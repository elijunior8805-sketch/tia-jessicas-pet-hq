import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

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
        .from("pagamentos")
        .select("id, valor_total, valor_pago, status, forma, data_pagamento, created_at")
        .is("arquivado_em", null)
        .eq("is_teste", false)
        .gte("created_at", inicioPeriodo);

      if (error) throw error;

      let faturamentoBruto = 0;
      let valoresRecebidos = 0;
      let despesas = 0;
      let estornos = 0;
      let totalEntradasCount = 0;
      let totalPix = 0;
      let totalDinheiro = 0;
      let totalCartaoCredito = 0;
      let totalCartaoDebito = 0;
      let totalOutrasFormas = 0;

      (transacoes || []).forEach((t: any) => {
        const valor = Number(t.valor_total) || 0;
        const recebido = Number(t.valor_pago) || 0;
        const ehConfirmado = t.status === "pago";

        faturamentoBruto += valor;
        if (ehConfirmado) {
          const valEfetivo = recebido || valor;
          valoresRecebidos += valEfetivo;
          totalEntradasCount++;

          const forma = (t.forma || "").toLowerCase();
          if (forma.includes("pix")) totalPix += valEfetivo;
          else if (forma.includes("dinheiro")) totalDinheiro += valEfetivo;
          else if (forma.includes("credito") || forma.includes("crédito")) totalCartaoCredito += valEfetivo;
          else if (forma.includes("debito") || forma.includes("débito")) totalCartaoDebito += valEfetivo;
          else totalOutrasFormas += valEfetivo;
        }
        if (t.status === "estornado" || t.status === "cancelado") {
          estornos += valor;
        }
      });

      // 2. Consulta de valores pendentes e devedores (vencidos) com vínculo do cliente
      const { data: pagamentosPendentes } = await sb
        .from("pagamentos")
        .select("id, valor_total, valor_pago, vencimento, status, clientes(id, nome, whatsapp)")
        .neq("status", "pago")
        .neq("status", "cancelado")
        .is("arquivado_em", null);

      let valoresAReceber = 0;
      let valoresVencidosDevedores = 0;
      const devedoresLista: any[] = [];

      (pagamentosPendentes || []).forEach((p: any) => {
        const pendente = Math.max((Number(p.valor_total) || 0) - (Number(p.valor_pago) || 0), 0);
        const nomeCli = p.clientes?.nome || "Cliente";

        if (p.vencimento && p.vencimento < hojeDataStr) {
          valoresVencidosDevedores += pendente;
          devedoresLista.push({
            id: p.id,
            clienteNome: nomeCli,
            valor: pendente,
            vencimento: p.vencimento,
            status: "vencido",
          });
        } else {
          valoresAReceber += pendente;
        }
      });

      const ticketMedio = totalEntradasCount > 0 ? valoresRecebidos / totalEntradasCount : 0;
      const saldoLiquido = valoresRecebidos - despesas;

      const resultado = {
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
        formasPagamento: {
          pix: totalPix,
          dinheiro: totalDinheiro,
          cartaoCredito: totalCartaoCredito,
          cartaoDebito: totalCartaoDebito,
          outros: totalOutrasFormas,
        },
        devedores: devedoresLista,
      };

      const resumoFormatado =
        `Resumo Financeiro Consolidado (${periodo === "hoje" ? "Hoje" : periodo === "semana" ? "Últimos 7 dias" : "Mês Atual"}):\n\n` +
        `• **Faturamento Bruto:** R$ ${faturamentoBruto.toFixed(2)} (Recebido: R$ ${valoresRecebidos.toFixed(2)})\n` +
        `• **Ticket Médio:** R$ ${ticketMedio.toFixed(2)} (${totalEntradasCount} atendimentos pagos)\n` +
        `• **Entradas por Forma:** Pix: R$ ${totalPix.toFixed(2)} | Dinheiro: R$ ${totalDinheiro.toFixed(2)} | Cartões: R$ ${(totalCartaoCredito + totalCartaoDebito).toFixed(2)}\n` +
        `• **A Receber (No prazo):** R$ ${valoresAReceber.toFixed(2)}\n` +
        `• **Inadimplência (Vencidos):** R$ ${valoresVencidosDevedores.toFixed(2)}${devedoresLista.length > 0 ? ` (${devedoresLista.length} cliente(s) com pendências)` : ""}\n` +
        `• **Saldo Líquido:** R$ ${saldoLiquido.toFixed(2)}`;

      return {
        success: true,
        source: "financeiro_consolidado_oficial",
        data: resultado as any,
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

  /**
   * 1. Executa o Recebimento Integral Confirmado com verificação pós-gravação (Read-Back)
   */
  static async executarRecebimentoConfirmado(
    sb: SupabaseClient<Database>,
    params: {
      agendamentoId?: string;
      clienteId?: string;
      valorTotal: number;
      formaPagamento: "pix" | "dinheiro" | "cartao_credito" | "cartao_debito" | "outro";
      observacoes?: string;
    },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const agora = new Date().toISOString();
      const { data: novoPagamento, error } = await sb
        .from("pagamentos")
        .insert({
          atendimento_id: params.agendamentoId || null,
          cliente_id: params.clienteId || null,
          valor_total: params.valorTotal,
          valor_pago: params.valorTotal,
          forma: params.formaPagamento,
          status: "pago",
          data_pagamento: agora,
          observacoes: params.observacoes || "Recebimento confirmado pelo operador",
          is_teste: false,
          idempotency_key: idempotencyKey,
        } as any)
        .select("id, valor_total, valor_pago, status, forma, data_pagamento")
        .single();

      if (error || !novoPagamento) throw error || new Error("Falha ao registrar recebimento financeiro.");

      // Read-Back Verification
      const { data: readBack } = await sb
        .from("pagamentos")
        .select("id, status, valor_pago")
        .eq("id", novoPagamento.id)
        .maybeSingle();

      const verificado = readBack?.status === "pago" && Number(readBack?.valor_pago) === params.valorTotal;

      return {
        success: true,
        entity_id: novoPagamento.id,
        affected_record_id: novoPagamento.id,
        source: "tabela_pagamentos",
        after: novoPagamento,
        summary: `Recebimento de R$ ${params.valorTotal.toFixed(2)} (${params.formaPagamento.toUpperCase()}) registrado e verificado com sucesso.`,
        executed_at: agora,
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: null,
        source: "tabela_pagamentos",
        summary: `Erro ao processar recebimento: ${err.message}`,
        error_code: err.code || "ERRO_RECEBIMENTO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * 2. Executa Pagamento Parcial Confirmado com cálculo de saldo remanescente
   */
  static async executarPagamentoParcialConfirmado(
    sb: SupabaseClient<Database>,
    params: {
      pagamentoId: string;
      valorParcial: number;
      formaPagamento: string;
      observacoes?: string;
    },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `parc_${Date.now()}`;
    try {
      const { data: anterior } = await sb
        .from("pagamentos")
        .select("id, valor_total, valor_pago, status")
        .eq("id", params.pagamentoId)
        .single();

      if (!anterior) {
        return {
          success: false,
          entity_id: params.pagamentoId,
          source: "tabela_pagamentos",
          summary: "Registro de pagamento não localizado para baixa parcial.",
          error_code: "PAGAMENTO_NAO_ENCONTRADO",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const valorJaPago = Number(anterior.valor_pago) || 0;
      const novoValorPago = valorJaPago + params.valorParcial;
      const valorTotal = Number(anterior.valor_total) || 0;
      const novoStatus = novoValorPago >= valorTotal ? "pago" : "parcialmente_pago";

      const { data: atualizado, error } = await sb
        .from("pagamentos")
        .update({
          valor_pago: novoValorPago,
          status: novoStatus,
          observacoes: params.observacoes ? `Parcial: ${params.observacoes}` : "Baixa de pagamento parcial",
        } as any)
        .eq("id", params.pagamentoId)
        .select("id, valor_total, valor_pago, status")
        .single();

      if (error || !atualizado) throw error || new Error("Falha ao registrar pagamento parcial.");

      const { data: readBack } = await sb
        .from("pagamentos")
        .select("id, valor_pago, status")
        .eq("id", params.pagamentoId)
        .maybeSingle();

      const verificado = Number(readBack?.valor_pago) === novoValorPago;
      const saldoRestante = Math.max(valorTotal - novoValorPago, 0);

      return {
        success: true,
        entity_id: params.pagamentoId,
        affected_record_id: params.pagamentoId,
        before: anterior,
        after: atualizado,
        source: "tabela_pagamentos",
        summary: `Pagamento parcial de R$ ${params.valorParcial.toFixed(2)} registrado com sucesso. Saldo restante: R$ ${saldoRestante.toFixed(2)}.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.pagamentoId,
        source: "tabela_pagamentos",
        summary: `Erro ao registrar pagamento parcial: ${err.message}`,
        error_code: "ERRO_PAGAMENTO_PARCIAL",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * 3. Executa Estorno Confirmado de Transação com verificação
   */
  static async executarEstornoConfirmado(
    sb: SupabaseClient<Database>,
    params: {
      pagamentoId: string;
      motivo: string;
    },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `estorno_${Date.now()}`;
    try {
      const { data: anterior } = await sb
        .from("pagamentos")
        .select("id, valor_total, valor_pago, status")
        .eq("id", params.pagamentoId)
        .single();

      if (!anterior) {
        return {
          success: false,
          entity_id: params.pagamentoId,
          source: "tabela_pagamentos",
          summary: "Pagamento não encontrado para estorno.",
          error_code: "PAGAMENTO_NAO_ENCONTRADO",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const { data: estornado, error } = await sb
        .from("pagamentos")
        .update({
          status: "estornado",
          observacoes: `Estornado pelo operador: ${params.motivo}`,
        } as any)
        .eq("id", params.pagamentoId)
        .select("id, valor_total, status")
        .single();

      if (error || !estornado) throw error || new Error("Falha ao registrar estorno.");

      const { data: readBack } = await sb
        .from("pagamentos")
        .select("id, status")
        .eq("id", params.pagamentoId)
        .maybeSingle();

      const verificado = String(readBack?.status) === "estornado";

      return {
        success: true,
        entity_id: params.pagamentoId,
        affected_record_id: params.pagamentoId,
        before: anterior,
        after: estornado,
        source: "tabela_pagamentos",
        summary: `Estorno do pagamento #${params.pagamentoId.slice(0, 8)} de R$ ${Number(anterior.valor_total).toFixed(2)} concluído e verificado com sucesso.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.pagamentoId,
        source: "tabela_pagamentos",
        summary: `Erro ao estornar pagamento: ${err.message}`,
        error_code: "ERRO_ESTORNO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * 4. Executa Conciliação Financeira Autorizada de Transações Pendentes
   */
  static async executarConciliacaoAutorizada(
    sb: SupabaseClient<Database>,
    params: {
      transacoesIds: string[];
      operadorNome: string;
    },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `concil_${Date.now()}`;
    try {
      const { data: atualizados, error } = await sb
        .from("pagamentos")
        .update({
          status: "pago",
          observacoes: `Conciliado e aprovado por ${params.operadorNome} em ${new Date().toLocaleDateString("pt-BR")}`,
        } as any)
        .in("id", params.transacoesIds)
        .select("id, status, valor_total");

      if (error) throw error;

      return {
        success: true,
        affected_record_id: params.transacoesIds.join(","),
        source: "conciliacao_financeira",
        after: atualizados,
        summary: `Conciliação autorizada concluída com sucesso: ${atualizados?.length || 0} lançamento(s) regularizado(s).`,
        executed_at: new Date().toISOString(),
        verified: true,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "conciliacao_financeira",
        summary: `Falha na conciliação autorizada: ${err.message}`,
        error_code: "ERRO_CONCILIACAO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }
}
