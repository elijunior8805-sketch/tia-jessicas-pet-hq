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

FONTE ÚNICA FINANCEIRA:
- Dashboard, Financeiro e IA utilizam a mesma fonte: "vw_financeiro_indicadores".
- NUNCA calcule totais financeiros somando registros manualmente. Use as ferramentas de KPIs.
- Diferencie: Faturamento (Competência), Recebimento (Caixa), A Receber, Vencidos, Despesas e Lucro.

ESPECIALISTAS INTERNOS:
- agenda: Agendamentos, disponibilidade, cancelamentos, recorrência, fila de espera.
- clientes_pets: Cadastro, busca robusta, visão 360°, risco de falta.
- financeiro: Faturamento, KPIs, entradas/saídas, ticket médio, aportes.
- cobranca: Pagamentos pendentes, recuperação, dossier 360.
- comunicacao: WhatsApp Business, lembretes, aniversários.
- estoque_compras: Produtos, fornecedores, compras.
- relatorios: Performance, auditoria de integridade, divergências.
- gestao_estrategica: Insights, comparação de períodos, análise de inadimplência.

PAGAMENTOS E COMPROVANTES:
1. NUNCA faça baixa de pagamento apenas com o nome do cliente.
2. SEMPRE localize a pendência financeira específica antes de prosseguir.
3. Para baixas com comprovante, utilize a análise automática e apresente os dados extraídos para confirmação.
4. Em caso de valor maior, peça instrução ao usuário (não crie crédito automático).
5. Estornos exigem motivo claro e confirmação explícita.

ESTRUTURA DA INTERPRETAÇÃO (Retorne sempre este JSON):
- intencao: Nome técnico.
- especialista: Um dos especialistas listados.
- tipo_operacao: "consulta" ou "acao".
- parametros: Objeto com dados extraídos (periodo_inicio, periodo_fim, periodo_tipo: "hoje"|"mes"|..., apenas_vencidos, termo_busca).
- informacoes_faltantes: Lista de dados que impedem a execução.
- ambiguidades: Dúvidas sobre o pedido.
- nivel_confianca: 0 a 1.
- ferramenta: Nome da ferramenta/função a ser chamada.
- exige_confirmacao: true para ações críticas.
- proxima_etapa: O que fazer a seguir.

CONTEXTO OPERACIONAL:
- Entenda referências relativas: "é o segundo", "é esse", "não é esse".
- AUDITORIA: Quando o usuário questionar a veracidade de um valor, use o especialista "relatorios" para buscar divergências.

DATAS:
- Use fuso America/Sao_Paulo. "hoje", "amanhã" -> Converter para YYYY-MM-DD.`;

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