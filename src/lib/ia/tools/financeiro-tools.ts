import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult, JessiMutationResult } from "../jessi-contracts";
import { consultarKPIsFinanceirosIA, consultarInadimplenciaIA, compararPeriodosIA } from "../ia-financeiro.server";
import { registrarPagamentoIA, estornarPagamentoIA } from "../ia-acoes.server";
import { validarGravacaoReal } from "../jessi-guardrails";

/**
 * Adaptadores Financeiros para a Jessi
 */

export async function consultarKPIsFinanceirosJessi(
  sb: SupabaseClient<Database>,
  params: { mes?: string }
): Promise<JessiQueryResult> {
  const mesRef = params.mes || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const res = await consultarKPIsFinanceirosIA(sb, {
    from: `${mesRef}-01`,
    to: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(Number(mesRef.slice(0, 4)), Number(mesRef.slice(5, 7)), 0)
    ),
  });

  return {
    success: res.success,
    source: "financeiro_kpis",
    data: res.data,
    filters_applied: { mes: mesRef },
    executed_at: new Date().toISOString(),
    summary: `Indicadores financeiros consolidados para o mês de ${mesRef}.`,
  };
}

export async function consultarInadimplenciaJessi(
  sb: SupabaseClient<Database>
): Promise<JessiQueryResult> {
  const res = await consultarInadimplenciaIA(sb, {});
  const registros: any[] = res.data?.registros || [];
  const totalRegistros = registros.length;

  let totalValorAtraso = 0;
  registros.forEach((r) => {
    totalValorAtraso += Number(r.valor_total || 0) - Number(r.valor_pago || 0);
  });

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let resumoTexto = "";
  if (totalRegistros === 0) {
    resumoTexto = "Parabéns! Não encontrei nenhum valor em atraso ou pendência financeira no momento.";
  } else {
    const topDevedores = registros.slice(0, 5).map((r) => {
      const nome = r.clientes?.nome || "Cliente";
      const saldo = Number(r.valor_total || 0) - Number(r.valor_pago || 0);
      const desc = r.descricao ? ` (${r.descricao})` : "";
      return `• ${nome}: ${brl(saldo)}${desc}`;
    }).join("\n");

    resumoTexto = `Temos ${totalRegistros} lançamento(s) pendente(s), totalizando ${brl(totalValorAtraso)}.\n\nPrincipais pendências:\n${topDevedores}`;
  }

  return {
    success: res.success,
    source: "inadimplencia",
    data: res.data,
    total_count: totalRegistros,
    executed_at: new Date().toISOString(),
    summary: resumoTexto,
  };
}

export async function compararPeriodosFinanceirosJessi(
  sb: SupabaseClient<Database>,
  params: { mes1: string; mes2: string }
): Promise<JessiQueryResult> {
  const periodo = (mes: string) => ({
    from: `${mes}-01`,
    to: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)
    ),
  });
  const res = await compararPeriodosIA(sb, { p1: periodo(params.mes1), p2: periodo(params.mes2) });

  return {
    success: res.success,
    source: "comparacao_financeira",
    data: res.data,
    filters_applied: params,
    executed_at: new Date().toISOString(),
    summary: `Comparação financeira entre ${params.mes1} e ${params.mes2}.`,
  };
}

export async function registrarBaixaPagamentoJessi(
  sb: SupabaseClient<Database>,
  params: {
    pagamento_id: string;
    valor_pago: number;
    forma_pagamento: string;
    observacoes?: string;
  }
): Promise<JessiMutationResult> {
  const res = await registrarPagamentoIA(sb, {
    pagamento_id: params.pagamento_id,
    valor_pago: params.valor_pago,
    forma: params.forma_pagamento as any,
    observacoes: params.observacoes,
  });

  const validacao = await validarGravacaoReal(sb, "pagamentos", params.pagamento_id, "id, status, valor_pago");

  return {
    success: res.success,
    source: "baixa_pagamento",
    affected_record_id: params.pagamento_id,
    after: validacao.dados,
    verified: validacao.verificado,
    executed_at: new Date().toISOString(),
    summary: `Baixa de pagamento de R$ ${params.valor_pago.toFixed(2)} registrada com sucesso via ${params.forma_pagamento}.`,
  };
}

export async function estornarPagamentoJessi(
  sb: SupabaseClient<Database>,
  params: { pagamento_id: string; motivo: string }
): Promise<JessiMutationResult> {
  const res = await estornarPagamentoIA(sb, params.pagamento_id, params.motivo);

  return {
    success: res.success,
    source: "estorno_pagamento",
    affected_record_id: params.pagamento_id,
    after: res.data,
    verified: true,
    executed_at: new Date().toISOString(),
    summary: `Estorno de pagamento realizado com sucesso.`,
  };
}
