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

      if (
        toolNome === "criar_agendamento" ||
        toolNome === "preparar_agendamento" ||
        toolNome === "executar_agendamento"
      ) {
        mutationResult = await AgendaAdapter.executarAgendamentoConfirmado(sb, params, idempotencyKey);
        recordIdReal = mutationResult?.affected_record_id || mutationResult?.entity_id || null;
      } else if (
        toolNome === "preparar_reagendamento" ||
        toolNome === "reagendar_agendamento" ||
        toolNome === "remarcar_agendamento"
      ) {
        mutationResult = await AgendaAdapter.executarRemarcacaoConfirmada(sb, params, idempotencyKey);
        recordIdReal = mutationResult?.affected_record_id || mutationResult?.entity_id || null;
      } else if (
        toolNome === "preparar_cancelamento" ||
        toolNome === "cancelar_agendamento"
      ) {
        mutationResult = await AgendaAdapter.executarCancelamentoConfirmado(sb, params, idempotencyKey);
        recordIdReal = mutationResult?.affected_record_id || mutationResult?.entity_id || null;
      }

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
    if (intencao.dominio === "clientes_pets" || intencao.entidades.termoBusca) {
      const termoParaBusca = intencao.entidades.termoBusca || textoLimpo;
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

      // 4.1 Resolução de Cliente no Banco se tiver apenas nome
      if (!clienteId && clienteNome) {
        const { data: clientesEncontrados } = await sb
          .from("clientes")
          .select("id, nome, whatsapp, telefone")
          .ilike("nome", `%${clienteNome}%`)
          .limit(5);

        if (clientesEncontrados && clientesEncontrados.length === 1) {
          clienteId = clientesEncontrados[0].id;
          clienteNome = clientesEncontrados[0].nome;
          novoContexto.cliente = {
            id: clienteId,
            nome: clienteNome,
            telefone: clientesEncontrados[0].telefone || clientesEncontrados[0].whatsapp,
          };
        } else if (clientesEncontrados && clientesEncontrados.length > 1) {
          // Ambiguidade: exige desambiguação humana
          return {
            versao: "v2",
            respostaTexto: `Encontrei mais de um cliente com o nome "${clienteNome}". Qual deles você deseja selecionar?`,
            cards: [
              {
                type: "cliente",
                title: "Selecione o Cliente / Tutor",
                subtitle: `Termo pesquisado: "${clienteNome}"`,
                data: {
                  exigeDesambiguacao: true,
                  opcoes: clientesEncontrados.map((c) => ({
                    id: c.id,
                    tipo: "cliente",
                    nome: c.nome,
                    detalhe: c.telefone || c.whatsapp || "Sem telefone",
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
              respostaTexto: `O tutor ${clienteNome} não possui nenhum pet com o nome "${petNome}". Os pets cadastrados para este tutor são: ${petsDoCliente.map((p) => p.nome).join(", ")}.`,
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
          // Cliente possui exatamente 1 pet cadastrado: seleciona com clareza
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
            respostaTexto: `O tutor ${clienteNome} possui ${petsDoCliente.length} pets cadastrados (${petsDoCliente.map((p) => p.nome).join(", ")}). Para qual pet deseja realizar a operação?`,
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

      // 4.3 Resolução de Serviço e Preço no Catálogo
      if (servicoNome) {
        const { data: servicoDB } = await sb
          .from("servicos")
          .select("id, nome, valor_padrao, duracao_minutos")
          .ilike("nome", `%${servicoNome}%`)
          .limit(1)
          .maybeSingle();

        if (servicoDB) {
          servicoId = servicoDB.id;
          servicoNome = servicoDB.nome;
          servicoValor = servicoDB.valor_padrao || 0;
          duracaoMinutos = servicoDB.duracao_minutos || 60;
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
          let textoOrientacao = `Para preparar o agendamento com segurança, ainda preciso das seguintes informações: **${camposFaltantes.join(", ")}**.`;
          if (clienteNome && petNome && !dataAlvo && !horaAlvo) {
            textoOrientacao = `Identifiquei o pet **${petNome}** (Tutor: **${clienteNome}**). Para qual data e horário você deseja agendar o serviço de **${servicoNome || "atendimento"}**?`;
          } else if (clienteNome && petNome && dataAlvo && !horaAlvo) {
            textoOrientacao = `Para o atendimento de **${petNome}** no dia **${dataAlvo}**, qual o horário desejado?`;
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
            data: { devedores, totalVencido: dadosFin?.valoresVencidosDevedores },
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
        if (novoContexto.pet?.id || contextoAtual.pet?.id) {
          const petId = novoContexto.pet?.id || contextoAtual.pet?.id || "";
          const resFicha = await ClientesPetsAdapter.obterFichaPet(sb, petId);
          respostaTexto = resFicha.summary || `Aqui está a ficha e histórico do pet.`;
          cards.push({
            type: "cliente",
            title: `Ficha Cadastral & Histórico`,
            subtitle: `Pet: ${novoContexto.pet?.nome || contextoAtual.pet?.nome}`,
            data: resFicha.data,
          });
        } else if (!respostaTexto) {
          respostaTexto = `Aqui estão os dados cadastrais solicitados.`;
        }
      } else {
        // Conversação Natural / Saudação
        respostaTexto = `Olá! Sou a Jessi, assistente operacional do Spa de Pet Tia Jéssica. Como posso ajudar você hoje com a agenda, clientes, pets, planos ou financeiro?`;
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
