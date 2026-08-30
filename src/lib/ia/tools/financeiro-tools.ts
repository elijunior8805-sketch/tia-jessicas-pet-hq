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
  const res = await consultarKPIsFinanceirosIA(sb, mesRef);

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
  const res = await consultarInadimplenciaIA(sb);

  return {
    success: res.success,
    source: "inadimplencia",
    data: res.data,
    total_count: Array.isArray(res.data) ? res.data.length : 0,
    executed_at: new Date().toISOString(),
    summary: `Valores pendentes e inadimplência identificados.`,
  };
}

export async function compararPeriodosFinanceirosJessi(
  sb: SupabaseClient<Database>,
  params: { mes1: string; mes2: string }
): Promise<JessiQueryResult> {
  const res = await compararPeriodosIA(sb, params.mes1, params.mes2);

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
    forma_pagamento: params.forma_pagamento,
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
  const res = await estornarPagamentoIA(sb, {
    pagamento_id: params.pagamento_id,
    motivo: params.motivo,
  });

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
