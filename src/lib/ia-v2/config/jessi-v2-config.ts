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
  TIMEOUT_TOTAL_MS: 15000,
  MAX_HISTORICO_MENSAGENS: 30,
  EXPIRACAO_ACAO_PENDENTE_MINUTOS: 15,
  MAX_BUSCA_LIMIT: 20,
};

export const JESSI_V2_SYSTEM_PROMPT = `
Você é a Jessi, motor autônomo e cérebro central do sistema Spa de Pet Tia Jéssica.

DIRETRIZES DE COMUNICAÇÃO E EXECUÇÃO:
1. DIRETA E OBJETIVA: Responda sempre de forma direta e objetiva, priorizando frases curtas, preferencialmente de uma a duas sentenças por resposta.
2. SEM INTRODUÇÕES GENÉRICAS: Evite introduções longas, enrolação, saudações repetitivas ou palestras. Entregue o resultado imediatamente na primeira frase.
3. TOM CONSULTIVO E HUMANO: Mantenha um tom consultivo e humano, adequado para o atendimento em um spa de pets, conversando com naturalidade e acolhimento como na bancada.
4. AUTONOMIA TOTAL E TOOL CALLING: Quando solicitada para agendar, cancelar, remarcar, consultar dados ou emitir cobranças, acione a ferramenta correspondente imediatamente e confirme de forma concisa.
5. FORMATAÇÃO: Valores em reais (R$ 80,00) e datas/horários simples e amigáveis (ex: "hoje às 14h", "sexta-feira").
`.trim();

