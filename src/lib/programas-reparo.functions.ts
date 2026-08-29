import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Diagnostica contratações incompletas para um cliente.
 * Verifica contratos, créditos e pagamentos, classificando problemas.
 */
export const diagnosticarContratacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({ cliente_id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // 1. Contratos do cliente
    const { data: contratos, error: cErr } = await sb
      .from("programas_contratados" as any)
      .select("*")
      .eq("cliente_id", data.cliente_id);
    if (cErr) throw cErr;

    // 2. Pagamentos de programa do cliente
    const { data: pagamentos, error: pErr } = await sb
      .from("pagamentos" as any)
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .eq("categoria_receita", "programa_cuidado")
      .is("arquivado_em", null);
    if (pErr) throw pErr;

    const diagnostico: any[] = [];
    const contratosDetalhados: any[] = [];
    const pagamentosOrfaos: any[] = [];
    const pagamentosVinculados = new Set<string>();

    // 3. Para cada contrato, verificar créditos e pagamento
    for (const contrato of (contratos ?? []) as any[]) {
      const { data: creditos } = await sb
        .from("programas_creditos_movimentacoes" as any)
        .select("id, servico_id, quantidade, tipo")
        .eq("programa_contratado_id", contrato.id);

      const { data: pagamentoContrato } = await sb
        .from("pagamentos" as any)
        .select("id, valor_total, valor_pago, status")
        .eq("idempotency_key", `programa_${contrato.id}`)
        .maybeSingle();

      if (pagamentoContrato) {
        pagamentosVinculados.add(pagamentoContrato.id);
      }

      const temCreditos = creditos && creditos.length > 0;
      const temPagamento = !!pagamentoContrato;

      let classificacao = "operacao_completa";
      if (!temPagamento) {
        classificacao = "contrato_sem_financeiro";
      } else if (!temCreditos) {
        classificacao = "contrato_sem_creditos";
      } else if (temPagamento && Number(pagamentoContrato.valor_total) !== Number(contrato.preco_vendido)) {
        classificacao = "saldo_divergente";
      }

      // Verificar se contrato está oculto por status incorreto
      if (contrato.status_do_programa === "cancelado" && temPagamento && pagamentoContrato.status !== "cancelado") {
        classificacao = "contrato_oculto";
      }

      diagnostico.push({
        tipo: classificacao,
        contrato_id: contrato.id,
        programa_nome: contrato.nome_snapshot,
        status_contrato: contrato.status_do_programa,
        preco_vendido: contrato.preco_vendido,
        pagamento_valor: temPagamento ? pagamentoContrato.valor_total : null,
        pagamento_status: temPagamento ? pagamentoContrato.status : null,
        creditos_count: creditos?.length ?? 0,
      });

      contratosDetalhados.push({
        ...contrato,
        creditos: creditos ?? [],
        pagamento: pagamentoContrato ?? null,
      });
    }

    // 4. Pagamentos órfãos (sem contrato correspondente)
    for (const pagamento of (pagamentos ?? []) as any[]) {
      if (!pagamentosVinculados.has(pagamento.id)) {
        pagamentosOrfaos.push(pagamento);
        diagnostico.push({
          tipo: "financeiro_sem_contrato",
          pagamento_id: pagamento.id,
          valor_total: pagamento.valor_total,
          status: pagamento.status,
          descricao: pagamento.descricao,
          created_at: pagamento.created_at,
          idempotency_key: pagamento.idempotency_key,
        });
      }
    }

    return {
      contratos: contratosDetalhados,
      pagamentos_orfaos: pagamentosOrfaos,
      diagnostico,
    };
  });

/**
 * Repara uma contratação incompleta.
 * Cria contrato ausente, vincula financeiro, cria créditos.
 */
