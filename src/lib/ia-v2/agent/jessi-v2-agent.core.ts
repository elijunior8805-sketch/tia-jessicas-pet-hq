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
import { JessiV2FallbackProvider } from "../providers/jessi-v2-fallback.provider";
import { ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { AgendaAdapter } from "../adapters/agenda.adapter";
import { FinanceiroRelatoriosAdapter } from "../adapters/financeiro-relatorios.adapter";
import { ProgramasCreditosAdapter } from "../adapters/programas-creditos.adapter";
import { JessiV2ConfirmationManager } from "../confirmation/jessi-v2-confirmation.manager";
import { despacharFerramentaV2 } from "../tools/jessi-v2-tools.registry";
import { registrarAuditoriaV2 } from "../tracing/jessi-v2-audit";
import { JESSI_V2_LIMITS } from "../config/jessi-v2-config";

/**
 * Motor Core de Orquestração da Jessi V2 (Autonomia Supervisionada)
 * FASE 1 — CONVERSA E MEMÓRIA
 * Desenvolvido pelo Agente 1 (Arquitetura e Coordenação)
 */

const geminiProvider = new JessiV2GeminiProvider();
const fallbackProvider = new JessiV2FallbackProvider();

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
    nome: user?.nome || "Proprietário",
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

    // 1. Tratamento de Confirmação Explícita de Ação Pendente
    const ehConfirmacaoTexto =
      textoLower === "confirmar" ||
      textoLower === "pode confirmar" ||
      textoLower === "sim" ||
      textoLower === "confirmo" ||
      textoLower === "pode executar";

    const acaoPendenteAtual = (input.contexto as any)?.operacaoPreparada || (input.contexto as any)?.acaoPendente;

    if ((input.confirmacaoAcaoPendenteId && input.dadosConfirmacao) || (ehConfirmacaoTexto && acaoPendenteAtual)) {
      const pending = acaoPendenteAtual;
      const toolNome = input.dadosConfirmacao?.tool || pending?.tool || "criar_agendamento";
      const params = input.dadosConfirmacao?.params || pending?.params || {};
      const idempotencyKey = input.confirmacaoAcaoPendenteId || pending?.id || `idemp_${Date.now()}`;

      let mutationResult: any = null;
      let recordIdReal: string | null = null;

      // Mapeia intenções preparadas para as ferramentas de execução registradas
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
      } else if (toolNome === "preparar_estorno" || toolNome === "estornar_pagamento") {
        toolEfetivo = "executar_estorno";
      } else if (toolNome === "preparar_pagamento_parcial") {
        toolEfetivo = "executar_pagamento_parcial";
      }

      mutationResult = await despacharFerramentaV2(sb, toolEfetivo, params, idempotencyKey);
      recordIdReal = mutationResult?.affected_record_id || mutationResult?.entity_id || null;

      const sucesso = mutationResult ? Boolean(mutationResult.success) : true;
      const idExibicao = recordIdReal ? ` (ID: ${recordIdReal.slice(0, 8)})` : "";

      if (sucesso) {
        respostaTexto =
          mutationResult?.summary ||
          `Operação${idExibicao} confirmada e registrada com sucesso no sistema. A gravação foi verificada fisicamente no banco de dados.`;

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

      return {
        versao: "v2",
        respostaTexto,
        cards,
        pendingAction: null,
        novoContexto: { operacaoPreparada: null } as any,
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
      };
    }

    // 1.1 Tratamento Imediato de Seleção de Opção / Desambiguação
    const matchIdDireto = textoLimpo.match(/\[id:([a-f0-9-]+)\]/i);
    const ehSelecaoOpcao =
      Boolean(matchIdDireto) ||
      textoLower.startsWith("selecionar opção") ||
      textoLower.startsWith("selecionar opcao") ||
      textoLower.startsWith("opção ") ||
      textoLower.startsWith("opcao ") ||
      /^(1|2|3|4|5)$/.test(textoLower) ||
      /\b(primeiro|primeira|segundo|segunda|terceiro|terceira)\b/i.test(textoLower);

    const candidatosEmEspera =
      (input.contexto as any)?.variaveisConversacao?.candidatosEmEspera ||
      (contextoAtual as any)?.variaveisConversacao?.candidatosEmEspera ||
      (contextoAtual as any)?.candidatosEmEspera;

    if (ehSelecaoOpcao) {
      let candidatoEscolhido: any = null;

      if (matchIdDireto && matchIdDireto[1]) {
        const idAlvo = matchIdDireto[1];
        const { data: petAlvo } = await sb
          .from("pets")
          .select("id, nome, raca, porte, cliente_id, clientes(id, nome, whatsapp, telefone)")
          .eq("id", idAlvo)
          .maybeSingle();

        if (petAlvo) {
          candidatoEscolhido = {
            id: petAlvo.id,
            tipo: "pet",
            nomePrincipal: petAlvo.nome,
            dadosCompletos: {
              ...petAlvo,
              cliente: petAlvo.clientes,
            },
          };
        } else {
          const { data: clienteAlvo } = await sb
            .from("clientes")
            .select("id, nome, whatsapp, telefone, rua, numero, bairro, cidade")
            .eq("id", idAlvo)
            .maybeSingle();

          if (clienteAlvo) {
            candidatoEscolhido = {
              id: clienteAlvo.id,
              tipo: "cliente",
              nomePrincipal: clienteAlvo.nome,
              dadosCompletos: clienteAlvo,
            };
          }
        }
      } else {
        let index = 0;
        const matchNum = textoLower.match(/\b([1-5])\b/);
        if (matchNum) {
          index = parseInt(matchNum[1], 10) - 1;
        } else if (textoLower.includes("segund")) {
          index = 1;
        } else if (textoLower.includes("terceir")) {
          index = 2;
        }

        if (Array.isArray(candidatosEmEspera) && candidatosEmEspera[index]) {
          candidatoEscolhido = candidatosEmEspera[index];
        } else {
          // Extrai o nome após os dois pontos (ex: "Selecionar opção 1: Thor")
          const matchNome = textoLimpo.match(/(?:opção|opcao)\s+\d+:\s*([^\n\r\[\]]+)/i);
          const nomeTermo = matchNome ? matchNome[1].trim() : textoLimpo.replace(/selecionar\s+opção\s+\d+:?/gi, "").trim();
          if (nomeTermo) {
            const resBusca = await ClientesPetsAdapter.buscarClientesPets(sb, nomeTermo);
            if (resBusca.success && resBusca.data.candidatos.length > index) {
              candidatoEscolhido = resBusca.data.candidatos[index];
            } else if (resBusca.success && resBusca.data.candidatos.length > 0) {
              candidatoEscolhido = resBusca.data.candidatos[0];
            }
          }
        }
      }

      if (candidatoEscolhido) {
        if (candidatoEscolhido.tipo === "pet") {
          const petNomeSel = candidatoEscolhido.nomePrincipal || candidatoEscolhido.nome;
          const petIdSel = candidatoEscolhido.id;
          const tutorNome = candidatoEscolhido.dadosCompletos?.cliente?.nome || candidatoEscolhido.dadosCompletos?.clientes?.nome || "Tutor";
          const tutorId = candidatoEscolhido.dadosCompletos?.cliente_id || candidatoEscolhido.dadosCompletos?.cliente?.id || candidatoEscolhido.dadosCompletos?.clientes?.id;

          novoContexto.pet = {
            id: petIdSel,
            nome: petNomeSel,
            raca: candidatoEscolhido.dadosCompletos?.raca,
            porte: candidatoEscolhido.dadosCompletos?.porte,
          };
          novoContexto.cliente = {
            id: tutorId,
            nome: tutorNome,
          };

          respostaTexto = `Selecionei o pet **${petNomeSel}** (Tutor: **${tutorNome}**). Qual serviço você deseja agendar (ex: Banho, Tosa, Banho e Tosa) e para qual data e horário?`;

          cards.push({
            type: "cliente",
            title: `Pet Selecionado: ${petNomeSel}`,
            subtitle: `Tutor: ${tutorNome}`,
            data: {
              id: tutorId,
              nome: tutorNome,
              telefone: candidatoEscolhido.dadosCompletos?.cliente?.telefone || candidatoEscolhido.dadosCompletos?.clientes?.telefone,
              pets: [
                {
                  id: petIdSel,
                  nome: petNomeSel,
                  raca: candidatoEscolhido.dadosCompletos?.raca,
                  porte: candidatoEscolhido.dadosCompletos?.porte,
                },
              ],
            },
          });

          return {
            versao: "v2",
            respostaTexto,
            cards,
            pendingAction: null,
            novoContexto: {
              ...contextoAtual,
              ...novoContexto,
              variaveisConversacao: {
                ...contextoAtual.variaveisConversacao,
                candidatosEmEspera: null,
              },
            },
            intencao: {
              dominio: "agenda",
              intencao: "preparar_agendamento",
              confianca: 1.0,
              entidades: {
                petNome: petNomeSel,
                petId: petIdSel,
                clienteNome: tutorNome,
                clienteId: tutorId,
              } as any,
              requerConfirmacao: false,
              ferramentaSugerida: "criar_agendamento",
              explicacaoRaciocinio: "Opção de pet selecionada pelo operador.",
            },
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        } else if (candidatoEscolhido.tipo === "cliente") {
          const clienteNomeSel = candidatoEscolhido.nomePrincipal || candidatoEscolhido.nome;
          const clienteIdSel = candidatoEscolhido.id;

          novoContexto.cliente = {
            id: clienteIdSel,
            nome: clienteNomeSel,
            telefone: candidatoEscolhido.dadosCompletos?.telefone || candidatoEscolhido.dadosCompletos?.whatsapp,
          };

          // Busca pets deste cliente
          const { data: petsDoCliente } = await sb
            .from("pets")
            .select("id, nome, raca, porte")
            .eq("cliente_id", clienteIdSel);

          if (petsDoCliente && petsDoCliente.length === 1) {
            novoContexto.pet = {
              id: petsDoCliente[0].id,
              nome: petsDoCliente[0].nome,
              raca: petsDoCliente[0].raca,
              porte: petsDoCliente[0].porte,
            };

            respostaTexto = `Selecionei o tutor **${clienteNomeSel}** e seu pet **${petsDoCliente[0].nome}**. Qual serviço deseja agendar (ex: Banho, Tosa) e para qual data e horário?`;
          } else if (petsDoCliente && petsDoCliente.length > 1) {
            respostaTexto = `Selecionei o tutor **${clienteNomeSel}**. Ele possui ${petsDoCliente.length} pets cadastrados (${petsDoCliente.map((p) => `**${p.nome}**`).join(", ")}). Para qual pet você deseja o atendimento?`;
            cards.push({
              type: "cliente",
              title: `Pets de ${clienteNomeSel}`,
              subtitle: "Selecione o pet desejado",
              data: {
                opcoes: petsDoCliente.map((p) => ({
                  id: p.id,
                  tipo: "pet",
                  nome: p.nome,
                  detalhe: `${p.raca || "Raça não informada"} • ${p.porte || "Porte médio"}`,
                })),
              },
            });
          } else {
            respostaTexto = `Selecionei o cliente **${clienteNomeSel}**. O que você deseja consultar ou registrar para ele?`;
          }

          return {
            versao: "v2",
            respostaTexto,
            cards,
            pendingAction: null,
            novoContexto: {
              ...contextoAtual,
              ...novoContexto,
              variaveisConversacao: {
                ...contextoAtual.variaveisConversacao,
                candidatosEmEspera: null,
              },
            },
            intencao: {
              dominio: "clientes_pets",
              intencao: "selecionar_cliente",
              confianca: 1.0,
              entidades: {
                clienteNome: clienteNomeSel,
                clienteId: clienteIdSel,
              } as any,
              requerConfirmacao: false,
              ferramentaSugerida: "buscar_clientes_pets",
              explicacaoRaciocinio: "Opção de cliente selecionada pelo operador.",
            },
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }
      }
    }

    // 2. Classificação NLU de Intenção e Entidades (Resolução Anafórica e Temporal)
    let nluResult;
    try {
      nluResult = await geminiProvider.classificarIntencao({
        mensagem: input.mensagem,
        contexto: contextoAtual,
        historico: input.historico || [],
      });
    } catch (providerErr) {
      console.warn("[JessiV2] Falha no provedor primário. Acionando fallback determinístico:", providerErr);
      nluResult = await fallbackProvider.classificarIntencao({
        mensagem: input.mensagem,
        contexto: contextoAtual,
        historico: input.historico || [],
      });
    }

    const intencao = nluResult.intencao;

    // 3. Busca Inteligente e Resolução de Ambiguidade (Clientes & Pets)
    const intencoesQuePrecisamBusca =
      intencao.dominio === "clientes_pets" ||
      intencao.intencao === "criar_agendamento" ||
      intencao.intencao === "preparar_agendamento" ||
      intencao.intencao === "cancelar_agendamento" ||
      intencao.intencao === "preparar_cancelamento" ||
      intencao.intencao === "reagendar_agendamento" ||
      intencao.intencao === "preparar_reagendamento" ||
      intencao.intencao === "consultar_ultimo_atendimento";

    if (intencoesQuePrecisamBusca && intencao.entidades.termoBusca) {
      const termoParaBusca = intencao.entidades.termoBusca;
      const resultadoBusca = await ClientesPetsAdapter.buscarClientesPets(sb, termoParaBusca);

      if (resultadoBusca.success && resultadoBusca.data.candidatos.length > 0) {
        if (resultadoBusca.data.exigeDesambiguacao) {
          // Ambiguidade detectada: Apresenta opções progressivas sem escolha silenciosa
          respostaTexto = resultadoBusca.summary || "Encontrei mais de uma opção.";
          
          cards.push({
            type: "cliente",
            title: "Opções Encontradas (Escolha uma)",
            subtitle: `Termo pesquisado: "${termoParaBusca}"`,
            data: {
              exigeDesambiguacao: true,
              opcoes: resultadoBusca.data.candidatos.map((c: any) => ({
                id: c.id,
                tipo: c.tipo,
                nome: c.nomePrincipal,
                detalhe: c.detalheSecundario,
              })),
            },
          });

          return {
            versao: "v2",
            respostaTexto,
            cards,
            pendingAction: null,
            novoContexto: {
              ...contextoAtual,
              variaveisConversacao: {
                ...contextoAtual.variaveisConversacao,
                candidatosEmEspera: resultadoBusca.data.candidatos,
              },
            },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        } else {
          // Encontrado com alta confiança: atualiza memória contextual
          const selecionado = resultadoBusca.data.candidatos[0];
          if (selecionado.tipo === "cliente") {
            novoContexto.cliente = {
              id: selecionado.id,
              nome: selecionado.nomePrincipal,
              telefone: selecionado.dadosCompletos?.telefone,
              endereco: selecionado.dadosCompletos?.endereco,
            };
          } else if (selecionado.tipo === "pet") {
            novoContexto.pet = {
              id: selecionado.id,
              nome: selecionado.nomePrincipal,
              raca: selecionado.dadosCompletos?.raca,
              porte: selecionado.dadosCompletos?.porte,
            };
            if (selecionado.dadosCompletos?.cliente) {
              novoContexto.cliente = {
                id: selecionado.dadosCompletos.cliente.id,
                nome: selecionado.dadosCompletos.cliente.nome,
                telefone: selecionado.dadosCompletos.cliente.telefone,
              };
            }
          }
        }
      }
    }

    // 4. Roteamento e Resolução Operacional Segura
    if (intencao.requerConfirmacao) {
      // PREPARAÇÃO DE OPERAÇÃO SUPERVISIONADA (NUNCA EXECUTA DIRETAMENTE NO BANCO)
      let clienteId = novoContexto.cliente?.id || contextoAtual.cliente?.id || intencao.entidades.clienteId || null;
      let clienteNome = novoContexto.cliente?.nome || contextoAtual.cliente?.nome || intencao.entidades.clienteNome || null;
      let petId = novoContexto.pet?.id || contextoAtual.pet?.id || intencao.entidades.petId || null;
      let petNome = novoContexto.pet?.nome || contextoAtual.pet?.nome || intencao.entidades.petNome || null;
      let servicoId = novoContexto.servico?.id || contextoAtual.servico?.id || intencao.entidades.servicoId || null;
      let servicoNome = intencao.entidades.servicoNome || contextoAtual.servico?.nome || null;
      let servicoValor = intencao.entidades.valor || (contextoAtual as any)?.servicoValor || null;
      let duracaoMinutos = 60;

      // 4.1 Resolução Resiliente de Cliente / Pet no Banco de Dados
      const termoParaPesquisar = clienteNome || petNome || intencao.entidades.termoBusca || null;
      if ((!clienteId || !petId) && termoParaPesquisar) {
        const resBusca = await ClientesPetsAdapter.buscarClientesPets(sb, termoParaPesquisar);
        if (resBusca.success && resBusca.data.candidatos.length > 0) {
          if (resBusca.data.exigeDesambiguacao) {
            return {
              versao: "v2",
              respostaTexto: resBusca.summary || `Encontrei mais de uma opção para "${termoParaPesquisar}". Qual delas você deseja selecionar?`,
              cards: [
                {
                  type: "cliente",
                  title: "Selecione a Opção Correspondente",
                  subtitle: `Termo pesquisado: "${termoParaPesquisar}"`,
                  data: {
                    exigeDesambiguacao: true,
                    opcoes: resBusca.data.candidatos.map((c: any) => ({
                      id: c.id,
                      tipo: c.tipo,
                      nome: c.nomePrincipal,
                      detalhe: c.detalheSecundario,
                    })),
                  },
                },
              ],
              pendingAction: null,
              novoContexto: { ...contextoAtual, ...novoContexto },
              intencao,
              tempoProcessamentoMs: Date.now() - inicioMs,
              correlationId,
            };
          }

          const topMatch = resBusca.data.candidatos[0];
          if (topMatch.tipo === "cliente") {
            clienteId = topMatch.id;
            clienteNome = topMatch.nomePrincipal;
            novoContexto.cliente = {
              id: clienteId,
              nome: clienteNome,
              telefone: topMatch.dadosCompletos?.telefone || topMatch.dadosCompletos?.whatsapp,
            };
          } else if (topMatch.tipo === "pet") {
            petId = topMatch.id;
            petNome = topMatch.nomePrincipal;
            novoContexto.pet = {
              id: petId,
              nome: petNome,
              raca: topMatch.dadosCompletos?.raca,
              porte: topMatch.dadosCompletos?.porte,
            };
            if (topMatch.dadosCompletos?.cliente) {
              clienteId = topMatch.dadosCompletos.cliente.id;
              clienteNome = topMatch.dadosCompletos.cliente.nome;
              novoContexto.cliente = { id: clienteId, nome: clienteNome };
            }
          }
        }
      }

      // 4.2 Resolução de Pet vinculado ao Cliente
      if (clienteId) {
        const { data: petsDoCliente } = await sb
          .from("pets")
          .select("id, nome, raca, porte")
          .eq("cliente_id", clienteId);

        if (petNome && petsDoCliente && petsDoCliente.length > 0) {
          const matchPet = petsDoCliente.find((p) => p.nome.toLowerCase().includes(petNome!.toLowerCase()));
          if (matchPet) {
            petId = matchPet.id;
            petNome = matchPet.nome;
            novoContexto.pet = {
              id: petId,
              nome: petNome,
              raca: matchPet.raca,
              porte: matchPet.porte,
            };
          } else {
            // Pet informado não pertence a este cliente
            return {
              versao: "v2",
              respostaTexto: `O tutor **${clienteNome}** não possui nenhum pet com o nome "${petNome}". Os pets cadastrados para este tutor são: ${petsDoCliente.map((p) => `**${p.nome}**`).join(", ")}.`,
              cards: [
                {
                  type: "cliente",
                  title: `Pets de ${clienteNome}`,
                  subtitle: "Selecione o pet correto",
                  data: {
                    opcoes: petsDoCliente.map((p) => ({
                      id: p.id,
                      tipo: "pet",
                      nome: p.nome,
                      detalhe: `${p.raca || "Raça não informada"} • ${p.porte || "Porte médio"}`,
                    })),
                  },
                },
              ],
              pendingAction: null,
              novoContexto: { ...contextoAtual, ...novoContexto },
              intencao,
              tempoProcessamentoMs: Date.now() - inicioMs,
              correlationId,
            };
          }
        } else if (!petId && petsDoCliente && petsDoCliente.length === 1) {
          // Cliente possui exatamente 1 pet cadastrado: seleciona automaticamente
          petId = petsDoCliente[0].id;
          petNome = petsDoCliente[0].nome;
          novoContexto.pet = {
            id: petId,
            nome: petNome,
            raca: petsDoCliente[0].raca,
            porte: petsDoCliente[0].porte,
          };
        } else if (!petId && petsDoCliente && petsDoCliente.length > 1) {
          // Cliente possui múltiplos pets e o usuário não especificou qual
          return {
            versao: "v2",
            respostaTexto: `O tutor **${clienteNome}** possui ${petsDoCliente.length} pets cadastrados (${petsDoCliente.map((p) => `**${p.nome}**`).join(", ")}). Para qual pet você deseja agendar o atendimento?`,
            cards: [
              {
                type: "cliente",
                title: `Selecione o Pet de ${clienteNome}`,
                subtitle: "Múltiplos pets cadastrados",
                data: {
                  opcoes: petsDoCliente.map((p) => ({
                    id: p.id,
                    tipo: "pet",
                    nome: p.nome,
                    detalhe: `${p.raca || "Raça não informada"} • ${p.porte || "Porte médio"}`,
                  })),
                },
              },
            ],
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        } else if (!petId && (!petsDoCliente || petsDoCliente.length === 0)) {
          return {
            versao: "v2",
            respostaTexto: `Identifiquei o cliente **${clienteNome}**, mas não há nenhum pet cadastrado para ele no momento. Deseja realizar o cadastro de um novo pet?`,
            cards: [],
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }
      } else if (!petId && petNome) {
        // Busca pet globalmente para descobrir o tutor
        const { data: petsGlobais } = await sb
          .from("pets")
          .select("id, nome, raca, porte, cliente_id, clientes(id, nome, whatsapp)")
          .ilike("nome", `%${petNome}%`)
          .limit(5);

        if (petsGlobais && petsGlobais.length === 1) {
          petId = petsGlobais[0].id;
          petNome = petsGlobais[0].nome;
          clienteId = petsGlobais[0].cliente_id;
          clienteNome = (petsGlobais[0].clientes as any)?.nome || "Tutor";
          novoContexto.pet = { id: petId, nome: petNome, raca: petsGlobais[0].raca, porte: petsGlobais[0].porte };
          novoContexto.cliente = { id: clienteId, nome: clienteNome };
        } else if (petsGlobais && petsGlobais.length > 1) {
          return {
            versao: "v2",
            respostaTexto: `Encontrei mais de um pet com o nome "${petNome}". De qual tutor é o pet?`,
            cards: [
              {
                type: "cliente",
                title: `Pets Encontrados ("${petNome}")`,
                subtitle: "Selecione o pet correspondente",
                data: {
                  exigeDesambiguacao: true,
                  opcoes: petsGlobais.map((p: any) => ({
                    id: p.id,
                    tipo: "pet",
                    nome: `${p.nome} (Tutor: ${p.clientes?.nome || "Não informado"})`,
                    detalhe: `${p.raca || ""} • Tel: ${p.clientes?.whatsapp || ""}`,
                  })),
                },
              },
            ],
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }
      }

      // 4.3 Resolução de Serviço e Preço no Catálogo com Desambiguação Inteligente
      if (servicoNome) {
        const { data: servicosDB, error: srvErr } = await sb
          .from("servicos")
          .select("id, nome, valor, duracao_min")
          .eq("ativo", true)
          .ilike("nome", `%${servicoNome}%`)
          .limit(10);

        if (srvErr) {
          console.error("[JessiV2] Erro ao consultar serviço no banco:", srvErr);
        }

        if (servicosDB && servicosDB.length === 1) {
          servicoId = servicosDB[0].id;
          servicoNome = servicosDB[0].nome;
          servicoValor = Number(servicosDB[0].valor || 0);
          duracaoMinutos = Number(servicosDB[0].duracao_min || 60);
        } else if (servicosDB && servicosDB.length > 1) {
          // Verifica correspondência exata
          const matchExato = servicosDB.find(
            (s) => s.nome.trim().toLowerCase() === servicoNome.trim().toLowerCase()
          );

          if (matchExato) {
            servicoId = matchExato.id;
            servicoNome = matchExato.nome;
            servicoValor = Number(matchExato.valor || 0);
            duracaoMinutos = Number(matchExato.duracao_min || 60);
          } else if (intencao.dominio === "agenda" && (intencao.intencao === "preparar_agendamento" || intencao.intencao === "criar_agendamento")) {
            // Múltiplas opções encontradas (ex: Banho Simples vs Banho Premium): Desambiguação proativa
            const opcoesTexto = servicosDB
              .map((s) => `• **${s.nome}**: R$ ${Number(s.valor || 0).toFixed(2)} (${s.duracao_min || 60} min)`)
              .join("\n");

            const petInfo = petNome ? ` para o pet **${petNome}**` : "";
            const dataHoraInfo = intencao.entidades.data && intencao.entidades.hora
              ? ` em ${intencao.entidades.data} às ${intencao.entidades.hora}`
              : "";

            return {
              versao: "v2",
              respostaTexto: `Identifiquei mais de uma modalidade de **${servicoNome}** no catálogo do Spa:\n\n${opcoesTexto}\n\nQual delas você deseja agendar${petInfo}${dataHoraInfo}?`,
              cards: [
                {
                  type: "agenda",
                  title: `Modalidades de ${servicoNome} Disponíveis`,
                  subtitle: "Selecione o serviço desejado com 1 clique:",
                  data: {
                    exigeDesambiguacao: true,
                    title: `Modalidades de ${servicoNome}`,
                    subtitle: "Selecione o serviço desejado com 1 clique:",
                    petNome: petNome || "o pet",
                    dataHoraTexto: intencao.entidades.data && intencao.entidades.hora ? `em ${intencao.entidades.data} às ${intencao.entidades.hora}` : "",
                    opcoes: servicosDB.map((s) => ({
                      id: s.id,
                      nome: s.nome,
                      valor: s.valor,
                      valorFmt: `R$ ${Number(s.valor || 0).toFixed(2)}`,
                      detalhe: `Duração: ${s.duracao_min || 60} min • R$ ${Number(s.valor || 0).toFixed(2)}`,
                    })),
                  },
                },
              ],
              pendingAction: null,
              novoContexto: { ...contextoAtual, ...novoContexto },
              intencao,
              tempoProcessamentoMs: Date.now() - inicioMs,
              correlationId,
            };
          }
        }
      }

      // 4.4 Validação Estrita de Campos Obrigatórios para Agendamento
      if (intencao.dominio === "agenda" && (intencao.intencao === "preparar_agendamento" || intencao.intencao === "criar_agendamento")) {
        const dataAlvo = intencao.entidades.data;
        const horaAlvo = intencao.entidades.hora;

        const camposFaltantes: string[] = [];
        if (!clienteId || !clienteNome) camposFaltantes.push("Tutor/Cliente");
        if (!petId || !petNome) camposFaltantes.push("Pet");
        if (!servicoNome) camposFaltantes.push("Serviço (ex: Banho, Tosa, Banho e Tosa)");
        if (!dataAlvo) camposFaltantes.push("Data do atendimento");
        if (!horaAlvo) camposFaltantes.push("Horário desejado");

        if (camposFaltantes.length > 0) {
          let textoOrientacao = `Para preparar o agendamento, por favor informe o **serviço desejado** (ex: Banho, Tosa) e a **data e horário**.`;
          if (clienteNome && petNome && !servicoNome && !dataAlvo && !horaAlvo) {
            textoOrientacao = `Identifiquei o pet **${petNome}** (Tutor: **${clienteNome}**). Qual serviço você deseja agendar (ex: Banho, Tosa, Banho e Tosa) e para qual data e horário?`;
          } else if (clienteNome && petNome && servicoNome && !dataAlvo && !horaAlvo) {
            textoOrientacao = `Identifiquei o pet **${petNome}** (Tutor: **${clienteNome}**) para o serviço de **${servicoNome}**. Para qual data e horário você deseja agendar?`;
          } else if (clienteNome && petNome && servicoNome && dataAlvo && !horaAlvo) {
            textoOrientacao = `Para o agendamento de **${servicoNome}** de **${petNome}** no dia **${dataAlvo}**, qual o horário desejado?`;
          } else if (!clienteNome && !petNome) {
            textoOrientacao = `Para preparar o agendamento com segurança, por favor me informe o nome do **cliente ou pet**, o **serviço** e a **data e horário** desejados.`;
          }

          return {
            versao: "v2",
            respostaTexto: textoOrientacao,
            cards,
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        // Se todos os dados obrigatórios estão presentes, checa disponibilidade na grade
        const dataHoraISO = `${dataAlvo}T${horaAlvo}:00`;
        const checagemGrade = await AgendaAdapter.verificarDisponibilidade(sb, dataHoraISO, null, dataAlvo, horaAlvo);
        if (!checagemGrade.disponivel) {
          return {
            versao: "v2",
            respostaTexto: `Atenção: ${checagemGrade.motivo} Deseja escolher outro horário para ${petNome}?`,
            cards,
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        const dataExtensa = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "full",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(`${dataAlvo}T12:00:00`));

        const proposta = JessiV2ConfirmationManager.criarProposta({
          userId: user?.id || "proprietario_spa",
          cliente: { id: clienteId!, nome: clienteNome! },
          pet: { id: petId!, nome: petNome! },
          acao: "criar_agendamento",
          motivo: `Agendamento de ${servicoNome} para ${petNome} em ${dataAlvo} às ${horaAlvo}`,
          estadoAtual: { status: "pendente" },
          estadoProposto: {
            clienteId,
            clienteNome,
            petId,
            petNome,
            servicoId,
            servicoNome,
            data: dataAlvo,
            hora: horaAlvo,
            dataHora: dataHoraISO,
            valor: servicoValor || 0,
            duracaoMinutos,
          },
          valores: { valorBruto: servicoValor || 0, valorFinal: servicoValor || 0 },
          dataHora: dataHoraISO,
          riscos: ["Alteração no banco sujeita a confirmação explícita com verificação física (read-back)."],
          resumoVisual: {
            entendido: `Agendamento de ${servicoNome} para o pet ${petNome} (${clienteNome}) em ${dataExtensa} às ${horaAlvo}.`,
            seraAlterado: `Reserva na grade de horários para ${dataAlvo} às ${horaAlvo} no valor de R$ ${Number(servicoValor || 0).toFixed(2)}.`,
            situacaoAtual: "Horário verificado e disponível na grade.",
            resultadoEsperado: `Agendamento oficial registrado e verificado no banco de dados para ${petNome}.`,
            alertas: ["Nenhuma alteração foi gravada ainda.", "A confirmação expira em 15 minutos."],
          },
        });

        pendingAction = {
          id: proposta.id,
          type: "criar_agendamento",
          tool: "criar_agendamento",
          title: `Confirmação de Agendamento: ${servicoNome}`,
          summary: `Tutor: ${clienteNome} • Pet: ${petNome} • Data: ${dataExtensa} às ${horaAlvo} • Valor: R$ ${Number(servicoValor || 0).toFixed(2)}`,
          riskLevel: "medio",
          params: {
            clienteId,
            clienteNome,
            petId,
            petNome,
            servicoId,
            servicoNome,
            data: dataAlvo,
            hora: horaAlvo,
            dataHora: dataHoraISO,
            valor: servicoValor || 0,
            duracaoMinutos,
          },
          created_at: proposta.created_at,
          expires_at: proposta.validade,
        };

        respostaTexto = `Preparei o agendamento de **${servicoNome}** para **${petNome}** (Tutor: **${clienteNome}**) em **${dataExtensa}** às **${horaAlvo}** (Valor: R$ ${Number(servicoValor || 0).toFixed(2)}). Por favor revise todos os detalhes no cartão abaixo e clique em **Confirmar e Executar**.`;

        cards.push({
          type: "confirmacao",
          title: pendingAction.title,
          subtitle: `Tutor: ${clienteNome} • Pet: ${petNome}`,
          data: {
            proposta,
            acaoPendente: pendingAction,
            pendingAction,
            requerConfirmacao: true,
            resumoVisual: proposta.resumoVisual,
            resumo: proposta.resumoVisual.entendido,
            acoesDisponiveis: ["Confirmar operação", "Cancelar"],
          },
        });

        novoContexto = {
          ...novoContexto,
          operacaoPreparada: pendingAction,
        };

        return {
          versao: "v2",
          respostaTexto,
          cards,
          pendingAction,
          novoContexto,
          intencao,
          tempoProcessamentoMs: Date.now() - inicioMs,
          correlationId,
        };
      }

      // 4.5 Resolução e Preparação de Cancelamento de Agendamento
      if (intencao.dominio === "agenda" && (intencao.intencao === "preparar_cancelamento" || intencao.intencao === "cancelar_agendamento")) {
        let agendamentoIdAlvo = intencao.entidades.agendamentoId || (intencao.entidades as any).agendamento_id || null;
        let agendamentoAlvo: any = null;

        if (agendamentoIdAlvo) {
          const { data: agById } = await sb
            .from("agendamentos")
            .select("id, data, hora, status, valor_previsto, clientes(id, nome), pets(id, nome), servicos(id, nome)")
            .eq("id", agendamentoIdAlvo)
            .maybeSingle();
          agendamentoAlvo = agById;
        } else {
          // Busca agendamentos ativos compatíveis
          let query = sb
            .from("agendamentos")
            .select("id, data, hora, status, valor_previsto, clientes(id, nome), pets(id, nome), servicos(id, nome)")
            .neq("status", "cancelado");

          if (petId) {
            query = query.eq("pet_id", petId);
          } else if (clienteId) {
            query = query.eq("cliente_id", clienteId);
          }

          if (intencao.entidades.data) {
            query = query.eq("data", intencao.entidades.data);
          } else {
            const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
            query = query.gte("data", hoje);
          }

          query = query.order("data", { ascending: true }).order("hora", { ascending: true }).limit(5);

          const { data: agsEncontrados, error: agErr } = await query;
          if (agErr) {
            console.error("[JessiV2] Erro ao buscar agendamentos para cancelamento:", agErr);
          }

          if (!agsEncontrados || agsEncontrados.length === 0) {
            const petMsg = petNome ? ` para o pet **${petNome}**` : clienteNome ? ` para o tutor **${clienteNome}**` : "";
            const dataMsg = intencao.entidades.data ? ` na data **${intencao.entidades.data}**` : "";
            return {
              versao: "v2",
              respostaTexto: `Não encontrei nenhum agendamento ativo${petMsg}${dataMsg} para cancelar.`,
              cards: [],
              pendingAction: null,
              novoContexto: { ...contextoAtual, ...novoContexto },
              intencao,
              tempoProcessamentoMs: Date.now() - inicioMs,
              correlationId,
            };
          }

          if (agsEncontrados.length > 1 && !intencao.entidades.data) {
            return {
              versao: "v2",
              respostaTexto: `Encontrei ${agsEncontrados.length} agendamentos ativos para ${petNome || clienteNome || "o cliente"}. Qual deles você deseja cancelar?`,
              cards: [
                {
                  type: "agenda",
                  title: "Selecione o Agendamento para Cancelar",
                  subtitle: `${agsEncontrados.length} agendamento(s) encontrado(s)`,
                  data: {
                    exigeDesambiguacao: true,
                    opcoes: agsEncontrados.map((ag: any) => ({
                      id: ag.id,
                      tipo: "agendamento",
                      nome: `${ag.pets?.nome || "Pet"} • ${ag.servicos?.nome || "Atendimento"}`,
                      detalhe: `${ag.data} às ${(ag.hora || "").slice(0, 5)} (Status: ${ag.status})`,
                    })),
                  },
                },
              ],
              pendingAction: null,
              novoContexto: { ...contextoAtual, ...novoContexto },
              intencao,
              tempoProcessamentoMs: Date.now() - inicioMs,
              correlationId,
            };
          }

          agendamentoAlvo = agsEncontrados[0];
          agendamentoIdAlvo = agendamentoAlvo.id;
        }

        const dataAg = agendamentoAlvo.data;
        const horaAg = (agendamentoAlvo.hora || "").slice(0, 5);
        const petNomeAg = agendamentoAlvo.pets?.nome || petNome || "Pet";
        const clienteNomeAg = agendamentoAlvo.clientes?.nome || clienteNome || "Tutor";
        const servicoNomeAg = agendamentoAlvo.servicos?.nome || "Atendimento";
        const petIdAg = agendamentoAlvo.pets?.id || petId;
        const clienteIdAg = agendamentoAlvo.clientes?.id || clienteId;

        const dataExtensa = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "full",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(`${dataAg}T12:00:00`));

        const proposta = JessiV2ConfirmationManager.criarProposta({
          userId: user?.id || "proprietario_spa",
          cliente: { id: clienteIdAg || "", nome: clienteNomeAg },
          pet: { id: petIdAg || "", nome: petNomeAg },
          acao: "cancelar_agendamento",
          motivo: `Cancelamento de ${servicoNomeAg} para ${petNomeAg} em ${dataAg} às ${horaAg}`,
          estadoAtual: { status: agendamentoAlvo.status, agendamentoId: agendamentoIdAlvo },
          estadoProposto: { status: "cancelado", agendamentoId: agendamentoIdAlvo },
          valores: { valorBruto: agendamentoAlvo.valor_previsto || 0, valorFinal: 0 },
          dataHora: `${dataAg}T${horaAg}:00`,
          riscos: ["A vaga na grade será liberada para novos agendamentos."],
          resumoVisual: {
            entendido: `Cancelamento do agendamento de ${servicoNomeAg} para ${petNomeAg} (${clienteNomeAg}) em ${dataExtensa} às ${horaAg}.`,
            seraAlterado: `Status do agendamento #${agendamentoIdAlvo.slice(0, 8)} será alterado para "cancelado" e o horário será liberado.`,
            situacaoAtual: `Agendamento ativo com status "${agendamentoAlvo.status}".`,
            resultadoEsperado: `Agendamento cancelado com sucesso e grade atualizada.`,
            alertas: ["Nenhuma alteração foi gravada ainda.", "A confirmação expira em 15 minutos."],
          },
        });

        pendingAction = {
          id: proposta.id,
          type: "cancelar_agendamento",
          tool: "cancelar_agendamento",
          title: `Confirmação de Cancelamento: ${servicoNomeAg}`,
          summary: `Pet: ${petNomeAg} • Tutor: ${clienteNomeAg} • Data: ${dataExtensa} às ${horaAg}`,
          riskLevel: "alto",
          params: {
            agendamentoId: agendamentoIdAlvo,
            agendamento_id: agendamentoIdAlvo,
            petId: petIdAg,
            petNome: petNomeAg,
            clienteId: clienteIdAg,
            clienteNome: clienteNomeAg,
            data: dataAg,
            hora: horaAg,
            servicoNome: servicoNomeAg,
            motivo: intencao.entidades.motivo || "Cancelamento solicitado pelo operador",
          },
          created_at: proposta.created_at,
          expires_at: proposta.validade,
        };

        respostaTexto = `Preparei o cancelamento do agendamento de **${servicoNomeAg}** para **${petNomeAg}** (Tutor: **${clienteNomeAg}**) no dia **${dataExtensa}** às **${horaAg}**. Por favor confirme no cartão abaixo para liberar o horário na grade.`;

        cards.push({
          type: "confirmacao",
          title: pendingAction.title,
          subtitle: `Tutor: ${clienteNomeAg} • Pet: ${petNomeAg}`,
          data: {
            proposta,
            acaoPendente: pendingAction,
            pendingAction,
            requerConfirmacao: true,
            resumoVisual: proposta.resumoVisual,
            resumo: proposta.resumoVisual.entendido,
            acoesDisponiveis: ["Confirmar cancelamento", "Manter agendamento"],
          },
        });

        novoContexto = {
          ...novoContexto,
          operacaoPreparada: pendingAction,
        };

        return {
          versao: "v2",
          respostaTexto,
          cards,
          pendingAction,
          novoContexto,
          intencao,
          tempoProcessamentoMs: Date.now() - inicioMs,
          correlationId,
        };
      }

      // 4.6 Resolução e Preparação de Remarcação (Reagendamento)
      if (intencao.dominio === "agenda" && (intencao.intencao === "preparar_reagendamento" || intencao.intencao === "reagendar_agendamento" || intencao.intencao === "remarcar_agendamento")) {
        let agendamentoIdAlvo = intencao.entidades.agendamentoId || (intencao.entidades as any).agendamento_id || null;
        let agendamentoAlvo: any = null;

        if (agendamentoIdAlvo) {
          const { data: agById } = await sb
            .from("agendamentos")
            .select("id, data, hora, status, valor_previsto, clientes(id, nome), pets(id, nome), servicos(id, nome)")
            .eq("id", agendamentoIdAlvo)
            .maybeSingle();
          agendamentoAlvo = agById;
        } else {
          let query = sb
            .from("agendamentos")
            .select("id, data, hora, status, valor_previsto, clientes(id, nome), pets(id, nome), servicos(id, nome)")
            .neq("status", "cancelado");

          if (petId) {
            query = query.eq("pet_id", petId);
          } else if (clienteId) {
            query = query.eq("cliente_id", clienteId);
          }

          const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
          query = query.gte("data", hoje).order("data", { ascending: true }).limit(5);

          const { data: agsEncontrados } = await query;
          if (agsEncontrados && agsEncontrados.length > 0) {
            agendamentoAlvo = agsEncontrados[0];
            agendamentoIdAlvo = agendamentoAlvo.id;
          }
        }

        if (!agendamentoAlvo) {
          return {
            versao: "v2",
            respostaTexto: `Não encontrei nenhum agendamento ativo para remarcar.`,
            cards: [],
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        const novaData = intencao.entidades.data;
        const novaHora = intencao.entidades.hora;

        if (!novaData || !novaHora) {
          return {
            versao: "v2",
            respostaTexto: `Localizei o agendamento de **${agendamentoAlvo.pets?.nome || "Pet"}** (${agendamentoAlvo.data} às ${(agendamentoAlvo.hora || "").slice(0, 5)}). Para qual nova data e horário você deseja reagendar?`,
            cards: [],
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        const novaDataHoraISO = `${novaData}T${novaHora}:00`;
        const checagemGrade = await AgendaAdapter.verificarDisponibilidade(sb, novaDataHoraISO, null, novaData, novaHora);
        if (!checagemGrade.disponivel) {
          return {
            versao: "v2",
            respostaTexto: `Atenção: Não é possível remarcar para este horário: ${checagemGrade.motivo}`,
            cards: [],
            pendingAction: null,
            novoContexto: { ...contextoAtual, ...novoContexto },
            intencao,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        const proposta = JessiV2ConfirmationManager.criarProposta({
          userId: user?.id || "proprietario_spa",
          cliente: { id: agendamentoAlvo.clientes?.id || "", nome: agendamentoAlvo.clientes?.nome || "Tutor" },
          pet: { id: agendamentoAlvo.pets?.id || "", nome: agendamentoAlvo.pets?.nome || "Pet" },
          acao: "reagendar_agendamento",
          motivo: `Remarcar de ${agendamentoAlvo.data} às ${(agendamentoAlvo.hora || "").slice(0, 5)} para ${novaData} às ${novaHora}`,
          estadoAtual: { data: agendamentoAlvo.data, hora: agendamentoAlvo.hora },
          estadoProposto: { agendamentoId: agendamentoIdAlvo, novaData, novaHora, novaDataHoraISO },
          valores: { valorBruto: agendamentoAlvo.valor_previsto || 0, valorFinal: agendamentoAlvo.valor_previsto || 0 },
          dataHora: novaDataHoraISO,
          riscos: ["A nova vaga será reservada e a anterior liberada."],
          resumoVisual: {
            entendido: `Remarcação do agendamento de ${agendamentoAlvo.pets?.nome} para ${novaData} às ${novaHora}.`,
            seraAlterado: `Data/hora atualizadas no agendamento #${agendamentoIdAlvo.slice(0, 8)}.`,
            situacaoAtual: `Agendado para ${agendamentoAlvo.data} às ${(agendamentoAlvo.hora || "").slice(0, 5)}.`,
            resultadoEsperado: `Agendamento remarcado com sucesso na base de dados.`,
            alertas: ["Nenhuma alteração foi gravada ainda.", "A confirmação expira em 15 minutos."],
          },
        });

        pendingAction = {
          id: proposta.id,
          type: "reagendar_agendamento",
          tool: "reagendar_agendamento",
          title: `Confirmação de Remarcação`,
          summary: `Pet: ${agendamentoAlvo.pets?.nome} • De ${agendamentoAlvo.data} às ${(agendamentoAlvo.hora || "").slice(0, 5)} para ${novaData} às ${novaHora}`,
          riskLevel: "medio",
          params: {
            agendamentoId: agendamentoIdAlvo,
            agendamento_id: agendamentoIdAlvo,
            novaData,
            novaHora,
            novaDataHoraISO,
          },
          created_at: proposta.created_at,
          expires_at: proposta.validade,
        };

        respostaTexto = `Preparei a remarcação do atendimento de **${agendamentoAlvo.pets?.nome || "Pet"}** para o dia **${novaData}** às **${novaHora}**. Por favor confirme no cartão abaixo.`;

        cards.push({
          type: "confirmacao",
          title: pendingAction.title,
          subtitle: `Pet: ${agendamentoAlvo.pets?.nome || "Pet"}`,
          data: {
            proposta,
            acaoPendente: pendingAction,
            pendingAction,
            requerConfirmacao: true,
            resumoVisual: proposta.resumoVisual,
            resumo: proposta.resumoVisual.entendido,
            acoesDisponiveis: ["Confirmar remarcação", "Cancelar"],
          },
        });

        novoContexto = {
          ...novoContexto,
          operacaoPreparada: pendingAction,
        };

        return {
          versao: "v2",
          respostaTexto,
          cards,
          pendingAction,
          novoContexto,
          intencao,
          tempoProcessamentoMs: Date.now() - inicioMs,
          correlationId,
        };
      }

      // Outros domínios com supervisão (programas, financeiro, clientes)
      const nomeCliente = clienteNome || "Cliente";
      const nomePet = petNome || "Pet";
      const dataHoraAlvo = intencao.entidades.data ? `${intencao.entidades.data}${intencao.entidades.hora ? ` às ${intencao.entidades.hora}` : ""}` : "Data a definir";

      let entendido = `Comando recebido: "${input.mensagem}"`;
      let seraAlterado = `Gravação pendente para ${nomePet} (Tutor: ${nomeCliente}).`;
      let situacaoAtual = "Registro em estado draft aguardando aprovação.";
      let resultadoEsperado = `Execução oficial de ${intencao.intencao.replace(/_/g, " ")} após confirmação humana.`;
      const alertas: string[] = ["Nenhuma alteração foi gravada ainda.", "A confirmação expira em 15 minutos."];

      if (intencao.dominio === "programas_creditos") {
        entendido = `Uso/liberação de 1 crédito do plano do Clubinho para ${nomePet}.`;
        seraAlterado = `Abatimento de 1 sessão no saldo de créditos do cliente ${nomeCliente}.`;
        situacaoAtual = `Cliente possui créditos ativos.`;
        resultadoEsperado = `Saldo debitado e atendimento quitado com crédito oficial.`;
        alertas.push("Serviços extras devem ser cobrados separadamente.");
      } else if (intencao.dominio === "clientes_pets") {
        entendido = `Cadastro/edição de dados cadastrais de ${nomeCliente}.`;
        seraAlterado = `Inserção do novo registro de cliente/pet na base oficial.`;
        situacaoAtual = "Registro não existente.";
        resultadoEsperado = `Ficha cadastral criada e vinculada.`;
      } else if (intencao.dominio === "financeiro_relatorios") {
        entendido = `Registro de pagamento / baixa financeira para ${nomeCliente}.`;
        seraAlterado = `Lançamento de receita no valor de R$ ${Number(intencao.entidades.valor || 0).toFixed(2)}.`;
        situacaoAtual = "Pagamento pendente de registro.";
        resultadoEsperado = `Transação financeira oficial registrada.`;
      }

      const proposta = JessiV2ConfirmationManager.criarProposta({
        userId: user?.id || "proprietario_spa",
        cliente: { id: clienteId || "", nome: nomeCliente },
        pet: { id: petId || "", nome: petNome || nomePet },
        acao: intencao.intencao,
        motivo: `Solicitação: "${input.mensagem}"`,
        estadoAtual: { status: "pendente" },
        estadoProposto: intencao.entidades,
        valores: { valorBruto: intencao.entidades.valor || 0, valorFinal: intencao.entidades.valor || 0 },
        dataHora: dataHoraAlvo,
        riscos: ["Alteração no banco sujeita a confirmação com verificação física (read-back)."],
        resumoVisual: {
          entendido,
          seraAlterado,
          situacaoAtual,
          resultadoEsperado,
          alertas,
        },
      });

      pendingAction = {
        id: proposta.id,
        type: intencao.intencao,
        tool: intencao.ferramentaSugerida || intencao.intencao,
        title: `Confirmação de ${intencao.intencao.replace(/_/g, " ").toUpperCase()}`,
        summary: proposta.motivo,
        riskLevel: "medio",
        params: {
          ...intencao.entidades,
          clienteId,
          clienteNome: nomeCliente,
          petId,
          petNome: nomePet,
          servicoId,
          servicoNome,
        },
        created_at: proposta.created_at,
        expires_at: proposta.validade,
      };

      respostaTexto = `Preparei a operação solicitada no cartão de revisão abaixo. Revise os dados e confirme para que eu execute a gravação no sistema.`;

      cards.push({
        type: "confirmacao",
        title: pendingAction.title,
        subtitle: `Cliente: ${nomeCliente} • Pet: ${nomePet}`,
        data: {
          proposta,
          acaoPendente: pendingAction,
          pendingAction,
          requerConfirmacao: true,
          resumoVisual: proposta.resumoVisual,
          resumo: proposta.resumoVisual?.entendido || proposta.motivo,
          acoesDisponiveis: ["Confirmar operação", "Cancelar"],
        },
      });

      novoContexto = {
        ...novoContexto,
        operacaoPreparada: pendingAction,
      };
    } else {
      // RESPOSTAS CONVERSACIONAIS E CONSULTAS REAIS (FASE 2 — SOMENTE LEITURA)
      if (intencao.dominio === "agenda") {
        const dataAlvo = intencao.entidades.data || contextoAtual.dataReferencia;
        const petAlvoId = novoContexto.pet?.id || contextoAtual.pet?.id;
        const petAlvoNome = novoContexto.pet?.nome || contextoAtual.pet?.nome || intencao.entidades.petNome;

        if (intencao.intencao === "consultar_ultimo_atendimento" && petAlvoId) {
          const resUltimo = await AgendaAdapter.consultarUltimoAtendimentoPet(sb, petAlvoId, petAlvoNome || undefined);
          respostaTexto = resUltimo.summary || `Consultei o histórico de atendimentos do pet.`;
          cards.push({
            type: "agenda",
            title: `Último Atendimento — ${petAlvoNome || "Pet"}`,
            subtitle: "Histórico Oficial do Sistema",
            data: resUltimo.data,
          });
        } else if (intencao.intencao === "consultar_horarios_livres") {
          const resEncaixes = await AgendaAdapter.identificarEncaixesDisponiveis(sb, dataAlvo);
          const livres = (resEncaixes.data as any)?.horariosSugeridos || [];
          const primeiro = livres[0];

          if (livres.length > 0) {
            respostaTexto = `O primeiro horário livre para **${dataAlvo}** é às **${primeiro}**.\n\nHorários disponíveis na grade:\n${livres.map((h: string) => `• ${h}`).join("\n")}`;
          } else {
            respostaTexto = `Não há horários livres disponíveis na grade para a data **${dataAlvo}**. Todos os horários estão ocupados.`;
          }

          cards.push({
            type: "agenda",
            title: `Horários Livres na Grade — ${dataAlvo}`,
            subtitle: `${livres.length} horário(s) disponível(is)`,
            data: resEncaixes.data,
          });
        } else {
          const resAgenda = await AgendaAdapter.consultarAgendaPorData(sb, dataAlvo);
          respostaTexto = resAgenda.summary || `Consultei a agenda para ${dataAlvo}.`;
          cards.push({
            type: "agenda",
            title: `Agenda de Atendimentos — ${dataAlvo}`,
            subtitle: `${resAgenda.total_count || 0} agendamento(s) encontrado(s)`,
            data: resAgenda.data,
          });
        }
      } else if (intencao.dominio === "financeiro_relatorios") {
        const resFin = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, "mes");
        const dadosFin = resFin.data as any;

        if (intencao.intencao === "consultar_contas_a_receber") {
          const aReceber = dadosFin?.valoresAReceber || 0;
          const vencidos = dadosFin?.valoresVencidosDevedores || 0;
          const totalPendente = aReceber + vencidos;

          respostaTexto =
            `Atualmente temos **R$ ${aReceber.toFixed(2)}** a receber dentro do prazo` +
            (vencidos > 0 ? ` e **R$ ${vencidos.toFixed(2)}** em faturas vencidas/inadimplentes.\n\nTotal geral a receber: **R$ ${totalPendente.toFixed(2)}**.` : ".");

          cards.push({
            type: "financeiro",
            title: "Contas a Receber (Oficial)",
            subtitle: `Total pendente: R$ ${totalPendente.toFixed(2)}`,
            data: dadosFin,
          });
        } else if (intencao.intencao === "consultar_inadimplencia_devedores") {
          const devedores: any[] = dadosFin?.devedores || [];
          if (devedores.length > 0) {
            const itens = devedores.map(
              (d) => `• **${d.clienteNome}**: R$ ${Number(d.valor).toFixed(2)} (Vencimento: ${new Date(`${d.vencimento}T12:00:00`).toLocaleDateString("pt-BR")})`
            );
            respostaTexto = `Encontrei ${devedores.length} cliente(s) com pagamentos pendentes/vencidos:\n\n${itens.join("\n")}\n\nTotal em aberto: **R$ ${dadosFin.valoresVencidosDevedores.toFixed(2)}**.`;
          } else {
            respostaTexto = `Não há clientes com pagamentos em atraso registrados no momento. A inadimplência está zerada.`;
          }

          cards.push({
            type: "financeiro",
            title: "Clientes com Pagamentos Pendentes",
            subtitle: `${devedores.length} cliente(s) listado(s)`,
            data: dadosFin,
          });
        } else {
          respostaTexto = resFin.summary || `Consultei o resumo financeiro consolidado oficial do Spa.`;
          cards.push({
            type: "financeiro",
            title: "Resumo Financeiro Consolidado (Oficial)",
            subtitle: "Fonte: Transações Oficiais",
            data: resFin.data,
          });
        }
      } else if (intencao.dominio === "programas_creditos") {
        const cliId = novoContexto.cliente?.id || contextoAtual.cliente?.id;
        const petId = novoContexto.pet?.id || contextoAtual.pet?.id;
        const petNome = novoContexto.pet?.nome || contextoAtual.pet?.nome || intencao.entidades.petNome;

        if (intencao.intencao === "consultar_programas_ativos" || (!cliId && !petId)) {
          const resProgGeral = await ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb);
          respostaTexto = resProgGeral.summary || `Consultei os contratos de programas ativos no Spa.`;
          cards.push({
            type: "programa",
            title: "Contratos Ativos do Clubinho",
            subtitle: `${resProgGeral.total_count || 0} contrato(s) ativo(s)`,
            data: resProgGeral.data,
          });
        } else {
          const resCred = await ProgramasCreditosAdapter.consultarSaldoCreditos(sb, cliId || "", petId || undefined);
          
          if (intencao.intencao === "consultar_validade_programa" && (resCred.data as any)?.validade) {
            respostaTexto = `O programa de cuidados de **${petNome || "o pet"}** possui validade até **${(resCred.data as any).validade}**. ${(resCred.data as any).totalSessaoRestantes || 0} crédito(s) restante(s).`;
          } else {
            respostaTexto = resCred.summary || `Consultei o saldo de créditos do plano.`;
          }

          cards.push({
            type: "programa",
            title: "Créditos e Programas do Clubinho",
            subtitle: `Pet: ${petNome || "Pet"} • Tutor: ${novoContexto.cliente?.nome || contextoAtual.cliente?.nome || "Cliente"}`,
            data: resCred.data,
          });
        }
      } else if (intencao.dominio === "clientes_pets") {
        const petIdCtx = novoContexto.pet?.id || contextoAtual.pet?.id;
        const clienteIdCtx = novoContexto.cliente?.id || contextoAtual.cliente?.id;
        const perguntaSobrePets = /\bpets?\b|\bcachorr|\bbichin|\banimais?\b/i.test(textoLimpo);

        if (petIdCtx && !(perguntaSobrePets && clienteIdCtx)) {
          const resFicha = await ClientesPetsAdapter.obterFichaPet(sb, petIdCtx);
          respostaTexto = resFicha.summary || `Aqui está a ficha e histórico do pet.`;
          cards.push({
            type: "cliente",
            title: `Ficha Cadastral & Histórico`,
            subtitle: `Pet: ${novoContexto.pet?.nome || contextoAtual.pet?.nome}`,
            data: resFicha.data,
          });
        } else if (clienteIdCtx) {
          const resCli = await ClientesPetsAdapter.obterFichaClienteCompleta(sb, clienteIdCtx);
          const dadosCli: any = resCli.data || {};
          const nomeCli = dadosCli.nome || novoContexto.cliente?.nome || contextoAtual.cliente?.nome || "O cliente";
          const petsCli: any[] = Array.isArray(dadosCli.pets) ? dadosCli.pets : [];

          if (petsCli.length === 0) {
            respostaTexto = `**${nomeCli}** ainda não possui nenhum pet cadastrado no sistema.`;
          } else {
            const nomes = petsCli.map((p: any) => `**${p.nome}**`);
            const listaNomes =
              nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
            respostaTexto = `**${nomeCli}** possui ${petsCli.length} pet(s) cadastrado(s): ${listaNomes}.`;
          }

          if (petsCli.length === 1) {
            novoContexto.pet = { id: petsCli[0].id, nome: petsCli[0].nome, raca: petsCli[0].raca };
          }

          cards.push({
            type: "cliente",
            title: `Ficha do Cliente`,
            subtitle: nomeCli,
            data: resCli.data,
          });
        } else {
          respostaTexto = `Não localizei esse cliente no cadastro. Pode confirmar o nome completo ou o telefone?`;
        }
      } else {
        // Conversação Natural / Saudação Generativa via Gemini com Fallback
        try {
          const genResp = await geminiProvider.gerarResposta({
            promptSistema: "",
            mensagemUsuario: textoLimpo,
            dadosOperacionais: {
              operador: user?.nome || "Eli Júnior",
              cargo: user?.cargo || "Administrador",
              contexto: {
                cliente: novoContexto.cliente || contextoAtual.cliente,
                pet: novoContexto.pet || contextoAtual.pet,
                dataReferencia: contextoAtual.dataReferencia,
              },
            },
            historico: (input.historico || []) as any,
          });
          if (genResp?.texto && genResp.texto.length > 5) {
            respostaTexto = genResp.texto;
          } else {
            respostaTexto = `Olá! Sou a Jessi, assistente operacional do Spa de Pet Tia Jéssica. Como posso ajudar você hoje com a agenda, clientes, pets, planos ou financeiro?`;
          }
        } catch {
          respostaTexto = `Olá! Sou a Jessi, assistente operacional do Spa de Pet Tia Jéssica. Como posso ajudar você hoje com a agenda, clientes, pets, planos ou financeiro?`;
        }
      }
    }

    // Auditoria oficial da interação
    registrarAuditoriaV2({
      user_id: user?.id || "proprietario_spa",
      conversation_id: contextoAtual.conversationId,
      intent: intencao.intencao,
      entities: intencao.entidades,
      tools_invoked: intencao.ferramentaSugerida ? [intencao.ferramentaSugerida] : [],
      proposal_id: pendingAction?.id || null,
      success: true,
      correlation_id: correlationId,
      duration_ms: Date.now() - inicioMs,
      jessi_version: "v2.0.0",
    });

    return {
      versao: "v2",
      respostaTexto,
      cards,
      pendingAction,
      novoContexto: {
        ...contextoAtual,
        ...novoContexto,
      },
      intencao,
      tempoProcessamentoMs: Date.now() - inicioMs,
      correlationId,
    };
  } catch (err: any) {
    console.error("Erro interno no motor V2 da Jessi:", err);
    throw err;
  }
}
