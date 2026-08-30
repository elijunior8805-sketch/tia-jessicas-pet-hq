import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Detalhe completo de um pacote comprado: contrato, itens, saldos, movimentos e pagamento. */
export const getContratoDetalhe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({ contrato_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { carregarContrato } = await import("./programas-contratos.server");
    return await carregarContrato(context.supabase as any, data.contrato_id);
  });

/** Edita a composição e/ou o valor de um pacote já vendido, respeitando o que já foi usado. */
export const atualizarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    contrato_id: z.string().uuid(),
    preco_vendido: z.number().min(0).optional(),
    data_de_validade: z.string().optional(),
    observacoes: z.string().optional().nullable(),
    motivo: z.string().min(3, "Informe o motivo da alteração"),
    itens: z.array(z.object({
      servico_id: z.string().uuid(),
      quantidade: z.number().int().min(0),
    })).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = context.userId;
    const { carregarContrato, validarNovaComposicao } = await import("./programas-contratos.server");

    const antes = await carregarContrato(sb, data.contrato_id);
    const contrato: any = antes.contrato;

    if (contrato.status_do_programa === "cancelado") {
      throw new Error("Pacote cancelado não pode ser editado.");
    }

    let composicao = contrato.composicao_snapshot ?? [];

    if (data.itens) {
      const erros = validarNovaComposicao(
        antes.itens.map((i) => ({ servico_id: i.servico_id, nome: i.nome, saldo: i.saldo })),
        data.itens
      );
      if (erros.length) throw new Error(erros.join(" "));

      const refDe = (sid: string) =>
        antes.itens.find((i) => i.servico_id === sid)?.valor_unitario_de_referencia ??
        Number((antes.servicos as any[]).find((s) => s.id === sid)?.valor ?? 0);

      composicao = data.itens
        .filter((i) => i.quantidade > 0)
        .map((i) => ({
          servico_id: i.servico_id,
          quantidade: i.quantidade,
          valor_unitario_de_referencia: refDe(i.servico_id),
          valor_alocado: refDe(i.servico_id) * i.quantidade,
        }));

      // Ajusta os créditos por diferença, sem apagar histórico
      for (const novo of composicao) {
        const atual = antes.saldos[novo.servico_id];
        const criadoAtual = atual ? atual.criado : 0;
        const delta = novo.quantidade - criadoAtual;
        if (delta === 0) continue;
        const { error } = await sb.from("programas_creditos_movimentacoes").insert({
          programa_contratado_id: data.contrato_id,
          servico_id: novo.servico_id,
          quantidade: Math.abs(delta),
          tipo: delta > 0 ? "ajuste_manual" : "cancelamento",
          usuario_id: userId,
          motivo: data.motivo,
        });
        if (error) throw error;
      }
      // Serviços removidos por completo
      for (const item of antes.itens) {
        if (composicao.some((c: any) => c.servico_id === item.servico_id)) continue;
        const restante = item.saldo.criado;
        if (restante <= 0) continue;
        const { error } = await sb.from("programas_creditos_movimentacoes").insert({
          programa_contratado_id: data.contrato_id,
          servico_id: item.servico_id,
          quantidade: restante,
          tipo: "cancelamento",
          usuario_id: userId,
          motivo: data.motivo,
        });
        if (error) throw error;
      }
    }

    const patch: any = {
      composicao_snapshot: composicao,
      atualizado_em: new Date().toISOString(),
    };
    if (data.preco_vendido !== undefined) {
      patch.preco_vendido = data.preco_vendido;
      patch.desconto = Number(contrato.preco_original ?? 0) - data.preco_vendido;
    }
    if (data.data_de_validade) patch.data_de_validade = data.data_de_validade;
    if (data.observacoes !== undefined) patch.observacoes = data.observacoes;

    const { error: uErr } = await sb
      .from("programas_contratados")
      .update(patch)
      .eq("id", data.contrato_id);
    if (uErr) throw uErr;

    // Mantém o financeiro coerente com o novo valor
    if (data.preco_vendido !== undefined) {
      await sb
        .from("pagamentos")
        .update({ valor_total: data.preco_vendido })
        .eq("idempotency_key", `programa_${data.contrato_id}`);
    }

    await sb.from("auditoria_programas").insert({
      acao: "editar_contrato",
      cliente_id: contrato.cliente_id,
      pet_id: contrato.pet_id,
      programa_contratado_id: data.contrato_id,
      valor_anterior: { composicao: contrato.composicao_snapshot, preco_vendido: contrato.preco_vendido },
      valor_posterior: patch,
      motivo: data.motivo,
      usuario_id: userId,
    });

    return await carregarContrato(sb, data.contrato_id);
  });

