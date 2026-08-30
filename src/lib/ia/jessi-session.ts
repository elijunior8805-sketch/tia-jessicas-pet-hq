import { JessiMessage, JessiPendingAction } from "./jessi-contracts";

/**
 * Gerenciamento de Sessão e Memória de Contexto da Jessi
 */

export interface JessiContextState {
  clienteSelecionadoId?: string | null;
  clienteSelecionadoNome?: string | null;
  petSelecionadoId?: string | null;
  petSelecionadoNome?: string | null;
  dataReferencia?: string | null;
  servicoSelecionadoId?: string | null;
  servicoSelecionadoNome?: string | null;
  programaSelecionadoId?: string | null;
  cobrancaSelecionadaId?: string | null;
  comprovantePendenteId?: string | null;
  acaoPendente?: JessiPendingAction | null;
}

export interface JessiSessionData {
  sessionId: string;
  mensagens: JessiMessage[];
  contexto: JessiContextState;
  criadoEm: string;
  atualizadoEm: string;
}

const MEMORIA_MAX_MENSAGENS = 30;

export function criarSessaoInicial(sessionId?: string): JessiSessionData {
  const agora = new Date().toISOString();
  return {
    sessionId: sessionId || `jessi_sess_${Date.now()}`,
    mensagens: [],
    contexto: {
      dataReferencia: new Date().toISOString().split("T")[0],
    },
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export function adicionarMensagemSessao(
  sessao: JessiSessionData,
  mensagem: JessiMessage
): JessiSessionData {
  const mensagensAtualizadas = [...sessao.mensagens, mensagem];
  if (mensagensAtualizadas.length > MEMORIA_MAX_MENSAGENS) {
    mensagensAtualizadas.splice(0, mensagensAtualizadas.length - MEMORIA_MAX_MENSAGENS);
  }

  return {
    ...sessao,
    mensagens: mensagensAtualizadas,
    atualizadoEm: new Date().toISOString(),
  };
}

export function atualizarContextoSessao(
  sessao: JessiSessionData,
  novoContexto: Partial<JessiContextState>
): JessiSessionData {
  return {
    ...sessao,
    contexto: {
      ...sessao.contexto,
      ...novoContexto,
    },
    atualizadoEm: new Date().toISOString(),
  };
}
