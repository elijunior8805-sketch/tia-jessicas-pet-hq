import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import {
  IJessiV2AIProvider,
  JessiV2NLURequest,
  JessiV2NLUResponse,
  JessiV2GenerativeRequest,
  JessiV2GenerativeResponse,
} from "./jessi-v2-provider.interface";
import {
  JessiV2Card,
  JessiV2PendingAction,
  JessiV2ProcessOutput,
} from "../contracts/jessi-v2-contracts";
import { JessiV2ContextState } from "../session/jessi-v2-session";
import { JESSI_V2_SYSTEM_PROMPT } from "../config/jessi-v2-config";
import { despacharFerramentaV2 } from "../tools/jessi-v2-tools.registry";
import { AgendaAdapter, partirDataHora } from "../adapters/agenda.adapter";
import { ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { FinanceiroRelatoriosAdapter } from "../adapters/financeiro-relatorios.adapter";
import { ProgramasCreditosAdapter } from "../adapters/programas-creditos.adapter";
import { ProativoAdapter } from "../adapters/proativo.adapter";
import { SentinelasAdapter } from "../adapters/sentinelas.adapter";
import { AnalyticsAdapter } from "../adapters/analytics.adapter";

/**
 * Provedor de IA Conversacional e Agente Autônomo com Tool Calling (Gemini 1.5 Flash / Lovable Gateway)
 * Desenvolvido para entregar 100% da capacidade cognitiva e operacional da Jessi
 */

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_CONFIG = {
  TIMEOUT_MS: 15000,
  MAX_RETRIES: 2,
  MODEL: "google/gemini-1.5-flash",
  GROQ_MODEL: "llama-3.3-70b-versatile",
  DIRECT_ENDPOINT_BASE: "https://generativelanguage.googleapis.com/v1beta/models",
};

/**
 * Catálogo de Ferramentas no padrão OpenAI/Lovable Tools Schema
 */
export const OPENAI_TOOLS_SCHEMA: any[] = [
  {
    type: "function",
    function: {
      name: "consultar_agenda",
      description: "Consulta a grade e lista oficial de agendamentos do Pet Spa para uma data específica.",
      parameters: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description: "Data no formato YYYY-MM-DD (ex: '2026-09-28'). Se omitido, consulta hoje.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_clientes_pets",
      description: "Pesquisa clientes/tutores ou pets por nome, telefone ou raça. Se o termo for vazio ou omitido, retorna a lista dos clientes mais recentes cadastrados.",
      parameters: {
        type: "object",
        properties: {
          termo: {
            type: "string",
            description: "Nome do cliente, telefone, nome do pet ou termo de busca. Deixe em branco para clientes recentes.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_ficha_pet",
      description: "Obtém a ficha cadastral detalhada, histórico, raça, porte e observações médicas de um pet.",
      parameters: {
        type: "object",
        properties: {
          petId: { type: "string", description: "UUID do pet" },
        },
        required: ["petId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_ficha_cliente",
      description: "Obtém a ficha completa do cliente com telefone, endereço, lista de pets e saldo.",
      parameters: {
        type: "object",
        properties: {
          clienteId: { type: "string", description: "UUID do cliente" },
        },
        required: ["clienteId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_horarios_disponiveis",
      description: "Verifica horários livres, encaixes e vagas disponíveis na grade de atendimento.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          porte: { type: "string", description: "Porte do pet (pequeno, medio, grande)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_analise_negocio",
      description: "Gera relatórios analíticos avançados de desempenho do Pet Spa (ex: faturamento por porte e raça, concentração por bairro, pico por dia da semana, cancelamentos).",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            description: "Tipo da análise: 'porte_raca', 'bairro', 'dia_semana', 'cancelamentos'",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_financeiro_consolidado",
      description: "Consulta o faturamento oficial, ticket médio, valores recebidos e contas pendentes a receber do Spa.",
      parameters: {
        type: "object",
        properties: {
          periodo: {
            type: "string",
            enum: ["hoje", "semana", "mes"],
            description: "Período para apuração financeira",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_saldo_programas",
      description: "Consulta o saldo de créditos restantes e contratos do Clubinho (planos mensais/recorrentes) de um cliente ou pet.",
      parameters: {
        type: "object",
        properties: {
          clienteId: { type: "string", description: "UUID do cliente" },
          petId: { type: "string", description: "UUID do pet" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_programas_ativos_geral",
      description: "Consulta todos os contratos ativos do Clubinho no Spa de Pet (visão geral dos planos).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "identificar_clientes_retorno",
      description: "Identifica clientes e pets ausentes há mais de 25 dias para campanhas de reativação e retorno.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_aniversariantes",
      description: "Lista os pets e tutores aniversariantes de hoje ou dos próximos dias para ações de fidelização e mimos.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_mensagens_cobranca",
      description: "Lista clientes devedores com mensagens cordiais e chave Pix para envio no WhatsApp.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_analise_negocio",
      description: "Realiza análises estatísticas cruzadas da operação: faturamento por porte/raça, dias de pico, bairros ou cancelamentos.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            description: "porte_raca | dia_semana | bairro | cancelamentos",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verificar_sentinelas",
      description: "Executa varredura de atrasos de chegada de pets, vagas por cancelamento e fechamento de caixa.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "otimizar_rotas_leva_traz",
      description: "Organiza as rotas e itinerário de transporte Leva e Traz para o dia.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_agendamento",
      description: "Prepara uma proposta de novo agendamento na grade para confirmação supervisionada do operador.",
      parameters: {
        type: "object",
        properties: {
          clienteNome: { type: "string", description: "Nome do cliente/tutor" },
          petNome: { type: "string", description: "Nome do pet" },
          data: { type: "string", description: "Data YYYY-MM-DD" },
          hora: { type: "string", description: "Horário HH:mm (ex: '14:00')" },
          servicoNome: { type: "string", description: "Nome do serviço (ex: 'Banho', 'Tosa')" },
          valor: { type: "number", description: "Valor previsto em R$" },
        },
        required: ["data", "hora"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_cancelamento",
      description: "Prepara o cancelamento de um agendamento existente para confirmação supervisionada.",
      parameters: {
        type: "object",
        properties: {
          agendamentoId: { type: "string", description: "ID do agendamento a cancelar" },
          petNome: { type: "string", description: "Nome do pet" },
          motivo: { type: "string", description: "Motivo do cancelamento" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_reagendamento",
      description: "Prepara a remarcação de um agendamento para nova data/hora para confirmação.",
      parameters: {
        type: "object",
        properties: {
          agendamentoId: { type: "string", description: "ID do agendamento" },
          novaData: { type: "string", description: "Nova data YYYY-MM-DD" },
          novaHora: { type: "string", description: "Novo horário HH:mm" },
          petNome: { type: "string", description: "Nome do pet" },
        },
        required: ["novaData", "novaHora"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_central_proativa",
      description: "Gera o panorama proativo em tempo real do Spa: alertas críticos, encaixes do dia, aniversariantes e oportunidades de retorno.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_resumo_operacional",
      description: "Consulta o resumo executivo operacional do negócio: ocupação, faturamento consolidado, status de banho e tosa.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "identificar_horarios_vagos",
      description: "Identifica horários ociosos na grade de banho e tosa para ofertar encaixes ou promoções de preenchimento.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sugerir_encaixes_reativacao",
      description: "Cruza clientes com saudades/ausentes com horários vagos de hoje/amanhã para sugerir convites de encaixe.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "processar_comprovante",
      description: "Analisa comprovante de transferência Pix ou depósito bancário para validação de dados.",
      parameters: {
        type: "object",
        properties: {
          textoComprovante: { type: "string", description: "Texto extraído do comprovante ou OCR" },
          valor: { type: "number", description: "Valor monetário do comprovante" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "conciliar_comprovante",
      description: "Localiza a pendência financeira correspondente e concilia o pagamento com o comprovante apresentado.",
      parameters: {
        type: "object",
        properties: {
          comprovanteId: { type: "string", description: "ID do comprovante ou dados de conciliação" },
          clienteId: { type: "string", description: "UUID do cliente" },
          valor: { type: "number", description: "Valor pago" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_mensagem_whatsapp",
      description: "Gera mensagem humanizada e cordial pronta para disparo no WhatsApp do tutor.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["cobranca", "lembrete_horario", "aniversario", "saudade_reativacao", "pronto_retirada"],
            description: "Finalidade da mensagem",
          },
          clienteNome: { type: "string", description: "Nome do cliente/tutor" },
          petNome: { type: "string", description: "Nome do pet" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sugerir_resposta",
      description: "Sugere resposta empática para dúvidas ou mensagens enviadas por clientes no canal de atendimento.",
      parameters: {
        type: "object",
        properties: {
          mensagemCliente: { type: "string", description: "Mensagem recebida do cliente" },
          clienteNome: { type: "string", description: "Nome do cliente" },
        },
        required: ["mensagemCliente"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auditoria_integridade",
      description: "Realiza checagem de integridade relacional entre clientes, pets, agendamentos e contratos.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "qualidade_ia",
      description: "Consulta métricas de qualidade, taxa de acerto e tempo médio de resposta da Jessi.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_cadastro_cliente",
      description: "Prepara a criação de um novo cadastro de cliente/tutor no Spa para confirmação supervisionada.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do tutor" },
          telefone: { type: "string", description: "Número de WhatsApp ou telefone" },
          email: { type: "string", description: "E-mail do cliente (opcional)" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_consumo_credito",
      description: "Prepara a baixa/consumo de 1 banho ou serviço do pacote do Clubinho para confirmação.",
      parameters: {
        type: "object",
        properties: {
          clienteId: { type: "string", description: "UUID do cliente" },
          petId: { type: "string", description: "UUID do pet" },
          contratoId: { type: "string", description: "UUID do contrato ativo" },
        },
        required: ["petId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_estorno",
      description: "Prepara o estorno de um pagamento registrado para confirmação supervisionada.",
      parameters: {
        type: "object",
        properties: {
          pagamentoId: { type: "string", description: "ID do pagamento a estornar" },
          motivo: { type: "string", description: "Motivo do estorno" },
        },
        required: ["pagamentoId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_termo_programa_pdf",
      description: "Gera o termo de adesão em PDF do Clubinho para impressão ou envio digital.",
      parameters: {
        type: "object",
        properties: {
          contratoId: { type: "string", description: "UUID do contrato do Clubinho" },
        },
        required: ["contratoId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_cobranca_pix_mercadopago",
      description: "Gera uma cobrança Pix online oficial via Mercado Pago com QR Code dinâmico e código Pix Copia-e-Cola.",
      parameters: {
        type: "object",
        properties: {
          valor: { type: "number", description: "Valor da cobrança em R$" },
          descricao: { type: "string", description: "Descrição do serviço prestado" },
          clienteNome: { type: "string", description: "Nome do cliente/tutor" },
          clienteTelefone: { type: "string", description: "Telefone do cliente para envio no WhatsApp" },
        },
        required: ["valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_link_pagamento_mercadopago",
      description: "Gera um link de pagamento Mercado Pago (Checkout Pro) para cartão de crédito parcelado.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título do pagamento ou serviço" },
          valor: { type: "number", description: "Valor em R$" },
          clienteNome: { type: "string", description: "Nome do cliente" },
        },
        required: ["valor"],
      },
    },
  },
];

export class JessiV2GeminiProvider implements IJessiV2AIProvider {
  readonly nome = "Gemini-1.5-Flash-Autonomous-Agent";

  /**
   * Obtém a chave de API do ambiente do servidor, Vite env ou variáveis de runtime
   */
  public obterApiKeyServidor(): {
    key: string;
    isGateway: boolean;
    endpoint: string;
    model: string;
  } | null {
    let chave = "";

    if (typeof process !== "undefined" && process.env) {
      chave =
        process.env.LOVABLE_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GROQ_API_KEY ||
        "";
    }

    if (!chave && typeof import.meta !== "undefined" && (import.meta as any).env) {
      const env = (import.meta as any).env;
      chave =
        env.VITE_GROQ_API_KEY ||
        env.GROQ_API_KEY ||
        env.VITE_LOVABLE_API_KEY ||
        env.LOVABLE_API_KEY ||
        env.VITE_OPENAI_API_KEY ||
        env.OPENAI_API_KEY ||
        env.VITE_GEMINI_API_KEY ||
        env.GEMINI_API_KEY ||
        env.VITE_GOOGLE_AI_API_KEY ||
        env.GOOGLE_AI_API_KEY ||
        "";
    }

    if (!chave && typeof globalThis !== "undefined") {
      chave = (globalThis as any).__JESSI_API_KEY__ || "";
    }

    // Sem chave configurada — logar erro claro em vez de tentar token inválido
    if (!chave) {
      console.error("[JessiV2] ERRO CRÍTICO: Nenhuma chave de IA configurada. Configure GROQ_API_KEY ou GEMINI_API_KEY no .env");
      return null;
    }

    // Groq (chaves começam com gsk_) — endpoint dedicado ultra-rápido
    if (chave.startsWith("gsk_")) {
      return {
        key: chave,
        isGateway: false,
        endpoint: GROQ_ENDPOINT,
        model: GEMINI_CONFIG.GROQ_MODEL,
      };
    }

    // Se a chave for do Google AI Studio direta (começa com AIzaSy)
    if (chave.startsWith("AIzaSy")) {
      return {
        key: chave,
        isGateway: false,
        endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        model: "gemini-1.5-flash",
      };
    }

    // Padrão Lovable Gateway
    return {
      key: chave,
      isGateway: true,
      endpoint: LOVABLE_GATEWAY,
      model: GEMINI_CONFIG.MODEL,
    };
  }

  /**
   * Executa chamada segura com timeout e retentativas
   */
  private async executarRequisicaoIA(
    messages: Array<{ role: string; content: string }>,
    jsonFormat = false,
    temperature = 0.4
  ): Promise<string> {
    const auth = this.obterApiKeyServidor();
    if (!auth) {
      throw new Error("Nenhuma chave de API configurada no ambiente.");
    }

    for (let tentativa = 1; tentativa <= GEMINI_CONFIG.MAX_RETRIES; tentativa++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_CONFIG.TIMEOUT_MS);

      try {
        const body: any = {
          model: auth.model,
          temperature,
          messages,
        };
        if (jsonFormat) {
          body.response_format = { type: "json_object" };
        }

        const resp = await fetch(auth.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.key}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 120)}`);
        }

        const data: any = await resp.json();
        const texto = data?.choices?.[0]?.message?.content?.trim();
        if (texto) return texto;

        throw new Error("Provedor retornou resposta vazia.");
      } catch (err: any) {
        clearTimeout(timer);
        if (tentativa >= GEMINI_CONFIG.MAX_RETRIES) throw err;
        await new Promise((res) => setTimeout(res, tentativa * 350));
      }
    }

    throw new Error("Falha na comunicação com o provedor de IA após retentativas.");
  }

  /**
   * MOTOR DO AGENTE AUTÔNOMO COM TOOL CALLING (LOOP MULTI-PASSOS)
   * A IA recebe a pergunta, decide quais ferramentas consultar no Supabase, raciocina sobre os dados e responde naturalmente.
   */
  async executarAgenteAutonomo(params: {
    sb: SupabaseClient<Database>;
    mensagemUsuario: string;
    contexto: JessiV2ContextState;
    historico?: any[];
    user?: { id: string; nome?: string; cargo?: string };
    canal?: string;
    modoBancada?: boolean;
  }): Promise<{
    respostaTexto: string;
    cards: JessiV2Card[];
    pendingAction: JessiV2PendingAction | null;
    novoContexto: Partial<JessiV2ContextState>;
  }> {
    const { sb, mensagemUsuario, contexto, historico = [], user, canal, modoBancada } = params;
    const auth = this.obterApiKeyServidor();

    const hojeStr =
      contexto.dataReferencia ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    const horaAtualStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    // 1. CARREGA SNAPSHOT OPERACIONAL EM TEMPO REAL DO SPA
    let snapshotTexto = "";
    let totalAgendadosHoje = 0;
    let vagasHojeTexto = "";
    let faturamentoMes = 0;
    let listaInativosQtd = 0;

    try {
      const [resAgendaHoje, resFinHoje, resVagasHoje, resInativos] = await Promise.all([
        sb.from("agendamentos").select("id, hora, status, pets(nome), clientes(nome), servicos(nome), leva_traz_modalidade").eq("data", hojeStr).order("hora", { ascending: true }),
        sb.from("pagamentos").select("valor, valor_total, valor_pago, status").gte("data_pagamento", `${hojeStr.slice(0, 7)}-01`),
        AgendaAdapter.identificarEncaixesDisponiveis(sb, hojeStr).catch(() => null),
        sb.from("clientes").select("id, nome, pets(nome)").limit(10),
      ]);

      totalAgendadosHoje = resAgendaHoje?.data?.length || 0;
      const proximosHoje = (resAgendaHoje?.data || [])
        .map((a: any) => `${(a.pets as any)?.nome || "Pet"} às ${(a.hora || "").slice(0, 5)} (${(a.servicos as any)?.nome || "Banho"}, tutor: ${(a.clientes as any)?.nome || "Tutor"})`)
        .join("; ");
      vagasHojeTexto = (resVagasHoje as any)?.data?.horariosSugeridos?.slice(0, 5).join(", ") || "vagas livres a consultar";
      faturamentoMes = (resFinHoje?.data || []).reduce((acc: number, p: any) => acc + Number(p.valor_pago || p.valor_total || p.valor || 0), 0);
      listaInativosQtd = resInativos?.data?.length || 0;

      snapshotTexto = `
DADOS OPERACIONAIS EM TEMPO REAL DO SPA:
- Data de Referência: ${hojeStr} (${horaAtualStr})
- Atendimentos agendados hoje (${totalAgendadosHoje}): ${proximosHoje || "Nenhum agendamento agendado até o momento para hoje"}
- Horários livres hoje na grade: ${vagasHojeTexto}
- Faturamento do mês: R$ ${faturamentoMes.toFixed(2)}
- Clientes com potencial de reativação: ${listaInativosQtd} tutores disponíveis
`;
    } catch (errSnap) {
      console.warn("[JessiV2] Aviso ao carregar snapshot em tempo real:", errSnap);
    }

    const ehVoz = canal === "voz" || Boolean(modoBancada);
    const instrucaoVoz = ehVoz
      ? `
MODO BANCADA / CANAL DE VOZ ATIVO:
- O operador está na bancada de banho e tosa ouvindo suas respostas por voz (TTS).
- Responda em no máximo 2 a 3 frases faladas curtas, calorosas, expressivas e diretas.
- NUNCA use marcadores de tópicos (•, -, *), numerações ou tabelas na fala.
- Se houver múltiplos atendimentos na lista, cite apenas o próximo da fila e o total geral.
- Use tom humano e expressões naturais como "Com certeza, Eli!", "Deixa comigo!", "Prontinho!".`
      : "";

    const systemPrompt = `${JESSI_V2_SYSTEM_PROMPT}

CONTEXTO TEMPORAL E OPERACIONAL ATUAL:
- Operador Ativo: ${user?.nome || "Eli Júnior"} (${user?.cargo || "Administrador"})
IMPORTANTE: Chame o operador sempre pelo primeiro nome ("${user?.nome?.split(" ")[0] || "Eli"}"). NUNCA se dirija a ele como "Proprietário", "Usuário" ou "Admin". Trate-o como parceiro executivo próximo, dinâmico e inteligente.
${contexto.pet?.nome ? `- Pet Selecionado no Contexto: ${contexto.pet.nome} (ID: ${contexto.pet.id || "N/A"})` : ""}
${contexto.cliente?.nome ? `- Cliente/Tutor no Contexto: ${contexto.cliente.nome} (ID: ${contexto.cliente.id || "N/A"})` : ""}
${snapshotTexto}
${instrucaoVoz}

DIRETRIZES DE CONVERSAÇÃO E PODER TOTAL DA IA:
1. Responda a QUALQUER pergunta, conselho, brincadeira, lembrete (ex: beber água, pausas, dicas de gestão), saudação ou dúvida de forma fluida, natural, inteligente e humana (estilo Gemini Live / ChatGPT).
2. Não seja robótica, rígida ou travada. Demonstre proatividade e afeto com os pets.
3. Se o usuário pedir para gerar pagamento, gerar link, pagar no cartão/crédito, cobrar via Pix, buscar cliente/pet, sugerir encaixes, agendar, cancelar, ver financeiro ou qualquer ação no sistema, inclua no final da sua resposta uma tag de ação estruturada:
<<<ACTION:{"tool":"gerar_cobranca_pix_mercadopago"|"identificar_clientes_retorno"|"buscar_clientes_pets"|"consultar_agenda"|"consultar_financeiro_consolidado"|"consultar_horarios_disponiveis"|"preparar_agendamento"|"preparar_cancelamento"|"gerar_mensagens_cobranca"|"consultar_programas_ativos_geral", "params":{...}}>>>
ATENÇÃO: "cartão de crédito", "crédito", "link de pagamento" ou "pix" referem-se a pagamento financeiro (ferramenta: "gerar_cobranca_pix_mercadopago"). NUNCA confunda cartão de crédito com créditos do Clubinho!
4. Formate valores monetários em R$ (ex: R$ 80,00).`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Histórico recente
    const historicoRecente = historico.slice(-8);
    for (const h of historicoRecente) {
      if (h.role === "user" || h.role === "assistant") {
        messages.push({
          role: h.role,
          content: typeof h.content === "string" ? h.content : JSON.stringify(h.content),
        });
      }
    }

    messages.push({ role: "user", content: mensagemUsuario });

    const cards: JessiV2Card[] = [];
    let pendingAction: JessiV2PendingAction | null = null;
    let novoContexto: Partial<JessiV2ContextState> = {};

    // Tenta chamada direta ao LLM (Gemini 1.5 Flash via Lovable Gateway)
    if (auth?.key) {
      try {
        const textoGerado = await this.executarRequisicaoIA(messages, false, 0.7);

        if (textoGerado && textoGerado.trim().length > 0) {
          let textoLimpo = textoGerado.trim();

          // Extrai tag de ação <<<ACTION:{...}>>> se o Gemini gerou
          const actionMatch = textoLimpo.match(/<<<ACTION:([\s\S]*?)>>>/);
          let toolAlvo: string | null = null;
          let toolParams: any = {};

          if (actionMatch && actionMatch[1]) {
            try {
              const parsedAction = JSON.parse(actionMatch[1].trim());
              toolAlvo = parsedAction.tool;
              toolParams = parsedAction.params || {};
              textoLimpo = textoLimpo.replace(/<<<ACTION:[\s\S]*?>>>/, "").trim();
            } catch {
              // ignore json parse error
            }
          }

          // Detecção complementar e correção de desvio de intenção
          const msgNorm = mensagemUsuario.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const ehIntencaoPagamento =
            msgNorm.includes("pix") ||
            msgNorm.includes("link") ||
            msgNorm.includes("cartao") ||
            msgNorm.includes("cartão") ||
            msgNorm.includes("credito") ||
            msgNorm.includes("crédito") ||
            msgNorm.includes("cobranca") ||
            msgNorm.includes("cobrar") ||
            msgNorm.includes("pagamento") ||
            msgNorm.includes("paganto") ||
            msgNorm.includes("pagto") ||
            msgNorm.includes("pagar") ||
            msgNorm.includes("checkout");

          // Se a IA confundiu cartão de crédito com créditos do Clubinho, redireciona para cobrança
          if (ehIntencaoPagamento && (toolAlvo === "consultar_programas_ativos_geral" || toolAlvo === "consultar_saldo_programas" || !toolAlvo)) {
            const matchVal = mensagemUsuario.match(/(?:r\$|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i);
            const valorNum = matchVal ? parseFloat(matchVal[1].replace(",", ".")) : 10;
            toolAlvo = "gerar_cobranca_pix_mercadopago";
            toolParams = {
              valor: valorNum,
              descricao: "Cobrança Pet Spa Tia Jéssica",
            };
          }

          if (!toolAlvo) {
            if (msgNorm.includes("inativ") || msgNorm.includes("reativa") || msgNorm.includes("ausente") || msgNorm.includes("sumido")) {
              toolAlvo = "identificar_clientes_retorno";
            } else if (msgNorm.includes("buscar") || msgNorm.includes("procurar") || msgNorm.includes("ficha") || msgNorm.includes("tutor") || msgNorm.includes("cliente")) {
              const termo = mensagemUsuario.replace(/\b(buscar|procurar|consultar|ver|ficha|cliente|pet|tutor|cadastro|quem|e|o|a|da|do|de|no|na|me|pra|para|por|favor|localizar|pesquisar|achar|encontrar|mostra|mostrar|olha|olhar)\b/gi, "").trim();
              toolAlvo = "buscar_clientes_pets";
              toolParams = { termo };
            } else if (msgNorm.includes("horario") || msgNorm.includes("vaga") || msgNorm.includes("encaixe") || msgNorm.includes("livre")) {
              toolAlvo = "consultar_horarios_disponiveis";
              toolParams = { data: hojeStr };
            } else if (msgNorm.includes("agenda") || msgNorm.includes("atendimento") || msgNorm.includes("proximo pet") || msgNorm.includes("proximo")) {
              toolAlvo = "consultar_agenda";
              toolParams = { data: hojeStr };
            } else if (msgNorm.includes("financeiro") || msgNorm.includes("faturamento") || msgNorm.includes("receber") || msgNorm.includes("caixa")) {
              toolAlvo = "consultar_financeiro_consolidado";
              toolParams = { periodo: "mes" };
            }
          }

          // Se há ferramenta de ação a ser executada no Supabase, executa e anexa o card visual
          if (toolAlvo) {
            try {
              const resTool = await despacharFerramentaV2(sb, toolAlvo, toolParams);
              this.anexarCardVisual(cards, toolAlvo, resTool, toolParams);
            } catch (errTool) {
              console.warn(`[JessiV2] Erro ao despachar ferramenta visual ${toolAlvo}:`, errTool);
            }
          }

          return {
            respostaTexto: textoLimpo,
            cards,
            pendingAction,
            novoContexto,
          };
        }
      } catch (errLLM) {
        const auth = this.obterApiKeyServidor();
        console.error(`[JessiV2] FALHA no LLM (${auth?.endpoint || "sem endpoint"}), acionando despacho resiliente:`, errLLM);
      }
    }

    // DISPATCHER RESILIENTE DIRETO DE FERRAMENTAS COM CONVERSAÇÃO 100% FLUIDA
    // Garante que mesmo offline ou sem resposta do gateway, o comando é executado com dados reais do Supabase e fala humanizada!
    const despachoResiliente = await this.executarDespachoResiliente(sb, mensagemUsuario, hojeStr, user?.nome || "Eli");
    if (despachoResiliente) {
      if (despachoResiliente.card) {
        cards.push(despachoResiliente.card);
      }
      return {
        respostaTexto: despachoResiliente.texto,
        cards,
        pendingAction: (despachoResiliente as any).pendingAction || null,
        novoContexto: despachoResiliente.novoContexto || {},
      };
    }

    return {
      respostaTexto: `Entendido, ${user?.nome || "Eli"}! Como posso te ajudar na operação do Spa de Pet agora? Você pode consultar a agenda de hoje, buscar um cliente ou pet, ver o financeiro ou horários livres.`,
      cards,
      pendingAction: null,
      novoContexto: {},
    };
  }

  /**
   * Executa despacho determinístico resiliente e conversacional quando o gateway de IA não estiver disponível
   */
  private async executarDespachoResiliente(
    sb: SupabaseClient<Database>,
    mensagemUsuario: string,
    hojeStr: string,
    operadorNome: string
  ): Promise<{ texto: string; card?: JessiV2Card; novoContexto?: any; pendingAction?: any } | null> {
    const nomeOp = operadorNome || "Eli";

    // Normalização da mensagem
    let msgTrabalho = mensagemUsuario.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 0. Remove saudação inicial se a mensagem trouxer conteúdo operacional (ex: "Bom dia, quanto faturei hoje?")
    const saudacaoRegex = /^(?:bom dia|boa tarde|boa noite|oi|ola|e ai|ei|opa|fala jessi|jessi)[,!\s]+/i;
    if (saudacaoRegex.test(msgTrabalho)) {
      const resto = msgTrabalho.replace(saudacaoRegex, "").trim();
      if (resto.length > 2) {
        msgTrabalho = resto;
      }
    }
    const msg = msgTrabalho;

    // =========================================================================
    // 0.0 TRATAMENTO DE SELEÇÃO DIRETA DE ID [id:uuid] OU OPÇÃO DE DESAMBIGUAÇÃO
    // =========================================================================
    const matchId = mensagemUsuario.match(/\[(?:id|selecionar):([a-f0-9-]+)\]/i);
    if (matchId && matchId[1]) {
      const idAlvo = matchId[1];
      const resFichaCli = await ClientesPetsAdapter.obterFichaClienteCompleta(sb, idAlvo);
      if (resFichaCli.success && resFichaCli.data) {
        const cli = resFichaCli.data;
        const tel = cli.whatsapp || cli.telefone || "Não informado";
        const petsCount = cli.pets?.length || 0;
        return {
          texto: `Aqui está a ficha completa de **${cli.nome}** (Tel: ${tel}, ${petsCount} pet(s))! Você pode agendar, consultar créditos ou enviar mensagem diretamente.`,
          card: {
            type: "cliente",
            title: `Ficha de ${cli.nome}`,
            subtitle: `Tel: ${tel} • ${petsCount} pet(s)`,
            data: { ...cli, clientes: [cli] },
          },
          novoContexto: { cliente: { id: cli.id, nome: cli.nome, telefone: tel } },
        };
      }

      const resFichaPet = await ClientesPetsAdapter.obterFichaPet(sb, idAlvo);
      if (resFichaPet.success && resFichaPet.data) {
        const pet = resFichaPet.data;
        const tutor = (pet as any).clientes?.nome || (pet as any).tutor || "Tutor";
        return {
          texto: `Aqui está a ficha completa de **${pet.nome}** (${pet.raca || "Raça padrão"}, tutor: ${tutor})!`,
          card: {
            type: "pet",
            title: `Ficha de ${pet.nome}`,
            subtitle: `${pet.raca || "Raça padrão"} • Tutor: ${tutor}`,
            data: pet,
          },
          novoContexto: { pet: { id: pet.id, nome: pet.nome, raca: pet.raca } },
        };
      }
    }

    // =========================================================================
    // 1. COBRANÇA DIRETA PIX & CARTÃO MERCADO PAGO (INTENÇÃO EXPLÍCITA)
    // =========================================================================
    const isExplicitPaymentGen =
      msg.includes("gerar pix") ||
      msg.includes("link de pagamento") ||
      msg.includes("mercado pago") ||
      msg.includes("qr code") ||
      msg.includes("link do cartao") ||
      msg.includes("link de cartao") ||
      msg.includes("checkout online") ||
      (msg.includes("pix") && (msg.includes("gerar") || msg.includes("criar") || msg.includes("de r$") || /(?:r\$|\$)?\s*\d+/.test(msg)));

    if (isExplicitPaymentGen) {
      const matchVal = mensagemUsuario.match(/(?:r\$|\$)?\s*(\d+(?:[.,]\d{1,2})?)/i);
      const valorNum = matchVal ? parseFloat(matchVal[1].replace(",", ".")) : 50;

      const resPix = await despacharFerramentaV2(sb, "gerar_cobranca_pix_mercadopago", {
        valor: valorNum,
        descricao: "Cobrança Pet Spa Tia Jéssica",
      });

      const d = resPix?.data || resPix;

      if (resPix.success && (d?.qrCode || d?.qrCodeBase64 || d?.paymentId || d?.linkCartao)) {
        return {
          texto: `Gerei as opções de pagamento no valor de **R$ ${valorNum.toFixed(2).replace(".", ",")}** via Mercado Pago com sucesso, ${nomeOp}! O card abaixo já conta com o **Pix Instantâneo (QR Code e Copia-e-Cola)** e o **Link de Pagamento no Cartão de Crédito (até 12x)** para enviar no WhatsApp do tutor com 1 clique! ✨`,
          card: {
            type: "pix_mercadopago",
            title: `Pagamento Mercado Pago · R$ ${valorNum.toFixed(2).replace(".", ",")}`,
            subtitle: "Pix & Cartão de Crédito com baixa automática",
            data: d,
          },
        };
      } else {
        return {
          texto: `Não foi possível gerar a cobrança no Mercado Pago no momento, ${nomeOp}. Detalhes: ${resPix?.summary || d?.mensagemErro || "Verifique a integração do Mercado Pago nas configurações."}`,
        };
      }
    }

    // =========================================================================
    // 2. AGENDAMENTO & MARCAÇÃO DE ATENDIMENTOS (BANHO, TOSA, HORÁRIO)
    // =========================================================================
    const isSchedulingIntent =
      msg.startsWith("agendar") ||
      msg.startsWith("marcar") ||
      msg.includes("agendar banho") ||
      msg.includes("agendar tosa") ||
      msg.includes("marcar banho") ||
      msg.includes("marcar tosa") ||
      msg.includes("novo agendamento") ||
      msg.includes("marcar horario") ||
      msg.includes("agendar horario");

    if (isSchedulingIntent) {
      let dataAgendamento = hojeStr;
      if (msg.includes("amanha")) {
        dataAgendamento = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000));
      }

      const matchHora = mensagemUsuario.match(/(?:as|às|ás)?\s*(\d{1,2})(?:[:h](\d{2})?|h)\b/i);
      let horaAgendamento = "09:00";
      if (matchHora) {
        const h = matchHora[1].padStart(2, "0");
        const m = matchHora[2] ? matchHora[2].padStart(2, "0") : "00";
        horaAgendamento = `${h}:${m}`;
      }

      let servicoNome = "Banho";
      if (msg.includes("tosa higienica")) servicoNome = "Tosa Higiênica";
      else if (msg.includes("tosa completa") || msg.includes("tosa geral")) servicoNome = "Tosa Completa";
      else if (msg.includes("tosa")) servicoNome = "Tosa";
      else if (msg.includes("hidratacao") || msg.includes("hidratação")) servicoNome = "Banho e Hidratação";

      const termoNome = mensagemUsuario
        .replace(/\b(agendar|marcar|agendamento|horario|para|o|a|do|da|de|no|na|amanha|hoje|banho|tosa|higienica|completa|geral|as|às|ás|por|favor|novo|atendimento)\b/gi, "")
        .replace(/\d{1,2}(?:[:h]\d{2}|h)?/gi, "")
        .trim();

      let petEncontrado: any = null;
      let clienteEncontrado: any = null;

      if (termoNome.length >= 2) {
        const resBusca = await ClientesPetsAdapter.buscarClientesPets(sb, termoNome);
        const candidatos = resBusca?.data?.candidatos || [];
        if (candidatos.length > 0) {
          const primeiro = candidatos[0];
          if (primeiro.tipo === "pet") {
            petEncontrado = primeiro.dadosCompletos || primeiro;
            if (petEncontrado.clientes) {
              clienteEncontrado = petEncontrado.clientes;
            }
          } else {
            clienteEncontrado = primeiro.dadosCompletos || primeiro;
            if (clienteEncontrado.pets && clienteEncontrado.pets.length > 0) {
              petEncontrado = clienteEncontrado.pets[0];
            }
          }
        }
      }

      const diaNome = dataAgendamento === hojeStr ? "hoje" : "amanhã";
      const petNomeLabel = petEncontrado?.nome || (termoNome ? `Pet (${termoNome})` : "o Pet");
      const tutorNomeLabel = clienteEncontrado?.nome || "Tutor";

      return {
        texto: `Preparei a proposta de agendamento de **${servicoNome}** para **${petNomeLabel}** (${tutorNomeLabel}) para ${diaNome} às **${horaAgendamento}**, ${nomeOp}! Toque em Confirmar no card para salvar na grade oficial.`,
        card: {
          type: "confirmacao",
          title: `Confirmar Agendamento: ${petNomeLabel}`,
          subtitle: `${servicoNome} • ${diaNome.toUpperCase()} às ${horaAgendamento}`,
          data: {
            acao: "criar_agendamento",
            tipo: "agendamento",
            data: dataAgendamento,
            hora: horaAgendamento,
            servico: servicoNome,
            petId: petEncontrado?.id,
            petNome: petEncontrado?.nome || termoNome,
            clienteId: clienteEncontrado?.id,
            clienteNome: clienteEncontrado?.nome,
          },
        },
        pendingAction: {
          action: "criar_agendamento",
          params: {
            data: dataAgendamento,
            hora: horaAgendamento,
            servico: servicoNome,
            petId: petEncontrado?.id,
            clienteId: clienteEncontrado?.id,
          },
        },
      };
    }

    // =========================================================================
    // 2.5 CANCELAMENTO & DESMARCAÇÃO DE ATENDIMENTO
    // =========================================================================
    if (
      msg.startsWith("cancelar") ||
      msg.startsWith("desmarcar") ||
      msg.includes("cancelar banho") ||
      msg.includes("cancelar tosa") ||
      msg.includes("cancelar atendimento") ||
      msg.includes("desmarcar horario")
    ) {
      const resAgenda = await AgendaAdapter.consultarAgenda(sb, hojeStr);
      const lista: any[] = resAgenda?.data || [];
      const termoPet = msg.replace(/\b(cancelar|desmarcar|atendimento|agendamento|banho|tosa|de|do|da|o|a|horario|por|favor)\b/gi, "").trim();

      const itemAlvo = lista.find((a: any) => {
        const nomeP = (a.pets?.nome || a.petNome || "").toLowerCase();
        return termoPet && nomeP.includes(termoPet);
      }) || lista[0];

      if (itemAlvo) {
        const petNome = itemAlvo.pets?.nome || itemAlvo.petNome || "Pet";
        const horaAg = (itemAlvo.hora || "").slice(0, 5);
        return {
          texto: `Localizei o atendimento de **${petNome}** agendado para hoje às **${horaAg}**, ${nomeOp}. Deseja confirmar o cancelamento e liberar a vaga na grade?`,
          card: {
            type: "confirmacao",
            title: `Cancelar Agendamento: ${petNome}`,
            subtitle: `Horário: ${horaAg} • Vaga será liberada`,
            data: {
              acao: "cancelar_agendamento",
              agendamentoId: itemAlvo.id,
              petNome,
              hora: horaAg,
            },
          },
          pendingAction: {
            action: "cancelar_agendamento",
            params: {
              agendamentoId: itemAlvo.id,
              motivo: `Cancelado pelo operador (${nomeOp})`,
            },
          },
        };
      }
    }

    // =========================================================================
    // 2.6 TABELA DE PREÇOS / VALORES / CATÁLOGO DE SERVIÇOS
    // =========================================================================
    if (
      msg.includes("quanto custa") ||
      msg.includes("qual o valor") ||
      msg.includes("qual o preco") ||
      msg.includes("qual o preço") ||
      msg.includes("tabela de preco") ||
      msg.includes("tabela de precos") ||
      msg.includes("tabela de valores") ||
      msg.includes("catalogo de servico")
    ) {
      try {
        const { data: servicos } = await sb.from("servicos").select("id, nome, preco, duracao_minutos").order("preco", { ascending: true });
        if (servicos && servicos.length > 0) {
          const listaFormatada = servicos
            .map((s: any) => `• **${s.nome}**: R$ ${Number(s.preco || 0).toFixed(2).replace(".", ",")} (${s.duracao_minutos || 60} min)`)
            .join("\n");
          return {
            texto: `Aqui está a nossa tabela de serviços e valores atualizada do Spa de Pet, ${nomeOp}:\n\n${listaFormatada}\n\nPosso preparar o agendamento de algum desses para hoje ou amanhã?`,
          };
        }
      } catch {}
    }

    // =========================================================================
    // 3. PAGAMENTOS EM ABERTO / COBRANÇA / INADIMPLÊNCIA / CONTAS A RECEBER
    // =========================================================================
    if (
      msg.includes("pagamentos em aberto") ||
      msg.includes("pagamento em aberto") ||
      msg.includes("a receber") ||
      msg.includes("inadimplente") ||
      msg.includes("devedor") ||
      msg.includes("quem deve") ||
      msg.includes("cobrancas pendentes") ||
      msg.includes("cobrar clientes") ||
      msg.includes("mensagens de cobranca") ||
      msg.includes("cobranca cordial")
    ) {
      const resAbertos = await FinanceiroRelatoriosAdapter.obterPagamentosEmAberto(sb);
      const lista = resAbertos?.data || [];
      const totalPendente = lista.reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0);

      if (lista.length === 0) {
        return {
          texto: `Parabéns, ${nomeOp}! Não há nenhum pagamento em aberto ou pendência financeira registrada no momento. O caixa está 100% em dia!`,
          card: {
            type: "financeiro",
            title: "Pagamentos em Aberto (0)",
            subtitle: "Tudo quitado no Pet Spa",
            data: { itens: [], devedores: [], totalPendente: 0 },
          },
        };
      }

      return {
        texto: `Encontrei **${lista.length} pagamento(s) pendente(s)** totalizando **R$ ${totalPendente.toFixed(2).replace(".", ",")}**, ${nomeOp}! Você pode gerar links do Mercado Pago ou disparar lembretes cordiais diretamente no WhatsApp.`,
        card: {
          type: "financeiro",
          title: `Pagamentos em Aberto (${lista.length})`,
          subtitle: `Total pendente: R$ ${totalPendente.toFixed(2).replace(".", ",")}`,
          data: { devedores: lista, itens: lista, totalPendente, valoresAReceber: totalPendente, total: lista.length },
        },
      };
    }

    // =========================================================================
    // 3.5 ANALYTICS / ESTATÍSTICAS (EXIGE PALAVRAS DE ANÁLISE PARA NÃO CANIBALIZAR)
    // =========================================================================
    const isAnalyticsIntent =
      msg.includes("analise") ||
      msg.includes("estatistica") ||
      msg.includes("ranking") ||
      msg.includes("relatorio de desempenho") ||
      msg.includes("faturamento por porte") ||
      msg.includes("faturamento por raca") ||
      msg.includes("faturamento por bairro") ||
      msg.includes("faturamento por dia");

    if (isAnalyticsIntent) {
      let tipoAnalise = "porte_raca";
      if (msg.includes("bairro") || msg.includes("regiao")) tipoAnalise = "bairro";
      else if (msg.includes("dia") || msg.includes("semana")) tipoAnalise = "dia_semana";
      else if (msg.includes("cancel") || msg.includes("no show")) tipoAnalise = "cancelamentos";

      const resAnalytics = await AnalyticsAdapter.consultarMetricasAnalytics(sb, { tipo: tipoAnalise });
      const d = resAnalytics?.data;
      if (d) {
        return {
          texto: `${d.insightEstrategico || `Aqui está a **${d.titulo}**, ${nomeOp}!`}`,
          card: {
            type: "analytics",
            title: d.titulo,
            subtitle: d.subtitulo,
            data: d,
          },
        };
      }
    }

    // =========================================================================
    // 4. RESUMO FINANCEIRO / FATURAMENTO / FECHAMENTO DE CAIXA / GANHOS
    // =========================================================================
    if (
      msg.includes("faturamento") ||
      msg.includes("faturou") ||
      msg.includes("faturei") ||
      msg.includes("faturamos") ||
      msg.includes("quanto entrou") ||
      msg.includes("fechamento de caixa") ||
      msg.includes("caixa de hoje") ||
      msg.includes("resumo financeiro") ||
      msg.includes("financeiro consolidado") ||
      msg.includes("ganhamos") ||
      msg.includes("rendeu") ||
      msg.includes("receita") ||
      msg.includes("lucro") ||
      (msg.includes("financeiro") && !msg.includes("ficha") && !msg.includes("cliente"))
    ) {
      const periodo = msg.includes("hoje") ? "hoje" : msg.includes("semana") ? "semana" : "mes";
      const resFin = await FinanceiroRelatoriosAdapter.obterConsolidadoFinanceiro(sb, periodo);
      const d = resFin?.data || resFin;
      const totalRecebido = Number(d?.totalRecebido || d?.faturamento || 0);
      const totalPendente = Number(d?.totalPendente || d?.valoresAReceber || 0);
      const ticketMedio = Number(d?.ticketMedio || 0);

      let textoFin = `Aqui está o panorama financeiro de **${periodo === "hoje" ? "hoje" : periodo === "semana" ? "esta semana" : "deste mês"}**, ${nomeOp}: já foram recebidos **R$ ${totalRecebido.toFixed(2).replace(".", ",")}** e temos **R$ ${totalPendente.toFixed(2).replace(".", ",")}** a receber (ticket médio: R$ ${ticketMedio.toFixed(2).replace(".", ",")}).`;
      if (totalPendente > 0) {
        textoFin += ` Você pode consultar a lista de pagamentos em aberto para agilizar a entrada desses valores.`;
      }

      return {
        texto: textoFin,
        card: {
          type: "financeiro",
          title: "Resumo Financeiro Consolidado",
          subtitle: `Período: ${periodo.toUpperCase()}`,
          data: d,
        },
      };
    }

    // =========================================================================
    // 4.5 CONTAGEM DE SERVIÇOS REALIZADOS (QUANTOS BANHOS / TOSAS)
    // =========================================================================
    if (
      msg.includes("quantos banhos") ||
      msg.includes("quantas tosas") ||
      msg.includes("quantos atendimentos") ||
      msg.includes("total de banhos") ||
      msg.includes("total de atendimentos")
    ) {
      try {
        const { data: ags } = await sb
          .from("agendamentos")
          .select("id, status, servicos(nome)")
          .eq("data", hojeStr);

        const listaAgs = ags || [];
        const concluidos = listaAgs.filter((a: any) => a.status === "finalizado" || a.status === "concluido");
        return {
          texto: `Hoje realizamos **${concluidos.length} atendimento(s) concluído(s)** de um total de **${listaAgs.length} agendados** na grade, ${nomeOp}!`,
        };
      } catch {}
    }

    // =========================================================================
    // 5. CLUBINHO & PACOTES DE BANHO / PLANOS & CRÉDITOS
    // =========================================================================
    if (
      msg.includes("clubinho") ||
      msg.includes("pacote de banho") ||
      msg.includes("plano mensal") ||
      msg.includes("saldo de banhos") ||
      msg.includes("creditos de banho") ||
      msg.includes("planos ativos") ||
      (msg.includes("credito") && !msg.includes("cartao") && !msg.includes("cartão"))
    ) {
      const resProg = await ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb);
      const d = resProg?.data || resProg;
      const totalAssinantes = Array.isArray(d) ? d.length : (d?.totalAtivos || d?.programas?.length || 0);

      return {
        texto: `Aqui está o panorama dos contratos e créditos do Clubinho, ${nomeOp}! Temos **${totalAssinantes} assinatura(s) ativa(s)** gerando receita recorrente e fidelidade para o Spa.`,
        card: {
          type: "programa",
          title: `Clubinho & Planos (${totalAssinantes} ativos)`,
          subtitle: "Contratos e Saldo de Créditos",
          data: d,
        },
      };
    }

    // =========================================================================
    // 6. PRÓXIMO PET / QUEM É O PRÓXIMO / FILA DE ATENDIMENTO
    // =========================================================================
    if (
      msg.includes("proximo pet") ||
      msg.includes("proximo atendimento") ||
      msg.includes("quem e o proximo") ||
      msg.includes("quem e a proxima") ||
      msg.includes("qual o proximo") ||
      msg.includes("qual a proxima") ||
      msg.includes("proxima tosa") ||
      msg.includes("proximo banho")
    ) {
      const resAgenda = await AgendaAdapter.consultarAgenda(sb, hojeStr);
      const lista: any[] = resAgenda?.data || [];

      if (lista.length === 0) {
        return {
          texto: `No momento não temos mais nenhum atendimento agendado na grade de hoje, ${nomeOp}! A bancada está livre. Gostaria de verificar os horários de amanhã ou sugerir encaixes com clientes sumidos?`,
          card: {
            type: "agenda",
            title: "Grade de Hoje (Vazia)",
            subtitle: `Data: ${hojeStr}`,
            data: { agendamentos: [], itens: [], total: 0 },
          },
        };
      }

      const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const proximo = lista.find((a: any) => (a.hora || "00:00") >= horaAtual) || lista[0];
      const petNome = proximo.pets?.nome || proximo.pet_nome || proximo.petNome || "o pet";
      const tutorNome = proximo.clientes?.nome || proximo.cliente_nome || proximo.tutor || "tutor não informado";
      const servicoNome = proximo.servicos?.nome || proximo.servico_nome || proximo.servico || "Banho e Tosa";
      const horaMarcada = (proximo.hora || "horário").slice(0, 5);
      const levaTrazStr = proximo.leva_traz_modalidade ? " (com serviço de Leva e Traz)" : "";

      return {
        texto: `O próximo pet na fila é o **${petNome}** (${servicoNome}), agendado para às **${horaMarcada}** com o tutor **${tutorNome}**${levaTrazStr}. A ficha completa está aberta no card abaixo.`,
        card: {
          type: "agenda",
          title: `Próximo: ${petNome} às ${horaMarcada}`,
          subtitle: `Tutor: ${tutorNome} • ${servicoNome}`,
          data: { agendamentos: [proximo], itens: [proximo], total: lista.length, proximo },
        },
      };
    }

    // =========================================================================
    // 7. HORÁRIOS LIVRES / VAGAS / ENCAIXES
    // =========================================================================
    if (
      msg.includes("horarios livres") ||
      msg.includes("horario livre") ||
      msg.includes("horarios disponiveis") ||
      msg.includes("horario disponivel") ||
      msg.includes("vagas") ||
      msg.includes("tem vaga") ||
      msg.includes("tem horario") ||
      msg.includes("tem horário") ||
      msg.includes("encaixe") ||
      (msg.includes("vaga") && !msg.includes("garagem"))
    ) {
      const dataAlvo = msg.includes("amanha")
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000))
        : hojeStr;

      const resVagas = await AgendaAdapter.consultarHorariosLivres(sb, dataAlvo);
      const dVagas = resVagas?.data;
      const vagas: string[] = Array.isArray(dVagas)
        ? dVagas
        : dVagas?.horariosSugeridos || (dVagas as any)?.vagas || [];
      const diaLabel = dataAlvo === hojeStr ? "hoje" : "amanhã";

      if (vagas.length === 0) {
        return {
          texto: `A grade de ${diaLabel} está 100% preenchida, ${nomeOp}! Não há horários ociosos. Excelente ocupação!`,
          card: {
            type: "agenda",
            title: `Vagas Esgotadas (${diaLabel.toUpperCase()})`,
            subtitle: `Data: ${dataAlvo}`,
            data: {
              tipo: "disponibilidade",
              data: dataAlvo,
              vagas_disponiveis: [],
              vagas: [],
              horariosSugeridos: [],
              total: 0,
            },
          },
        };
      }

      const vagasTexto = vagas.slice(0, 6).join(", ");
      return {
        texto: `Temos **${vagas.length} horário(s) livre(s)** na grade de ${diaLabel}: **${vagasTexto}**. Uma ótima oportunidade para preencher com encaixes da lista de retorno!`,
        card: {
          type: "agenda",
          title: `Horários Livres (${vagas.length} vagas)`,
          subtitle: `Data: ${dataAlvo}`,
          data: {
            tipo: "disponibilidade",
            data: dataAlvo,
            vagas_disponiveis: vagas,
            vagas,
            horariosSugeridos: vagas,
            manha: vagas.filter((s: string) => parseInt(s.split(":")[0], 10) < 12),
            tarde: vagas.filter((s: string) => parseInt(s.split(":")[0], 10) >= 12),
            total: vagas.length,
          },
        },
      };
    }

    // =========================================================================
    // 8. ATRASOS / QUEM FALTOU / SENTINELAS (ANTES DA AGENDA GERAL)
    // =========================================================================
    if (
      msg.includes("atrasad") ||
      msg.includes("atraso") ||
      msg.includes("quem faltou") ||
      msg.includes("nao chegou") ||
      msg.includes("sentinela")
    ) {
      const resAgenda = await AgendaAdapter.consultarAgenda(sb, hojeStr);
      const lista: any[] = resAgenda?.data || [];
      const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const atrasados = lista.filter((a: any) => {
        const horaAg = (a.hora || "").slice(0, 5);
        const status = (a.status || "").toLowerCase();
        return horaAg && horaAg < horaAtual && (status === "agendado" || status === "pendente");
      });

      if (atrasados.length === 0) {
        return {
          texto: `Excelente notícia, ${nomeOp}! Verifiquei a grade e nenhum pet está com atraso de chegada registrado no momento. Todos os atendimentos estão dentro do horário!`,
        };
      }

      const nomesAtrasados = atrasados
        .map((a: any) => `**${a.pets?.nome || a.petNome || "Pet"}** (agendado às ${(a.hora || "").slice(0, 5)}, tutor: ${a.clientes?.nome || a.tutor || "tutor"})`)
        .join(", ");

      return {
        texto: `Identifiquei **${atrasados.length} atendimento(s)** com horário ultrapassado: ${nomesAtrasados}. Deseja que eu prepare uma mensagem no WhatsApp para checar se o tutor está a caminho?`,
        card: {
          type: "sentinela",
          title: `Atrasos Identificados (${atrasados.length})`,
          subtitle: `Horário de corte: ${horaAtual}`,
          data: { atrasados, atrasosDetectados: atrasados, total: atrasados.length },
        },
      };
    }

    // =========================================================================
    // 9. LEVA E TRAZ / ROTAS / TRANSPORTE / TÁXI DOG (ANTES DA AGENDA GERAL)
    // =========================================================================
    if (
      msg.includes("leva e traz") ||
      msg.includes("transporte") ||
      msg.includes("taxi dog") ||
      msg.includes("taxi pet") ||
      msg.includes("rotas") ||
      msg.includes("motorista") ||
      msg.includes("buscar pet")
    ) {
      const resAgenda = await AgendaAdapter.consultarAgenda(sb, hojeStr);
      const lista: any[] = resAgenda?.data || [];
      const rotas = lista.filter((a: any) => Boolean(a.leva_traz_modalidade || a.transporte || a.endereco_busca));

      if (rotas.length === 0) {
        return {
          texto: `Não temos viagens ou pets com serviço de Leva e Traz agendados para hoje, ${nomeOp}. Todos os pets virão diretamente pelos tutores.`,
        };
      }

      return {
        texto: `Temos **${rotas.length} atendimento(s) com Leva e Traz** na rota de hoje, ${nomeOp}! A lista com endereços e horários de busca está no card na tela.`,
        card: {
          type: "leva_traz",
          title: `Leva e Traz de Hoje (${rotas.length} rotas)`,
          subtitle: `Data: ${hojeStr}`,
          data: { rotas, total: rotas.length },
        },
      };
    }

    // =========================================================================
    // 10. AGENDA DE ATENDIMENTOS / GRADE DO DIA / ROTINA
    // =========================================================================
    if (
      msg.includes("agenda") ||
      msg.includes("atendimento") ||
      msg.includes("marcado") ||
      msg.includes("rotina") ||
      msg.includes("como esta o dia") ||
      msg.includes("grade do dia")
    ) {
      const dataAlvo = msg.includes("amanha")
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000))
        : hojeStr;

      const resAgenda = await AgendaAdapter.consultarAgenda(sb, dataAlvo);
      const lista: any[] = resAgenda?.data || [];
      const diaLabel = dataAlvo === hojeStr ? "hoje" : "amanhã";

      if (lista.length === 0) {
        return {
          texto: `Não temos atendimentos marcados na grade para ${diaLabel}, ${nomeOp}! Essa é uma oportunidade perfeita para disparar convites ou campanhas de fidelização.`,
          card: {
            type: "agenda",
            title: `Agenda de ${diaLabel === "hoje" ? "Hoje" : "Amanhã"} (0 Atendimentos)`,
            subtitle: `Data: ${dataAlvo}`,
            data: { agendamentos: [], itens: [], total: 0 },
          },
        };
      }

      const primeiros = lista
        .slice(0, 3)
        .map((a: any) => `**${a.pets?.nome || a.petNome || "Pet"}** às ${(a.hora || a.horario || "horário").slice(0, 5)} (${a.servicos?.nome || a.servicoNome || "Serviço"})`)
        .join(", ");

      return {
        texto: `Temos **${lista.length} atendimento(s)** agendado(s) para ${diaLabel}, ${nomeOp}! Primeiros da fila: ${primeiros}. A lista completa e os detalhes estão no card na tela.`,
        card: {
          type: "agenda",
          title: `Agenda (${lista.length} atendimentos)`,
          subtitle: `Data: ${dataAlvo}`,
          data: { agendamentos: lista, itens: lista, total: lista.length },
        },
      };
    }

    // =========================================================================
    // 11. CLIENTES INATIVOS / REATIVAÇÃO / CLIENTES SUMIDOS
    // =========================================================================
    if (
      msg.includes("inativ") ||
      msg.includes("reativa") ||
      msg.includes("retorno") ||
      msg.includes("ausente") ||
      msg.includes("sumido") ||
      msg.includes("saudade")
    ) {
      const resRet = await despacharFerramentaV2(sb, "identificar_clientes_retorno", {});
      const d = resRet?.data || resRet;
      const lista = Array.isArray(d) ? d : d?.clientes || [];

      return {
        texto: `Identifiquei **${lista.length} cliente(s) inativo(s)** que não vêm ao Spa há mais de 25 dias, ${nomeOp}! Preparei a lista com os pets e sugestões de mensagens de carinho prontas para disparo no WhatsApp, para preenchermos os horários livres da grade!`,
        card: {
          type: "reativacao",
          title: "Clientes Inativos para Encaixe",
          subtitle: `${lista.length} tutores com potencial de retorno`,
          data: lista,
        },
      };
    }

    // =========================================================================
    // 12. ANIVERSARIANTES
    // =========================================================================
    if (msg.includes("aniversari") || msg.includes("parabens") || msg.includes("niver")) {
      const resAniv = await despacharFerramentaV2(sb, "consultar_aniversariantes", {});
      const d = resAniv?.data || resAniv;
      const lista = Array.isArray(d) ? d : d?.aniversariantes || [];

      return {
        texto: `Temos **${lista.length} aniversariante(s)** registrado(s) no Spa para este período! Uma excelente oportunidade para encantar os tutores com um mimo ou desconto especial.`,
        card: {
          type: "comunicacao",
          title: "Aniversariantes do Pet Spa",
          subtitle: "Ações de Encantamento",
          data: d,
        },
      };
    }

    // =========================================================================
    // 13. SAUDAÇÕES, POLIDEZ, BEM-ESTAR E EMPATIA (SE SOBROU APENAS SAUDAÇÃO)
    // =========================================================================
    if (
      msg === "boa noite" ||
      msg === "bom dia" ||
      msg === "boa tarde" ||
      msg === "oi" ||
      msg === "ola" ||
      msg === "e ai" ||
      msg === "tudo bem" ||
      msg === "como vai" ||
      msg.includes("como voce esta") ||
      msg.includes("como você está")
    ) {
      const hora = new Date().getHours();
      const saudacaoHorario = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
      return {
        texto: `${saudacaoHorario}, ${nomeOp}! Tudo excelente por aqui no Spa de Pet. Estou com a central de atendimentos, agenda e financeiro 100% pronta para te apoiar. Por onde você gostaria de começar agora?`,
      };
    }

    if (
      msg.includes("agua") ||
      msg.includes("água") ||
      msg.includes("beber") ||
      msg.includes("hidrat") ||
      msg.includes("obrigad") ||
      msg.includes("valeu") ||
      msg.includes("top") ||
      msg.includes("legal") ||
      msg.includes("descans") ||
      msg.includes("pausa") ||
      msg.includes("almoc") ||
      msg.includes("almoç")
    ) {
      if (msg.includes("agua") || msg.includes("água") || msg.includes("hidrat")) {
        return {
          texto: `Muito obrigado pelo lembrete de hidratação, ${nomeOp}! Cuidar da água e fazer pequenas pausas é essencial para mantermos o foco e a energia alta na rotina do Spa. Já tomei meu gole virtual de água! Como posso te ajudar na operação agora?`,
        };
      }
      return {
        texto: `Muito obrigado, ${nomeOp}! É sempre um prazer estar ao seu lado cuidando da operação do Spa de Pet. Conte comigo para a agenda, clientes, financeiro e qualquer detalhe do dia!`,
      };
    }

    // =========================================================================
    // 14. REDE DE SEGURANÇA UNIVERSAL: BUSCA DE CLIENTE / PET OU GUIA OPERACIONAL
    // =========================================================================
    const isSearchIntent =
      msg.includes("buscar") ||
      msg.includes("procurar") ||
      msg.includes("cliente") ||
      msg.includes("pet") ||
      msg.includes("tutor") ||
      msg.includes("ficha") ||
      msg.includes("cadastro") ||
      msg.split(" ").length <= 2;

    if (isSearchIntent) {
      const termoLimpo = mensagemUsuario
        .replace(/\b(buscar|procurar|consultar|ver|ficha|cliente|pet|tutor|cadastro|quem|e|o|a|da|do|de|no|na|me|pra|para|por|favor|localizar|pesquisar|achar|encontrar|mostra|mostrar|olha|olhar|abrir)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      const termoBusca = termoLimpo.length >= 2 ? termoLimpo : mensagemUsuario.trim();

      if (termoBusca.length >= 2) {
        const resBusca = await ClientesPetsAdapter.buscarClientesPets(sb, termoBusca);
        const d = resBusca?.data || resBusca;
        const candidatos = d?.candidatos || (Array.isArray(d) ? d : []);

        if (candidatos.length === 1) {
          const c = candidatos[0];
          const nomeCli = c.nomePrincipal || c.nome;
          const det = c.detalheSecundario || "";
          const dadosCard = c.dadosCompletos
            ? { ...c.dadosCompletos, nome: nomeCli, telefone: c.telefone || c.detalheSecundario }
            : { ...c, nome: nomeCli, telefone: c.telefone || c.detalheSecundario };

          return {
            texto: `Localizei a ficha de **${nomeCli}** (${det})! Já abri o card com todos os detalhes, contatos e histórico.`,
            card: {
              type: c.tipo === "pet" ? "pet" : "cliente",
              title: `Ficha de ${nomeCli}`,
              subtitle: det || "Cadastro no Pet Spa",
              data: dadosCard,
            },
            novoContexto: c.tipo === "pet" ? { pet: { id: c.id, nome: nomeCli } } : { cliente: { id: c.id, nome: nomeCli } },
          };
        }

        if (candidatos.length > 1) {
          const nomes = candidatos.slice(0, 4).map((c: any) => `**${c.nomePrincipal || c.nome}**`).join(", ");
          return {
            texto: `Encontrei **${candidatos.length} resultados** para "${termoBusca}": ${nomes}. Toque em **[Selecionar]** no card para abrir a ficha completa!`,
            card: {
              type: "cliente",
              title: `Resultados para "${termoBusca}"`,
              subtitle: `${candidatos.length} cadastros encontrados`,
              data: {
                exigeDesambiguacao: true,
                opcoes: candidatos.slice(0, 8).map((c: any) => {
                  const comp = c.dadosCompletos || {};
                  return {
                    id: c.id,
                    tipo: c.tipo || "cliente",
                    nome: c.nomePrincipal || c.nome,
                    detalhe: c.detalheSecundario || c.telefone || "",
                    telefone: comp.telefone || c.telefone || c.detalheSecundario || "",
                    pets: comp.pets || c.pets || [],
                    bairro: comp.bairro || c.bairro || "",
                  };
                }),
              },
            },
          };
        }
      }
    }

    // Guia inteligente quando o termo não é um cadastro específico
    return {
      texto: `Entendido, ${nomeOp}! Estou pronta para te apoiar. Você pode me pedir:\n\n• **"Agenda de hoje"** ou **"Próximo pet"**\n• **"Quanto faturamos este mês?"** ou **"Pagamentos em aberto"**\n• **"Gerar Pix de R$ 80"** ou **"Horários livres de amanhã"**\n• **"Clientes inativos"** ou o nome de qualquer cliente/pet.`,
    };
  }

  /**
   * Sintetiza uma resposta natural, calorosa e fluida em português a partir dos dados retornados por qualquer ferramenta
   */
  private sintetizarResultadoLocal(toolNome: string, dados: any, operadorNome: string): string {
    const nomeOp = operadorNome || "Eli";
    if (!dados) return `Prontinho, ${nomeOp}! Consultei as informações diretamente no sistema.`;

    switch (toolNome) {
      case "consultar_financeiro_consolidado": {
        const recebido = Number(dados?.totalRecebido || dados?.faturamento || 0);
        const pendente = Number(dados?.totalPendente || dados?.valoresAReceber || 0);
        return `Aqui está o resumo financeiro, ${nomeOp}: já foram recebidos **R$ ${recebido.toFixed(2).replace(".", ",")}** e temos **R$ ${pendente.toFixed(2).replace(".", ",")}** pendentes a receber.`;
      }
      case "consultar_agenda": {
        const lista = Array.isArray(dados) ? dados : dados?.agendamentos || [];
        if (lista.length === 0) {
          return `Não há nenhum agendamento na grade para esta data, ${nomeOp}! Os horários estão livres para encaixes.`;
        }
        const primeiros = lista.slice(0, 3).map((a: any) => `${a.pets?.nome || a.petNome || "Pet"} (${(a.hora || "").slice(0, 5)})`).join(", ");
        return `Encontrei **${lista.length} atendimento(s)** na agenda. Próximos: ${primeiros}. O card com a grade completa está na tela!`;
      }
      case "buscar_clientes_pets": {
        const lista = dados?.candidatos || (Array.isArray(dados) ? dados : []);
        if (lista.length === 0) {
          return `Não encontrei nenhum cadastro com esse termo no sistema, ${nomeOp}. Tente buscar com outro nome, telefone ou raça.`;
        }
        if (lista.length === 1) {
          const c = lista[0];
          return `Localizei: **${c.nomePrincipal || c.nome}** (${c.detalheSecundario || ""}). O card com a ficha completa já está aberto!`;
        }
        const nomes = lista.slice(0, 4).map((c: any) => c.nomePrincipal || c.nome).join(", ");
        return `Encontrei ${lista.length} resultados: ${nomes}. Toque no card para abrir a ficha que você deseja!`;
      }
      case "consultar_horarios_disponiveis": {
        const vagas = dados?.horariosSugeridos || dados?.vagas || [];
        if (vagas.length === 0) {
          return `A grade de hoje está com horários preenchidos, ${nomeOp}!`;
        }
        return `Temos **${vagas.length} horário(s) livre(s)** na grade: ${vagas.slice(0, 4).join(", ")}.`;
      }
      case "identificar_clientes_retorno": {
        const lista = Array.isArray(dados) ? dados : dados?.clientes || [];
        return `Identifiquei **${lista.length} cliente(s)** ausentes com alto potencial de retorno para o Spa!`;
      }
      case "consultar_aniversariantes": {
        const lista = Array.isArray(dados) ? dados : dados?.aniversariantes || [];
        return `Temos **${lista.length} aniversariante(s)** no período para ações de carinho e fidelização!`;
      }
      default:
        return `Prontinho, ${nomeOp}! Operação concluída com sucesso e sincronizada no sistema.`;
    }
  }

  /**
   * Constrói Cards Visuais para cada ferramenta executada
   */
  private anexarCardVisual(cards: JessiV2Card[], toolNome: string, resTool: any, toolArgs: any) {
    if (!resTool) return;
    const data = resTool.data || resTool;

    switch (toolNome) {
      case "consultar_agenda": {
        const lista = Array.isArray(data) ? data : data?.agendamentos || data?.itens || [];
        cards.push({
          type: "agenda",
          title: `Agenda (${lista.length} atendimento(s))`,
          subtitle: toolArgs.data || "Data de hoje",
          data: { agendamentos: lista, itens: lista, total: lista.length },
        });
        break;
      }
      case "buscar_clientes_pets": {
        const candidatos = data?.candidatos || (Array.isArray(data) ? data : []);
        if (candidatos.length > 0) {
          if (candidatos.length === 1) {
            const c = candidatos[0];
            const isPet = c.tipo === "pet";
            cards.push({
              type: isPet ? "pet" : "cliente",
              title: `Ficha de ${c.nomePrincipal || c.nome}`,
              subtitle: isPet ? `${c.detalheSecundario || "Pet"}` : "Detalhes do cliente",
              data: c.dadosCompletos ? {
                ...c.dadosCompletos,
                nome: c.nomePrincipal || c.nome,
                telefone: c.telefone || c.detalheSecundario || "",
              } : {
                ...c,
                nome: c.nomePrincipal || c.nome,
                telefone: c.telefone || c.detalheSecundario || "",
              },
            });
          } else {
            cards.push({
              type: "cliente",
              title: toolArgs.termo ? `Resultados para "${toolArgs.termo}"` : "Clientes Recentes",
              subtitle: "Selecione para abrir a ficha completa",
              data: {
                exigeDesambiguacao: true,
                opcoes: candidatos.slice(0, 6).map((c: any) => {
                  const comp = c.dadosCompletos || {};
                  return {
                    id: c.id,
                    tipo: c.tipo || "cliente",
                    nome: c.nomePrincipal || c.nome,
                    detalhe: c.detalheSecundario || c.telefone || "",
                    telefone: comp.telefone || c.telefone || c.detalheSecundario || "",
                    pets: comp.pets || c.pets || [],
                    bairro: comp.bairro || c.bairro || "",
                  };
                }),
              },
            });
          }
        }
        break;
      }
      case "obter_ficha_pet": {
        cards.push({
          type: "pet",
          title: `Ficha do Pet — ${data.nome || "Pet"}`,
          subtitle: `${data.raca || "SRD"} • Porte ${data.porte || "Médio"}`,
          data,
        });
        break;
      }
      case "obter_ficha_cliente": {
        cards.push({
          type: "cliente",
          title: `Ficha do Cliente — ${data.nome || "Cliente"}`,
          subtitle: `WhatsApp: ${data.whatsapp || data.telefone || "Não cadastrado"}`,
          data,
        });
        break;
      }
      case "consultar_horarios_disponiveis": {
        const dVagas = data?.horariosSugeridos || (Array.isArray(data) ? data : (data as any)?.vagas || []);
        cards.push({
          type: "agenda",
          title: `Vagas Disponíveis (${dVagas.length})`,
          subtitle: toolArgs?.data || "Grade de hoje",
          data: {
            tipo: "disponibilidade",
            data: toolArgs?.data || "Hoje",
            vagas_disponiveis: dVagas,
            vagas: dVagas,
            horariosSugeridos: dVagas,
            manha: dVagas.filter((s: string) => parseInt(s.split(":")[0], 10) < 12),
            tarde: dVagas.filter((s: string) => parseInt(s.split(":")[0], 10) >= 12),
            total: dVagas.length,
          },
        });
        break;
      }
      case "consultar_financeiro_consolidado": {
        cards.push({
          type: "financeiro",
          title: "Resumo Financeiro Consolidado",
          subtitle: `Período: ${(toolArgs.periodo || "mês").toUpperCase()}`,
          data,
        });
        break;
      }
      case "consultar_saldo_programas":
      case "consultar_programas_ativos_geral": {
        cards.push({
          type: "programa",
          title: "Clubinho & Planos Mensais",
          subtitle: "Contratos ativos",
          data,
        });
        break;
      }
      case "identificar_clientes_retorno": {
        const lista = Array.isArray(data) ? data : data?.clientes || [];
        cards.push({
          type: "reativacao",
          title: "Clientes Ausentes com Potencial de Retorno",
          subtitle: `${lista.length} cliente(s) identificado(s)`,
          data: lista,
        });
        break;
      }
      case "consultar_aniversariantes": {
        cards.push({
          type: "comunicacao",
          title: "Aniversariantes do Pet Spa",
          subtitle: "Ações de Encantamento",
          data,
        });
        break;
      }
      case "gerar_mensagens_cobranca": {
        cards.push({
          type: "financeiro",
          title: "Cobrança Cordial via Pix",
          subtitle: "Pendências financeiras",
          data,
        });
        break;
      }
      case "consultar_analise_negocio": {
        cards.push({
          type: "analytics",
          title: "Análise Estratégica do Spa",
          subtitle: `Tipo: ${toolArgs.tipo || "Geral"}`,
          data,
        });
        break;
      }
      case "verificar_sentinelas":
      case "gerar_central_proativa": {
        cards.push({
          type: "sentinela",
          title: "Sentinelas Operacionais",
          subtitle: "Atrasos, cancelamentos e caixa",
          data,
        });
        break;
      }
      case "otimizar_rotas_leva_traz": {
        cards.push({
          type: "leva_traz",
          title: "Itinerário Leva & Traz",
          subtitle: "Rotas do dia",
          data,
        });
        break;
      }
      case "gerar_cobranca_pix_mercadopago":
      case "gerar_cobranca_pix_online":
      case "gerar_link_pagamento_mercadopago":
      case "gerar_link_pagamento":
      case "gerar_pix": {
        cards.push({
          type: "pix_mercadopago",
          title: "Cobrança Pix & Cartão · Mercado Pago",
          subtitle: `R$ ${Number(data.valor || toolArgs.valor || 0).toFixed(2)}`,
          data,
        });
        break;
      }
      case "executar_agendamento":
      case "criar_agendamento": {
        cards.push({
          type: "confirmacao",
          title: "Agendamento Confirmado!",
          subtitle: "Salvo com sucesso na grade do Spa",
          data: { executado: true, resultado: data },
        });
        break;
      }
      case "executar_cancelamento":
      case "cancelar_agendamento": {
        cards.push({
          type: "confirmacao",
          title: "Atendimento Cancelado",
          subtitle: "Vaga liberada com sucesso",
          data: { executado: true, resultado: data },
        });
        break;
      }
      case "executar_remarcacao":
      case "reagendar_agendamento": {
        cards.push({
          type: "confirmacao",
          title: "Atendimento Reagendado",
          subtitle: "Novo horário salvo na grade",
          data: { executado: true, resultado: data },
        });
        break;
      }
      case "processar_comprovante":
      case "analisar_comprovante": {
        cards.push({
          type: "comprovante",
          title: "Comprovante Processado",
          subtitle: "Conciliação Pix",
          data,
        });
        break;
      }
      case "gerar_mensagem_whatsapp": {
        cards.push({
          type: "comunicacao",
          title: "Mensagem WhatsApp",
          subtitle: "Pronta para envio",
          data,
        });
        break;
      }
      default:
        break;
    }
  }

  // --- MÉTODOS DE COMPATIBILIDADE DA INTERFACE IJessiV2AIProvider ---

  async classificarIntencao(req: JessiV2NLURequest): Promise<JessiV2NLUResponse> {
    const inicio = Date.now();
    const apiKey = this.obterApiKeyServidor();
    return {
      intencao: {
        dominio: "geral_conversacional",
        intencao: "conversar_autonomo",
        confianca: 0.98,
        entidades: { data: req.contexto.dataReferencia },
        requerConfirmacao: false,
        ferramentaSugerida: null,
        explicacaoRaciocinio: "Roteamento inteligente pelo Agente Autônomo com Tool Calling.",
      },
      provedorUtilizado: apiKey ? `${this.nome} (Online)` : `${this.nome} (Simulado)`,
      tempoProcessamentoMs: Date.now() - inicio,
    };
  }

  async gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse> {
    try {
      const systemMsg = req.promptSistema
        ? `${req.promptSistema}\n\nDados Reais do Spa:\n${JSON.stringify(req.dadosOperacionais, null, 2)}`
        : `${JESSI_V2_SYSTEM_PROMPT}\n\nDados Reais do Spa:\n${JSON.stringify(req.dadosOperacionais, null, 2)}`;

      const messages = [
        { role: "system", content: systemMsg },
        { role: "user", content: req.mensagemUsuario },
      ];

      const textoGerado = await this.executarRequisicaoIA(messages, false, 0.4);
      if (textoGerado && textoGerado.length > 5) {
        return {
          texto: textoGerado.trim(),
          sugestoesAcoes: ["Ver detalhes", "Conferir agenda", "Abrir cadastro"],
          provedorUtilizado: `${this.nome} (Lovable Gateway)`,
        };
      }
    } catch (err) {
      console.warn("[JessiV2 Provider] Chamada gerarResposta falhou:", err);
    }

    return {
      texto: "Olá, Eli! Como posso ajudar você agora com a agenda, clientes ou finanças do Spa?",
      sugestoesAcoes: ["Ver agenda de hoje", "Consultar clientes", "Ver faturamento"],
      provedorUtilizado: `${this.nome} (Síntese)`,
    };
  }
}
