import { z } from "zod";


export const IAIntentSchema = z.object({
  intencao: z.enum([
    "consulta_agenda",
    "consulta_cliente",
    "consulta_pet",
    "consulta_financeira",
    "consulta_historico_pet",
    "buscar_servicos",
    "criar_agendamento",
    "remarcar",
    "cancelar",
    "cadastrar_cliente",
    "cadastrar_pet",
    "registrar_pagamento",
    "analisar_comprovante",
    "identificar_pendencia",
    "confirmar_baixa",
    "cancelar_pagamento",
    "solicitar_resumo_operacional",
    "analisar_risco_evasao",
    "sugerir_otimizacao_agenda",
    "disponibilidade",
    "comando_nao_reconhecido"
  ]),
  cliente_nome: z.string().optional().nullable(),
  cliente_telefone: z.string().optional().nullable(),
  cliente_id: z.string().optional().nullable(),
  pet_nome: z.string().optional().nullable(),
  pet_id: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  servicos_ids: z.array(z.string()).optional().nullable(),
  data: z.string().optional().nullable(),
  horario: z.string().optional().nullable(),
  profissional: z.string().optional().nullable(),
  valor: z.number().optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  transporte: z.boolean().optional().nullable(),
  taxa_transporte: z.number().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  informacoes_faltantes: z.array(z.string()).optional().nullable(),
  nivel_confianca: z.number().min(0).max(1),
  exige_confirmacao: z.boolean().default(false),
  resposta_ia: z.string().optional().nullable(),
  resumo_acao: z.string().optional().nullable(),
});

export type IAIntent = z.infer<typeof IAIntentSchema>;

export interface IAMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: IAIntent;
}

/**
 * Classifica a intenção do usuário usando o modelo Gemini.
 */
export async function classificarComandoIA(texto: string, contexto?: any): Promise<IAIntent> {
  const { chamarIA } = await import("./ia-agente.functions.server");
  
  const userContext = contexto?.user ? `
  USUÁRIO LOGADO:
  - Nome: ${contexto.user.nome}
  - Cargo: ${contexto.user.cargo}
  - Unidade: ${contexto.user.unidade || 'Matriz'}
  ` : '';

  const systemPrompt = `Você é a Assistente Operacional da "Tia Jéssica Pet HQ".
Seu papel é ajudar o PROPRIETÁRIO/GERENTE na gestão do Pet Shop.

${userContext}

INTENÇÕES DISPONÍVEIS:
1. CONSULTAS:
    - consulta_agenda: Verificar horários, atendimentos do dia/período.
    - consulta_cliente: Buscar cadastro, contatos, débitos.
    - consulta_pet: Buscar dados de animais, raça, idade.
    - consulta_historico_pet: Ver atendimentos passados de um animal específico.
    - buscar_servicos: Listar serviços cadastrados e preços.
    - consulta_financeira: Faturamento, pendências, devedores.
    - solicitar_resumo_operacional: Visão geral do dia.

2. AÇÕES (Exigem confirmação na UI):
   - criar_agendamento: Montar rascunho de novo atendimento.
   - registrar_pagamento: Vincular comprovante ou dar baixa.
   - analisar_comprovante: IA Vision para ler recibos.

IDENTIDADE OBRIGATÓRIA E REGRAS:
- NUNCA trate o proprietário como tutor/cliente.
- NUNCA ofereça vender banho/tosa para o usuário logado.
- NUNCA peça cadastro do usuário como cliente.
- Se o usuário perguntar "conhecer serviços", pergunte se ele quer ver o cadastro de serviços ou criar uma mensagem para um cliente.
- Se a intenção for criar mensagem para cliente, use um tom profissional e acolhedor (da Tia Jéssica para o Tutor).

REGRAS DE RESPOSTA (JSON):
- Retorne SEMPRE um JSON válido seguindo o IAIntentSchema.
- nivel_confianca: 0 a 1.
- exige_confirmacao: true para qualquer ação de escrita (agendar, pagar, cancelar).
- resposta_ia: Sua resposta amigável e profissional como ASSISTENTE INTERNA.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: texto,
      config: contexto?.config,
      json: true,
      origem: "assistente_ia_classificador"
    });

    const parsed = JSON.parse(res.texto);
    
    return {
      ...parsed,
      nivel_confianca: parsed.nivel_confianca || 0.9
    } as IAIntent;
  } catch (error) {
    console.error("Erro na classificação IA:", error);
    return fallbackClassificador(texto);
  }
}

function fallbackClassificador(texto: string): IAIntent {
  const lowercaseText = texto.toLowerCase();
  let intencao: IAIntent["intencao"] = "comando_nao_reconhecido";
  
  if (lowercaseText.includes("agenda") || lowercaseText.includes("hoje") || lowercaseText.includes("amanhã")) {
    intencao = "consulta_agenda";
  } else if (lowercaseText.includes("cliente")) {
    intencao = "consulta_cliente";
  } else if (lowercaseText.includes("pet")) {
    intencao = "consulta_pet";
  } else if (lowercaseText.includes("financeiro") || lowercaseText.includes("pagamento")) {
    intencao = "consulta_financeira";
  }

  return {
    intencao,
    nivel_confianca: 0.5,
    resposta_ia: "Estou processando sua solicitação..."
  } as IAIntent;
}
