import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult } from "../contracts/jessi-v2-contracts";

/**
 * Adaptador Oficial de Financeiro & Relatórios da Jessi V2 (Seção 15)
 * Garante diferenciação estrita entre Faturamento, Recebidos, A Receber e Devedores
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export interface JessiV2ResumoFinanceiroDetalhado {
  periodo: "hoje" | "semana" | "mes" | "ano";
  faturamentoBruto: number;
  valoresRecebidos: number;
  valoresAReceber: number;
  valoresVencidosDevedores: number;
  despesas: number;
  saldoLiquido: number;
  ticketMedio: number;
  totalAtendimentosPagos: number;
  estornos: number;
  valorQuitadoPorCredito: number;
}

export class FinanceiroRelatoriosAdapter {
  /**
   * Consulta o resumo financeiro consolidado oficial diferenciando todas as categorias
   * Regra Absoluta: Pergunta sobre faturamento NUNCA retorna apenas devedores.
   */
  static async consultarResumoConsolidado(
    sb: SupabaseClient<Database>,
    periodo: "hoje" | "semana" | "mes" = "mes"
  ): Promise<JessiV2QueryResult<JessiV2ResumoFinanceiroDetalhado>> {
    const inicio = Date.now();
    const correlationId = `query_fin_${inicio}_${Math.random().toString(36).substring(2, 6)}`;
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
        const primeiroDiaMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        inicioPeriodo = primeiroDiaMes.toISOString();
      }

      const hojeDataStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(agora);

      // 1. Consulta transações financeiras confirmadas no período
      const { data: transacoes, error } = await sb
        .from("transacoes_financeiras")
        .select("id, tipo, valor, status, forma_pagamento, created_at")
        .gte("created_at", inicioPeriodo);

      if (error) throw error;

      let faturamentoBruto = 0;
      let valoresRecebidos = 0;
      let despesas = 0;
      let estornos = 0;
      let totalEntradasCount = 0;

      (transacoes || []).forEach((t: any) => {
        const valor = Number(t.valor) || 0;
        const ehConfirmado = t.status === "confirmado" || t.status === "pago";

        if (t.tipo === "receita" || t.tipo === "entrada") {
          faturamentoBruto += valor;
          if (ehConfirmado) {
            valoresRecebidos += valor;
            totalEntradasCount++;
          }
        } else if (t.tipo === "despesa" || t.tipo === "saida") {
          if (ehConfirmado) despesas += valor;
        } else if (t.tipo === "estorno") {
          estornos += valor;
        }
      });

      // 2. Consulta de valores pendentes e devedores (vencidos)
      const { data: pagamentosPendentes } = await sb
        .from("pagamentos")
        .select("id, valor_total, valor_pago, vencimento, status")
        .neq("status", "pago")
        .neq("status", "cancelado")
        .is("arquivado_em", null);

      let valoresAReceber = 0;
      let valoresVencidosDevedores = 0;

      (pagamentosPendentes || []).forEach((p: any) => {
        const pendente = Math.max((Number(p.valor_total) || 0) - (Number(p.valor_pago) || 0), 0);
        if (p.vencimento && p.vencimento < hojeDataStr) {
          valoresVencidosDevedores += pendente;
        } else {
          valoresAReceber += pendente;
        }
      });

      const ticketMedio = totalEntradasCount > 0 ? valoresRecebidos / totalEntradasCount : 0;
      const saldoLiquido = valoresRecebidos - despesas;

      const resultado: JessiV2ResumoFinanceiroDetalhado = {
        periodo,
        faturamentoBruto,
        valoresRecebidos,
        valoresAReceber,
        valoresVencidosDevedores,
        despesas,
        saldoLiquido,
        ticketMedio,
        totalAtendimentosPagos: totalEntradasCount,
        estornos,
        valorQuitadoPorCredito: 0,
      };

      const resumoFormatado =
        `Resumo Financeiro Consolidado (${periodo}):\n` +
        `• Faturamento: R$ ${faturamentoBruto.toFixed(2)} (Recebido: R$ ${valoresRecebidos.toFixed(2)})\n` +
        `• Ticket Médio: R$ ${ticketMedio.toFixed(2)} (${totalEntradasCount} atendimentos)\n` +
        `• A Receber: R$ ${valoresAReceber.toFixed(2)} | Vencidos/Devedores: R$ ${valoresVencidosDevedores.toFixed(2)}\n` +
        `• Saldo Líquido: R$ ${saldoLiquido.toFixed(2)}`;

      return {
        success: true,
        source: "financeiro_consolidado_oficial",
        data: resultado,
        total_count: transacoes?.length || 0,
        summary: resumoFormatado,
        filters_applied: { periodo, inicioPeriodo },
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "financeiro_consolidado",
        data: {
          periodo,
          faturamentoBruto: 0,
          valoresRecebidos: 0,
          valoresAReceber: 0,
          valoresVencidosDevedores: 0,
          despesas: 0,
          saldoLiquido: 0,
          ticketMedio: 0,
          totalAtendimentosPagos: 0,
          estornos: 0,
          valorQuitadoPorCredito: 0,
        },
        total_count: 0,
        summary: `Erro ao consolidar faturamento e recebíveis: ${err.message}`,
        error_code: err.code || "ERRO_FINANCEIRO_CONSOLIDADO",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }
}
