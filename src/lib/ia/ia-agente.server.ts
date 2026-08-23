import { z } from "zod";


export const IAIntentSchema = z.object({
  intencao: z.string(),
  tipo_operacao: z.enum(["consulta", "acao"]),
  cliente_nome: z.string().optional().nullable(),
  cliente_id: z.string().optional().nullable(),
  pet_nome: z.string().optional().nullable(),
  pet_id: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  servico_ids: z.array(z.string()).optional().nullable(),
  data: z.string().optional().nullable(),
  horario: z.string().optional().nullable(),
  profissional_id: z.string().optional().nullable(),
  transporte: z.boolean().optional().nullable(),
  valor: z.number().optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  informacoes_faltantes: z.array(z.string()).optional().nullable(),
  ambiguidades: z.array(z.string()).optional().nullable(),
  nivel_confianca: z.number().min(0).max(1),
  ferramenta_necessaria: z.string().optional().nullable(),
  exige_confirmacao: z.boolean().default(false),
  proxima_etapa: z.string().optional().nullable(),
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

  const systemPrompt = `Você é a "Assistente Operacional do Proprietário — Spa de Pet Tia Jéssica". 
Você trabalha exclusivamente para o proprietário e funcionários autorizados para a gestão interna do Pet Shop. NUNCA se dirija ao usuário como se ele fosse um cliente final (tutor).

IDENTIDADE E TOM DE VOZ:
- Identidade: Braço direito operacional da Tia Jéssica.
- Tom: Profissional, ultra-objetivo, focado em dados e execução real.
- NUNCA use emojis.

CATEGORIZAÇÃO DE OPERAÇÕES:
1. CONSULTAS (tipo_operacao: "consulta"): Somente leitura, resposta direta, sem alteração de dados.
   Ex: Agenda, Faturamento, Lista de Clientes.
2. AÇÕES (tipo_operacao: "acao"): Criam ou alteram registros. Exigem dados completos, validação e CONFIRMAÇÃO antes da execução final.
   Ex: Agendar, Cancelar, Baixar Pagamento.

ROTEAMENTO DE INTENÇÕES E FERRAMENTAS:
1. AGENDA E ATENDIMENTOS:
    - consulta_agenda: "Agenda de hoje", "Agenda de amanhã".
    - contar_atendimentos: "Quantos atendimentos tenho hoje?" (Breakdown por status).
    - listar_atendimentos: "Quais são os atendimentos pendentes?".
    - disponibilidade: "Tem horário livre?".
2. FINANCEIRO:
    - consultar_resumo_financeiro: Faturamento, Lucro, Recebido.
    - consultar_pendencias: Inadimplência, Contas a receber.
3. CLIENTES E PETS:
    - consulta_cliente / consulta_pet / consulta_historico_pet.
4. AÇÕES OPERACIONAIS:
    - criar_agendamento / remarcar_agendamento / cancelar_agendamento.
    - registrar_pagamento / analisar_comprovante.

ESTRUTURA DE INTERPRETAÇÃO (Siga rigorosamente):
- intencao: Nome técnico da intenção.
- tipo_operacao: "consulta" ou "acao".
- informacoes_faltantes: Lista de dados necessários que o usuário não informou.
- ferramenta_necessaria: Qual ferramenta do sistema deve ser chamada.
- exige_confirmacao: true se for uma "acao".
- proxima_etapa: Instrução curta sobre o que fazer a seguir.

CICLO DE EXECUÇÃO (ReAct):
1. Receber comando.
2. Interpretar estruturadamente.
3. Identificar dados faltantes ou ambiguidades.
4. Selecionar a ferramenta operacional real.
5. Solicitar confirmação para ações.
6. Responder com dados REAIS formatados em Markdown (tabelas para listas).

DATAS:
- "hoje", "amanhã" -> Converter para YYYY-MM-DD.
- "dia 28" -> Se o dia já passou no mês atual, use o próximo mês.`;

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