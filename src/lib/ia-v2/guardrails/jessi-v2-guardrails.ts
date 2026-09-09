import { JessiGuardrailViolationError, JessiIdempotencyConflictError } from "../errors/jessi-v2-errors";

/**
 * Guardrails e Mecanismos de Autonomia Supervisionada da Jessi V2 (Seção 12)
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

export const CONSULTAS_AUTONOMAS_PERMITIDAS = [
  "consultar_agenda",
  "verificar_disponibilidade",
  "buscar_clientes_pets",
  "obter_ficha_pet",
  "consultar_historico",
  "consultar_programas",
  "consultar_saldo_creditos",
  "consultar_validade",
  "consultar_faturamento",
  "consultar_recebimentos",
  "consultar_pendencias",
  "consultar_relatorios",
  "comparar_periodos",
  "consultar_resumo_operacional",
  "identificar_divergencias",
] as const;

export const PREPARACOES_AUTONOMAS_PERMITIDAS = [
  "preparar_agendamento",
  "preparar_remarcacao",
  "preparar_cancelamento",
  "preparar_consumo_credito",
  "preparar_liberacao_credito",
  "preparar_cadastro_cliente",
  "preparar_edicao_cliente",
  "preparar_pagamento",
  "preparar_estorno",
  "preparar_mensagem_whatsapp",
  "preparar_cobranca_pix",
  "preparar_relatorio",
  "preparar_pdf",
] as const;

export const ACOES_MUTACAO_SUPERVISIONADA_ESTRITA = [
  "executar_agendamento",
  "executar_remarcacao",
  "executar_cancelamento",
  "executar_consumo_credito",
  "executar_liberacao_credito",
  "executar_cadastro_cliente",
  "executar_edicao_cliente",
  "executar_registro_pagamento",
  "executar_estorno_pagamento",
  "executar_envio_mensagem",
  "executar_exclusao_registro",
] as const;

export class JessiV2Guardrails {
  private static chavesExecutadas = new Set<string>();

  /**
   * Garante que nenhuma operação de escrita ocorra sem confirmação humana explícita
   * Preparar não significa executar.
   */
  static validarExecucaoSupervisionada(
    tipoOperacao: "consulta" | "mutacao_supervisionada",
    confirmacaoAcaoPendenteId?: string | null,
    dadosConfirmacao?: Record<string, any> | null,
    toolNome?: string
  ): void {
    // 1. Consultas nunca exigem confirmação
    if (tipoOperacao === "consulta") {
      return;
    }

    // 2. Mutações exigem ID de confirmação e dados de confirmação válidos
    if (!confirmacaoAcaoPendenteId || !dadosConfirmacao) {
      throw new JessiGuardrailViolationError(
        `VIOLAÇÃO DE GUARDRAIL (Seção 12): Ação "${toolNome || "mutacao"}" requer confirmação humana explícita antes de qualquer alteração física no banco de dados.`,
        { tipoOperacao, confirmacaoAcaoPendenteId, toolNome }
      );
    }
  }

  /**
   * Valida se uma intenção é puramente de preparação
   */
  static ehPreparacaoAutonoma(intencao: string): boolean {
    return (PREPARACOES_AUTONOMAS_PERMITIDAS as readonly string[]).includes(intencao);
  }

  /**
   * Valida e registra chave de idempotência para evitar duplicidade de operações
   */
  static registrarChaveIdempotencia(chave: string): void {
    if (!chave || chave.trim().length < 5) {
      throw new JessiGuardrailViolationError("Chave de idempotência inválida ou ausente.");
    }

    if (this.chavesExecutadas.has(chave)) {
      throw new JessiIdempotencyConflictError(chave);
    }

    this.chavesExecutadas.add(chave);

    // Limpeza automática após 1 hora para evitar estouro de memória
    setTimeout(() => {
      this.chavesExecutadas.delete(chave);
    }, 60 * 60 * 1000);
  }

  /**
   * Reseta as chaves registradas (utilizado em suites de teste)
   */
  static resetarChavesParaTestes(): void {
    this.chavesExecutadas.clear();
  }
}
