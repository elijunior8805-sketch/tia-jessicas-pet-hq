import { JessiV2Message, JessiV2PendingAction } from "../contracts/jessi-v2-contracts";
import { JESSI_V2_LIMITS } from "../config/jessi-v2-config";

/**
 * Gestão de Sessão, Memória e Contexto Isolado da Jessi V2 (Seção 8)
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export interface JessiV2ClienteContext {
  id?: string | null;
  nome?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  endereco?: string | null;
}

export interface JessiV2PetContext {
  id?: string | null;
  nome?: string | null;
  raca?: string | null;
  porte?: string | null;
  restricoes?: string | null;
}

export interface JessiV2ServicoContext {
  id?: string | null;
  nome?: string | null;
  valor?: number | null;
  duracaoMin?: number | null;
}

export interface JessiV2ProgramaContext {
  id?: string | null;
  nome?: string | null;
  tipo?: string | null;
}

export interface JessiV2CreditoContext {
  id?: string | null;
  saldo?: number | null;
  servicoNome?: string | null;
}

export interface JessiV2PerfilContext {
  nome: string;
  cargo: string;
  permissoes: string[];
}

export interface JessiV2ConsultaHistoricoItem {
  timestamp: string;
  dominio: string;
  resumo: string;
}

export interface JessiV2ContextState {
  conversationId: string;
  userId: string;
  perfil: JessiV2PerfilContext;
  cliente: JessiV2ClienteContext | null;
  pet: JessiV2PetContext | null;
  dataReferencia: string; // Formato YYYY-MM-DD
  servico: JessiV2ServicoContext | null;
  programa: JessiV2ProgramaContext | null;
  credito: JessiV2CreditoContext | null;
  formaPagamento?: string | null;
  intencaoAtual?: string | null;
  ultimasConsultas: JessiV2ConsultaHistoricoItem[];
  operacaoPreparada?: JessiV2PendingAction | null;
  confirmacoesExecutadasIds: string[];
  ultimoResultado?: any;
  resumoHistorico?: string | null;
  variaveisConversacao: Record<string, any>;
  // Aliases legados usados pelo provedor de NLU
  clienteSelecionadoId?: string | null;
  clienteSelecionadoNome?: string | null;
  petSelecionadoId?: string | null;
  petSelecionadoNome?: string | null;
  servicoSelecionadoId?: string | null;
  servicoSelecionadoNome?: string | null;
  servicoValor?: number | null;
}

export interface JessiV2Session {
  sessionId: string;
  userId: string;
  contexto: JessiV2ContextState;
  mensagens: JessiV2Message[];
  criadoEm: string;
  atualizadoEm: string;
  expiraEm: string;
}

const SESSION_TTL_MINUTOS = 60; // 1 hora de inatividade

/**
 * Cria uma nova sessão com isolamento rigoroso por usuário e conversa
 */
