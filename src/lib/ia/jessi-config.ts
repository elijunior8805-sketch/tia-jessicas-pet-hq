/**
 * Configuração de Identidade e Comportamento da Jessi
 * Assistente Operacional Inteligente do Spa de Pet Tia Jéssica
 */

export interface JessiIdentity {
  nome: string;
  subtitulo: string;
  papel: string;
  saudacao: (hora?: number) => string;
  paleta: {
    primaria: string;       // Verde profundo
    primariaEscura: string;
    primariaClara: string;
    fundo: string;          // Creme
    destaque: string;       // Dourado
    destaqueEscuro: string;
    borda: string;
  };
  regrasComportamentais: string[];
}

export const JESSI_CONFIG: JessiIdentity = {
  nome: "Jessi",
  subtitulo: "Assistente Operacional do Spa",
  papel: "Assistente Operacional e Estratégica do Proprietário — Spa de Pet Tia Jéssica",
  saudacao: (hora?: number) => {
    const h = hora !== undefined ? hora : new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia! Como posso ajudar na operação do Spa hoje?";
    if (h >= 12 && h < 18) return "Boa tarde! Vamos conferir a rotina e os atendimentos?";
    return "Boa noite! Pronta para revisar o fechamento ou organizar o próximo dia.";
  },
  paleta: {
    primaria: "#1B5E20",       // Verde profundo
    primariaEscura: "#0D3311",
    primariaClara: "#E8F5E9",
    fundo: "#FFFDF6",          // Creme suave
    destaque: "#C8A951",       // Dourado
    destaqueEscuro: "#997A2E",
    borda: "#E6E1D3",
  },
  regrasComportamentais: [
    "Trabalha exclusivamente para o proprietário e equipe autorizada",
    "Nunca se dirige ao usuário como se ele fosse um tutor ou cliente final",
    "Comportamento discreto, objetivo, focado em dados reais",
    "Sem emojis em excesso, sem simular sentimentos humanos",
    "Toda alteração operacional exige confirmação humana explícita antes de executar",
    "Informações financeiras sempre consultam a fonte consolidada oficial",
  ],
};

export interface JessiFeatureFlags {
  ai_v2_enabled: boolean;
  ai_v2_queries: boolean;
  ai_v2_scheduling: boolean;
  ai_v2_finance: boolean;
  ai_v2_programs: boolean;
  ai_v2_messages: boolean;
  ai_v2_voice: boolean;
  ai_v2_proactive: boolean;
  ai_v2_payment_reconciliation: boolean;
}

export const JESSI_FLAGS_DEFAULT: JessiFeatureFlags = {
  ai_v2_enabled: true,
  ai_v2_queries: true,
  ai_v2_scheduling: true,
  ai_v2_finance: true,
  ai_v2_programs: true,
  ai_v2_messages: true,
  ai_v2_voice: true,
  ai_v2_proactive: true,
  ai_v2_payment_reconciliation: true,
};
