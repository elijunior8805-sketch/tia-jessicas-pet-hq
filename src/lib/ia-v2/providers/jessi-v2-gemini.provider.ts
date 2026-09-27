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
];

export class JessiV2GeminiProvider implements IJessiV2AIProvider {
  readonly nome = "Gemini-1.5-Flash-Autonomous-Agent";

  /**
   * Obtém a chave de API estritamente do ambiente do servidor ou Vite env
   */
  public obterApiKeyServidor(): { key: string; isGateway: boolean } | null {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.LOVABLE_API_KEY) {
        return { key: process.env.LOVABLE_API_KEY, isGateway: true };
      }
      if (process.env.OPENAI_API_KEY) {
        return { key: process.env.OPENAI_API_KEY, isGateway: true };
      }
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY) {
        return {
          key: (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY)!,
          isGateway: false,
        };
      }
    }

    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      const env = (import.meta as any).env;
      if (env.VITE_LOVABLE_API_KEY || env.LOVABLE_API_KEY) {
        return { key: env.VITE_LOVABLE_API_KEY || env.LOVABLE_API_KEY, isGateway: true };
      }
      if (env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GOOGLE_AI_API_KEY || env.GOOGLE_AI_API_KEY) {
        return {
          key: env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GOOGLE_AI_API_KEY || env.GOOGLE_AI_API_KEY,
          isGateway: false,
        };
      }
      if (env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY) {
        return { key: env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY, isGateway: true };
      }
    }

    return null;
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
      throw new Error("Nenhuma chave de API (LOVABLE_API_KEY / GEMINI_API_KEY) configurada no ambiente do servidor.");
    }

    for (let tentativa = 1; tentativa <= GEMINI_CONFIG.MAX_RETRIES; tentativa++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_CONFIG.TIMEOUT_MS);

      try {
        let resp: Response;

        if (auth.isGateway) {
          const body: any = {
            model: GEMINI_CONFIG.MODEL,
            temperature,
            messages,
          };
          if (jsonFormat) {
            body.response_format = { type: "json_object" };
          }

          resp = await fetch(LOVABLE_GATEWAY, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.key}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } else {
          const promptCombined = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
          const directUrl = `${GEMINI_CONFIG.DIRECT_ENDPOINT_BASE}/gemini-1.5-flash:generateContent?key=${auth.key}`;

          resp = await fetch(directUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: promptCombined }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: 1200,
                responseMimeType: jsonFormat ? "application/json" : "text/plain",
              },
            }),
            signal: controller.signal,
          });
        }

        clearTimeout(timer);

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 120)}`);
        }

        const data: any = await resp.json();
        if (auth.isGateway) {
          const texto = data?.choices?.[0]?.message?.content?.trim();
          if (texto) return texto;
        } else {
          const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (texto) return texto;
        }

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
${contexto.pet?.nome ? `- Pet Selecionado no Contexto: ${contexto.pet.nome} (ID: ${contexto.pet.id || "N/A"})` : ""}
${contexto.cliente?.nome ? `- Cliente/Tutor no Contexto: ${contexto.cliente.nome} (ID: ${contexto.cliente.id || "N/A"})` : ""}

DIRETRIZES DE USO DAS FERRAMENTAS (TOOL CALLING):
1. Sempre que a pergunta envolver dados reais (agenda, horários, clientes, faturamento, histórico, planos), invoque a ferramenta correspondente para obter dados precisos do banco.
2. Se o operador pedir para "consultar um cliente" ou perguntar por clientes sem fornecer um nome, invoque 'buscar_clientes_pets' sem termo para trazer os mais recentes e pergunte gentilmente quem ele deseja consultar.
3. Se o operador quiser agendar, remarcar ou cancelar, use 'preparar_agendamento', 'preparar_reagendamento' ou 'preparar_cancelamento'.
4. NUNCA mencione que você chamou uma 'ferramenta', 'função', 'payload' ou 'banco de dados'. Fale sempre de forma humana e direta.
5. Formate valores monetários em R$ (ex: R$ 80,00).`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Histórico recente (máximo 6 mensagens para manter foco e velocidade)
    const historicoRecente = historico.slice(-6);
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

    if (auth && auth.isGateway) {
      try {
        // PASSADA 1: Envia com Tools disponíveis
        const resPass1 = await fetch(LOVABLE_GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.key}`,
          },
          body: JSON.stringify({
            model: GEMINI_CONFIG.MODEL,
            temperature: 0.4,
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

            for (const tCall of msgAssistant.tool_calls) {
              const toolNome = tCall.function.name;
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

              // Executa a ferramenta de consulta diretamente no Supabase
              const resTool = await despacharFerramentaV2(sb, toolNome, toolArgs);

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
            const resPass2 = await fetch(LOVABLE_GATEWAY, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.key}`,
              },
              body: JSON.stringify({
                model: GEMINI_CONFIG.MODEL,
                temperature: 0.4,
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
        console.warn("[JessiV2 Autonomous Agent] Erro no gateway, acionando síntese resiliente:", errGateway);
      }
    }

    // Fallback conversacional generativo caso a API de tools falhe
    const fallbackGenerativo = await this.gerarResposta({
      promptSistema: systemPrompt,
      mensagemUsuario,
      dadosOperacionais: {
        operador: user?.nome || "Eli",
        dataReferencia: hojeStr,
        contexto,
      },
      historico: historico as any,
    });

    return {
      respostaTexto: fallbackGenerativo.texto,
      cards,
      pendingAction: null,
      novoContexto: {},
    };
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
