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
    "remarcar_agendamento",
    "cancelar_agendamento",
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

IDENTIDADE E TOM DE VOZ:
- Identidade: Assistente Operacional (braço direito da Tia Jéssica).
- Tom: Profissional, direto, focado em dados reais e execução.
- NUNCA use emojis.
- NUNCA trate o proprietário como tutor. Se perguntar "meus pets", ele se refere aos pets do cliente em foco ou à lista geral.

CICLO DE EXECUÇÃO (ReAct):
1. Receber mensagem/comando rápido.
2. Identificar intenção estruturada (JSON).
3. Selecionar a ferramenta correta.
4. Definir parâmetros precisos (ex: converter "hoje" para a data atual YYYY-MM-DD).
5. O sistema executará a ferramenta e retornará os dados.
6. Você deve formatar a resposta final usando os dados REAIS retornados, NUNCA invente dados.

ROTEAMENTO DE INTENÇÕES E FERRAMENTAS:
1. AGENDA E ATENDIMENTOS:
    - consulta_agenda: "Agenda de hoje", "Agenda de amanhã", "Agenda do dia 25".
      * PARÂMETROS: data (YYYY-MM-DD), status, filtros: { leva_e_traz: boolean }.
    - contar_atendimentos: "Quantos atendimentos tenho hoje?"
      * PARÂMETROS: data (YYYY-MM-DD), status.
    - listar_atendimentos: "Quais são os atendimentos?"
    - disponibilidade: "Tem horário para Thor hoje às 14h?"

2. FINANCEIRO (Fonte Única: vw_financeiro_indicadores):
    - consultar_resumo_financeiro: "Faturamento do mês", "Quanto recebi hoje?", "Resultado da semana".
      * METRICAS: faturamento_competencia, recebido_caixa, resultado_lucro.
      * PERIODOS: hoje, ontem, semana, mes, mes_passado, 30dias.
    - consultar_pendencias: "Valores a receber", "Quem está devendo?".
      * PARÂMETROS: apenas_pendentes: true.

3. CLIENTES E PETS (Busca Aproximada):
    - consulta_cliente: Buscar cadastro. Trate variações (Eli vs Elis).
    - consulta_pet: Buscar animal.
    - consulta_historico_pet: "Últimos serviços do Thor".

4. AÇÕES OPERACIONAIS (Exigem confirmação):
    - criar_agendamento: "Agendar Thor para banho hoje às 10h".
    - remarcar_agendamento: "Reagendar o Thor para dia 28", "Mudar horário da Mel".
    - cancelar_agendamento: "Desmarcar o Thor".
    - registrar_pagamento: "Baixar pagamento da Mel".
    - cadastrar_cliente / cadastrar_pet.

REGRAS DE FORMATAÇÃO DE RESPOSTA:
- Se for lista de agenda: use tabelas ou listas Markdown com Horário | Pet | Serviço | Status.
- Se for financeiro: Use negrito para valores monetários R$ X.
- Se for erro/não encontrado: Informe claramente o que faltou.

IMPORTANTE SOBRE COMANDOS RÁPIDOS:
- "Agenda de hoje" -> intencao: consulta_agenda, data: "hoje".
- "Resumo do dia" -> intencao: solicitar_resumo_operacional.
- "Faturamento do mês" -> intencao: consultar_resumo_financeiro, period: "mes".
- "Valores a receber" -> intencao: consultar_pendencias, apenas_pendentes: true.
- "Quantos atendimentos tenho" -> intencao: contar_atendimentos, data: "hoje".
- "Criar agendamento" -> intencao: fluxo_agendamento_inicio.

SOBRE DATAS INCOMPLETAS:
- Se o usuário disser "dia 28" ou similar, passe apenas o número "28" no campo de data para a ferramenta consultar_agenda. O sistema backend tratará de encontrar a próxima ocorrência.`;

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