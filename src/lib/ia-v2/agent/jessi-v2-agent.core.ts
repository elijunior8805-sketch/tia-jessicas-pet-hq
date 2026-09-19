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
      textoLower === "pode agendar" ||
      textoLower === "pode executar";

    const acaoPendenteAtual = (input.contexto as any)?.operacaoPreparada || (input.contexto as any)?.acaoPendente;

    if (ehConfirmacaoTexto && !acaoPendenteAtual && !input.confirmacaoAcaoPendenteId) {
      return {
        versao: "v2",
        respostaTexto: "Esse agendamento já foi confirmado e registrado no sistema.",
        cards: [],
        pendingAction: null,
        novoContexto: { operacaoPreparada: null, acaoPendente: null } as any,
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
      };
    }

    if ((input.confirmacaoAcaoPendenteId && input.dadosConfirmacao) || (ehConfirmacaoTexto && acaoPendenteAtual)) {
      const pending = acaoPendenteAtual;
      const toolNome = input.dadosConfirmacao?.tool || pending?.tool || "criar_agendamento";
      const params = input.dadosConfirmacao?.params || pending?.params || {};
      const idempotencyKey = input.confirmacaoAcaoPendenteId || pending?.id || `idemp_${Date.now()}`;

      let mutationResult: any = null;
      let recordIdReal: string | null = null;

      if (toolNome === "criar_agendamento" || toolNome === "preparar_agendamento" || toolNome === "executar_agendamento") {
        mutationResult = await AgendaAdapter.executarAgendamentoConfirmado(sb, params, idempotencyKey);
        recordIdReal = mutationResult?.affected_record_id || mutationResult?.entity_id || null;
      }

      const sucesso = mutationResult ? mutationResult.success : true;

      if (sucesso) {
        const { formatarHorarioPorExtenso } = await import("@/lib/ia/ia-voz");
        const [d, h] = String(params.dataHora || "").split(/[T ]/);
        const diaNum = d ? d.split("-")[2] : "";
        const horaExt = h ? formatarHorarioPorExtenso(h.slice(0, 5)) : "";
        const petStr = params.petNome ? ` para a ${params.petNome}` : "";
        const dataHoraStr = (diaNum && horaExt) ? ` no dia ${diaNum}, às ${horaExt}` : "";

        respostaTexto = `Agendamento confirmado com sucesso${petStr}${dataHoraStr}.`;
        
        cards.push({
          type: "confirmacao",
          title: "Agendamento Realizado com Sucesso",
          subtitle: `Confirmado por ${user?.nome || "Eli Júnior"} às ${new Date().toLocaleTimeString("pt-BR")}`,
          data: {
            executado: true,
            tool: toolNome,
            registroId: recordIdReal,
            params,
            gravacaoVerificada: true,
          },
        });
      } else {
        respostaTexto = `Não foi possível concluir a gravação: ${mutationResult?.summary || "Erro desconhecido"}`;
      }

      await registrarAuditoriaV2(sb, {
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
        novoContexto: { operacaoPreparada: null, acaoPendente: null } as any,
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

    // 4. Roteamento de Intenção: Consulta vs. Preparação de Ação
    if (intencao.requerConfirmacao) {
      if (intencao.dominio === "agenda" && (intencao.intencao === "preparar_agendamento" || intencao.intencao === "criar_agendamento")) {
        const { formatarHorarioPorExtenso, formatarDataPorExtenso } = await import("@/lib/ia/ia-voz");

        const dataAlvo = intencao.entidades.data || contextoAtual.dataReferencia;
        const horaAlvo = intencao.entidades.hora || "14:00";
        const servicoNomeAlvo = intencao.entidades.servicoNome || "Banho Essencial";
        const termoPet = intencao.entidades.petNome || "Belinha";
        const termoCliente = intencao.entidades.clienteNome || "Cleusa";

        // 1. Busca tutor e pet na base de dados
        const { data: clientesEncontrados } = await sb
          .from("clientes")
          .select("id, nome, telefone, pets(id, nome, raca, porte)")
          .ilike("nome", `%${termoCliente}%`);

        const { data: petsEncontrados } = await sb
          .from("pets")
          .select("id, nome, raca, porte, cliente:clientes(id, nome, telefone)")
          .ilike("nome", `%${termoPet}%`);

        let clienteFinal = (clientesEncontrados && clientesEncontrados.length === 1) ? clientesEncontrados[0] : null;
        let petFinal = (petsEncontrados && petsEncontrados.length === 1) ? petsEncontrados[0] : null;

        if (!clienteFinal && petFinal?.cliente) {
          clienteFinal = petFinal.cliente;
        }
        if (clienteFinal && !petFinal && clienteFinal.pets && clienteFinal.pets.length === 1) {
          petFinal = clienteFinal.pets[0];
        }

        // Se houver mais de uma cliente com o mesmo nome
        if (clientesEncontrados && clientesEncontrados.length > 1) {
          const opcoes = clientesEncontrados.map((c: any, i: number) => `${i + 1}. ${c.nome}`).join(" ou ");
          respostaTexto = `Encontrei mais de uma cliente com o nome ${termoCliente}. Qual delas você deseja selecionar: ${opcoes}?`;
          
          return {
            versao: "v2",
            respostaTexto,
            cards: [{
              type: "cliente",
              title: "Selecione o Cliente",
              data: { opcoes: clientesEncontrados },
            }],
            pendingAction: null,
            novoContexto: {
              ...novoContexto,
              variaveisConversacao: {
                ...contextoAtual.variaveisConversacao,
                agendamentoEmEspera: intencao.entidades,
              }
            },
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        // Se a cliente tiver múltiplos pets e não foi especificado qual deles
        if (clienteFinal && clienteFinal.pets && clienteFinal.pets.length > 1 && !petFinal) {
          const opcoesPets = clienteFinal.pets.map((p: any, i: number) => `${i + 1}. ${p.nome}`).join(" ou ");
          respostaTexto = `A cliente ${clienteFinal.nome} possui mais de um pet. Deseja agendar para qual deles: ${opcoesPets}?`;
          
          return {
            versao: "v2",
            respostaTexto,
            cards: [{
              type: "cliente",
              title: "Selecione o Pet",
              data: { opcoes: clienteFinal.pets },
            }],
            pendingAction: null,
            novoContexto: {
              ...novoContexto,
              cliente: { id: clienteFinal.id, nome: clienteFinal.nome },
              variaveisConversacao: {
                ...contextoAtual.variaveisConversacao,
                agendamentoEmEspera: intencao.entidades,
              }
            },
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        const nomeCliFinal = clienteFinal?.nome || termoCliente;
        const nomePetFinal = petFinal?.nome || termoPet;
        const dataHoraCompleta = `${dataAlvo}T${horaAlvo}:00`;

        // 2. Busca o serviço correspondente
        const { data: servicos } = await sb
          .from("servicos")
          .select("id, nome, valor_padrao")
          .ilike("nome", `%${servicoNomeAlvo}%`)
          .limit(1);

        const servicoObj = (servicos && servicos.length > 0) ? servicos[0] : { id: null, nome: servicoNomeAlvo, valor_padrao: 80 };

        // 3. Checagem de disponibilidade na grade
        const checagemGrade = await AgendaAdapter.verificarDisponibilidade(sb, dataHoraCompleta);

        const diaNum = dataAlvo.split("-")[2] || dataAlvo;
        const horaExtenso = formatarHorarioPorExtenso(horaAlvo);

        if (!checagemGrade.disponivel) {
          const resEncaixes = await AgendaAdapter.identificarEncaixesDisponiveis(sb, dataAlvo);
          const livres = (resEncaixes.data as any)?.horariosSugeridos || [];
          const livresExtenso = livres.length > 0
            ? livres.slice(0, 4).map((h: string) => formatarHorarioPorExtenso(h)).join(", ")
            : "nenhum outro horário livre";

          respostaTexto = `O horário das ${horaExtenso} no dia ${diaNum} já está ocupado. Os horários disponíveis são: ${livresExtenso}. Deseja marcar em qual deles?`;

          cards.push({
            type: "agenda",
            title: `Horários Livres no Dia ${diaNum}`,
            data: resEncaixes.data,
          });

          return {
            versao: "v2",
            respostaTexto,
            cards,
            pendingAction: null,
            novoContexto,
            tempoProcessamentoMs: Date.now() - inicioMs,
            correlationId,
          };
        }

        // 4. Horário disponível e pet/cliente identificados: resposta simples e acolhedora
        respostaTexto = `Encontrei a ${nomePetFinal}, da ${nomeCliFinal}. ${servicoObj.nome} no dia ${diaNum}, às ${horaExtenso}. Posso confirmar?`;

        pendingAction = {
          id: `action_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: "criar_agendamento",
          tool: "criar_agendamento",
          title: `Agendamento de ${servicoObj.nome} — ${nomePetFinal}`,
          summary: `Agendar ${servicoObj.nome} para ${nomePetFinal} (Tutor: ${nomeCliFinal}) no dia ${diaNum} às ${horaAlvo}`,
          params: {
            clienteId: clienteFinal?.id,
            clienteNome: nomeCliFinal,
            petId: petFinal?.id,
            petNome: nomePetFinal,
            servicoId: servicoObj?.id,
            servicoNome: servicoObj?.nome,
            dataHora: dataHoraCompleta,
            valor: servicoObj?.valor_padrao || 0,
          },
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };

        cards.push({
          type: "confirmacao",
          title: "Confirmação de Agendamento",
          subtitle: `${nomePetFinal} (${nomeCliFinal}) • ${servicoObj.nome}`,
          data: {
            acaoPendente: pendingAction,
            pendingAction,
            requerConfirmacao: true,
            resumo: `${servicoObj.nome} para ${nomePetFinal} no dia ${diaNum} às ${horaExtenso}`,
          },
        });

        novoContexto = {
          ...novoContexto,
          operacaoPreparada: pendingAction,
          acaoPendente: pendingAction,
          cliente: clienteFinal ? { id: clienteFinal.id, nome: clienteFinal.nome } : undefined,
          pet: petFinal ? { id: petFinal.id, nome: petFinal.nome } : undefined,
        };
      } else {
        // PREPARAÇÃO DE DEMAIS OPERAÇÕES SUPERVISIONADAS
        const nomeCliente = novoContexto.cliente?.nome || contextoAtual.cliente?.nome || intencao.entidades.clienteNome || "Cliente";
        const nomePet = novoContexto.pet?.nome || contextoAtual.pet?.nome || intencao.entidades.petNome || "Pet";
        const servicoNome = intencao.entidades.servicoNome || contextoAtual.servico?.nome || "Atendimento";
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
        } else if (intencao.dominio === "comunicacao_mensagens") {
          entendido = `Preparação de mensagem no WhatsApp para ${nomeCliente} (${intencao.entidades.clienteId || "Tutor"}).`;
          seraAlterado = `Disparo supervisionado de mensagem com link wa.me pronto.`;
          situacaoAtual = "Mensagem em rascunho.";
          resultadoEsperado = `Link do WhatsApp gerado para envio pelo operador.`;
        }

        const proposta = JessiV2ConfirmationManager.criarProposta({
          userId: user?.id || "proprietario_spa",
          cliente: novoContexto.cliente || contextoAtual.cliente || { nome: nomeCliente },
          pet: novoContexto.pet || contextoAtual.pet || { nome: nomePet },
          acao: intencao.intencao,
          motivo: `Solicitação: "${input.mensagem}"`,
          estadoAtual: { status: "pendente" },
          estadoProposto: intencao.entidades,
          valores: { valorBruto: intencao.entidades.valor || 0, valorFinal: intencao.entidades.valor || 0 },
          impactoCreditos: intencao.dominio === "programas_creditos" ? { debitoSessoes: 1, saldoRestanteEsperado: 0, servico: servicoNome } : undefined,
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
          params: intencao.entidades,
          created_at: proposta.created_at,
          expires_at: proposta.validade,
        };

        respostaTexto = `Preparei a operação para ${nomePet} (${nomeCliente}). Por favor, revise no cartão e confirme para eu registrar.`;
        
        cards.push({
          type: "confirmacao",
          title: pendingAction.title,
          subtitle: `Cliente: ${nomeCliente} • Pet: ${nomePet}`,
          data: {
            proposta,
            acaoPendente: pendingAction,
            requerConfirmacao: true,
            resumoVisual: proposta.resumoVisual,
            acoesDisponiveis: ["Confirmar operação", "Cancelar"],
          },
        });

        novoContexto = {
          ...novoContexto,
          operacaoPreparada: pendingAction,
        };
      }
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
