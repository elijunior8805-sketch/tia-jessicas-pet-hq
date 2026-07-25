/**
 * Regras centralizadas de "Total executado" de um atendimento.
 *
 * Fórmula única, usada por todas as telas (Histórico do pet, Financeiro,
 * Dashboard, Clientes, Fichas, PDFs) para evitar divergências:
 *
 *   total = max(0, valor_executado + taxa_leva_traz - desconto)
 *
 * Observações:
 * - valores nulos/indefinidos são tratados como 0
 * - o `clamp` (max 0) evita totais negativos quando o desconto é maior que
 *   o serviço + taxa; alguns cálculos históricos usavam o valor "cru"
 *   (sem clamp) — expomos as duas formas.
 */

export type AtendimentoTotais = {
  valor_executado?: number | string | null;
  taxa_leva_traz?: number | string | null;
  desconto?: number | string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Total executado bruto (pode ser negativo se desconto > serviço + taxa). */
export function calcTotalExecutadoRaw(a: AtendimentoTotais | null | undefined): number {
  if (!a) return 0;
  return num(a.valor_executado) + num(a.taxa_leva_traz) - num(a.desconto);
}

/** Total executado normalizado (nunca negativo). Use sempre que possível. */
export function calcTotalExecutado(a: AtendimentoTotais | null | undefined): number {
  return Math.max(0, calcTotalExecutadoRaw(a));
}

/** Soma o total executado de uma lista de atendimentos. */
export function sumTotalExecutado(rows: Array<AtendimentoTotais | null | undefined>): number {
  return (rows ?? []).reduce<number>((s, a) => s + calcTotalExecutado(a), 0);
}

/** Quebra do total: serviços, taxa, desconto e total final normalizado. */
export function breakdownTotalExecutado(rows: Array<AtendimentoTotais | null | undefined>) {
  const totalServicos = rows.reduce((s, a) => s + num(a?.valor_executado), 0);
  const totalTaxa = rows.reduce((s, a) => s + num(a?.taxa_leva_traz), 0);
  const totalDesconto = rows.reduce((s, a) => s + num(a?.desconto), 0);
  const totalExecutado = totalServicos + totalTaxa - totalDesconto;
  return { totalServicos, totalTaxa, totalDesconto, totalExecutado };
}
