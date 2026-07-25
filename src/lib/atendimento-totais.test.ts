import { describe, it, expect } from "vitest";
import {
  calcTotalExecutado,
  calcTotalExecutadoRaw,
  sumTotalExecutado,
  breakdownTotalExecutado,
} from "./atendimento-totais";

describe("calcTotalExecutado (regra única de Total executado)", () => {
  it("soma valor_executado + taxa_leva_traz e subtrai desconto", () => {
    expect(calcTotalExecutado({ valor_executado: 600, taxa_leva_traz: 20, desconto: 0 })).toBe(620);
    expect(calcTotalExecutado({ valor_executado: 100, taxa_leva_traz: 30, desconto: 10 })).toBe(120);
  });

  it("trata null/undefined/strings como 0 e é resiliente a NaN", () => {
    expect(calcTotalExecutado(null)).toBe(0);
    expect(calcTotalExecutado(undefined)).toBe(0);
    expect(calcTotalExecutado({})).toBe(0);
    expect(calcTotalExecutado({ valor_executado: "150", taxa_leva_traz: "10", desconto: "5" })).toBe(155);
    expect(calcTotalExecutado({ valor_executado: "abc" as any })).toBe(0);
  });

  it("normaliza para nunca ser negativo", () => {
    expect(calcTotalExecutado({ valor_executado: 50, desconto: 200 })).toBe(0);
    expect(calcTotalExecutadoRaw({ valor_executado: 50, desconto: 200 })).toBe(-150);
  });

  it("sumTotalExecutado soma vários atendimentos", () => {
    const rows = [
      { valor_executado: 100, taxa_leva_traz: 20, desconto: 0 }, // 120
      { valor_executado: 200, taxa_leva_traz: 0, desconto: 50 }, // 150
      null,
      { valor_executado: 80 }, // 80
    ];
    expect(sumTotalExecutado(rows)).toBe(350);
  });

  it("breakdownTotalExecutado devolve serviços, taxa, desconto e total", () => {
    const rows = [
      { valor_executado: 300, taxa_leva_traz: 20, desconto: 10 },
      { valor_executado: 200, taxa_leva_traz: 0, desconto: 0 },
      { valor_executado: 120, taxa_leva_traz: 20, desconto: 40 },
    ];
    expect(breakdownTotalExecutado(rows)).toEqual({
      totalServicos: 620,
      totalTaxa: 40,
      totalDesconto: 50,
      totalExecutado: 610,
    });
  });
});

// ---------------------------------------------------------------------------
// Consistência entre telas: cada tela lê os mesmos campos do atendimento
// (valor_executado, taxa_leva_traz, desconto) e precisa produzir o MESMO
// número final. Aqui reproduzimos os cálculos usados por cada tela relacionada
// e conferimos que todos convergem para calcTotalExecutado / sumTotalExecutado.
// ---------------------------------------------------------------------------

// Reducer usado em src/routes/_authenticated/pets.$petId.historico.tsx
function historicoReducer(rows: any[]) {
  const totalServicos = rows.reduce((s, a) => s + Number(a.valor_executado ?? 0), 0);
  const totalTaxa = rows.reduce((s, a) => s + Number(a.taxa_leva_traz ?? 0), 0);
  const totalDesconto = rows.reduce((s, a) => s + Number(a.desconto ?? 0), 0);
  const totalExecutado = totalServicos + totalTaxa - totalDesconto;
  return { totalServicos, totalTaxa, totalDesconto, totalExecutado };
}

// Reducer usado em src/routes/_authenticated/financeiro.tsx (faturamento realizado)
function financeiroReducer(rows: any[]) {
  return rows.reduce((s, r) => {
    const exec = Number(r.valor_executado ?? 0);
    if (!(exec > 0 && !!r.encerrado_em && r.finalizado === true)) return s;
    return s + Math.max(0, exec + Number(r.taxa_leva_traz ?? 0) - Number(r.desconto ?? 0));
  }, 0);
}

// Cálculo usado em clientes.index / clientes.$id.index (saldo dinâmico)
function clienteSaldoDinamico(a: any) {
  return a?.finalizado
    ? Math.max(Number(a.valor_executado || 0) + Number(a.taxa_leva_traz || 0) - Number(a.desconto || 0), 0)
    : 0;
}

describe("Consistência do Total executado entre telas", () => {
  const atendimentos = [
    { valor_executado: 600, taxa_leva_traz: 20, desconto: 0, finalizado: true, encerrado_em: "2026-01-10T12:00:00Z" },
    { valor_executado: 200, taxa_leva_traz: 0, desconto: 50, finalizado: true, encerrado_em: "2026-01-11T12:00:00Z" },
    { valor_executado: 120, taxa_leva_traz: 20, desconto: 40, finalizado: true, encerrado_em: "2026-01-12T12:00:00Z" },
  ];

  it("histórico do pet == helper compartilhado", () => {
    const hist = historicoReducer(atendimentos);
    const shared = breakdownTotalExecutado(atendimentos);
    expect(hist).toEqual(shared);
  });

  it("financeiro (realizado) == soma via helper compartilhado", () => {
    expect(financeiroReducer(atendimentos)).toBe(sumTotalExecutado(atendimentos));
  });

  it("saldo dinâmico do cliente (por atendimento) == helper", () => {
    for (const a of atendimentos) {
      expect(clienteSaldoDinamico(a)).toBe(calcTotalExecutado(a));
    }
  });

  it("atendimento não finalizado não entra no faturamento, mas helper ainda calcula bruto", () => {
    const aberto = { valor_executado: 300, taxa_leva_traz: 10, desconto: 0, finalizado: false, encerrado_em: null };
    expect(financeiroReducer([aberto])).toBe(0);
    expect(calcTotalExecutado(aberto)).toBe(310);
  });

  it("desconto maior que serviço + taxa nunca gera valor negativo", () => {
    const a = { valor_executado: 100, taxa_leva_traz: 10, desconto: 500, finalizado: true, encerrado_em: "x" };
    expect(financeiroReducer([a])).toBe(0);
    expect(calcTotalExecutado(a)).toBe(0);
    expect(clienteSaldoDinamico(a)).toBe(0);
  });
});
