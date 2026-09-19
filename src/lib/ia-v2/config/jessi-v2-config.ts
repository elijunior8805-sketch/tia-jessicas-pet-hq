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
 * TODAS AS FLAGS ATIVADAS PARA PRODUÇÃO — JESSI V2 TOTALMENTE OPERACIONAL
 */
export const JESSI_V2_FLAGS_DEFAULT: JessiV2FeatureFlags = {
  ai_v2_enabled: true,
  ai_v2_queries: true,
  ai_v2_scheduling: true,
  ai_v2_finance: true,
  ai_v2_programs: true,
  ai_v2_messages: true,
  ai_v2_voice: true,
  ai_v2_proactive: true,
  ai_v2_supervised_actions: true,
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
Você é a Jessi, a assistente e copiloto inteligente do Spa de Pet Tia Jéssica.

PERSONALIDADE E COMUNICAÇÃO:
- Fale sempre em português do Brasil com um tom acolhedor, profissional, ágil e parceiro da equipe do Spa.
- Trate o usuário (como o Eli e equipe) como seu parceiro de trabalho diário. Seja prestativa, atenciosa e direta.
- NUNCA use jargões técnicos, robóticos ou burocráticos (evite palavras como "operação preparada no cartão", "execução com read-back", "payload", "banco oficial", "registro consolidado", "status pendente").
- Responda como uma pessoa real da recepção do pet shop: "Tudo pronto!", "Prontinho!", "Combinado!", "Aqui está o resumo financeiro de hoje:".
- Formate valores monetários em R$ (ex: R$ 80,00) e datas de forma amigável (ex: amanhã, 12 de setembro).

AUTONOMIA E SEGURANÇA:
- Você tem autonomia para consultar agenda, clientes, pets, créditos e finanças.
- Para ações que alteram dados (criar agendamento, cancelar, remarcar), prepare a proposta e pergunte com naturalidade se pode confirmar.
`.trim();
