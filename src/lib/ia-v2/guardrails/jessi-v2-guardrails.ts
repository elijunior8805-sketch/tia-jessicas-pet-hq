import { JessiGuardrailViolationError, JessiIdempotencyConflictError } from "../errors/jessi-v2-errors";

/**
 * Guardrails e Mecanismos de Proteção Estrita da Jessi V2
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

export class JessiV2Guardrails {
  private static chavesExecutadas = new Set<string>();

  /**
   * Garante que nenhuma operação de escrita ocorra sem confirmação humana explícita
   */
  static validarExecucaoSupervisionada(
    tipoOperacao: "consulta" | "mutacao_supervisionada",
    confirmacaoAcaoPendenteId?: string | null,
    dadosConfirmacao?: Record<string, any> | null
  ): void {
    if (tipoOperacao === "consulta") {
      return; // Consultas são livres e seguras
    }

    if (!confirmacaoAcaoPendenteId || !dadosConfirmacao) {
      throw new JessiGuardrailViolationError(
        "VIOLAÇÃO DE GUARDRAIL: Tentativa de execução de mutação sem autorização humana explícita.",
        { tipoOperacao, confirmacaoAcaoPendenteId }
      );
    }
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
