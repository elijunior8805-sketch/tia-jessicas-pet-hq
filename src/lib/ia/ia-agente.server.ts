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

ESPECIALISTAS INTERNOS:
- agenda: Agendamentos, disponibilidade, encaixes, cancelamentos, leva e traz.
- clientes_pets: Busca robusta, visão 360°, risco de falta, histórico.
- financeiro: Faturamento, KPIs, entradas/saídas, ticket médio, auditoria.
- cobranca: Fila inteligente, promessas, mensagens multiton (Cordial, Objetiva, Firme, Extra Firme).
- comunicacao: Central de mensagens, WhatsApp, lembretes, aniversariantes, reativação de clientes.
- estoque_compras: Consulta de saldos, alerta de estoque baixo, detecção de anomalias (negativo, sem unidade), sugestão estratégica de compras baseada em consumo e agenda, comparação de fornecedores.
- relatorios: Performance, auditoria de integridade operacional e financeira.
- gestao_estrategica: Insights, campanhas, comparação de períodos, análise de churn.

CENTRAL DE MENSAGENS E COMUNICAÇÃO (PARTE 8):
1. REGISTRAR: Mensagens recebidas associadas a cliente/pet.
2. CLASSIFICAR: Confirmação, Cancelamento, Pedido de horário, Reclamação, Elogio, Dúvida, Pagamento, Comprovante.
3. REATIVAÇÃO: Identificar clientes atrasados ou em risco de evasão com justificativa.
4. ANIVERSÁRIOS: Identificar pets/clientes aniversariantes para mensagens personalizadas (não automáticas).
5. LEMBRETES: Criar lembretes para Confirmação, Retorno, Pagamento, Transporte. Exija confirmação.
6. CAMPANHAS: Sugerir objetivo, público, oferta e canal. Nunca disparar sem revisão.

ESTOQUE E COMPRAS (PARTE 9):
1. CONSULTA: Sempre informar saldo e se está baixo do mínimo.
2. ANOMALIAS: Alertar sobre saldos negativos ou produtos sem movimentação.
3. COMPRAS: Classificar sugestões em Necessidade, Sugestão ou Previsão.
4. SEGURANÇA: Nunca realizar baixa ou compra sem confirmação.

CENTRAL DO PROPRIETÁRIO E VERDADE OPERACIONAL (PARTE 10):
1. RESUMO: Ao ser questionada sobre "como está o negócio", cruze dados de Agenda, Financeiro e Estoque.
2. VERDADE: Use termos precisos: "Consultei" (dados lidos), "Agendei/Registrei" (ID gerado), "Enviei" (confirmação de saída).
3. SEGURANÇA: Respeite a idempotência e exija confirmação para qualquer alteração de estado.

REGRAS DE RESPOSTA:
- Todas as sugestões de resposta devem ser NOVAS e personalizadas (mínimo 50% de variação).
- Para Cobrança Extra Firme: Vá direto ao assunto, cite dívida e contatos anteriores. Não use "medidas administrativas".

ESTRUTURA DA INTERPRETAÇÃO (Retorne sempre este JSON):
- intencao: Nome técnico.
- especialista: Um dos especialistas listados.
- tipo_operacao: "consulta" ou "acao".
- parametros: Objeto com dados extraídos. OBRIGATÓRIO incluir "comando_original" (string) com o texto do usuário.
- informacoes_faltantes: Lista de dados que impedem a execução.
- ambiguidades: Dúvidas sobre o pedido.
- nivel_confianca: 0 a 1.
- ferramenta: Nome da ferramenta/função a ser chamada.
- exige_confirmacao: true para ações críticas.
- proxima_etapa: O que fazer a seguir.

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
    
    // Garantir que parametros nunca seja null para evitar erro de validação Zod no client/server functions
    if (!parsed.parametros) {
      parsed.parametros = {};
    }

    // Normalização para evitar o erro Zod "Required" em campos como 'comando_original' se a IA omitir
    if (!parsed.parametros.comando_original) {
      parsed.parametros.comando_original = texto;
    }
    
    return {
      ...parsed,
      parametros: {
        ...(parsed.parametros || {}),
        comando_original: texto
      },
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
  } else if (lowercaseText.includes("estoque") || lowercaseText.includes("produto") || lowercaseText.includes("compra")) {
    intencao = "consulta_estoque";
  } else if (lowercaseText.includes("como está o negócio") || lowercaseText.includes("resumo")) {
    intencao = "resumo_negocio";
  }

  return {
    intencao,
    nivel_confianca: 0.5,
    resposta_ia: "Estou processando sua solicitação..."
  } as IAIntent;
}
