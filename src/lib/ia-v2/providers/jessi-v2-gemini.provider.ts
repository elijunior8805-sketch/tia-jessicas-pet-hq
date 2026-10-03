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
  TIMEOUT_MS: 4000,
  MAX_RETRIES: 1,
  MODEL: "google/gemini-1.5-flash",
  GROQ_MODEL: "openai/gpt-oss-120b",
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
      name: "sugerir_clientes_para_encaixe",
      description: "Sugere clientes com alta probabilidade de conversão para preencher horários vagos hoje ou na data especificada, analisando clientes habituais do dia da semana (ex: sextas-feiras) e ciclo de retorno recente (10 a 30 dias).",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data YYYY-MM-DD para buscar encaixes (padrão: hoje)" },
          horarioVago: { type: "string", description: "Horário vago a preencher HH:mm (ex: '14:00')" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "identificar_clientes_retorno",
      description: "Identifica clientes e pets no ciclo de retorno para encaixes e contato via WhatsApp.",
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
        process.env.GROQ_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.LOVABLE_API_KEY ||
        "";
    }

    // Sem chave configurada — logar erro claro
    if (!chave) {
      console.error("[JessiV2] ERRO CRÍTICO: Nenhuma chave de IA configurada.");
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
   * Executa chamada segura com suporte a Tool Calling nativo (OpenAI / Groq / Lovable)
   */
  private async executarRequisicaoIAComTools(
    messages: Array<any>,
    tools?: any[],
    temperature = 0.3
  ): Promise<{
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }> {
    const auth = this.obterApiKeyServidor();
    if (!auth) {
      throw new Error("Nenhuma chave de API configurada no ambiente.");
    }

    const modelosParaTentar = [auth.model];

    for (let tentativa = 0; tentativa < modelosParaTentar.length; tentativa++) {
      const modeloAtual = modelosParaTentar[tentativa];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_CONFIG.TIMEOUT_MS);

      try {
        const body: any = {
          model: modeloAtual,
          temperature,
          messages,
        };

        if (tools && tools.length > 0) {
          body.tools = tools;
          body.tool_choice = "auto";
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
          if (resp.status === 401 || resp.status === 403 || resp.status === 404 || resp.status === 429) {
            throw new Error(`Fatal HTTP ${resp.status}: ${errBody.slice(0, 80)}`);
          }
          throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 120)}`);
        }

        const data: any = await resp.json();
        const msg = data?.choices?.[0]?.message;
        if (!msg) {
          throw new Error("Provedor retornou resposta vazia sem escolhas.");
        }

        return {
          content: msg.content || null,
          tool_calls: msg.tool_calls || undefined,
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err?.message?.startsWith("Fatal HTTP")) {
          throw err;
        }
        console.warn(`[JessiV2] Tentativa com modelo ${modeloAtual} falhou:`, err?.message || err);
        if (tentativa >= modelosParaTentar.length - 1) throw err;
        await new Promise((res) => setTimeout(res, 100));
      }
    }

    throw new Error("Falha na comunicação com o provedor de IA.");
  }

  /**
   * Executa chamada segura com timeout e retentativas (legado / texto simples)
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
   * MOTOR DO AGENTE AUTÔNOMO COM TOOL CALLING NATIVO (MULTI-PASSOS)
   * A IA recebe a mensagem, raciocina com 70B de parâmetros, seleciona e executa ferramentas no Supabase,
   * e sintetiza uma resposta conversacional e calorosa com dados reais e cards interativos.
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
- O operador está ouvindo sua resposta por voz no alto-falante.
- Responda em no máximo 1 a 2 frases curtas, claras e 100% diretas ao ponto.
- NUNCA use marcadores de tópicos (•, -, *), numerações ou explicações teóricas.
- Fale o resultado imediatamente na primeira palavra.`
      : "";

    const systemPrompt = `${JESSI_V2_SYSTEM_PROMPT}

CONTEXTO TEMPORAL E OPERACIONAL ATUAL:
- Operador Ativo: ${user?.nome || "Eli Júnior"} (${user?.cargo || "Administrador"})
IMPORTANTE: Chame o operador sempre pelo primeiro nome ("${user?.nome?.split(" ")[0] || "Eli"}"). NUNCA se dirija a ele como "Proprietário", "Usuário" ou "Admin". Trate-o como parceiro executivo próximo, dinâmico e inteligente.
${contexto.pet?.nome ? `- Pet Selecionado no Contexto: ${contexto.pet.nome} (ID: ${contexto.pet.id || "N/A"})` : ""}
${contexto.cliente?.nome ? `- Cliente/Tutor no Contexto: ${contexto.cliente.nome} (ID: ${contexto.cliente.id || "N/A"})` : ""}
${snapshotTexto}
${instrucaoVoz}

DIRETRIZES DE AUTONOMIA E OBJETIVIDADE:
1. FOCO TOTAL NO OBJETIVO: Responda exatamente e apenas o que o Eli perguntou com precisão cirúrgica.
2. ACIONAMENTO DE FERRAMENTAS: Se o usuário pedir para agendar, cancelar, remarcar, consultar faturamento, buscar clientes ou ver a agenda, ACIONE A TOOL CORRESPONDENTE NA HORA.
3. RESPOSTA DIRETA: Após o retorno da ferramenta, informe o resultado de forma limpa em 1 a 2 frases sem enrolação ou teorias.`;

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
    const novoContexto: Partial<JessiV2ContextState> = {};

    // 2. TENTA CHAMADA NATIVA COM TOOL CALLING AO LLM (GROQ / GEMINI)
    if (auth?.key) {
      try {
        const respostaIA = await this.executarRequisicaoIAComTools(messages, OPENAI_TOOLS_SCHEMA, 0.2);

        // A. O LLM decidiu chamar uma ou mais ferramentas nativamente
        if (respostaIA.tool_calls && respostaIA.tool_calls.length > 0) {
          const toolMessages: any[] = [
            {
              role: "assistant",
              content: respostaIA.content || null,
              tool_calls: respostaIA.tool_calls,
            },
          ];

          for (const tc of respostaIA.tool_calls) {
            const toolNome = tc.function.name;
            let toolArgs: any = {};
            try {
              toolArgs = JSON.parse(tc.function.arguments || "{}");
            } catch {
              toolArgs = {};
            }

            try {
              const resTool = await despacharFerramentaV2(sb, toolNome, toolArgs);
              if (resTool?.success === false) {
                return {
                  respostaTexto: `Não consegui concluir essa consulta: ${resTool.summary || "serviço indisponível no momento"}. Nenhuma alteração foi confirmada.`,
                  cards,
                  pendingAction: null,
                  novoContexto,
                };
              }
              this.anexarCardVisual(cards, toolNome, resTool, toolArgs);

              if (resTool?.pendingAction) {
                pendingAction = resTool.pendingAction;
              } else if (resTool?.data?.pendingAction) {
                pendingAction = resTool.data.pendingAction;
              }

              toolMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(resTool),
              });
            } catch (errTool) {
              console.warn(`[JessiV2] Erro ao executar tool ${toolNome}:`, errTool);
              return {
                respostaTexto: "Não consegui concluir essa consulta agora. Nenhuma alteração foi confirmada.",
                cards,
                pendingAction: null,
                novoContexto,
              };
            }
          }

          // Segunda rodada: O LLM gera a resposta final humanizada com os dados reais
          try {
            const mensagensRound2 = [...messages, ...toolMessages];
            const respostaFinal = await this.executarRequisicaoIAComTools(mensagensRound2, undefined, 0.4);
            const textoFinal = (respostaFinal.content || respostaIA.content || "").trim();

            if (textoFinal) {
              return {
                respostaTexto: textoFinal.replace(/<<<ACTION:[\s\S]*?>>>/, "").trim(),
                cards,
                pendingAction,
                novoContexto,
              };
            }
          } catch (errRound2) {
            console.warn("[JessiV2] Aviso na rodada final de síntese:", errRound2);
          }

          // Se a rodada 2 não produziu texto novo, usa o conteúdo inicial ou resumo
          const textoFallback = respostaIA.content || "A consulta foi feita, mas não consegui preparar a resposta. Confira os dados apresentados.";
          return {
            respostaTexto: textoFallback.replace(/<<<ACTION:[\s\S]*?>>>/, "").trim(),
            cards,
            pendingAction,
            novoContexto,
          };
        }

        // B. O LLM respondeu diretamente sem tool calls (conversa pura, conselho, instrução)
        if (respostaIA.content && respostaIA.content.trim().length > 0) {
          let textoLimpo = respostaIA.content.trim();

          // Fallback para tags legadas <<<ACTION:{...}>>> se o modelo emitiu no texto
          const actionMatch = textoLimpo.match(/<<<ACTION:([\s\S]*?)>>>/);
          if (actionMatch && actionMatch[1]) {
            try {
              const parsedAction = JSON.parse(actionMatch[1].trim());
              const toolAlvo = parsedAction.tool;
              const toolParams = parsedAction.params || {};
              textoLimpo = textoLimpo.replace(/<<<ACTION:[\s\S]*?>>>/, "").trim();

              const resTool = await despacharFerramentaV2(sb, toolAlvo, toolParams);
              this.anexarCardVisual(cards, toolAlvo, resTool, toolParams);
              if (resTool?.pendingAction) pendingAction = resTool.pendingAction;
            } catch {}
          }

          return {
            respostaTexto: textoLimpo,
            cards,
            pendingAction,
            novoContexto,
          };
        }
      } catch (errLLM) {
        const authInfo = this.obterApiKeyServidor();
        console.error(`[JessiV2] FALHA no LLM (${authInfo?.endpoint || "sem endpoint"}), acionando despacho resiliente:`, errLLM);
      }
    }

    // 3. DISPATCHER RESILIENTE DE BACKUP (caso a rede/IA esteja offline)
    // Garante que mesmo offline ou sem resposta do gateway, o comando é executado com dados reais do Supabase e fala humanizada!
    const despachoResiliente = await this.executarDespachoResiliente(sb, mensagemUsuario, hojeStr, user?.nome || "Eli", contexto);
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
      respostaTexto: `Como posso te ajudar agora, ${user?.nome || "Eli"}? Posso consultar a agenda, agendar ou cancelar atendimentos, ver o financeiro ou buscar clientes.`,
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
    operadorNome: string,
    contexto?: any
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
    // 2. CANCELAMENTO & DESMARCAÇÃO DE ATENDIMENTOS
    // =========================================================================
    const isCancelIntent =
      msg.includes("cancelar") ||
      msg.includes("cancela") ||
      msg.includes("desmarcar") ||
      msg.includes("desmarca") ||
      msg.includes("anular agendamento");

    if (isCancelIntent) {
      const termoNome = mensagemUsuario
        .replace(/\b(eu|quero|por|favor|cancelar|cancela|desmarcar|desmarca|o|a|os|as|do|da|de|no|na|em|dia|agendamento|horario|horário|atendimento|banho|tosa|para|às|as|horas|hora|manhã|manha|tarde|noite|esse|este|essa|este agendamento|esse agendamento)\b/gi, "")
        .replace(/\b\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?\b/g, "")
        .replace(/\b\d{1,2}(?:[:h]\d{2}|h|\s*horas)?\b/gi, "")
        .replace(/[^\w\s\u00C0-\u00FF]/gi, "")
        .trim();

      const resCancel = await AgendaAdapter.prepararPropostaCancelamento(sb, {
        agendamentoId: contexto?.ultimoAgendamentoId || contexto?.agendamentoId || undefined,
        petNome: termoNome || contexto?.pet?.nome || undefined,
        clienteNome: termoNome || contexto?.cliente?.nome || undefined,
        motivo: "Cancelamento solicitado pelo tutor/operador",
      });

      const d = resCancel?.data || {};
      const petLabel = d.petNome || (termoNome ? termoNome : "o Pet");

      return {
        texto: `Preparei o cancelamento do agendamento de **${petLabel}**. Toque em Confirmar para liberar a vaga na grade.`,
        card: {
          type: "confirmacao",
          title: `Cancelar Agendamento: ${petLabel}`,
          subtitle: `Horário: ${d.hora || "Atendimento"} • Vaga será liberada`,
          data: {
            acao: "cancelar_agendamento",
            tipo: "cancelamento",
            agendamentoId: d.agendamentoId,
            petNome: d.petNome,
            hora: d.hora,
          },
        },
        pendingAction: resCancel?.pendingAction || null,
        novoContexto: {
          agendamentoId: d.agendamentoId,
          ultimoAgendamentoId: d.agendamentoId,
        },
      };
    }

    // =========================================================================
    // 3. REAGENDAMENTO & REMARCAÇÃO (TROCA DE DATA/HORÁRIO)
    // =========================================================================
    const isRescheduleIntent =
      msg.includes("reagendar") ||
      msg.includes("remarcar") ||
      msg.includes("trocar a data") ||
      msg.includes("troca a data") ||
      msg.includes("trocar data") ||
      msg.includes("mudar data") ||
      msg.includes("mudar horario") ||
      msg.includes("mudar o horario") ||
      msg.includes("alterar horario");

    if (isRescheduleIntent) {
      let novaData = hojeStr;
      const matchDataBarra = mensagemUsuario.match(/\b(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?\b/);
      if (matchDataBarra) {
        const dia = matchDataBarra[1].padStart(2, "0");
        const mes = matchDataBarra[2].padStart(2, "0");
        const anoAtual = new Date().getFullYear();
        const ano = matchDataBarra[3] ? (matchDataBarra[3].length === 2 ? `20${matchDataBarra[3]}` : matchDataBarra[3]) : String(anoAtual);
        novaData = `${ano}-${mes}-${dia}`;
      }

      const matchHora = mensagemUsuario.match(/(?:as|às|ás)?\s*(\d{1,2})(?:[:h](\d{2})?|h|\s*horas)?\b/i);
      let novaHora = "14:00";
      if (matchHora) {
        const h = matchHora[1].padStart(2, "0");
        const m = matchHora[2] ? matchHora[2].padStart(2, "0") : "00";
        novaHora = `${h}:${m}`;
      }

      const termoNome = mensagemUsuario
        .replace(/\b(eu|quero|por|favor|reagendar|remarcar|trocar|troca|mudar|muda|alterar|a|o|os|as|do|da|de|no|na|em|dia|data|horario|horário|atendimento|banho|tosa|para|às|as|horas|hora|manhã|manha|tarde|noite|este|esse|essa|este agendamento|esse agendamento)\b/gi, "")
        .replace(/\b\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?\b/g, "")
        .replace(/\b\d{1,2}(?:[:h]\d{2}|h|\s*horas)?\b/gi, "")
        .replace(/[^\w\s\u00C0-\u00FF]/gi, "")
        .trim();

      const resRemarcar = await AgendaAdapter.prepararPropostaReagendamento(sb, {
        agendamentoId: contexto?.ultimoAgendamentoId || contexto?.agendamentoId || undefined,
        petNome: termoNome || contexto?.pet?.nome || undefined,
        clienteNome: termoNome || contexto?.cliente?.nome || undefined,
        novaData,
        novaHora,
        motivo: "Remarcação solicitada pelo tutor/operador",
      });

      const d = resRemarcar?.data || {};
      const petLabel = d.petNome || (termoNome ? termoNome : "o Pet");
      const diaFormatado = novaData.split("-").reverse().slice(0, 2).join("/");

      return {
        texto: `Preparei a remarcação de **${petLabel}** para o dia **${diaFormatado}** às **${novaHora}**. Toque em Confirmar para atualizar a grade.`,
        card: {
          type: "confirmacao",
          title: `Remarcar: ${petLabel}`,
          subtitle: `Mudar para ${diaFormatado} às ${novaHora}`,
          data: {
            acao: "reagendar_agendamento",
            tipo: "reagendamento",
            agendamentoId: d.agendamentoId,
            petNome: d.petNome,
            clienteNome: d.clienteNome,
            novaData,
            novaHora,
            motivo: "Remarcação solicitada pelo operador",
          },
        },
        pendingAction: resRemarcar?.pendingAction || null,
        novoContexto: {
          agendamentoId: d.agendamentoId,
          ultimoAgendamentoId: d.agendamentoId,
        },
      };
    }

    // =========================================================================
    // 4. AGENDAMENTO & MARCAÇÃO DE ATENDIMENTOS (BANHO, TOSA, HORÁRIO)
    // =========================================================================
    const isSchedulingIntent =
      (msg.includes("agendar") ||
        msg.includes("marcar") ||
        msg.includes("agendamento") ||
        msg.includes("fazer um agendamento") ||
        msg.includes("fazer agendamento") ||
        msg.includes("quero agendar") ||
        msg.includes("quero marcar") ||
        msg.includes("agendamento para") ||
        msg.includes("agendamento no dia") ||
        msg.includes("marcar banho") ||
        msg.includes("marcar tosa") ||
        msg.includes("marcar horario") ||
        msg.includes("novo agendamento") ||
        msg.includes("agendar horario") ||
        msg.includes("horario para")) &&
      !msg.includes("cancelar") &&
      !msg.includes("cancela") &&
      !msg.includes("desmarcar") &&
      !msg.includes("desmarca") &&
      !msg.includes("remarcar") &&
      !msg.includes("reagendar") &&
      !msg.includes("trocar data") &&
      !msg.includes("troca a data") &&
      !msg.includes("como esta a agenda") &&
      !msg.includes("ver agenda") &&
      !msg.includes("consultar agenda") &&
      !msg.includes("qual o proximo");

    if (isSchedulingIntent) {
      let dataAgendamento = hojeStr;

      // Suporte a formatos "01/10", "1/10", "10/10", "01-10", "01/10/2026"
      const matchDataBarra = mensagemUsuario.match(/\b(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?\b/);
      if (matchDataBarra) {
        const dia = matchDataBarra[1].padStart(2, "0");
        const mes = matchDataBarra[2].padStart(2, "0");
        const anoAtual = new Date().getFullYear();
        const ano = matchDataBarra[3] ? (matchDataBarra[3].length === 2 ? `20${matchDataBarra[3]}` : matchDataBarra[3]) : String(anoAtual);
        dataAgendamento = `${ano}-${mes}-${dia}`;
      } else if (msg.includes("amanha")) {
        dataAgendamento = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000));
      } else if (msg.includes("depois de amanha")) {
        dataAgendamento = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 172800000));
      }

      // Extrair hora (ex: às 14 horas, 14h, 14:00, às 14:30, 9h, 9:00)
      const matchHora = mensagemUsuario.match(/(?:as|às|ás)?\s*(\d{1,2})(?:[:h](\d{2})?|h|\s*horas)?\b/i);
      let horaAgendamento = "09:00";
      if (matchHora) {
        const h = matchHora[1].padStart(2, "0");
        const m = matchHora[2] ? matchHora[2].padStart(2, "0") : "00";
        horaAgendamento = `${h}:${m}`;
      }

      // Extrair serviço
      let servicoNome = "Banho";
      if (msg.includes("tosa higienica")) servicoNome = "Tosa Higiênica";
      else if (msg.includes("tosa completa") || msg.includes("tosa geral")) servicoNome = "Tosa Completa";
      else if (msg.includes("tosa")) servicoNome = "Tosa";
      else if (msg.includes("hidratacao") || msg.includes("hidratação")) servicoNome = "Banho e Hidratação";

      // Extrair nome de pet/cliente mencionado
      const termoNome = mensagemUsuario
        .replace(/\b(eu|quero|fazer|um|uma|novo|nova|agendar|marcar|agendamento|horario|para|o|a|do|da|de|no|na|amanha|hoje|depois|dia|banho|tosa|higienica|completa|geral|as|às|ás|horas|hora|por|favor|atendimento)\b/gi, "")
        .replace(/\b\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?\b/g, "")
        .replace(/\b\d{1,2}(?:[:h]\d{2}|h|\s*horas)?\b/gi, "")
        .replace(/[^\w\s\u00C0-\u00FF]/gi, "")
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

      const diaNomeFormatado = dataAgendamento === hojeStr
        ? "hoje"
        : dataAgendamento.split("-").reverse().slice(0, 2).join("/");

      const petNomeLabel = petEncontrado?.nome || (termoNome ? termoNome : "o Pet");
      const tutorNomeLabel = clienteEncontrado?.nome ? ` (tutor: ${clienteEncontrado.nome})` : "";

      return {
        texto: `Preparei a proposta de agendamento de **${servicoNome}** para **${petNomeLabel}**${tutorNomeLabel} no dia **${diaNomeFormatado}** às **${horaAgendamento}**, ${nomeOp}! Toque em Confirmar no card para salvar na grade oficial.`,
        card: {
          type: "confirmacao",
          title: `Confirmar Agendamento: ${petNomeLabel}`,
          subtitle: `${servicoNome} • Dia ${diaNomeFormatado} às ${horaAgendamento}`,
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
      const resAbertos = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb);
      if (!resAbertos.success) return { texto: "Não consegui consultar os pagamentos em aberto agora. Tente novamente em instantes." };
      const lista = ((resAbertos.data as any)?.itens_pendentes || []) as any[];
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
      const resFin = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, periodo);
      if (!resFin.success) return { texto: "Não consegui consultar o financeiro agora. Tente novamente em instantes." };
      const d = resFin.data;
      const totalRecebido = Number(d.valoresRecebidos || 0);
      const totalPendente = Number(d.valoresAReceber || 0) + Number(d.valoresVencidosDevedores || 0);
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
    // 7. CLIENTES PARA ENCAIXE / PREENCHER GRADE / SUGESTÃO INTELIGENTE
    // =========================================================================
    if (
      msg.includes("sugerir cliente") ||
      msg.includes("sugerir clientes") ||
      msg.includes("sugerir encaixe") ||
      msg.includes("sugerir encaixes") ||
      msg.includes("clientes para horario vago") ||
      msg.includes("clientes para horarios vagos") ||
      msg.includes("clientes para vaga") ||
      msg.includes("preencher grade") ||
      msg.includes("preencher horario") ||
      msg.includes("preencher horário") ||
      msg.includes("clientes para preencher") ||
      msg.includes("quem sugerir") ||
      msg.includes("quem chamar") ||
      msg.includes("convidar cliente") ||
      msg.includes("convidar clientes") ||
      msg.includes("inativ") ||
      msg.includes("reativa") ||
      msg.includes("retorno") ||
      msg.includes("ausente") ||
      msg.includes("sumido") ||
      msg.includes("saudade")
    ) {
      const resRet = await despacharFerramentaV2(sb, "sugerir_clientes_para_encaixe", { data: hojeStr });
      const d = resRet?.data || resRet;
      const lista = Array.isArray(d) ? d : d?.data || d?.clientes || d?.sugestoes || [];

      return {
        texto: `Identifiquei os clientes habituais deste dia da semana com ciclo ideal de retorno. Você pode enviar os convites no WhatsApp diretamente pelos cards abaixo.`,
        card: {
          type: "reativacao",
          title: "Clientes Sugeridos para Encaixe",
          subtitle: `${lista.length} cliente(s) habitual(is) no ciclo ideal`,
          data: lista,
        },
      };
    }

    // =========================================================================
    // 8. HORÁRIOS LIVRES / VAGAS / DISPONIBILIDADE
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
    // 9. ATRASOS / QUEM FALTOU / SENTINELAS (ANTES DA AGENDA GERAL)
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
    // 10. LEVA E TRAZ / ROTAS / TRANSPORTE / TÁXI DOG (ANTES DA AGENDA GERAL)
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
    // 11. AGENDA DE ATENDIMENTOS / GRADE DO DIA / ROTINA
    // =========================================================================
    if (
      (msg.includes("agenda") ||
        msg.includes("atendimentos de hoje") ||
        msg.includes("atendimentos de amanha") ||
        msg.includes("atendimentos marcados") ||
        msg.includes("rotina") ||
        msg.includes("como esta o dia") ||
        msg.includes("grade do dia") ||
        msg.includes("ver grade")) &&
      !isSchedulingIntent &&
      !msg.includes("cancelar") &&
      !msg.includes("desmarcar") &&
      !msg.includes("reagendar")
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
      texto: `Entendido, ${nomeOp}! Estou pronta para te apoiar. Você pode me pedir:\n\n• **"Como está a agenda de hoje?"** ou **"Próximos pets para atendimento"**\n• **"Horários livres para amanhã"** ou **"Lembretes de confirmação"**\n• **"Resumo do faturamento deste mês"** ou **"Pagamentos pendentes dos clientes"**\n• **"Clientes sumidos para reativar"** ou o nome de qualquer tutor/pet.`,
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
      case "sugerir_clientes_para_encaixe":
      case "sugerir_encaixes_reativacao":
      case "identificar_clientes_retorno": {
        const lista = Array.isArray(data) ? data : data?.data || data?.clientes || data?.sugestoes || [];
        cards.push({
          type: "reativacao",
          title: "Clientes Sugeridos para Encaixe",
          subtitle: `${lista.length} cliente(s) habitual(is) no ciclo ideal`,
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
      case "preparar_agendamento": {
        const d = data || toolArgs || {};
        const diaFormatado = d.data ? (d.data.includes("-") ? d.data.split("-").reverse().slice(0, 2).join("/") : d.data) : "Hoje";
        cards.push({
          type: "confirmacao",
          title: `Confirmar Agendamento: ${d.petNome || d.clienteNome || "Pet"}`,
          subtitle: `${d.servico || d.servicoNome || "Banho"} • Dia ${diaFormatado} às ${d.hora || "14:00"}`,
          data: {
            acao: "criar_agendamento",
            tipo: "agendamento",
            data: d.data,
            hora: d.hora,
            servico: d.servico || d.servicoNome || "Banho",
            servicoNome: d.servico || d.servicoNome || "Banho",
            petId: d.petId,
            petNome: d.petNome,
            clienteId: d.clienteId,
            clienteNome: d.clienteNome,
            valor: d.valor || 80,
          },
        });
        break;
      }
      case "preparar_reagendamento":
      case "remarcar_horario":
      case "trocar_data":
      case "mudar_horario": {
        const d = data || toolArgs || {};
        const diaFormatado = d.novaData ? (d.novaData.includes("-") ? d.novaData.split("-").reverse().slice(0, 2).join("/") : d.novaData) : (d.data || "Nova Data");
        cards.push({
          type: "confirmacao",
          title: `Remarcar: ${d.petNome || d.clienteNome || "Agendamento"}`,
          subtitle: `Mudar para ${diaFormatado} às ${d.novaHora || d.hora || "Horário"}`,
          data: {
            acao: "reagendar_agendamento",
            tipo: "reagendamento",
            agendamentoId: d.agendamentoId,
            petNome: d.petNome,
            clienteNome: d.clienteNome,
            novaData: d.novaData || d.data,
            novaHora: d.novaHora || d.hora,
            motivo: d.motivo,
          },
        });
        break;
      }
      case "preparar_cancelamento": {
        const d = data || toolArgs || {};
        cards.push({
          type: "confirmacao",
          title: `Cancelar Agendamento: ${d.petNome || "Pet"}`,
          subtitle: `Horário: ${d.hora || "Atendimento"} • Vaga será liberada`,
          data: {
            acao: "cancelar_agendamento",
            agendamentoId: d.agendamentoId,
            petNome: d.petNome,
            hora: d.hora,
          },
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
