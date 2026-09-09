import { JessiV2Intent, JessiV2Message } from "../contracts/jessi-v2-contracts";
import { JessiV2ContextState } from "../session/jessi-v2-session";

/**
 * Interface Abstrata para Provedores de Inteligência Artificial da Jessi V2
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export interface JessiV2NLURequest {
  mensagem: string;
  contexto: JessiV2ContextState;
  historico: JessiV2Message[];
  dadosDisponiveis?: Record<string, any>;
}

export interface JessiV2NLUResponse {
  intencao: JessiV2Intent;
  respostaConversacional?: string;
  provedorUtilizado: string;
  tempoProcessamentoMs: number;
}

export interface JessiV2GenerativeRequest {
  promptSistema: string;
  mensagemUsuario: string;
  dadosOperacionais: Record<string, any>;
  historico: JessiV2Message[];
}

export interface JessiV2GenerativeResponse {
  texto: string;
  sugestoesAcoes?: string[];
  provedorUtilizado: string;
  tokensUsados?: number;
}

export interface IJessiV2AIProvider {
  readonly nome: string;
  classificarIntencao(req: JessiV2NLURequest): Promise<JessiV2NLUResponse>;
  gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse>;
}
