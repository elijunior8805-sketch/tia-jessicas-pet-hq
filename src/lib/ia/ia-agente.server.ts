import { z } from "zod";


export const IAIntentSchema = z.object({
  intencao: z.enum([
    "consulta_agenda",
    "listar_atendimentos",
    "contar_atendimentos",
    "consulta_cliente",
    "consulta_pet",
    "consulta_financeira",
    "consultar_resumo_financeiro",
    "consultar_pendencias",
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
  acao: z.string().optional().nullable(),
  cliente_nome: z.string().optional().nullable(),
  cliente_id: z.string().optional().nullable(),
  pet_nome: z.string().optional().nullable(),
  pet_id: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  servicos_ids: z.array(z.string()).optional().nullable(),
  data: z.string().optional().nullable(),
  horario: z.string().optional().nullable(),
  profissional: z.string().optional().nullable(),
  periodo_inicio: z.string().optional().nullable(),
  periodo_fim: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  valor: z.number().optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  transporte: z.boolean().optional().nullable(),
  taxa_transporte: z.number().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  filtros: z.record(z.any()).optional().nullable(),
  informacoes_faltantes: z.array(z.string()).optional().nullable(),
  nivel_confianca: z.number().min(0).max(1),
  ferramenta: z.string().optional().nullable(),
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
  const { chamarIA } = await import("../ia-core.server");
  
  const userContext = contexto?.user ? `
  USUÁRIO LOGADO:
  - Nome: ${contexto.user.nome}
  - Cargo: ${contexto.user.cargo}
  - Unidade: ${contexto.user.unidade || 'Matriz'}
  ` : '';

  const systemPrompt = `Você é a Assistente Operacional da "Tia Jéssica Pet HQ". Seu papel é ajudar o PROPRIETÁRIO/GERENTE na gestão interna do Pet Shop.

${userContext}

CICLO DE EXECUÇÃO:
1. Receber mensagem.
2. Identificar intenção estruturada (JSON).
3. Verificar informações faltantes.
4. Definir a ferramenta correta para o roteamento.
5. Aguardar o resultado do backend antes de responder perguntas que dependem do banco.

ESTRUTURA DE INTENÇÃO (Obrigatória):
- Use EXATAMENTE os campos do IAIntentSchema: intencao, acao, cliente_nome, cliente_id, pet_nome, pet_id, servicos, data, horario, profissional, periodo_inicio, periodo_fim, status, valor, forma_pagamento, filtros, informacoes_faltantes, nivel_confianca, ferramenta, exige_confirmacao.
- Não invente campos adicionais.

ROTEAMENTO DE INTENÇÕES:
1. CONSULTAS:
    - contar_atendimentos: "Quantos atendimentos tenho hoje?"
    - listar_atendimentos: "Quais são os atendimentos?" ou "Mostre a agenda."
    - consultar_resumo_financeiro: "Qual foi meu faturamento?"
    - consultar_pendencias: "Quem está devendo?" ou "Quais pagamentos faltam?"
    - consulta_cliente: Buscar cadastro de cliente.
    - consulta_pet: Buscar dados de animais.
    - consulta_historico_pet: Histórico de serviços de um pet.
    - buscar_servicos: Lista de serviços e preços.
    - solicitar_resumo_operacional: Visão geral do dia.

2. AÇÕES (Exigem confirmação):
   - criar_agendamento: Novo atendimento (verifique se cliente existe com buscar_clientes antes).
   - cadastrar_cliente: Novo cliente.
   - cadastrar_pet: Novo pet.
   - registrar_pagamento: Baixa de pagamento.

DIRETRIZES:
- NUNCA trate o proprietário como tutor.
- SEMPRE defina 'exige_confirmacao: true' para ações de escrita.
- Responda de forma curta e operacional.`;

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
