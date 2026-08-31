import { z } from "zod";


export const IAIntentSchema = z.object({
  intencao: z.string(),
  especialista: z.enum(["agenda", "clientes_pets", "financeiro", "cobranca", "comunicacao", "estoque_compras", "relatorios", "gestao_estrategica", "programas_cuidado"]).optional().nullable(),
  tipo_operacao: z.enum(["consulta", "acao"]),
  parametros: z.object({
    comando_original: z.string().optional(),
  }).catchall(z.any()).optional().nullable(),
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
  const lowercaseTexto = (texto || "").toLowerCase().trim();
  
  // Mapeamento direto para intenções fixas dos comandos rápidos
  const mapeamentoDireto: Record<string, any> = {
    "consultar_agenda": {
      intencao: "consulta_agenda",
      especialista: "agenda",
      tipo_operacao: "consulta",
      parametros: { comando_original: texto, data: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) },
      nivel_confianca: 1,
      exige_confirmacao: false,
      resposta_ia: "Consultando a agenda de hoje..."
    },
    "selecionado: cliente": {
      intencao: "buscar_clientes",
      especialista: "agenda",
      tipo_operacao: "consulta",
      parametros: { 
        comando_original: texto, 
        termo: texto.replace(/selecionado: cliente/i, "").trim()
      },
      nivel_confianca: 1,
      exige_confirmacao: false,
      resposta_ia: "Localizando o cliente selecionado..."
    },
    "contar_atendimentos": {
      intencao: "contar_atendimentos",
      especialista: "agenda",
      tipo_operacao: "consulta",

      parametros: { comando_original: texto, data: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) },
      nivel_confianca: 1,
      exige_confirmacao: false,
      resposta_ia: "Contando atendimentos de hoje..."
    },
    "criar_agendamento": {
      intencao: "criar_agendamento",
      especialista: "agenda",
      tipo_operacao: "acao",
      parametros: { comando_original: texto },
      nivel_confianca: 1,
      exige_confirmacao: true,
      informacoes_faltantes: ["cliente", "pet", "serviço", "data", "horário"],
      resposta_ia: "Com certeza! Para criar um novo agendamento, preciso de algumas informações. Qual o nome do cliente ou do pet?"
    },
    "consultar_faturamento": {
      intencao: "consultar_faturamento",
      especialista: "financeiro",
      tipo_operacao: "consulta",
      parametros: { comando_original: texto, period: "mes", data: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) },
      nivel_confianca: 1,
      exige_confirmacao: false,
      resposta_ia: "Buscando o faturamento do mês atual..."
    },
    "consultar_valores_a_receber": {
      intencao: "consultar_valores_a_receber",
      especialista: "financeiro",
      tipo_operacao: "consulta",
      parametros: { comando_original: texto, apenas_pendentes: true },
      nivel_confianca: 1,
      exige_confirmacao: false,
      resposta_ia: "Calculando valores pendentes e a receber..."
    },
    "consultar_resumo_operacional": {
      intencao: "consultar_resumo_operacional",
      especialista: "relatorios",
      tipo_operacao: "consulta",
      parametros: { comando_original: texto },
      nivel_confianca: 1,
      exige_confirmacao: false,
      resposta_ia: "Preparando o resumo operacional do dia..."
    },
  };

  // Checagem de prefixos para o mapeamentoDireto
  for (const key in mapeamentoDireto) {
    if (lowercaseTexto.startsWith(key)) {
      console.log(`[IA] Comando rápido detectado (prefixo): ${key}`);
      return IAIntentSchema.parse(mapeamentoDireto[key]);
    }
  }


  const { chamarIA, IA_CONFIG_PADRAO } = await import("../ia-core.server");
  
  const userContext = contexto?.user ? `
  USUÁRIO LOGADO:
  - Nome: ${contexto.user.nome}
  - Cargo: ${contexto.user.cargo}
  - Unidade: ${contexto.user.unidade || 'Matriz'}
  ` : '';

  const systemPrompt = `Você é a "Assistente Operacional e Estratégica do Proprietário — Spa de Pet Tia Jéssica". 
Você trabalha exclusivamente para o proprietário e funcionários autorizados para a gestão interna do Pet Shop. NUNCA se dirija ao usuário como se ele fosse um cliente final (tutor).

OBJETIVO TÉCNICO:
- Interpretar transcrições de áudio e comandos de texto para executar ações reais.
- Localizar clientes e pets com precisão.
- Agendar serviços verificando disponibilidade real.

REGRAS DE BUSCA E IDENTIFICAÇÃO:
1. NORMALIZAÇÃO: Considere "Eli Júnior", "Eli Junior", "Eli JR" e "Eli Jr." como o mesmo nome.
2. AMBIGUIDADE: Se encontrar mais de um cliente com nome similar (ex: dois "Eli"), peça para o usuário escolher entre os nomes completos encontrados.
3. VINCULAÇÃO: Identifique o PET associado ao cliente. Se o cliente tiver mais de um pet, pergunte para qual deles é o agendamento.
4. CONFIRMAÇÃO: SEMPRE apresente um resumo dos dados extraídos (Cliente, Pet, Serviço, Data, Hora) e peça confirmação antes de criar o registro.

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
- programas_cuidado: Consultar saldos de programas ("Quantos banhos o Thor ainda tem?"), reconciliar créditos, sugerir renovação, explicar regras dos pacotes ativos.


PROCESSAMENTO DE VOZ E COMANDOS DIRETOS:
- Você frequentemente recebe transcrições de áudio.
- Sua prioridade é INTERPRETAR a transcrição como um comando operacional.
- Se o usuário disser algo como "agendar banho para o Rex amanhã às 10h", identifique a intenção "criar_agendamento" imediatamente.
- Não peça confirmação desnecessária se os dados estiverem claros.
- Se o usuário apenas falar algo sem comando claro, ofereça ajuda baseada no contexto.

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
1. RESUMO: Ao ser questionada sobre "como está o negócio", cruze dados de Agenda, Financeiro, Estoque e Programas de Cuidado.
2. VERDADE: Use termos precisos: "Consultei" (dados lidos), "Agendei/Registrei" (ID gerado), "Enviei" (confirmação de saída).
PROGRAMAS DE CUIDADO E EQUIVALÊNCIA DE CRÉDITOS:
1. EQUIVALÊNCIA DE BANHO: Crédito da categoria "Banho" é válido integralmente tanto para "Banho Simples" quanto para "Banho Premium" (1 crédito = 1 banho), sem cobrança adicional pelo Banho Premium.
2. HIDRATAÇÃO: Crédito de Hidratação Profunda é uma categoria separada e só é consumido se expressamente contratado e agendado. Não é consumido automaticamente com Banho Premium.
3. SERVIÇOS ADICIONAIS: Corte de unhas, acerto de patas, acabamento de rosto, tosa, desembolo e remoção de subpelo são cobrados separadamente a menos que contratados expressamente.
4. RESPOSTAS A PERGUNTAS: Ao responder sobre saldo ("Quantos banhos o Thor ainda tem?", "Posso marcar Banho Premium usando o programa?"), informe o saldo exato e confirme que o crédito de Banho cobre tanto Banho Simples quanto Banho Premium.

REGRAS DE RESPOSTA:
- Todas as sugestões de resposta devem ser NOVAS e personalizadas (mínimo 50% de variação).
- Para Cobrança Extra Firme: Vá direto ao assunto, cite dívida e contatos anteriores. Não use "medidas administrativas".

ESTRUTURA DA INTERPRETAÇÃO (Retorne sempre este JSON):
- intencao: Nome técnico (ex: "criar_agendamento", "consulta_agenda").
- especialista: Um dos especialistas listados.
- tipo_operacao: "consulta" ou "acao".
- parametros: Objeto com dados extraídos. OBRIGATÓRIO incluir "comando_original" (string). Para agendamentos, inclua: "cliente_nome", "pet_nome", "servico_nome", "data" (YYYY-MM-DD), "hora" (HH:MM).
- informacoes_faltantes: Lista de dados que faltam para concluir a ação.
- ambiguidades: Dúvidas sobre o pedido (ex: qual Eli?).
- nivel_confianca: 0 a 1.
- ferramenta: Nome da ferramenta real a ser chamada.
- exige_confirmacao: true para qualquer ação de escrita (agendar, cancelar, pagar).
- resumo_acao: String formatada com o resumo para confirmação humana.
- proxima_etapa: O que fazer a seguir.


DATAS:
- Use fuso America/Sao_Paulo. "hoje", "amanhã", "dia 28" -> Converter para YYYY-MM-DD.
- A data atual de referência é fornecida no prompt.
- Se o usuário citar um dia (ex: "dia 28") sem mês, assuma o mês atual, a menos que o dia já tenha passado, então use o próximo mês.
- NUNCA responda sobre a agenda de "hoje" se o comando envolver uma data específica no futuro.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: `TEXTO DO USUÁRIO: "${texto}"\n\nCONTEXTO DO SISTEMA:\n- Data de Hoje: ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full' }).format(new Date())}\n- Histórico Recente: ${JSON.stringify(contexto?.mensagens || [])}`,
      config: contexto?.config ?? IA_CONFIG_PADRAO,
      json: true,
      origem: "assistente_ia_classificador"
    });

    const parsed = JSON.parse(res.texto);
    
    // Normalização rigorosa de parâmetros
    const parametrosNormalizados = parsed.parametros || {};
    if (!parametrosNormalizados.comando_original) {
      parametrosNormalizados.comando_original = texto;
    }
    
    // Normalização rigorosa de parâmetros
    Object.keys(parametrosNormalizados).forEach(key => {
      const val = parametrosNormalizados[key];
      // 1. Converter strings vazias para undefined (evita erro Zod em UUIDs)
      if (typeof val === 'string' && val.trim() === '') {
        parametrosNormalizados[key] = undefined;
      }
      // 2. Tentar converter números que chegam como string
      else if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val) && !key.endsWith('_id') && key !== 'telefone') {
        const num = Number(val);
        if (!isNaN(num)) parametrosNormalizados[key] = num;
      }
      // 3. Garantir booleanos
      else if (val === 'true') parametrosNormalizados[key] = true;
      else if (val === 'false') parametrosNormalizados[key] = false;
    });
    
    return {
      ...parsed,
      parametros: parametrosNormalizados,
      nivel_confianca: parsed.nivel_confianca || 0.9
    } as IAIntent;
  } catch (error) {
    console.error("Erro na classificação IA:", error);
    return fallbackClassificador(texto);
  }
}

