import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult } from "../contracts/jessi-v2-contracts";

/**
 * Adaptador Oficial de Financeiro & Relatórios para a Jessi V2 (Fonte Consolidada Oficial)
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export class FinanceiroRelatoriosAdapter {
  /**
   * Consulta o resumo financeiro consolidado oficial para um período
   */
  static async consultarResumoConsolidado(
    sb: SupabaseClient<Database>,
    periodo: "hoje" | "semana" | "mes" = "mes"
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    try {
      const agora = new Date();
      let inicioPeriodo: string;

      if (periodo === "hoje") {
        const hojeStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(agora);
        inicioPeriodo = `${hojeStr}T00:00:00.000Z`;
      } else if (periodo === "semana") {
        const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
        inicioPeriodo = seteDiasAtras.toISOString();
      } else {
        // Mês atual
        const primeiroDiaMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        inicioPeriodo = primeiroDiaMes.toISOString();
      }

      // Consulta à fonte oficial consolidada de transações
      const { data: transacoes, error } = await sb
        .from("transacoes_financeiras")
        .select("id, tipo, valor, status, forma_pagamento, created_at")
        .gte("created_at", inicioPeriodo)
        .eq("status", "confirmado");

      if (error) throw error;

      let faturamentoBruto = 0;
      let despesas = 0;
      let totalEntradasCount = 0;

      (transacoes || []).forEach((t: any) => {
        const valor = Number(t.valor) || 0;
        if (t.tipo === "receita" || t.tipo === "entrada") {
          faturamentoBruto += valor;
          totalEntradasCount++;
        } else if (t.tipo === "despesa" || t.tipo === "saida") {
          despesas += valor;
        }
      });

      const ticketMedio = totalEntradasCount > 0 ? faturamentoBruto / totalEntradasCount : 0;
      const saldoLiquido = faturamentoBruto - despesas;

      // Consulta de valores pendentes a receber
      const { data: pendentes } = await sb
        .from("transacoes_financeiras")
        .select("valor")
        .eq("status", "pendente");

      const totalAReceber = (pendentes || []).reduce((acc, curr: any) => acc + (Number(curr.valor) || 0), 0);

      const resultado = {
        periodo,
        faturamentoBruto,
        despesas,
        saldoLiquido,
        ticketMedio,
        totalAtendimentosPagos: totalEntradasCount,
        totalAReceberPendente: totalAReceber,
      };

      return {
        success: true,
        source: "transacoes_financeiras_consolidado",
        data: resultado,
        total_count: transacoes?.length || 0,
        summary: `Faturamento (${periodo}): R$ ${faturamentoBruto.toFixed(2)} | Ticket Médio: R$ ${ticketMedio.toFixed(2)} | Saldo Líquido: R$ ${saldoLiquido.toFixed(2)}.`,
        executed_at: new Date().toISOString(),
        correlation_id: `query_fin_${inicio}`,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "transacoes_financeiras",
        data: { faturamentoBruto: 0, despesas: 0, saldoLiquido: 0, ticketMedio: 0 },
        total_count: 0,
        summary: `Erro ao consultar base financeira consolidada: ${err.message}`,
        error_code: err.code || "ERRO_CONSULTA_FINANCEIRA",
        executed_at: new Date().toISOString(),
      };
    }
  }
}
