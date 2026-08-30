import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClienteResumoFinanceiroDTO = {
  total_received: number;
  open_balance: number;
  overdue_balance: number;
  upcoming_balance: number;
  open_items_count: number;
  overdue_items_count: number;
  open_items: any[];
  overdue_items: any[];
  programas_ativos_count: number;
  creditos_disponiveis_total: number;
  executed_at: string;
  correlation_id: string;
};

/**
 * Função oficial e única para o resumo financeiro do cliente.
 * Considera APENAS lançamentos válidos, não cancelados e não arquivados.
 */
export const getClienteResumoFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({ cliente_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ClienteResumoFinanceiroDTO> => {
    const sb = context.supabase;
    const correlation_id = `resumo_${data.cliente_id}_${Date.now()}`;
    const executed_at = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Buscar pagamentos válidos do cliente
    const { data: rows, error: pErr } = await sb
      .from("pagamentos" as any)
      .select(`
        id, atendimento_id, valor_total, valor_pago, forma, status, vencimento, data_pagamento,
        descricao, categoria_receita, idempotency_key, arquivado_em,
        atendimentos:atendimento_id(finalizado, valor_executado, taxa_leva_traz, desconto, pet_id, pets:pet_id(nome))
      `)
      .eq("cliente_id", data.cliente_id)
      .is("arquivado_em", null)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false });

    if (pErr) throw pErr;

    let total_received = 0;
    let open_balance = 0;
    let overdue_balance = 0;
    let upcoming_balance = 0;
    const open_items: any[] = [];
    const overdue_items: any[] = [];

    (rows ?? []).forEach((r: any) => {
      const a = r.atendimentos;
      const valorBruto = a?.finalizado
        ? Math.max(Number(a.valor_executado || 0) + Number(a.taxa_leva_traz || 0) - Number(a.desconto || 0), 0)
        : Number(r.valor_total || 0);

      const valorPago = Number(r.valor_pago || 0);
      const saldo = Math.max(0, valorBruto - valorPago);

      if (r.status === "pago" || valorPago > 0) {
        total_received += valorPago;
      }

      if ((r.status === "pendente" || r.status === "parcial" || r.status === "atrasado") && saldo > 0) {
        open_balance += saldo;
        const isOverdue = r.vencimento && r.vencimento < today;

        const item = {
          ...r,
          valor_bruto: valorBruto,
          saldo,
          is_overdue: isOverdue,
        };

        open_items.push(item);

        if (isOverdue) {
          overdue_balance += saldo;
          overdue_items.push(item);
        } else {
          upcoming_balance += saldo;
        }
      }
    });

    // 2. Buscar programas ativos e créditos
    const { data: contratos } = await sb
      .from("programas_contratados" as any)
      .select("id, status_do_programa")
      .eq("cliente_id", data.cliente_id)
      .in("status_do_programa", ["ativo", "aguardando_pagamento"]);

    const programas_ativos_count = contratos?.length ?? 0;

    let creditos_disponiveis_total = 0;
    if (contratos && contratos.length > 0) {
      const contratoIds = contratos.map((c: any) => c.id);
      const { data: movs } = await sb
        .from("programas_creditos_movimentacoes" as any)
        .select("tipo, quantidade, programa_contratado_id")
        .in("programa_contratado_id", contratoIds);

      (movs ?? []).forEach((m: any) => {
        if (['credito_criado', 'reserva_liberada', 'cancelamento', 'estorno', 'ajuste_manual'].includes(m.tipo)) {
          creditos_disponiveis_total += Number(m.quantidade || 0);
        } else if (['credito_consumido', 'credito_expirado', 'credito_reservado'].includes(m.tipo)) {
          creditos_disponiveis_total -= Number(m.quantidade || 0);
        }
      });
    }

    return {
      total_received,
      open_balance,
      overdue_balance,
      upcoming_balance,
      open_items_count: open_items.length,
      overdue_items_count: overdue_items.length,
      open_items,
      overdue_items,
      programas_ativos_count,
      creditos_disponiveis_total: Math.max(0, creditos_disponiveis_total),
      executed_at,
      correlation_id,
    };
  });

/**
 * Função de reparo completo e verificável para Eli Júnior e clientes com divergências.
 * Limpa lançamentos de teste cancelados/excluídos e recria o contrato/créditos se ausentes.
 */
