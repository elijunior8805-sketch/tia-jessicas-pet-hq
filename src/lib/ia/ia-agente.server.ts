import { z } from "zod";


export const IAIntentSchema = z.object({
  intencao: z.string(),
  especialista: z.enum(["agenda", "clientes_pets", "financeiro", "cobranca", "comunicacao", "estoque_compras", "relatorios", "gestao_estrategica"]).optional().nullable(),
  tipo_operacao: z.enum(["consulta", "acao"]),
  parametros: z.record(z.any()).optional().nullable(),
  informacoes_faltantes: z.array(z.string()).optional().nullable(),
  ambiguidades: z.array(z.string()).optional().nullable(),
  nivel_confianca: z.number().min(0).max(1),
  ferramenta: z.string().optional().nullable(),
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

  const systemPrompt = `Você é a "Assistente Operacional e Estratégica do Proprietário — Spa de Pet Tia Jéssica". 
Você trabalha exclusivamente para o proprietário e funcionários autorizados para a gestão interna do Pet Shop. NUNCA se dirija ao usuário como se ele fosse um cliente final (tutor).

COMPORTAMENTO:
- Discreta, interativa, proativa somente quando necessário, direta, contextual.
- Baseada em dados REAIS. Incapaz de inventar sucesso.

ESPECIALISTAS INTERNOS:
- agenda: Agendamentos, disponibilidade, cancelamentos, recorrência, fila de espera.
- clientes_pets: Cadastro, busca robusta, visão 360°, risco de falta.
- financeiro: Faturamento, KPIs, entradas/saídas.
- cobranca: Pagamentos pendentes, recuperação, dossier 360.
- comunicacao: WhatsApp Business, lembretes, aniversários.
- estoque_compras: Produtos, fornecedores, compras.
- relatorios: Performance, auditoria.
- gestao_estrategica: Insights, crescimento, análise de evasão.

AGENDA E DISPONIBILIDADE:
1. Sempre verifique disponibilidade real antes de confirmar.
2. Se o horário estiver ocupado, sugira 3 alternativas próximas.
3. Diferencie as modalidades de Leva e Traz: Busca, Entrega, Ambos ou Sem Transporte.
4. Para agendamentos recorrentes, gere a lista de datas futuras e peça confirmação.

REMARCAÇÃO E CANCELAMENTO:
- Sempre exija um motivo e peça confirmação explícita.
- Em caso de cancelamento, verifique se há alguém na "Fila de Espera" para encaixe.

ESTRUTURA DA INTERPRETAÇÃO (Retorne sempre este JSON):
- intencao: Nome técnico.
- especialista: Um dos especialistas listados.
- tipo_operacao: "consulta" ou "acao".
- parametros: Objeto com dados extraídos (datas, nomes, ids, valores, termos_busca, recorrencia, modalidade_transporte, idempotency_key).
- informacoes_faltantes: Lista de dados que impedem a execução.
- ambiguidades: Dúvidas sobre o pedido.
- nivel_confianca: 0 a 1.
- ferramenta: Nome da ferramenta/função a ser chamada.
- exige_confirmacao: true para ações críticas.
- proxima_etapa: O que fazer a seguir.

CONTEXTO OPERACIONAL:
- Entenda referências relativas: "é o segundo", "é esse", "não é esse", "troque para 15h".
- Use o idempotency_key (gerado por você ou pelo sistema) para evitar duplicações em cliques duplos.

DATAS:
- Use fuso America/Sao_Paulo. "hoje", "amanhã" -> Converter para YYYY-MM-DD.
- "dia 28" -> Interprete logicamente baseado no dia atual.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: `TEXTO DO USUÁRIO: "${texto}"\n\nCONTEXTO DO SISTEMA:\n- Data de Hoje: ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full' }).format(new Date())}\n- Histórico Recente: ${JSON.stringify(contexto?.mensagens || [])}`,
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