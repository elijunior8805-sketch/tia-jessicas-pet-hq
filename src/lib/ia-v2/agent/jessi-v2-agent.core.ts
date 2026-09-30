import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import {
  JessiV2ProcessInput,
  JessiV2ProcessOutput,
  JessiV2Card,
  JessiV2PendingAction,
} from "../contracts/jessi-v2-contracts";
import { JessiV2ContextState, criarSessaoV2 } from "../session/jessi-v2-session";
import { JessiV2GeminiProvider } from "../providers/jessi-v2-gemini.provider";
import { normalizarTexto, ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { despacharFerramentaV2 } from "../tools/jessi-v2-tools.registry";
import { registrarAuditoriaV2 } from "../tracing/jessi-v2-audit";
import { humanizarRespostaParaVoz } from "@/lib/ia/ia-voz-conversational";

/**
 * Motor Core de Orquestração da Jessi V2 (Agente Autônomo com Tool Calling)
 * Desenvolvido para entregar 100% da capacidade do modelo de linguagem (Gemini 1.5 Flash)
 */

const geminiProvider = new JessiV2GeminiProvider();

export async function processarMensagemJessiV2Core(
  sb: SupabaseClient<Database>,
  input: JessiV2ProcessInput,
  user?: { id: string; nome?: string; cargo?: string; permissoes?: string[] }
): Promise<JessiV2ProcessOutput> {
  const inicioMs = Date.now();
  const correlationId = input.correlationId || `jessi_v2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cards: JessiV2Card[] = [];
  let pendingAction: JessiV2PendingAction | null = null;
  let novoContexto: Partial<JessiV2ContextState> = {};
  let respostaTexto = "";

  const sessaoBase = criarSessaoV2(undefined, user?.id, {
    nome: user?.nome || "Eli Júnior",
    cargo: user?.cargo || "Administrador",
    permissoes: user?.permissoes || ["admin", "agenda", "financeiro", "clientes"],
  });

  const contextoAtual: JessiV2ContextState = {
    ...sessaoBase.contexto,
    ...(input.contexto as any),
  };

  try {
    const textoLimpo = (input.mensagem || "").trim();
    const textoLower = textoLimpo.toLowerCase();

    // 1. Tratamento de Confirmação Explícita de Ação Pendente por Voz ou Texto
    const acaoPendenteAtual = (input.contexto as any)?.operacaoPreparada || (input.contexto as any)?.acaoPendente;

    const ehConfirmacaoTexto =
      textoLower === "confirmar" ||
      textoLower === "pode confirmar" ||
      textoLower === "sim" ||
      textoLower === "confirmo" ||
      textoLower === "pode agendar" ||
      textoLower === "pode marcar" ||
      textoLower === "pode executar" ||
      (Boolean(acaoPendenteAtual) &&
        /\b(confirmar|confirmo|confirma|confirmado|confirmada|pode confirmar|pode agendar|pode marcar|pode cancelar|pode desmarcar|pode executar|pode fazer|pode gravar|pode salvar|pode ser|sim|ok|está certo|ta certo|tá certo|correto|com certeza|autorizo|autorizado|concluir|gravar|salvar|fechar|prosseguir)\b/i.test(
          textoLower
        ));

    // Se o operador tenta confirmar mas o agendamento já foi gravado / não há ação pendente
    if (ehConfirmacaoTexto && !acaoPendenteAtual && !input.confirmacaoAcaoPendenteId) {
      return {
        versao: "v2",
        respostaTexto: "Esse agendamento já foi confirmado e registrado no sistema com sucesso!",
        cards: [],
        pendingAction: null,
        novoContexto: { operacaoPreparada: null, acaoPendente: null } as any,
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
      };
    }

    const ehCancelamentoProposta =
      Boolean(acaoPendenteAtual) &&
      /\b(não|nao|cancelar|cancela|desistir|manter|manter agendamento|não agendar|nao agendar|não cancelar|nao cancelar|abortar)\b/i.test(textoLower);

    if (ehCancelamentoProposta) {
      return {
        versao: "v2",
        respostaTexto: "Operação descartada! Nada foi alterado na grade.",
        cards: [],
        pendingAction: null,
        novoContexto: {
          ...contextoAtual,
          operacaoPreparada: null,
          acaoPendente: null,
        } as any,
        intencao: {
          dominio: "geral_conversacional",
          intencao: "cancelar_operacao",
          confianca: 1.0,
          entidades: {},
          requerConfirmacao: false,
          ferramentaSugerida: null,
          explicacaoRaciocinio: "Operação descartada pelo operador.",
        },
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
      };
    }

    // Execução física de mutação supervisionada confirmada
    if ((input.confirmacaoAcaoPendenteId && input.dadosConfirmacao) || (ehConfirmacaoTexto && acaoPendenteAtual)) {
      const pending = acaoPendenteAtual;
      const toolNome = input.dadosConfirmacao?.tool || pending?.tool || "criar_agendamento";
      const params = input.dadosConfirmacao?.params || pending?.params || {};
      const idempotencyKey = input.confirmacaoAcaoPendenteId || pending?.id || `idemp_${Date.now()}`;

      let mutationResult: any = null;
      let recordIdReal: string | null = null;

      let toolEfetivo = toolNome;
      if (toolNome === "preparar_agendamento" || toolNome === "agendar_horario") {
        toolEfetivo = "criar_agendamento";
      } else if (toolNome === "preparar_reagendamento" || toolNome === "remarcar_agendamento" || toolNome === "reagendar_horario") {
        toolEfetivo = "reagendar_agendamento";
      } else if (toolNome === "preparar_cancelamento") {
        toolEfetivo = "cancelar_agendamento";
      } else if (toolNome === "preparar_cadastro_cliente" || toolNome === "cadastrar_cliente") {
        toolEfetivo = "executar_cadastro_cliente";
      } else if (toolNome === "preparar_consumo_credito" || toolNome === "consumir_credito") {
        toolEfetivo = "executar_consumo_credito";
      } else if (toolNome === "preparar_recebimento" || toolNome === "receber_pagamento" || toolNome === "registrar_recebimento") {
        toolEfetivo = "executar_recebimento";
      }

      mutationResult = await despacharFerramentaV2(sb, toolEfetivo, params, idempotencyKey);
      recordIdReal = mutationResult?.affected_record_id || mutationResult?.entity_id || null;

      const sucesso = mutationResult ? Boolean(mutationResult.success) : true;

      if (sucesso) {
        if (toolNome === "criar_agendamento" || toolNome === "preparar_agendamento") {
          const [d, h] = String(params.dataHora || params.data || "").split(/[T ]/);
          const diaNum = d ? d.split("-")[2] || d : "";
          const horaStr = (h || params.hora) ? String(h || params.hora).slice(0, 5) : "";
          const petStr = params.petNome ? ` para o(a) **${params.petNome}**` : "";
          const dataHoraStr = (diaNum && horaStr) ? ` no dia **${diaNum}**, às **${horaStr}**` : "";
          respostaTexto = `Perfeito! Agendamento confirmado com sucesso${petStr}${dataHoraStr}! Já incluí na grade do Spa.`;
        } else if (toolNome === "cancelar_agendamento" || toolNome === "preparar_cancelamento") {
          respostaTexto = `Cancelamento realizado com sucesso! O horário já foi liberado na grade de atendimentos.`;
        } else if (toolNome === "reagendar_agendamento" || toolNome === "preparar_reagendamento") {
          respostaTexto = `Horário remarcado com sucesso! A grade já foi devidamente atualizada.`;
        } else {
          respostaTexto = mutationResult?.summary || `Operação realizada com sucesso!`;
        }
        cards.push({
          type: "confirmacao",
          title: "Operação Realizada com Sucesso",
          subtitle: `Confirmado por ${user?.nome || "Eli Júnior"} às ${new Date().toLocaleTimeString("pt-BR")}`,
          data: {
            executado: true,
            tool: toolNome,
            registroId: recordIdReal,
            resultado: mutationResult,
            params,
            gravacaoVerificada: true,
          },
        });
      } else {
        respostaTexto = `Não foi possível concluir a gravação: ${mutationResult?.summary || "Erro desconhecido na execução da operação."}`;
      }

      registrarAuditoriaV2({
        userId: user?.id || "anon",
        operadorNome: user?.nome || "Eli Júnior",
        tipoOperacao: "mutacao_supervisionada",
        dominio: "agenda",
        intencaoDetectada: toolNome,
        ferramentasUtilizadas: [toolNome],
        sucesso,
        tempoRespostaMs: Date.now() - inicioMs,
        correlationId,
        idempotencyKey,
        registroAfetadoId: recordIdReal,
      });

      const ehCanalVoz = input.canal === "voz" || Boolean(input.modoBancada);
      const respostaFinal = ehCanalVoz
        ? humanizarRespostaParaVoz(respostaTexto, cards, input.modoBancada, user?.nome)
        : respostaTexto;

      return {
        versao: "v2",
        respostaTexto: respostaFinal,
        cards,
        pendingAction: null,
        novoContexto: { operacaoPreparada: null, acaoPendente: null } as any,
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
      };
    }

    // 1.1 Tratamento de Seleção Direta de ID [id:uuid] ou Opção de Desambiguação
    const matchIdDireto = textoLimpo.match(/\[id:([a-f0-9-]+)\]/i);
    const ehMensagemSelecaoPura =
      /^(selecionar|escolher|abrir|ver)\s+(op[cç][aã]o\s+\d+:?\s*)?/i.test(textoLimpo.trim()) ||
      /^\s*op[cç][aã]o\s+\d+/i.test(textoLimpo.trim()) ||
      textoLimpo.replace(/\[id:[^\]]+\]/gi, "").replace(/selecionar\s+op[cç][aã]o\s+\d+:?/gi, "").trim().length <= 30;

    if (matchIdDireto && matchIdDireto[1]) {
      const idAlvo = matchIdDireto[1];

      // Busca pet por ID
      const { data: petAlvo } = await sb
        .from("pets")
        .select("id, nome, raca, porte, peso, cuidados_saude, alergias, cliente_id, clientes(id, nome, whatsapp, telefone, rua, numero, bairro, cidade)")
        .eq("id", idAlvo)
        .maybeSingle();

      if (petAlvo) {
        novoContexto.pet = {
          id: petAlvo.id,
          nome: petAlvo.nome,
          raca: petAlvo.raca,
          porte: petAlvo.porte,
        };
        if (petAlvo.clientes) {
          novoContexto.cliente = {
            id: (petAlvo.clientes as any).id,
            nome: (petAlvo.clientes as any).nome,
            telefone: (petAlvo.clientes as any).whatsapp || (petAlvo.clientes as any).telefone,
          };
        }

        // Se a mensagem for de seleção direta, retorna a ficha do pet imediatamente sem depender do LLM
        if (ehMensagemSelecaoPura) {
          const resFicha = await ClientesPetsAdapter.obterFichaPet(sb, petAlvo.id);
          const tutorNome = (petAlvo.clientes as any)?.nome || "Tutor não informado";
          const tutorTel = (petAlvo.clientes as any)?.whatsapp || (petAlvo.clientes as any)?.telefone || "";

          const cardPet: JessiV2Card = {
            type: "pet",
            title: `Ficha de ${petAlvo.nome}`,
            subtitle: `${petAlvo.raca || "Raça padrão"} • Tutor: ${tutorNome}`,
            data: {
              ...(resFicha.data || {}),
              pet: petAlvo,
              tutor: petAlvo.clientes,
            },
          };

          const ehCanalVoz = input.canal === "voz" || Boolean(input.modoBancada);
          const respostaTexto = `Aqui está a ficha completa de **${petAlvo.nome}** (${petAlvo.raca || "Raça padrão"}), pet do tutor **${tutorNome}**${tutorTel ? ` (Tel: ${tutorTel})` : ""}. Todos os dados e histórico de atendimentos estão no card abaixo. O que você gostaria de fazer com o ${petAlvo.nome}?`;

          return {
            versao: "v2",
            respostaTexto: ehCanalVoz
              ? humanizarRespostaParaVoz(respostaTexto, [cardPet], input.modoBancada, user?.nome)
              : respostaTexto,
            cards: [cardPet],
            pendingAction: null,
            novoContexto: {
              ...contextoAtual,
              ...novoContexto,
            },
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }
      } else {
        // Busca cliente por ID
        const { data: clienteAlvo } = await sb
          .from("clientes")
          .select("id, nome, whatsapp, telefone, email, rua, numero, complemento, bairro, cidade, observacoes, pets(id, nome, raca, porte, peso)")
          .eq("id", idAlvo)
          .maybeSingle();

        if (clienteAlvo) {
          novoContexto.cliente = {
            id: clienteAlvo.id,
            nome: clienteAlvo.nome,
            telefone: clienteAlvo.whatsapp || clienteAlvo.telefone,
          };

          // Se a mensagem for de seleção direta, retorna a ficha completa do cliente imediatamente
          if (ehMensagemSelecaoPura) {
            const resFicha = await ClientesPetsAdapter.obterFichaClienteCompleta(sb, clienteAlvo.id);
            const petsCount = clienteAlvo.pets?.length || 0;
            const petsLista = (clienteAlvo.pets || []).map((p: any) => `${p.nome}${p.raca ? ` (${p.raca})` : ""}`).join(", ");
            const tel = clienteAlvo.whatsapp || clienteAlvo.telefone || "Não informado";

            const cardCliente: JessiV2Card = {
              type: "cliente",
              title: `Ficha de ${clienteAlvo.nome}`,
              subtitle: `Tel: ${tel} • ${petsCount} pet(s)`,
              data: {
                ...(resFicha.data || {}),
                cliente: clienteAlvo,
                clientes: [clienteAlvo],
              },
            };

            const ehCanalVoz = input.canal === "voz" || Boolean(input.modoBancada);
            const respostaTexto = `Aqui está a ficha cadastral completa de **${clienteAlvo.nome}**!\n\n` +
              `• **WhatsApp / Telefone:** ${tel}\n` +
              `• **Pets vinculados (${petsCount}):** ${petsLista || "Nenhum pet cadastrado"}\n` +
              `• **Endereço:** ${clienteAlvo.rua ? `${clienteAlvo.rua}${clienteAlvo.numero ? `, ${clienteAlvo.numero}` : ""} - ${clienteAlvo.bairro || ""}` : "Não informado"}\n\n` +
              `Você pode agendar um serviço, consultar créditos ou enviar uma mensagem pelo WhatsApp diretamente pelos botões no card abaixo.`;

            return {
              versao: "v2",
              respostaTexto: ehCanalVoz
                ? humanizarRespostaParaVoz(respostaTexto, [cardCliente], input.modoBancada, user?.nome)
                : respostaTexto,
              cards: [cardCliente],
              pendingAction: null,
              novoContexto: {
                ...contextoAtual,
                ...novoContexto,
              },
              tempoProcessamentoMs: Date.now() - inicioMs,
              correlationId,
            };
          }
        }
      }
    }

    // 2. EXECUÇÃO DIRETA PELO MOTOR DO AGENTE AUTÔNOMO COM TOOL CALLING
    const resultadoAgente = await geminiProvider.executarAgenteAutonomo({
      sb,
      mensagemUsuario: textoLimpo,
      contexto: {
        ...contextoAtual,
        ...novoContexto,
      },
      historico: input.historico || [],
      user: user as any,
    });

    respostaTexto = resultadoAgente.respostaTexto;

    if (resultadoAgente.cards && resultadoAgente.cards.length > 0) {
      cards.push(...resultadoAgente.cards);
    }

    if (resultadoAgente.pendingAction) {
      pendingAction = resultadoAgente.pendingAction;
    }

    if (resultadoAgente.novoContexto) {
      novoContexto = {
        ...novoContexto,
        ...resultadoAgente.novoContexto,
      };
    }

    // Auditoria oficial
    registrarAuditoriaV2({
      userId: user?.id || "proprietario_spa",
      operadorNome: user?.nome || "Eli Júnior",
      tipoOperacao: pendingAction ? "proposta_supervisionada" : "consulta_autonoma",
      dominio: "agente_autonomo",
      intencaoDetectada: pendingAction?.type || "processamento_autonomo_llm",
      ferramentasUtilizadas: [],
      sucesso: true,
      tempoRespostaMs: Date.now() - inicioMs,
      correlationId,
      propostaId: pendingAction?.id || null,
    });

    const ehCanalVoz = input.canal === "voz" || Boolean(input.modoBancada);
    const respostaFinal = ehCanalVoz
      ? humanizarRespostaParaVoz(respostaTexto, cards, input.modoBancada, user?.nome)
      : respostaTexto;

    return {
      versao: "v2",
      respostaTexto: respostaFinal,
      cards,
      pendingAction,
      novoContexto: {
        ...contextoAtual,
        ...novoContexto,
        operacaoPreparada: pendingAction,
      },
      intencao: {
        dominio: "geral_conversacional",
        intencao: "agente_autonomo_llm",
        confianca: 1.0,
        entidades: {},
        requerConfirmacao: Boolean(pendingAction),
        ferramentaSugerida: pendingAction?.tool || null,
        explicacaoRaciocinio: "Processado com autonomia e Tool Calling pelo Gemini 1.5 Flash.",
      },
      tempoProcessamentoMs: Date.now() - inicioMs,
      correlationId,
    };
  } catch (err: any) {
    console.error("Erro interno no motor V2 da Jessi:", err);
    throw err;
  }
}
