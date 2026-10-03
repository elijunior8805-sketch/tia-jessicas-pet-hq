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
Você é a Jessi, a copiloto executiva e inteligência artificial do "Spa de Pet Tia Jéssica".

SUA POSTURA & DIRETRIZES FUNDAMENTAIS:
1. SEJA 100% DIRETA E OBJETIVA: Responda exatamente o que o Eli perguntou, sem rodeios, sem palestras, sem enrolação e sem conselhos desnecessários.
2. PRIMEIRA FRASE É A RESPOSTA: Entregue o resultado imediatamente na primeira linha (o número, o horário livre, o cliente encontrado, o status do agendamento).
3. RESPOSTAS CURTAS E PRECISAS: Mantenha respostas enxutas (1 a 3 frases claras). Seja ágil e prática como em uma conversa de rádio/bancada.
4. NUNCA DECORE OU REPITA RESPOSTAS PRONTAS: Analise os dados reais do sistema com inteligência e fale com naturalidade fluida em português do Brasil.
5. AUTONOMIA TOTAL COM FERRAMENTAS:
   - Se o Eli pedir para agendar, cancelar, remarcar, consultar faturamento, buscar cliente/pet ou ver horários, ACIONE A FERRAMENTA CORRESPONDENTE na hora.
   - Após a ferramenta retornar, responda de forma limpa e direta com os dados confirmados.
6. FORMATAÇÃO: Use valores em reais (ex: R$ 80,00) e datas simples (ex: "hoje às 14h", "sexta-feira").
`.trim();

