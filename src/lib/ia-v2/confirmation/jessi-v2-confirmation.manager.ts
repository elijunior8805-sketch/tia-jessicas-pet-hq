import { JESSI_V2_LIMITS } from "../config/jessi-v2-config";

/**
 * Estados do Ciclo de Vida da Confirmação Humana (Seção 13)
 */
export type JessiV2ProposalStatus =
  | "draft"
  | "awaiting_confirmation"
  | "approved"
  | "revalidating"
  | "executing"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

/**
 * Estrutura Completa da Proposta Supervisionada (Seção 13)
 */
export interface JessiV2Proposal {
  id: string;
  userId: string;
  cliente?: { id?: string | null; nome?: string | null; telefone?: string | null } | null;
  pet?: { id?: string | null; nome?: string | null; raca?: string | null } | null;
  acao: string;
  motivo: string;
  estadoAtual?: any;
  estadoProposto: any;
  valores?: { valorBruto?: number; desconto?: number; valorFinal?: number } | null;
  impactoCreditos?: { debitoSessoes?: number; saldoRestanteEsperado?: number; servico?: string } | null;
  dataHora?: string | null;
  riscos: string[];
  validade: string; // ISO Timestamp (15 minutos)
  assinaturaConteudo: string;
  status: JessiV2ProposalStatus;
  resumoVisual: {
    entendido: string;
    seraAlterado: string;
    situacaoAtual: string;
    resultadoEsperado: string;
    alertas: string[];
  };
}

/**
 * Gerenciador e Validador de Propostas Supervisionadas (Seção 13)
 * Desenvolvido pelo Agente 1 (Arquitetura) & Agente 3 (Segurança)
 */
export class JessiV2ConfirmationManager {
  /**
   * Gera uma assinatura determinística do conteúdo para assegurar integridade
   */
  static gerarAssinaturaConteudo(payload: {
    id: string;
    userId: string;
    acao: string;
    estadoProposto: any;
    validade: string;
  }): string {
    const raw = `${payload.id}|${payload.userId}|${payload.acao}|${JSON.stringify(payload.estadoProposto)}|${payload.validade}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `sig_${Math.abs(hash).toString(16)}_${raw.length}`;
  }

  /**
   * Cria uma proposta estruturada e assinada aguardando autorização humana
   */
  static criarProposta(params: {
    userId: string;
    acao: string;
    motivo: string;
    cliente?: { id?: string | null; nome?: string | null; telefone?: string | null } | null;
    pet?: { id?: string | null; nome?: string | null; raca?: string | null } | null;
    estadoAtual?: any;
    estadoProposto: any;
    valores?: { valorBruto?: number; desconto?: number; valorFinal?: number } | null;
    impactoCreditos?: { debitoSessoes?: number; saldoRestanteEsperado?: number; servico?: string } | null;
    dataHora?: string | null;
    riscos?: string[];
    resumoVisual: {
      entendido: string;
      seraAlterado: string;
      situacaoAtual: string;
      resultadoEsperado: string;
      alertas: string[];
    };
  }): JessiV2Proposal {
    const agora = Date.now();
    const id = `prop_${agora}_${Math.random().toString(36).substring(2, 7)}`;
    const validade = new Date(
      agora + JESSI_V2_LIMITS.EXPIRACAO_ACAO_PENDENTE_MINUTOS * 60 * 1000
    ).toISOString();

    const assinatura = this.gerarAssinaturaConteudo({
      id,
      userId: params.userId,
      acao: params.acao,
      estadoProposto: params.estadoProposto,
      validade,
    });

    return {
      id,
      userId: params.userId,
      cliente: params.cliente || null,
      pet: params.pet || null,
      acao: params.acao,
      motivo: params.motivo,
      estadoAtual: params.estadoAtual || null,
      estadoProposto: params.estadoProposto,
      valores: params.valores || null,
      impactoCreditos: params.impactoCreditos || null,
      dataHora: params.dataHora || null,
      riscos: params.riscos || [],
      validade,
      assinaturaConteudo: assinatura,
      status: "awaiting_confirmation",
      resumoVisual: params.resumoVisual,
    };
  }

  /**
   * Valida a proposta antes de autorizar a execução física
   * Rejeita propostas expiradas, de outro usuário ou com assinatura corrompida
   */
  static validarPropostaParaExecucao(
    proposta: JessiV2Proposal | null | undefined,
    userIdExecutante: string
  ): { valida: boolean; motivo?: string } {
    if (!proposta) {
      return { valida: false, motivo: "Proposta de operação inexistente ou ausente." };
    }

    // 1. Validação de Usuário Vinculado
    if (proposta.userId !== userIdExecutante) {
      return {
        valida: false,
        motivo: "A confirmação deve ser realizada exclusivamente pelo usuário que solicitou a operação.",
      };
    }

    // 2. Validação de Validade / Expiração (15 min)
    const expiracaoTime = new Date(proposta.validade).getTime();
    if (Date.now() > expiracaoTime || proposta.status === "expired") {
      return {
        valida: false,
        motivo: "A proposta de operação expirou por segurança. Por favor, solicite novamente.",
      };
    }

    // 3. Validação de Status Ativo
    if (proposta.status !== "awaiting_confirmation" && proposta.status !== "approved") {
      return {
        valida: false,
        motivo: `A proposta não está em estado de confirmação (status atual: ${proposta.status}).`,
      };
    }

    // 4. Validação de Integridade da Assinatura do Conteúdo
    const assinaturaEsperada = this.gerarAssinaturaConteudo({
      id: proposta.id,
      userId: proposta.userId,
      acao: proposta.acao,
      estadoProposto: proposta.estadoProposto,
      validade: proposta.validade,
    });

    if (proposta.assinaturaConteudo !== assinaturaEsperada) {
      return {
        valida: false,
        motivo: "Assinatura de integridade da proposta inválida. Operação abortada por segurança.",
      };
    }

    return { valida: true };
  }
}