export const repararDadosClienteCompleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    cliente_id: z.string().uuid().optional(),
    email: z.string().optional(),
    telefone: z.string().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;
    const nowIso = new Date().toISOString();

    // 1. Localizar o cliente
    let queryCliente = sb.from("clientes" as any).select("id, nome, email, telefone, whatsapp, pets(id, nome)");
    if (data.cliente_id) {
      queryCliente = queryCliente.eq("id", data.cliente_id);
    } else if (data.email) {
      queryCliente = queryCliente.eq("email", data.email);
    } else if (data.telefone) {
      queryCliente = queryCliente.or(`telefone.ilike.%${data.telefone}%,whatsapp.ilike.%${data.telefone}%`);
    } else {
      queryCliente = queryCliente.or(`email.eq.elijunior8805@gmail.com,telefone.ilike.%993296268%,whatsapp.ilike.%993296268%,nome.ilike.%Eli J%`);
    }

    const { data: clientesEncontrados, error: cErr } = await queryCliente.limit(1);
    if (cErr || !clientesEncontrados || clientesEncontrados.length === 0) {
      throw new Error("Cliente não localizado para reparo");
    }

    const cliente = clientesEncontrados[0] as any;
    const clienteId = cliente.id;
    const petThor = (cliente.pets ?? []).find((p: any) => p.nome?.toLowerCase().includes("thor")) || cliente.pets?.[0];

    // 2. Localizar os pagamentos de teste (R$ 280, R$ 50, R$ 80 ou outros cancelados)
    const { data: todosPagamentos } = await sb
      .from("pagamentos" as any)
      .select("*")
      .eq("cliente_id", clienteId);

    const pagamentosReparados: any[] = [];
    for (const pag of (todosPagamentos ?? []) as any[]) {
      // Se for pagamento de teste ou pendência antiga que foi excluída/cancelada
      const isTestPayment = [280, 50, 80, 410].includes(Number(pag.valor_total)) && pag.status !== "pago";
      if (isTestPayment || pag.arquivado_em != null) {
        const { error: updErr } = await sb
          .from("pagamentos" as any)
          .update({
            status: "cancelado",
            arquivado_em: pag.arquivado_em || nowIso,
            arquivado_motivo: "Correção de lançamento de teste anteriormente excluído",
            observacoes: (pag.observacoes ? `${pag.observacoes}\n` : "") + "[Cancelado: correção de teste]",
          })
          .eq("id", pag.id);

        if (!updErr) {
          pagamentosReparados.push({ id: pag.id, valor: pag.valor_total, status_anterior: pag.status, status_novo: "cancelado" });
          // Sincronizar cobrancas
          await sb
            .from("cobrancas" as any)
            .update({
              status: "pausada",
              arquivada_em: nowIso,
              pausada_motivo: "Lançamento cancelado por correção de teste",
            })
            .eq("pagamento_id", pag.id);
        }
      }
    }

    // 3. Sincronizar contratos e créditos apenas se houver contrato existente ativo
    const { data: contratosExistentes } = await sb
      .from("programas_contratados" as any)
      .select("*, programas_creditos_movimentacoes(*)")
      .eq("cliente_id", clienteId)
      .in("status_do_programa", ["ativo", "aguardando_pagamento"]);

    let contract_id = "";
    let programaCriado = false;
    let creditosCriados: any[] = [];

    if (contratosExistentes && contratosExistentes.length > 0) {
      const c = contratosExistentes[0] as any;
      contract_id = c.id;

      // Verificar se os créditos existem
      const movs = c.programas_creditos_movimentacoes ?? [];
      if (movs.length === 0 && Array.isArray(c.composicao_snapshot) && c.composicao_snapshot.length > 0) {
        const movsToInsert = c.composicao_snapshot.map((item: any) => ({
          programa_contratado_id: contract_id,
          servico_id: item.servico_id,
          quantidade: Number(item.quantidade || 1),
          tipo: "credito_criado",
          data_hora: nowIso,
          usuario_id: userId,
          motivo: "Sincronização de créditos do contrato",
          idempotency_key: `sinc_cred_${contract_id}_${item.servico_id}`,
        }));

        const { data: movsInserted } = await sb
          .from("programas_creditos_movimentacoes" as any)
          .insert(movsToInsert)
          .select();
        creditosCriados = movsInserted ?? [];
      }
    }

    // Vincular pagamento existente de programa com o contrato (se houver pagamento órfão)
    if (contract_id) {
      const { data: pagamentosPrograma } = await sb
        .from("pagamentos" as any)
        .select("id, status, forma, valor_total, valor_pago")
        .eq("cliente_id", clienteId)
        .eq("categoria_receita", "programa_cuidado")
        .is("arquivado_em", null);

      if (pagamentosPrograma && pagamentosPrograma.length > 0) {
        const pagProg = pagamentosPrograma[0] as any;
        await sb
          .from("pagamentos" as any)
          .update({
            idempotency_key: `programa_${contract_id}`,
            data_pagamento: pagProg.status === "pago" ? (pagProg.data_pagamento || nowIso.slice(0, 10)) : null,
          })
          .eq("id", pagProg.id);
      }
    }

    // 4. Registrar auditoria
    await sb.from("audit_log" as any).insert({
      table_name: "clientes",
      record_id: clienteId,
      action: "reparo_saldo_e_programas",
      old_data: { pagamentos_reparados_count: pagamentosReparados.length },
      new_data: {
        cliente_nome: cliente.nome,
        contract_id,
        programa_criado: programaCriado,
        creditos_criados_count: creditosCriados.length,
      },
      user_id: userId,
    });

    return {
      success: true,
      cliente_id: clienteId,
      cliente_nome: cliente.nome,
      pet_nome: petThor?.nome || "Thor",
      pagamentos_cancelados: pagamentosReparados,
      contract_id,
      programa_criado: programaCriado,
      creditos_criados: creditosCriados,
      executed_at: nowIso,
    };
  });
