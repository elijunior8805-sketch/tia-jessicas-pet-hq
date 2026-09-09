import { JessiV2Message, JessiV2PendingAction } from "../contracts/jessi-v2-contracts";
import { JESSI_V2_LIMITS } from "../config/jessi-v2-config";

/**
 * Gestão de Sessão, Memória de Curto e Médio Prazo da Jessi V2
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export interface JessiV2ContextState {
  clienteSelecionadoId?: string | null;
  clienteSelecionadoNome?: string | null;
  clienteTelefone?: string | null;
  petSelecionadoId?: string | null;
  petSelecionadoNome?: string | null;
  petRaca?: string | null;
  dataReferencia: string; // Formato YYYY-MM-DD
  servicoSelecionadoId?: string | null;
  servicoSelecionadoNome?: string | null;
  servicoValor?: number | null;
  programaSelecionadoId?: string | null;
  cobrancaSelecionadaId?: string | null;
  acaoPendente?: JessiV2PendingAction | null;
  ultimoDominioAcessado?: string | null;
  variaveisConversacao?: Record<string, any>;
}

export interface JessiV2Session {
  sessionId: string;
  userId: string;
  contexto: JessiV2ContextState;
  mensagens: JessiV2Message[];
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Cria uma nova sessão com estado inicial calibrado
 */
export function criarSessaoV2(sessionId?: string, userId?: string): JessiV2Session {
  const agora = new Date();
  const dataHoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);

  return {
    sessionId: sessionId || `jessi_v2_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: userId || "proprietario_spa",
    contexto: {
      dataReferencia: dataHoje,
      variaveisConversacao: {},
    },
    mensagens: [],
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
  };
}

/**
 * Adiciona mensagem garantindo podagem de histórico dentro do limite seguro
 */
export function adicionarMensagemSessaoV2(
  sessao: JessiV2Session,
  mensagem: JessiV2Message
): JessiV2Session {
  const mensagensAtualizadas = [...sessao.mensagens, mensagem];

  if (mensagensAtualizadas.length > JESSI_V2_LIMITS.MAX_HISTORICO_MENSAGENS) {
    mensagensAtualizadas.splice(
      0,
      mensagensAtualizadas.length - JESSI_V2_LIMITS.MAX_HISTORICO_MENSAGENS
    );
  }

  return {
    ...sessao,
    mensagens: mensagensAtualizadas,
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Atualiza o contexto preservando dados anteriores e validando expiração de ações pendentes
 */
export function atualizarContextoSessaoV2(
  sessao: JessiV2Session,
  novoContexto: Partial<JessiV2ContextState>
): JessiV2Session {
  let acaoPendente = novoContexto.acaoPendente !== undefined 
    ? novoContexto.acaoPendente 
    : sessao.contexto.acaoPendente;

  // Verifica se a ação pendente já expirou
  if (acaoPendente) {
    const expiracao = new Date(acaoPendente.expires_at).getTime();
    if (Date.now() > expiracao) {
      acaoPendente = null;
    }
  }

  return {
    ...sessao,
    contexto: {
      ...sessao.contexto,
      ...novoContexto,
      acaoPendente,
    },
    atualizadoEm: new Date().toISOString(),
  };
}