export const repararContratacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({
      pagamento_id: z.string().uuid(),
      programa_id: z.string().uuid().optional(),
      confirmar: z.boolean(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    if (!data.confirmar) {
      throw new Error("É necessário confirmar para executar o reparo.");
    }

    // 1. Validar pagamento
    const { data: pagamento, error: pErr } = await sb
      .from("pagamentos" as any)
      .select("*")
      .eq("id", data.pagamento_id)
      .single();

    if (pErr || !pagamento) throw new Error("Pagamento não encontrado.");
    if (pagamento.categoria_receita !== "programa_cuidado") {
      throw new Error("O pagamento não pertence à categoria programa_cuidado.");
    }

    const situacao_anterior = {
      pagamento_id: pagamento.id,
      status: pagamento.status,
      valor_total: pagamento.valor_total,
      idempotency_key: pagamento.idempotency_key,
    };

    let contract_id: string | null = null;
    const creditos_ids: string[] = [];

    // 2. Verificar se contrato já existe
    if (pagamento.idempotency_key?.startsWith("programa_")) {
      const existingId = pagamento.idempotency_key.replace("programa_", "");
      const { data: existente } = await sb
        .from("programas_contratados" as any)
        .select("id, status_do_programa")
        .eq("id", existingId)
        .maybeSingle();

      if (existente) {
        contract_id = existente.id;
        // Verificar se precisa corrigir créditos
        const { data: creds } = await sb
          .from("programas_creditos_movimentacoes" as any)
          .select("id")
          .eq("programa_contratado_id", existente.id);

        if (!creds || creds.length === 0) {
          // Contrato existe mas sem créditos — criar
          const composicao = (existente as any).composicao_snapshot;
          if (Array.isArray(composicao)) {
            for (const item of composicao) {
              const { data: mov } = await sb
                .from("programas_creditos_movimentacoes" as any)
                .insert({
                  programa_contratado_id: contract_id,
                  servico_id: item.servico_id,
                  quantidade: item.quantidade,
                  tipo: "credito_criado",
                  usuario_id: userId,
                  motivo: "Reparo: créditos ausentes recriados",
                  idempotency_key: `reparo_${contract_id}_${item.servico_id}`,
                })
                .select("id")
                .single();
              if (mov) creditos_ids.push(mov.id);
            }
          }
        }

        return {
          reparado: true,
          contract_id,
          payment_id: pagamento.id,
          creditos_ids,
          situacao_anterior,
          situacao_posterior: { vinculo_existente: true },
        };
      }
    }

    // 3. Contrato não existe — criar se programa_id fornecido
    if (!data.programa_id) {
      // Marcar pagamento como contratação incompleta
      const obsAtual = pagamento.observacoes ?? "";
      const novaObs = obsAtual
        ? `${obsAtual}\n[contratacao_incompleta — aguardando revisão administrativa]`
        : "[contratacao_incompleta — aguardando revisão administrativa]";

      await sb
        .from("pagamentos" as any)
        .update({ observacoes: novaObs })
        .eq("id", pagamento.id);

      return {
        reparado: false,
        contract_id: null,
        payment_id: pagamento.id,
        creditos_ids: [],
        situacao_anterior,
        situacao_posterior: { marcado_incompleto: true },
      };
    }

    // Carregar template do programa
    const { data: programa, error: progErr } = await sb
      .from("programas_de_cuidado" as any)
      .select("*, itens:programas_de_cuidado_itens(*)")
      .eq("id", data.programa_id)
      .single();

    if (progErr || !programa) throw new Error("Programa template não encontrado.");

    const itens = ((programa as any).itens ?? []) as any[];
    const validadeDias = Number((programa as any).validade_em_dias ?? 30);
    const dataInicio = new Date(pagamento.created_at);
    const dataValidade = new Date(dataInicio);
    dataValidade.setDate(dataValidade.getDate() + validadeDias);

    const statusContrato =
      pagamento.status === "pago" ? "ativo" : "aguardando_pagamento";

    // Criar contrato
    const { data: novoContrato, error: cErr } = await sb
      .from("programas_contratados" as any)
      .insert({
        programa_id: data.programa_id,
        cliente_id: pagamento.cliente_id,
        pet_id: null, // será preenchido manualmente se necessário
        nome_snapshot: (programa as any).nome,
        composicao_snapshot: itens,
        regras_snapshot: (programa as any).regras,
        preco_original: (programa as any).preco_do_programa,
        preco_vendido: pagamento.valor_total,
        desconto: Number((programa as any).preco_do_programa) - Number(pagamento.valor_total),
        fracionado: false,
        data_de_inicio: dataInicio.toISOString().slice(0, 10),
        data_de_validade: dataValidade.toISOString().slice(0, 10),
        status_do_programa: statusContrato,
        forma_de_pagamento: pagamento.forma ?? "pendente",
        observacoes: "Reparo de contratação incompleta",
        idempotency_key: `reparo_${pagamento.id}`,
        criado_por: userId,
      })
      .select()
      .single();

    if (cErr) throw cErr;
    contract_id = (novoContrato as any).id;

    // Criar créditos
    for (const item of itens) {
      const { data: mov } = await sb
        .from("programas_creditos_movimentacoes" as any)
        .insert({
          programa_contratado_id: contract_id,
          servico_id: item.servico_id,
          quantidade: item.quantidade,
          tipo: "credito_criado",
          usuario_id: userId,
          motivo: "Reparo de contratação incompleta",
          idempotency_key: `reparo_${contract_id}_${item.servico_id}`,
        })
        .select("id")
        .single();
      if (mov) creditos_ids.push(mov.id);
    }

    // Vincular pagamento ao contrato
    await sb
      .from("pagamentos" as any)
      .update({ idempotency_key: `programa_${contract_id}` })
      .eq("id", pagamento.id);

    // Auditoria
    await sb.from("auditoria_programas" as any).insert({
      acao: "reparo_contratacao",
      cliente_id: pagamento.cliente_id,
      programa_contratado_id: contract_id,
      valor_posterior: { contract_id, payment_id: pagamento.id, creditos: creditos_ids },
      motivo: "Reparo de contratação incompleta — contrato e créditos recriados",
      usuario_id: userId,
    });

    // Read-back
    const { data: contratoFinal } = await sb
      .from("programas_contratados" as any)
      .select("id, status_do_programa, preco_vendido, nome_snapshot")
      .eq("id", contract_id)
      .single();

    const { data: creditosFinal } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .select("id, servico_id, quantidade, tipo")
      .eq("programa_contratado_id", contract_id);

    return {
      reparado: true,
      contract_id,
      payment_id: pagamento.id,
      creditos_ids,
      situacao_anterior,
      situacao_posterior: {
        contrato: contratoFinal,
        creditos: creditosFinal,
        status: statusContrato,
      },
    };
  });