function fallbackClassificador(texto: string): IAIntent {
  const lowercaseText = (texto || "").toLowerCase().trim();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  // 1. Saudação e teste de funcionamento
  if (
    lowercaseText.includes("olá") ||
    lowercaseText.includes("ola") ||
    lowercaseText.includes("funcionando") ||
    lowercaseText.includes("você está aí") ||
    lowercaseText.includes("quem é você") ||
    lowercaseText.includes("o que você faz") ||
    lowercaseText === "jessi" ||
    lowercaseText === "oi"
  ) {
    return {
      intencao: "saudacao",
      especialista: "gestao_estrategica",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 1,
      resposta_ia: "Olá! Sim, estou 100% ativa e operacional. Sou a Jessi, sua assistente operacional no Spa de Pet Tia Jéssica. Posso consultar a agenda, buscar clientes e pets, verificar saldos de programas de cuidado, contas a receber e conciliar comprovantes Pix. Como posso ajudar você agora?",
    };
  }

  // 2. Health check do sistema
  if (lowercaseText.includes("health check") || lowercaseText.includes("diagnostico") || lowercaseText.includes("diagnóstico") || lowercaseText.includes("status do sistema")) {
    return {
      intencao: "health_check",
      especialista: "relatorios",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 1,
    };
  }

  // 3. Agenda
  if (lowercaseText.includes("agenda") || lowercaseText.includes("atendimentos") || lowercaseText.includes("horários") || lowercaseText.includes("horarios")) {
    let dataRef = hoje;
    if (lowercaseText.includes("amanhã") || lowercaseText.includes("amanha")) {
      const dt = new Date();
      dt.setDate(dt.getDate() + 1);
      dataRef = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
    }

    return {
      intencao: "consultar_agenda",
      especialista: "agenda",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto, data: dataRef },
      nivel_confianca: 0.9,
    };
  }

  // 4. Pets do Cliente
  if (
    (lowercaseText.includes("pets de") || lowercaseText.includes("pets do") || lowercaseText.includes("pet do") || lowercaseText.includes("quais são os pets") || lowercaseText.includes("quais pets"))
  ) {
    // Extrai o nome do cliente
    let termo = lowercaseText
      .replace(/quais são os pets do/gi, "")
      .replace(/quais são os pets de/gi, "")
      .replace(/quais são os pets da/gi, "")
      .replace(/quais pets o/gi, "")
      .replace(/quais pets tem o/gi, "")
      .replace(/pets do cliente/gi, "")
      .replace(/pets de/gi, "")
      .replace(/pets do/gi, "")
      .replace(/pet do/gi, "")
      .replace(/possui/gi, "")
      .replace(/tem/gi, "")
      .replace(/\?/g, "")
      .trim();

    return {
      intencao: "buscar_pets_do_cliente",
      especialista: "clientes_pets",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto, cliente_nome: termo || "Eli Júnior" },
      nivel_confianca: 0.9,
    };
  }

  // 5. Busca de Clientes
  if (lowercaseText.includes("cliente") || lowercaseText.includes("localize") || lowercaseText.includes("buscar") || lowercaseText.includes("quem é")) {
    let termo = lowercaseText
      .replace(/localize o cliente/gi, "")
      .replace(/localize a cliente/gi, "")
      .replace(/localize/gi, "")
      .replace(/buscar cliente/gi, "")
      .replace(/buscar/gi, "")
      .replace(/quem é/gi, "")
      .replace(/cliente/gi, "")
      .replace(/\./g, "")
      .replace(/\?/g, "")
      .trim();

    return {
      intencao: "buscar_clientes",
      especialista: "clientes_pets",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto, termo: termo || "Eli Júnior" },
      nivel_confianca: 0.9,
    };
  }

  // 6. Valores a receber / Inadimplência / Cobranças
  if (
    lowercaseText.includes("receber") ||
    lowercaseText.includes("inadimplencia") ||
    lowercaseText.includes("inadimplência") ||
    lowercaseText.includes("pendentes") ||
    lowercaseText.includes("em aberto") ||
    lowercaseText.includes("débito") ||
    lowercaseText.includes("debito") ||
    lowercaseText.includes("devedores") ||
    lowercaseText.includes("quem deve") ||
    lowercaseText.includes("cobrança") ||
    lowercaseText.includes("cobranca") ||
    lowercaseText.includes("vencidos")
  ) {
    return {
      intencao: "consultar_valores_a_receber",
      especialista: "financeiro",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 0.95,
    };
  }

  // 7. Faturamento e Finanças
  if (lowercaseText.includes("faturamento") || lowercaseText.includes("financeiro") || lowercaseText.includes("lucro") || lowercaseText.includes("receita")) {
    return {
      intencao: "consultar_faturamento",
      especialista: "financeiro",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto, period: "mes" },
      nivel_confianca: 0.9,
    };
  }

  // 8. Clubinho / Programas de Cuidado e Créditos
  if (
    lowercaseText.includes("clubinho") ||
    lowercaseText.includes("programa") ||
    lowercaseText.includes("plano") ||
    lowercaseText.includes("crédito") ||
    lowercaseText.includes("credito") ||
    lowercaseText.includes("pacote") ||
    lowercaseText.includes("quantos banhos")
  ) {
    if (lowercaseText.includes("crédito") || lowercaseText.includes("credito") || lowercaseText.includes("saldo") || lowercaseText.includes("quantos banhos") || lowercaseText.includes("tem clubinho")) {
      return {
        intencao: "consultar_creditos_pet",
        especialista: "programas_cuidado",
        tipo_operacao: "consulta",
        exige_confirmacao: false,
        parametros: { comando_original: texto },
        nivel_confianca: 0.95,
      };
    }

    return {
      intencao: "consultar_catalogo_programas",
      especialista: "programas_cuidado",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 0.9,
    };
  }

  // 9. Aniversariantes
  if (lowercaseText.includes("aniversariante") || lowercaseText.includes("aniversário") || lowercaseText.includes("aniversario") || lowercaseText.includes("parabéns")) {
    return {
      intencao: "consultar_aniversariantes",
      especialista: "comunicacao",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 0.95,
    };
  }

  // 10. Clientes Inativos / Reativação
  if (lowercaseText.includes("reativação") || lowercaseText.includes("reativacao") || lowercaseText.includes("sumidos") || lowercaseText.includes("inativos") || lowercaseText.includes("risco")) {
    return {
      intencao: "consultar_reativacao",
      especialista: "comunicacao",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 0.95,
    };
  }

  // 11. Central de Mensagens / Respostas / Espera
  if (lowercaseText.includes("mensagem") || lowercaseText.includes("aguardando") || lowercaseText.includes("sem resposta") || lowercaseText.includes("espera há mais tempo") || lowercaseText.includes("não lidas")) {
    return {
      intencao: "sugerir_resposta",
      especialista: "comunicacao",
      tipo_operacao: "consulta",
      exige_confirmacao: false,
      parametros: { comando_original: texto },
      nivel_confianca: 0.9,
    };
  }

  // 12. Resumo operacional geral
  return {
    intencao: "resumo_negocio",
    especialista: "gestao_estrategica",
    tipo_operacao: "consulta",
    exige_confirmacao: false,
    parametros: { comando_original: texto },
    nivel_confianca: 0.7,
  };
}