export function criarSessaoV2(
  sessionId?: string,
  userId?: string,
  perfil?: Partial<JessiV2PerfilContext>
): JessiV2Session {
  const agora = new Date();
  const dataHoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);

  const convId = sessionId || `jessi_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const uid = userId || "proprietario_spa";

  const expiraEm = new Date(agora.getTime() + SESSION_TTL_MINUTOS * 60 * 1000).toISOString();

  return {
    sessionId: convId,
    userId: uid,
    contexto: {
      conversationId: convId,
      userId: uid,
      perfil: {
        nome: perfil?.nome || "Proprietário",
        cargo: perfil?.cargo || "Administrador",
        permissoes: perfil?.permissoes || ["admin", "agenda", "financeiro", "clientes"],
      },
      cliente: null,
      pet: null,
      dataReferencia: dataHoje,
      servico: null,
      programa: null,
      credito: null,
      formaPagamento: null,
      intencaoAtual: null,
      ultimasConsultas: [],
      operacaoPreparada: null,
      confirmacoesExecutadasIds: [],
      ultimoResultado: null,
      resumoHistorico: null,
      variaveisConversacao: {},
    },
    mensagens: [],
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
    expiraEm,
  };
}

/**
 * Adiciona mensagem garantindo podagem segura de histórico (máx 30 mensagens)
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

  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + SESSION_TTL_MINUTOS * 60 * 1000).toISOString();

  return {
    ...sessao,
    mensagens: mensagensAtualizadas,
    atualizadoEm: agora.toISOString(),
    expiraEm,
  };
}

/**
 * Atualiza o contexto validando expiração de ações e prevenindo reuso de confirmações
 */
export function atualizarContextoSessaoV2(
  sessao: JessiV2Session,
  novoContexto: Partial<JessiV2ContextState>
): JessiV2Session {
  let operacaoPreparada = novoContexto.operacaoPreparada !== undefined
    ? novoContexto.operacaoPreparada
    : sessao.contexto.operacaoPreparada;

  // Validação de expiração da ação pendente (15 minutos)
  if (operacaoPreparada) {
    const expiracao = new Date(operacaoPreparada.expires_at).getTime();
    if (Date.now() > expiracao) {
      operacaoPreparada = null;
    }
  }

  // Prevenção de reuso: se a ação já foi executada, invalida
  if (operacaoPreparada && sessao.contexto.confirmacoesExecutadasIds.includes(operacaoPreparada.id)) {
    operacaoPreparada = null;
  }

  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + SESSION_TTL_MINUTOS * 60 * 1000).toISOString();

  return {
    ...sessao,
    contexto: {
      ...sessao.contexto,
      ...novoContexto,
      operacaoPreparada,
    },
    atualizadoEm: agora.toISOString(),
    expiraEm,
  };
}

/**
 * Invalida uma confirmação executada para impedir que seja reprocessada
 */
export function registrarConfirmacaoExecutada(
  sessao: JessiV2Session,
  actionId: string
): JessiV2Session {
  const jaRegistrado = sessao.contexto.confirmacoesExecutadasIds.includes(actionId);
  const atualizadas = jaRegistrado
    ? sessao.contexto.confirmacoesExecutadasIds
    : [...sessao.contexto.confirmacoesExecutadasIds, actionId];

  return {
    ...sessao,
    contexto: {
      ...sessao.contexto,
      operacaoPreparada: null,
      confirmacoesExecutadasIds: atualizadas,
    },
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Limpa o contexto preservando a identidade do usuário e a data de referência
 */
export function limparContextoSessaoV2(sessao: JessiV2Session): JessiV2Session {
  const dataHoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return {
    ...sessao,
    contexto: {
      conversationId: sessao.contexto.conversationId,
      userId: sessao.contexto.userId,
      perfil: sessao.contexto.perfil,
      cliente: null,
      pet: null,
      dataReferencia: dataHoje,
      servico: null,
      programa: null,
      credito: null,
      formaPagamento: null,
      intencaoAtual: null,
      ultimasConsultas: [],
      operacaoPreparada: null,
      confirmacoesExecutadasIds: sessao.contexto.confirmacoesExecutadasIds,
      ultimoResultado: null,
      resumoHistorico: null,
      variaveisConversacao: {},
    },
    mensagens: [],
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Gera um resumo cirúrgico do contexto para envio no prompt do modelo
 * NUNCA envia a base inteira, apenas entidades ativas e relevantes
 */
export function montarSnippetContextoParaModelo(contexto: JessiV2ContextState): string {
  const partes: string[] = [];

  partes.push(`- Data de Hoje (Spa): ${contexto.dataReferencia}`);
  partes.push(`- Operador: ${contexto.perfil.nome} (${contexto.perfil.cargo})`);

  if (contexto.cliente?.nome) {
    partes.push(`- Cliente em Foco: ${contexto.cliente.nome} (ID: ${contexto.cliente.id || "novo"})`);
  }
  if (contexto.pet?.nome) {
    partes.push(`- Pet em Foco: ${contexto.pet.nome} (${contexto.pet.raca || "Raça padrão"})`);
  }
  if (contexto.credito?.saldo !== undefined && contexto.credito?.saldo !== null) {
    partes.push(`- Crédito Disponível: ${contexto.credito.saldo} sessões de ${contexto.credito.servicoNome || "serviço"}`);
  }
  if (contexto.operacaoPreparada) {
    partes.push(`- Ação Aguardando Confirmação: ${contexto.operacaoPreparada.title} (ID: ${contexto.operacaoPreparada.id})`);
  }

  return partes.join("\n");
}
