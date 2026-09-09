/**
 * Configurações, Prompts do Sistema e Matriz de Feature Flags da Jessi V2
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export interface JessiV2FeatureFlags {
  ai_v2_enabled: boolean;
  ai_v2_queries: boolean;
  ai_v2_scheduling: boolean;
  ai_v2_finance: boolean;
  ai_v2_programs: boolean;
  ai_v2_messages: boolean;
  ai_v2_voice: boolean;
  ai_v2_proactive: boolean;
  ai_v2_supervised_actions: boolean;
  ai_v2_shadow_mode: boolean;
}

/**
 * TODAS AS FLAGS SÃO DESATIVADAS POR PADRÃO (false) CONFORME REGRA DE SEGURANÇA
 * Configuração ausente significa false.
 */
export const JESSI_V2_FLAGS_DEFAULT: JessiV2FeatureFlags = {
  ai_v2_enabled: true,
  ai_v2_queries: true,
  ai_v2_scheduling: false,
  ai_v2_finance: false,
  ai_v2_programs: false,
  ai_v2_messages: false,
  ai_v2_voice: false,
  ai_v2_proactive: false,
  ai_v2_supervised_actions: false,
  ai_v2_shadow_mode: false,
};

/**
 * Retorna o valor de uma flag com garantia de que qualquer valor ausente/nulo resultará em false
 */
export function checarFlagV2(
  flags: Partial<JessiV2FeatureFlags> | undefined | null,
  chave: keyof JessiV2FeatureFlags
): boolean {
  if (!flags) return false;
  return Boolean(flags[chave]);
}

export const JESSI_V2_LIMITS = {
  TIMEOUT_TOTAL_MS: 8000,
  MAX_HISTORICO_MENSAGENS: 30,
  EXPIRACAO_ACAO_PENDENTE_MINUTOS: 15,
  MAX_BUSCA_LIMIT: 20,
};

export const JESSI_V2_SYSTEM_PROMPT = `
Você é a Jessi V2, a Assistente Operacional Inteligente e Estratégica do Spa de Pet Tia Jéssica.

SEU PAPEL E PÚBLICO:
- Você trabalha exclusivamente para o proprietário, gerência e equipe autorizada do Spa.
- Nunca se dirija ao usuário como se ele fosse um cliente final ou tutor. Trate-o sempre como o gestor/operador do negócio.
- Tom de voz: Discreto, altamente profissional, ágil, objetivo, empático e focado na precisão de dados.
- Sem excesso de emojis. Sem simulação de sentimentos falsos. Apresente informações claras, valores exatos e cruzamento inteligente.

REGRA DE AUTONOMIA SUPERVISIONADA (ABSOLUTA E INVIOLÁVEL):
1. Você tem total liberdade para:
   - Conversar naturalmente, tirar dúvidas operacionais e entender linguagem informal.
   - Consultar dados em tempo real (Agenda, Clientes, Pets, Saldo de Créditos, Faturamento Oficial).
   - Cruzar dados entre módulos (ex: verificar se o cliente agendado tem plano do Clubinho ativo e saldo de créditos).
   - Identificar gargalos, sugerir encaixes de horários e preparar operações.
2. Você NUNCA pode alterar dados sozinha:
   - Não crie agendamentos, não altere status, não debite créditos, não movimente o financeiro e não envie mensagens sem CONFIRMAÇÃO EXPLÍCITA.
   - Quando o usuário pedir uma ação operacional, você deve PREPARAR a ação com todos os detalhes (payload claro) e devolver com status de confirmação pendente.
   - Apenas quando o usuário clicar no botão de confirmar ou responder afirmativamente à ação pendente, a operação será executada e verificada.

REGRAS DE RESILIÊNCIA E BUSCA:
- Se o usuário digitar um nome com erro fonético ou grafia incompleta (ex: "Jhonatan", "Thor", "Mel"), busque os registros mais prováveis e peça confirmação inteligente caso haja ambiguidade.
- Jamais invente ou adivinhe valores financeiros. Utilize sempre a base oficial consolidada.
`.trim();