/** Cancela um pacote comprado preservando todo o histórico e estornando efeitos financeiros/operacionais. */
export const cancelarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    contrato_id: z.string().uuid(),
    motivo: z.string().min(3, "Informe o motivo do cancelamento"),
    estornar_financeiro: z.boolean().default(true),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = context.userId;
    const nowIso = new Date().toISOString();
    const { carregarContrato } = await import("./programas-contratos.server");

    const antes = await carregarContrato(sb, data.contrato_id);
    const contrato: any = antes.contrato;

    if (contrato.status_do_programa === "cancelado") {
      return { ja_cancelado: true, contrato_id: data.contrato_id };
    }

    const consumidos = Object.values(antes.saldos).reduce((acc, s: any) => acc + s.consumido, 0);
    const cancelamentosCreditos: any[] = [];

    // 1. Zera créditos disponíveis e libera reservas (histórico preservado no livro razão)
    for (const s of Object.values(antes.saldos) as any[]) {
      if (s.reservado > 0) {
        // Libera reservas existentes
        await sb.from("programas_creditos_movimentacoes").insert({
          programa_contratado_id: data.contrato_id,
          servico_id: s.servico_id,
          quantidade: s.reservado,
          tipo: "reserva_liberada",
          data_hora: nowIso,
          usuario_id: userId,
          motivo: `Liberação por cancelamento de contrato: ${data.motivo}`,
          idempotency_key: `canc_lib_res_${data.contrato_id}_${s.servico_id}_${Date.now()}`,
        });
      }

      const restante = s.criado - s.consumido;
      if (restante > 0) {
        const { data: movCanc } = await sb.from("programas_creditos_movimentacoes").insert({
          programa_contratado_id: data.contrato_id,
          servico_id: s.servico_id,
          quantidade: restante,
          tipo: "cancelamento",
          data_hora: nowIso,
          usuario_id: userId,
          motivo: data.motivo,
          idempotency_key: `canc_cred_${data.contrato_id}_${s.servico_id}_${Date.now()}`,
        }).select();
        if (movCanc) cancelamentosCreditos.push(...movCanc);
      }
    }

    // 2. Atualiza status do contrato para cancelado
    const { error: uErr } = await sb
      .from("programas_contratados")
      .update({
        status_do_programa: "cancelado",
        cancelado_em: nowIso,
        cancelado_por: userId,
        motivo_cancelamento: data.motivo,
        atualizado_em: nowIso,
      })
      .eq("id", data.contrato_id);
    if (uErr) throw uErr;

    // 3. Estorno e cancelamento no financeiro
    let pagamentoEstornado = null;
    const { data: pagamentoContrato } = await sb
      .from("pagamentos")
      .select("*")
      .eq("idempotency_key", `programa_${data.contrato_id}`)
      .is("arquivado_em", null)
      .maybeSingle();

    const pagamentoAlvo = pagamentoContrato || antes.pagamento;
    if (pagamentoAlvo) {
      const { data: pagUpd, error: pErr } = await sb
        .from("pagamentos")
        .update({
          status: "cancelado",
          valor_pago: 0,
          arquivado_em: nowIso,
          arquivado_motivo: `Cancelamento de venda do programa: ${data.motivo}`,
          observacoes: (pagamentoAlvo.observacoes ? `${pagamentoAlvo.observacoes}\n` : "") + `[Estorno/Cancelamento de Venda: ${data.motivo} em ${nowIso}]`,
        })
        .eq("id", (pagamentoAlvo as any).id)
        .select()
        .single();

      if (!pErr && pagUpd) {
        pagamentoEstornado = pagUpd;
      }
    }

    // 4. Registro na Auditoria de Programas
    await sb.from("auditoria_programas").insert({
      acao: "cancelar_venda",
      cliente_id: contrato.cliente_id,
      pet_id: contrato.pet_id,
      programa_contratado_id: data.contrato_id,
      valor_anterior: {
        status: contrato.status_do_programa,
        preco_vendido: contrato.preco_vendido,
        pagamento: pagamentoAlvo,
      },
      valor_posterior: {
        status: "cancelado",
        creditos_consumidos: consumidos,
        creditos_cancelados_count: cancelamentosCreditos.length,
        pagamento_estornado: pagamentoEstornado?.id,
      },
      motivo: data.motivo,
      usuario_id: userId,
      created_at: nowIso,
    });

    // 5. Read-back obrigatório
    const depois = await carregarContrato(sb, data.contrato_id);

    return {
      success: true,
      cancelado: true,
      contrato_id: data.contrato_id,
      creditos_consumidos: consumidos,
      pagamento_estornado: pagamentoEstornado?.id ?? null,
      contrato_depois: depois.contrato,
      saldos_finais: depois.saldos,
    };
  });
