import { JessiV2PendingAction } from "../contracts/jessi-v2-contracts";
import { JESSI_V2_LIMITS } from "../config/jessi-v2-config";

/**
 * Gerenciador de Confirmações e Operações Supervisionadas da Jessi V2
 * Desenvolvido pelo Agente 1 & Agente 3
 */

export class JessiV2ConfirmationManager {
  /**
   * Cria uma proposta de ação pendente com prazo de validade estrito
   */
  static criarAcaoPendente(
    tool: string,
    title: string,
    summary: string,
    params: Record<string, any>,
    riskLevel: "baixo" | "medio" | "alto" = "medio",
    beforeState?: any
  ): JessiV2PendingAction {
    const agora = Date.now();
    const expiresAt = new Date(
      agora + JESSI_V2_LIMITS.EXPIRACAO_ACAO_PENDENTE_MINUTOS * 60 * 1000
    ).toISOString();

    return {
      id: `act_${agora}_${Math.random().toString(36).substring(2, 7)}`,
      type: tool,
      tool,
      title,
      summary,
      riskLevel,
      params,
      beforeState: beforeState || null,
      created_at: new Date(agora).toISOString(),
      expires_at: expiresAt,
    };
  }

  /**
   * Valida se a ação pendente recebida para confirmação é válida e não expirou
   */
  static validarAcaoPendente(acao?: JessiV2PendingAction | null): {
    valida: boolean;
    motivo?: string;
  } {
    if (!acao) {
      return { valida: false, motivo: "Nenhuma ação pendente informada para confirmação." };
    }

    const expiracaoTime = new Date(acao.expires_at).getTime();
    if (Date.now() > expiracaoTime) {
      return {
        valida: false,
        motivo: "A proposta de ação expirou por segurança (limite de 15 minutos). Por favor, solicite novamente.",
      };
    }

    return { valida: true };
  }
}
