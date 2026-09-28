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

/**
 * Provedor de IA Conversacional e Agente Autônomo com Tool Calling (Gemini 1.5 Flash / Lovable Gateway)
 * Desenvolvido para entregar 100% da capacidade cognitiva e operacional da Jessi
 */

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_CONFIG = {
  TIMEOUT_MS: 15000,
  MAX_RETRIES: 2,
  MODEL: "google/gemini-1.5-flash",
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

    if (!chave) return null;

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
  }): Promise<{
    respostaTexto: string;
    cards: JessiV2Card[];
    pendingAction: JessiV2PendingAction | null;
    novoContexto: Partial<JessiV2ContextState>;
  }> {
    const { sb, mensagemUsuario, contexto, historico = [], user } = params;
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

    const systemPrompt = `${JESSI_V2_SYSTEM_PROMPT}

CONTEXTO TEMPORAL E OPERACIONAL ATUAL:
- Data de Referência do Sistema: ${hojeStr}
- Hora Local Atual (São Paulo): ${horaAtualStr}
- Operador Ativo: ${user?.nome || "Eli Júnior"} (${user?.cargo || "Administrador"})
IMPORTANTE: Chame o operador sempre pelo nome próprio ("${user?.nome || 'Eli'}"). NUNCA se dirija a ele como "Proprietário", "Usuário" ou "Admin". Trate-o como parceiro executivo próximo e respeitoso.
${contexto.pet?.nome ? `- Pet Selecionado no Contexto: ${contexto.pet.nome} (ID: ${contexto.pet.id || "N/A"})` : ""}
${contexto.cliente?.nome ? `- Cliente/Tutor no Contexto: ${contexto.cliente.nome} (ID: ${contexto.cliente.id || "N/A"})` : ""}

DIRETRIZES DE USO DAS FERRAMENTAS (TOOL CALLING) & FLUIDEZ TOTAL:
1. Sempre que a pergunta envolver dados reais (agenda, horários, clientes, faturamento, histórico, planos, estoque), invoque a ferramenta correspondente para obter dados precisos do banco.
2. Seja proativa, inteligente e parceira executiva! Não dê respostas curtas ou monótonas. Contextualize a resposta, traga ideias práticas de operação, comente sobre os pets com afeto e sugira os próximos passos.
3. Se o operador pedir para "consultar um cliente", "buscar um cliente", "procurar" ou mencionar QUALQUER nome de pessoa ou pet, invoque IMEDIATAMENTE 'buscar_clientes_pets' com o nome/termo mencionado.
4. Se o operador pedir para consultar clientes sem fornecer um nome, invoque 'buscar_clientes_pets' sem termo para trazer os mais recentes e pergunte quem ele deseja consultar de forma acolhedora.
5. Se o operador quiser agendar, remarcar ou cancelar, use 'preparar_agendamento', 'preparar_reagendamento' ou 'preparar_cancelamento'.
6. NUNCA mencione que você chamou uma 'ferramenta', 'função', 'payload' ou 'banco de dados'. Fale sempre como uma colega de trabalho experiente, humana e atenciosa.
7. NUNCA diga "não consegui identificar o cliente". Se a busca retornar resultados, apresente-os com clareza e destaque. Se a busca retornar vazio, diga com gentileza que não encontrou o cadastro e pergunte se deseja registrar um novo cliente.
8. Formate valores monetários em R$ (ex: R$ 80,00).`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Histórico recente (máximo 8 mensagens para manter contexto conversacional rico)
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

    if (auth?.key) {
      try {
        // PASSADA 1: Envia com Tools disponíveis
        const resPass1 = await fetch(auth.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.key}`,
          },
          body: JSON.stringify({
            model: auth.model,
            temperature: 0.7,
            messages,
            tools: OPENAI_TOOLS_SCHEMA,
            tool_choice: "auto",
          }),
        });

        if (resPass1.ok) {
          const dataPass1: any = await resPass1.json();
          const choice = dataPass1?.choices?.[0];
          const msgAssistant = choice?.message;

          // Se a IA decidiu chamar ferramentas
          if (msgAssistant?.tool_calls && msgAssistant.tool_calls.length > 0) {
            messages.push(msgAssistant);
            let dadosUltimaTool: any = null;
            let nomeUltimaTool: string = "";

            for (const tCall of msgAssistant.tool_calls) {
              const toolNome = tCall.function.name;
              nomeUltimaTool = toolNome;
              let toolArgs: any = {};
              try {
                toolArgs = JSON.parse(tCall.function.arguments || "{}");
              } catch {
                toolArgs = {};
              }

              // Tratamento de propostas de mutação supervisionada
              if (toolNome === "preparar_agendamento") {
                const actionId = `action_agenda_${Date.now()}`;
                pendingAction = {
                  id: actionId,
                  type: "agendamento",
                  tool: "criar_agendamento",
                  title: "Confirmar Agendamento",
                  summary: `Agendar ${toolArgs.servicoNome || "Banho"} para ${toolArgs.petNome || "Pet"} no dia ${toolArgs.data || hojeStr} às ${toolArgs.hora}`,
                  riskLevel: "medio",
                  params: toolArgs,
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };

                cards.push({
                  type: "confirmacao",
                  title: "Proposta de Agendamento",
                  subtitle: `${toolArgs.petNome || "Pet"} • ${toolArgs.data || hojeStr} às ${toolArgs.hora}`,
                  data: {
                    pendingAction,
                    ...toolArgs,
                  },
                });

                messages.push({
                  role: "tool",
                  tool_call_id: tCall.id,
                  content: JSON.stringify({
                    status: "proposta_criada",
                    mensagem: "Proposta de agendamento montada na tela para confirmação do operador.",
                    detalhes: toolArgs,
                  }),
                });
                continue;
              }

              if (toolNome === "preparar_cancelamento") {
                const actionId = `action_canc_${Date.now()}`;
                pendingAction = {
                  id: actionId,
                  type: "cancelamento",
                  tool: "cancelar_agendamento",
                  title: "Confirmar Cancelamento",
                  summary: `Cancelar agendamento de ${toolArgs.petNome || "Pet"}`,
                  riskLevel: "alto",
                  params: toolArgs,
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };

                cards.push({
                  type: "confirmacao",
                  title: "Proposta de Cancelamento",
                  subtitle: `Pet: ${toolArgs.petNome || "Pet"}`,
                  data: { pendingAction, ...toolArgs },
                });

                messages.push({
                  role: "tool",
                  tool_call_id: tCall.id,
                  content: JSON.stringify({
                    status: "proposta_cancelamento_criada",
                    detalhes: toolArgs,
                  }),
                });
                continue;
              }

              if (toolNome === "preparar_reagendamento") {
                const actionId = `action_reag_${Date.now()}`;
                pendingAction = {
                  id: actionId,
                  type: "reagendamento",
                  tool: "reagendar_agendamento",
                  title: "Confirmar Remarcação",
                  summary: `Remarcar ${toolArgs.petNome || "Pet"} para ${toolArgs.novaData} às ${toolArgs.novaHora}`,
                  riskLevel: "medio",
                  params: toolArgs,
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };

                cards.push({
                  type: "confirmacao",
                  title: "Proposta de Remarcação",
                  subtitle: `Novo horário: ${toolArgs.novaData} às ${toolArgs.novaHora}`,
                  data: { pendingAction, ...toolArgs },
                });

                messages.push({
                  role: "tool",
                  tool_call_id: tCall.id,
                  content: JSON.stringify({
                    status: "proposta_reagendamento_criada",
                    detalhes: toolArgs,
                  }),
                });
                continue;
              }

              if (toolNome === "preparar_cadastro_cliente") {
                const actionId = `action_cli_${Date.now()}`;
                pendingAction = {
                  id: actionId,
                  type: "cadastro_cliente",
                  tool: "executar_cadastro_cliente",
                  title: "Confirmar Cadastro de Cliente",
                  summary: `Cadastrar cliente ${toolArgs.nome}${toolArgs.telefone ? ` (${toolArgs.telefone})` : ""}`,
                  riskLevel: "baixo",
                  params: toolArgs,
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };

                cards.push({
                  type: "confirmacao",
                  title: "Proposta de Novo Cliente",
                  subtitle: `${toolArgs.nome} • Tel: ${toolArgs.telefone || "Não informado"}`,
                  data: { pendingAction, ...toolArgs },
                });

                messages.push({
                  role: "tool",
                  tool_call_id: tCall.id,
                  content: JSON.stringify({
                    status: "proposta_cadastro_criada",
                    detalhes: toolArgs,
                  }),
                });
                continue;
              }

              if (toolNome === "preparar_consumo_credito") {
                const actionId = `action_cred_${Date.now()}`;
                pendingAction = {
                  id: actionId,
                  type: "consumo_credito",
                  tool: "executar_consumo_credito",
                  title: "Confirmar Uso de Crédito do Clubinho",
                  summary: `Abater 1 serviço do pacote do Clubinho`,
                  riskLevel: "baixo",
                  params: toolArgs,
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };

                cards.push({
                  type: "confirmacao",
                  title: "Consumo de Crédito do Clubinho",
                  subtitle: "Abatimento de 1 banho no plano",
                  data: { pendingAction, ...toolArgs },
                });

                messages.push({
                  role: "tool",
                  tool_call_id: tCall.id,
                  content: JSON.stringify({
                    status: "proposta_credito_criada",
                    detalhes: toolArgs,
                  }),
                });
                continue;
              }

              if (toolNome === "preparar_estorno") {
                const actionId = `action_est_${Date.now()}`;
                pendingAction = {
                  id: actionId,
                  type: "estorno",
                  tool: "executar_estorno",
                  title: "Confirmar Estorno Financeiro",
                  summary: `Estornar pagamento: ${toolArgs.motivo || "A pedido do cliente"}`,
                  riskLevel: "alto",
                  params: toolArgs,
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };

                cards.push({
                  type: "confirmacao",
                  title: "Proposta de Estorno",
                  subtitle: `Motivo: ${toolArgs.motivo || "Não informado"}`,
                  data: { pendingAction, ...toolArgs },
                });

                messages.push({
                  role: "tool",
                  tool_call_id: tCall.id,
                  content: JSON.stringify({
                    status: "proposta_estorno_criada",
                    detalhes: toolArgs,
                  }),
                });
                continue;
              }

              // Executa a ferramenta de consulta diretamente no Supabase
              const resTool = await despacharFerramentaV2(sb, toolNome, toolArgs);
              dadosUltimaTool = resTool?.data || resTool;

              // Converte o resultado em Card visual adequado
              this.anexarCardVisual(cards, toolNome, resTool, toolArgs);

              // Atualiza contexto caso cliente/pet tenham sido selecionados
              if (toolNome === "obter_ficha_pet" && resTool?.data) {
                novoContexto.pet = {
                  id: resTool.data.id,
                  nome: resTool.data.nome,
                  raca: resTool.data.raca,
                  porte: resTool.data.porte,
                };
              } else if (toolNome === "obter_ficha_cliente" && resTool?.data) {
                novoContexto.cliente = {
                  id: resTool.data.id,
                  nome: resTool.data.nome,
                  telefone: resTool.data.telefone,
                };
              }

              messages.push({
                role: "tool",
                tool_call_id: tCall.id,
                content: JSON.stringify(resTool?.data || resTool || { ok: true }),
              });
            }

            // PASSADA 2: IA sintetiza os dados reais do banco com calor humano
            try {
              const resPass2 = await fetch(auth.endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${auth.key}`,
                },
                body: JSON.stringify({
                  model: auth.model,
                  temperature: 0.7,
                  messages,
                }),
              });

              if (resPass2.ok) {
                const dataPass2: any = await resPass2.json();
                const finalContent = dataPass2?.choices?.[0]?.message?.content?.trim();
                if (finalContent) {
                  return {
                    respostaTexto: finalContent,
                    cards,
                    pendingAction,
                    novoContexto,
                  };
                }
              }
            } catch (errPass2) {
              console.warn("[JessiV2] Falha na passada 2 do Gateway, gerando síntese local:", errPass2);
            }

            // Síntese local resiliente dos dados recuperados da ferramenta
            const resLocal = this.sintetizarResultadoLocal(nomeUltimaTool, dadosUltimaTool, user?.nome || "Eli");
            return {
              respostaTexto: resLocal,
              cards,
              pendingAction,
              novoContexto,
            };
          } else if (msgAssistant?.content) {
            // IA respondeu diretamente (conversa natural, conselho ou esclarecimento)
            return {
              respostaTexto: msgAssistant.content.trim(),
              cards,
              pendingAction,
              novoContexto,
            };
          }
        }
      } catch (errGateway) {
        console.warn("[JessiV2 Autonomous Agent] Erro no gateway, acionando despacho resiliente:", errGateway);
      }
    }


    // DISPATCHER RESILIENTE DIRETO DE FERRAMENTAS
    // Garante que mesmo offline ou sem resposta do gateway, o comando é executado e os dados reais são mostrados e falados!
    const despachoResiliente = await this.executarDespachoResiliente(sb, mensagemUsuario, hojeStr, user?.nome || "Eli");
    if (despachoResiliente) {
      if (despachoResiliente.card) {
        cards.push(despachoResiliente.card);
      }
      return {
        respostaTexto: despachoResiliente.texto,
        cards,
        pendingAction: null,
        novoContexto: despachoResiliente.novoContexto || {},
      };
    }

    return {
      respostaTexto: `Olá, ${user?.nome || "Eli"}! Estou pronta para te ajudar. Você pode me pedir para ver a agenda de hoje, consultar valores a receber, verificar vagas ou buscar a ficha de qualquer cliente ou pet!`,
      cards,
      pendingAction: null,
      novoContexto: {},
    };
  }

  /**
   * Executa despacho determinístico resiliente quando o gateway de IA não estiver disponível
   */
  private async executarDespachoResiliente(
    sb: SupabaseClient<Database>,
    mensagemUsuario: string,
    hojeStr: string,
    operadorNome: string
  ): Promise<{ texto: string; card?: JessiV2Card; novoContexto?: any } | null> {
    const msg = mensagemUsuario.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 0. Saudações e Conversação Natural Humanizada
    if (
      msg === "boa noite" ||
      msg.startsWith("boa noite") ||
      msg === "bom dia" ||
      msg.startsWith("bom dia") ||
      msg === "boa tarde" ||
      msg.startsWith("boa tarde") ||
      msg === "oi" ||
      msg === "ola" ||
      msg.startsWith("oi ") ||
      msg.startsWith("ola ") ||
      msg.includes("tudo bem") ||
      msg.includes("como vai") ||
      msg.includes("como voce esta") ||
      msg.includes("como você está")
    ) {
      const hora = new Date().getHours();
      const saudacaoHorario = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
      return {
        texto: `${saudacaoHorario}, ${operadorNome || "Eli"}! Tudo ótimo por aqui no Spa. Estou 100% pronta para te ajudar com a agenda, financeiro, clientes ou qualquer detalhe da operação. O que faremos agora?`,
      };
    }

    // 1. Financeiro / Valores a Receber / Faturamento / Caixa
    if (
      msg.includes("receber") ||
      msg.includes("financeiro") ||
      msg.includes("faturamento") ||
      msg.includes("faturou") ||
      msg.includes("quanto entrou") ||
      msg.includes("caixa") ||
      msg.includes("pagamento")
    ) {
      const periodo = msg.includes("hoje") ? "hoje" : msg.includes("semana") ? "semana" : "mes";
      const resFin = await despacharFerramentaV2(sb, "consultar_financeiro_consolidado", { periodo });
      const d = resFin?.data || resFin;
      const totalRecebido = d?.totalRecebido || d?.faturamento || 0;
      const totalPendente = d?.totalPendente || d?.valoresAReceber || 0;
      const ticketMedio = d?.ticketMedio || 0;

      const texto = `Aqui está o resumo financeiro do ${periodo === "hoje" ? "dia" : periodo === "semana" ? "período desta semana" : "mês"}: já foram recebidos R$ ${Number(totalRecebido).toFixed(2).replace(".", ",")} e temos R$ ${Number(totalPendente).toFixed(2).replace(".", ",")} pendentes a receber, com ticket médio de R$ ${Number(ticketMedio).toFixed(2).replace(".", ",")}.`;

      return {
        texto,
        card: {
          type: "financeiro",
          title: "Resumo Financeiro Consolidado",
          subtitle: `Período: ${periodo.toUpperCase()}`,
          data: d,
        },
      };
    }

    // 2. Horários Disponíveis / Vagas / Grade Livre
    if (
      msg.includes("horario") ||
      msg.includes("vaga") ||
      msg.includes("livre") ||
      msg.includes("encaixe") ||
      msg.includes("disponiv")
    ) {
      const resVagas = await despacharFerramentaV2(sb, "consultar_horarios_disponiveis", { data: hojeStr });
      const d = resVagas?.data || resVagas;
      const vagas = d?.horariosSugeridos || d?.vagas || [];

      let texto = `Temos ${vagas.length} horário(s) disponível(is) na grade de hoje: ${vagas.slice(0, 5).join(", ")}.`;
      if (vagas.length === 0) {
        texto = `A grade de hoje está com horários preenchidos. Quer que eu verifique a grade de amanhã?`;
      }

      return {
        texto,
        card: {
          type: "agenda",
          title: `Vagas Disponíveis (${vagas.length})`,
          subtitle: `Data: ${hojeStr}`,
          data: d,
        },
      };
    }

    // 3. Agenda de Atendimentos / Grade do Dia
    if (
      msg.includes("agenda") ||
      msg.includes("atendimento") ||
      msg.includes("marcado") ||
      msg.includes("banho") ||
      msg.includes("tosa")
    ) {
      const resAgenda = await despacharFerramentaV2(sb, "consultar_agenda", { data: hojeStr });
      const d = resAgenda?.data || resAgenda;
      const lista = Array.isArray(d) ? d : d?.agendamentos || [];

      let texto = `Encontrei ${lista.length} atendimento(s) agendado(s) para hoje.`;
      if (lista.length > 0) {
        const primeiros = lista
          .slice(0, 3)
          .map((a: any) => `${a.petNome || a.pet_nome || "Pet"} às ${(a.hora || a.horario || "horário").slice(0, 5)}`)
          .join(", ");
        texto += ` Próximos: ${primeiros}.`;
      }

      return {
        texto,
        card: {
          type: "agenda",
          title: `Agenda (${lista.length} atendimentos)`,
          subtitle: `Data: ${hojeStr}`,
          data: { itens: lista, total: lista.length },
        },
      };
    }

    // 4. Clientes / Pets / Tutores — Extração inteligente do nome para busca
    if (
      msg.includes("cliente") ||
      msg.includes("pet") ||
      msg.includes("tutor") ||
      msg.includes("buscar") ||
      msg.includes("procurar") ||
      msg.includes("ficha") ||
      msg.includes("cadastro") ||
      msg.includes("quem e") ||
      msg.includes("localizar")
    ) {
      // Extrai o termo de busca removendo palavras-chave de comando
      const termo = mensagemUsuario
        .replace(/\b(buscar|procurar|consultar|ver|ficha|cliente|pet|tutor|cadastro|quem|e|o|a|da|do|de|no|na|me|pra|para|por|favor|localizar|pesquisar|achar|encontrar|mostra|mostrar|olha|olhar)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      const resBusca = await despacharFerramentaV2(sb, "buscar_clientes_pets", { termo: termo || "" });
      const d = resBusca?.data || resBusca;
      const candidatos = d?.candidatos || (Array.isArray(d) ? d : []);

      let texto: string;
      if (candidatos.length === 1) {
        const c = candidatos[0];
        texto = `Encontrei! ${c.nomePrincipal || c.nome} — ${c.detalheSecundario || ""}. Toque no card para abrir a ficha completa.`;
      } else if (candidatos.length > 1) {
        const nomes = candidatos.slice(0, 4).map((c: any) => c.nomePrincipal || c.nome).join(", ");
        texto = `Encontrei ${candidatos.length} resultado(s) para "${termo || "clientes recentes"}": ${nomes}. Qual deles você quer ver?`;
      } else {
        texto = `Não encontrei nenhum registro para "${termo}" no sistema. Tente com outro nome, telefone ou o nome do pet.`;
      }

      return {
        texto,
        card: {
          type: "cliente",
          title: termo ? `Resultados para "${termo}"` : "Clientes Recentes",
          subtitle: "Selecione para abrir a ficha completa",
          data: {
            exigeDesambiguacao: candidatos.length > 1,
            opcoes: candidatos.slice(0, 6).map((c: any) => ({
              id: c.id,
              tipo: c.tipo || "cliente",
              nome: c.nomePrincipal || c.nome,
              detalhe: c.detalheSecundario || c.telefone || "",
            })),
          },
        },
      };
    }

    // 5. Clientes Ausentes / Reativação
    if (msg.includes("reativa") || msg.includes("retorno") || msg.includes("ausente") || msg.includes("sumido")) {
      const resRet = await despacharFerramentaV2(sb, "identificar_clientes_retorno", {});
      const d = resRet?.data || resRet;
      const lista = Array.isArray(d) ? d : d?.clientes || [];

      return {
        texto: `Identifiquei ${lista.length} cliente(s) que não vêm ao Spa há mais de 25 dias. Podemos disparar uma mensagem de carinho e retorno!`,
        card: {
          type: "reativacao",
          title: "Clientes Ausentes com Potencial de Retorno",
          subtitle: `${lista.length} clientes identificados`,
          data: lista,
        },
      };
    }

    // 6. Aniversariantes
    if (msg.includes("aniversari") || msg.includes("parabens") || msg.includes("niver")) {
      const resAniv = await despacharFerramentaV2(sb, "consultar_aniversariantes", {});
      const d = resAniv?.data || resAniv;
      const lista = Array.isArray(d) ? d : d?.aniversariantes || [];

      return {
        texto: `Temos ${lista.length} aniversariante(s) registrado(s) para este período. É uma ótima oportunidade de encantamento!`,
        card: {
          type: "comunicacao",
          title: "Aniversariantes do Pet Spa",
          subtitle: "Ações de Encantamento",
          data: d,
        },
      };
    }

    // 7. Cobrança Pix
    if (msg.includes("cobranca") || msg.includes("devedor") || msg.includes("inadimplente") || msg.includes("cobrar")) {
      const resCob = await despacharFerramentaV2(sb, "gerar_mensagens_cobranca", {});
      const d = resCob?.data || resCob;

      return {
        texto: `Preparei a lista de cobrança cordial com chave Pix pronta para envio no WhatsApp.`,
        card: {
          type: "financeiro",
          title: "Cobrança Cordial via Pix",
          subtitle: "Pendências financeiras",
          data: d,
        },
      };
    }

    // 8. Clubinho & Planos
    if (msg.includes("clubinho") || msg.includes("plano") || msg.includes("pacote") || msg.includes("credito")) {
      const resProg = await despacharFerramentaV2(sb, "consultar_programas_ativos_geral", {});
      const d = resProg?.data || resProg;

      return {
        texto: `Aqui está o panorama dos contratos e créditos ativos do Clubinho no Spa de Pet.`,
        card: {
          type: "programa",
          title: "Clubinho & Planos Mensais",
          subtitle: "Contratos ativos",
          data: d,
        },
      };
    }

    return null;
  }

  /**
   * Sintetiza uma resposta natural em português a partir dos dados retornados por uma ferramenta
   */
  private sintetizarResultadoLocal(toolNome: string, dados: any, operadorNome: string): string {
    if (!dados) return "Prontinho! Consultei as informações no sistema.";

    switch (toolNome) {
      case "consultar_financeiro_consolidado": {
        const recebido = dados?.totalRecebido || dados?.faturamento || 0;
        const pendente = dados?.totalPendente || dados?.valoresAReceber || 0;
        return `Aqui está o resumo financeiro: R$ ${Number(recebido).toFixed(2).replace(".", ",")} recebidos e R$ ${Number(pendente).toFixed(2).replace(".", ",")} pendentes a receber.`;
      }
      case "consultar_agenda": {
        const lista = Array.isArray(dados) ? dados : dados?.agendamentos || [];
        return `Encontrei ${lista.length} atendimento(s) na agenda. Os dados detalhados estão no card na tela.`;
      }
      case "buscar_clientes_pets": {
        const lista = dados?.candidatos || (Array.isArray(dados) ? dados : []);
        if (lista.length === 0) {
          return `Não encontrei nenhum cadastro com esse termo no sistema. Tente buscar com outro nome ou telefone.`;
        }
        if (lista.length === 1) {
          const c = lista[0];
          return `Encontrei: ${c.nomePrincipal || c.nome} — ${c.detalheSecundario || ""}. Toque no card para ver a ficha completa.`;
        }
        const nomes = lista.slice(0, 4).map((c: any) => c.nomePrincipal || c.nome).join(", ");
        return `Encontrei ${lista.length} resultado(s): ${nomes}. Qual deles você quer consultar?`;
      }
      case "consultar_horarios_disponiveis": {
        const vagas = dados?.horariosSugeridos || dados?.vagas || [];
        return `Temos ${vagas.length} vaga(s) disponível(is) na grade: ${vagas.slice(0, 4).join(", ")}.`;
      }
      case "identificar_clientes_retorno": {
        const lista = Array.isArray(dados) ? dados : dados?.clientes || [];
        return `Identifiquei ${lista.length} cliente(s) ausente(s) com potencial de retorno.`;
      }
      case "consultar_aniversariantes": {
        return `Consultei os aniversariantes do Pet Spa. Os dados estão disponíveis no card.`;
      }
      default:
        return "Prontinho! Operação realizada e dados sincronizados com a grade.";
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
        const lista = Array.isArray(data) ? data : data?.agendamentos || [];
        cards.push({
          type: "agenda",
          title: `Agenda (${lista.length} atendimento(s))`,
          subtitle: toolArgs.data || "Data de hoje",
          data: { itens: lista, total: lista.length },
        });
        break;
      }
      case "buscar_clientes_pets": {
        const candidatos = data?.candidatos || (Array.isArray(data) ? data : []);
        if (candidatos.length > 0) {
          cards.push({
            type: "cliente",
            title: toolArgs.termo ? `Resultados para "${toolArgs.termo}"` : "Clientes Recentes",
            subtitle: "Selecione para abrir a ficha completa",
            data: {
              exigeDesambiguacao: true,
              opcoes: candidatos.slice(0, 6).map((c: any) => ({
                id: c.id,
                tipo: c.tipo || "cliente",
                nome: c.nomePrincipal || c.nome,
                detalhe: c.detalheSecundario || c.telefone || "",
              })),
            },
          });
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
        const vagas = data?.horariosSugeridos || data?.vagas || [];
        cards.push({
          type: "agenda",
          title: `Vagas Disponíveis (${vagas.length})`,
          subtitle: toolArgs.data || "Grade de hoje",
          data,
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
      case "verificar_sentinelas": {
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
