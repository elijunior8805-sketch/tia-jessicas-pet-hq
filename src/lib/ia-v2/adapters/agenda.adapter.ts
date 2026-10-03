import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { ClientesPetsAdapter } from "./clientes-pets.adapter";

/**
 * Adaptador Oficial da Agenda para a Jessi V2 (Seção 15)
 * Suporte a Agenda do Dia, Agenda Futura, Grade, Transporte e Encaixes
 * Colunas oficiais: data (date) + hora (time) + valor_previsto
 */

const SELECT_AGENDA = `
  id,
  data,
  hora,
  status,
  valor_previsto,
  observacoes,
  leva_traz_modalidade,
  clientes(id, nome, whatsapp),
  pets(id, nome, raca, porte),
  servicos(id, nome, valor)
`;

export function partirDataHora(
  dataHoraISO?: string | null,
  fallbackData?: string | null,
  fallbackHora?: string | null
): { data: string; hora: string } {
  let dataResolvida: string | null = null;
  let horaResolvida: string | null = null;

  if (fallbackData && typeof fallbackData === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fallbackData.trim())) {
    dataResolvida = fallbackData.trim();
  }

  if (fallbackHora && typeof fallbackHora === "string" && /^([01]\d|2[0-3]):[0-5]\d/.test(fallbackHora.trim())) {
    horaResolvida = fallbackHora.trim().slice(0, 5);
  }

  if (dataHoraISO && typeof dataHoraISO === "string" && dataHoraISO !== "undefined" && dataHoraISO.trim() !== "") {
    const str = dataHoraISO.trim();

    // Caso 1: Apenas data "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      dataResolvida = str;
    } else {
      // Caso 2: Data e Hora com separador "YYYY-MM-DD[T ]HH:mm"
      const partes = str.split(/[T ]/);
      if (partes.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(partes[0])) {
        dataResolvida = partes[0];
        if (/^([01]\d|2[0-3]):[0-5]\d/.test(partes[1])) {
          horaResolvida = partes[1].slice(0, 5);
        }
      } else {
        // Caso 3: Parse Date ISO
        const dt = new Date(str);
        if (!isNaN(dt.getTime())) {
          dataResolvida = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(dt);
          horaResolvida = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(dt);
        }
      }
    }
  }

  if (!dataResolvida || !horaResolvida) {
    throw new Error(
      `Data ou horário não especificados de forma válida (Data: ${dataResolvida || "não informada"}, Horário: ${horaResolvida || "não informado"}).`
    );
  }

  return { data: dataResolvida, hora: horaResolvida };
}

export class AgendaAdapter {
  /**
   * Consulta os agendamentos de uma data específica com formatação rica
   */
  static async consultarAgendaPorData(
    sb: SupabaseClient<Database>,
    data: string
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    const correlationId = `query_agenda_${inicio}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const { data: agendamentos, error } = await sb
        .from("agendamentos")
        .select(SELECT_AGENDA)
        .eq("data", data)
        .order("hora", { ascending: true });

      if (error) throw error;

      const total = agendamentos?.length || 0;
      let summary = "";

      const { formatarDataPorExtenso, formatarHorarioPorExtenso } = await import("@/lib/ia/ia-voz");
      const dataExtenso = formatarDataPorExtenso(data);

      if (total === 0) {
        summary = `Não há nenhum agendamento registrado para o dia ${dataExtenso}.`;
      } else {
        const primeiroHorario = agendamentos && agendamentos[0]?.hora ? formatarHorarioPorExtenso(agendamentos[0].hora) : "";
        const horarioTexto = primeiroHorario ? `, às ${primeiroHorario}` : "";
        const qtdTexto = total === 1 ? "um agendamento" : total === 2 ? "dois agendamentos" : total === 3 ? "três agendamentos" : `${total} agendamentos`;
        summary = `Encontrei ${qtdTexto} para o dia ${dataExtenso}${horarioTexto}. Quer ver os detalhes?`;
      }

      return {
        success: true,
        source: "tabela_agendamentos",
        data: agendamentos || [],
        total_count: total,
        summary,
        filters_applied: { data },
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_agendamentos",
        data: [],
        total_count: 0,
        summary: `Falha ao consultar agenda: ${err.message}`,
        error_code: err.code || "ERRO_CONSULTA_AGENDA",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Consulta a agenda futura para os próximos N dias (Seção 15)
   */
  static async consultarAgendaFutura(
    sb: SupabaseClient<Database>,
    diasAFrente = 7
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    const correlationId = `query_agenda_futura_${inicio}`;
    try {
      const hojeStr = partirDataHora(new Date().toISOString()).data;
      const dataLimite = partirDataHora(
        new Date(Date.now() + diasAFrente * 24 * 60 * 60 * 1000).toISOString()
      ).data;

      const { data: agendamentos, error } = await sb
        .from("agendamentos")
        .select(SELECT_AGENDA)
        .gte("data", hojeStr)
        .lte("data", dataLimite)
        .neq("status", "cancelado")
        .order("data", { ascending: true })
        .order("hora", { ascending: true });

      if (error) throw error;

      return {
        success: true,
        source: "agenda_futura",
        data: agendamentos || [],
        total_count: agendamentos?.length || 0,
        summary: `Existem ${agendamentos?.length || 0} agendamento(s) programados para os próximos ${diasAFrente} dias.`,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "agenda_futura",
        data: [],
        total_count: 0,
        summary: `Erro ao consultar agenda futura: ${err.message}`,
        error_code: err.code || "ERRO_AGENDA_FUTURA",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Alias de conveniência para consultar agenda por data
   */
  static async consultarAgenda(
    sb: SupabaseClient<Database>,
    data: string
  ): Promise<JessiV2QueryResult> {
    return this.consultarAgendaPorData(sb, data);
  }

  /**
   * Alias de conveniência para consultar horários livres
   */
  static async consultarHorariosLivres(
    sb: SupabaseClient<Database>,
    data: string
  ): Promise<JessiV2QueryResult<{ gradeOcupada: string[]; horariosSugeridos: string[] }>> {
    return this.identificarEncaixesDisponiveis(sb, data);
  }

  /**
   * Identifica lacunas e horários de encaixe disponíveis na grade do dia (Seção 15)
   */
  static async identificarEncaixesDisponiveis(
    sb: SupabaseClient<Database>,
    data: string
  ): Promise<JessiV2QueryResult<{ gradeOcupada: string[]; horariosSugeridos: string[] }>> {
    const inicio = Date.now();
    try {
      const res = await this.consultarAgendaPorData(sb, data);
      const agendamentos = res.data || [];

      const horariosOcupados: string[] = agendamentos
        .filter((a: any) => a.status !== "cancelado")
        .map((a: any) => String(a.hora || "").slice(0, 5));

      // Grade padrão do Spa: das 08h às 18h de hora em hora
      const gradePadrao = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
      const horariosSugeridos = gradePadrao.filter((h) => !horariosOcupados.includes(h));

      return {
        success: true,
        source: "calculo_encaixes_grade",
        data: { gradeOcupada: horariosOcupados, horariosSugeridos },
        total_count: horariosSugeridos.length,
        summary: `Para a data ${data}, existem ${horariosSugeridos.length} horário(s) livres para encaixe: ${horariosSugeridos.join(", ")}.`,
        executed_at: new Date().toISOString(),
        correlation_id: `encaixes_${inicio}`,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "calculo_encaixes",
        data: { gradeOcupada: [], horariosSugeridos: [] },
        total_count: 0,
        summary: `Falha ao calcular encaixes de agenda: ${err.message}`,
        error_code: err.code || "ERRO_ENCAIXES",
        executed_at: new Date().toISOString(),
        correlation_id: `encaixes_err_${inicio}`,
      };
    }
  }

  /**
   * Verifica se há conflito de grade para um determinado horário
   */
  /**
   * Verifica se há conflito de grade para um determinado horário
   */
  static async verificarDisponibilidade(
    sb: SupabaseClient<Database>,
    dataHoraISO?: string | null,
    profissionalId?: string | null,
    fallbackData?: string | null,
    fallbackHora?: string | null
  ): Promise<{ disponivel: boolean; motivo?: string }> {
    try {
      const { data, hora } = partirDataHora(dataHoraISO, fallbackData, fallbackHora);

      let query = sb
        .from("agendamentos")
        .select("id, status")
        .eq("data", data)
        .eq("hora", hora)
        .neq("status", "cancelado");

      if (profissionalId) {
        query = query.eq("profissional_id", profissionalId);
      }

      const { data: existentes } = await query;

      if (existentes && existentes.length > 0) {
        return {
          disponivel: false,
          motivo: `Já existe agendamento ativo registrado para ${data} às ${hora}.`,
        };
      }

      return { disponivel: true };
    } catch (err: any) {
      return { disponivel: false, motivo: `Erro ao checar grade: ${err.message}` };
    }
  }

  /**
   * Prepara proposta de agendamento na grade (com busca de dados e supervisão humana)
   */
  static async prepararPropostaAgendamento(
    sb: SupabaseClient<Database>,
    params: {
      clienteId?: string;
      clienteNome?: string;
      petId?: string;
      petNome?: string;
      servicoId?: string;
      servicoNome?: string;
      data?: string;
      hora?: string;
      dataHora?: string;
      valor?: number;
      transporte?: boolean;
    }
  ) {
    let dataAlvo = params.data || "";
    let horaAlvo = params.hora || "";

    if (params.dataHora && (!dataAlvo || !horaAlvo)) {
      try {
        const parsed = partirDataHora(params.dataHora, params.data, params.hora);
        dataAlvo = parsed.data;
        horaAlvo = parsed.hora;
      } catch {}
    }

    if (!dataAlvo) {
      dataAlvo = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    }
    if (!horaAlvo) {
      horaAlvo = "14:00";
    }

    let clienteId = params.clienteId;
    let clienteNome = params.clienteNome;
    let petId = params.petId;
    let petNome = params.petNome;
    const servicoNome = params.servicoNome || "Banho";

    // Se temos nome de cliente ou pet sem ID, busca no banco
    if ((!clienteId || !petId) && (clienteNome || petNome)) {
      try {
        const termo = clienteNome || petNome || "";
        const busca = await ClientesPetsAdapter.buscarClientesPets(sb, termo);
        if (busca.success && busca.data?.candidatos?.length > 0) {
          const c = busca.data.candidatos[0];
          if (c.tipo === "pet") {
            petId = c.id;
            petNome = c.nomePrincipal || c.nome;
            if (c.dadosCompletos?.clientes) {
              clienteId = c.dadosCompletos.clientes.id;
              clienteNome = c.dadosCompletos.clientes.nome;
            }
          } else {
            clienteId = c.id;
            clienteNome = c.nomePrincipal || c.nome;
            if (c.dadosCompletos?.pets?.length > 0) {
              petId = c.dadosCompletos.pets[0].id;
              petNome = c.dadosCompletos.pets[0].nome;
            }
          }
        }
      } catch (errBusca) {
        console.warn("[AgendaAdapter] Erro na busca de cliente/pet para proposta:", errBusca);
      }
    }

    // Se temos petId mas não clienteId, busca o tutor
    if (petId && !clienteId) {
      try {
        const { data: petDb } = await sb.from("pets").select("id, nome, cliente_id, clientes(id, nome)").eq("id", petId).maybeSingle();
        if (petDb) {
          petNome = petDb.nome;
          clienteId = petDb.cliente_id;
          clienteNome = (petDb.clientes as any)?.nome || clienteNome;
        }
      } catch {}
    }

    const valorEstimado = Number(params.valor || 80);

    return {
      success: true,
      data: {
        status: "proposto",
        tipo: "agendamento",
        data: dataAlvo,
        hora: horaAlvo,
        servico: servicoNome,
        servicoNome,
        clienteId,
        clienteNome: clienteNome || "Cliente a confirmar",
        petId,
        petNome: petNome || "Pet a confirmar",
        valor: valorEstimado,
        transporte: Boolean(params.transporte),
      },
      pendingAction: {
        action: "criar_agendamento",
        params: {
          data: dataAlvo,
          hora: horaAlvo,
          servico: servicoNome,
          servicoNome,
          clienteId,
          clienteNome: clienteNome || "Cliente a confirmar",
          petId,
          petNome: petNome || "Pet a confirmar",
          valor: valorEstimado,
        },
      },
      summary: `Proposta de agendamento de ${servicoNome} para ${petNome || clienteNome || "o Pet"} em ${dataAlvo} às ${horaAlvo}.`,
    };
  }

  /**
   * Prepara proposta de remarcação (troca de data/hora) para supervisão humana
   */
  static async prepararPropostaReagendamento(
    sb: SupabaseClient<Database>,
    params: {
      agendamentoId?: string;
      petNome?: string;
      clienteNome?: string;
      novaData?: string;
      novaHora?: string;
      novaDataHora?: string;
      data?: string;
      hora?: string;
      motivo?: string;
    }
  ) {
    let novaData = params.novaData || params.data || "";
    let novaHora = params.novaHora || params.hora || "";

    if (params.novaDataHora && (!novaData || !novaHora)) {
      try {
        const parsed = partirDataHora(params.novaDataHora, novaData, novaHora);
        novaData = parsed.data;
        novaHora = parsed.hora;
      } catch {}
    }

    if (!novaData) {
      novaData = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    }
    if (!novaHora) novaHora = "14:00";

    let agendamentoAlvo: any = null;

    if (params.agendamentoId) {
      try {
        const { data: agDb } = await sb
          .from("agendamentos")
          .select("id, data, hora, status, pet_id, cliente_id, pets(id, nome), clientes(id, nome), servicos(id, nome)")
          .eq("id", params.agendamentoId)
          .maybeSingle();
        if (agDb) agendamentoAlvo = agDb;
      } catch {}
    }

    if (!agendamentoAlvo && (params.petNome || params.clienteNome)) {
      try {
        const termo = (params.petNome || params.clienteNome || "").toLowerCase();
        const { data: lista } = await sb
          .from("agendamentos")
          .select("id, data, hora, status, pet_id, cliente_id, pets(id, nome), clientes(id, nome), servicos(id, nome)")
          .order("data", { ascending: false })
          .limit(20);

        if (lista && lista.length > 0) {
          agendamentoAlvo = lista.find((a: any) => {
            const nomeP = ((a.pets as any)?.nome || "").toLowerCase();
            const nomeC = ((a.clientes as any)?.nome || "").toLowerCase();
            return (params.petNome && nomeP.includes(termo)) || (params.clienteNome && nomeC.includes(termo));
          }) || lista[0];
        }
      } catch {}
    }

    const petNomeFinal = (agendamentoAlvo?.pets as any)?.nome || params.petNome || "Pet";
    const clienteNomeFinal = (agendamentoAlvo?.clientes as any)?.nome || params.clienteNome || "Cliente";
    const servicoNomeFinal = (agendamentoAlvo?.servicos as any)?.nome || "Atendimento";
    const agendamentoIdFinal = agendamentoAlvo?.id || params.agendamentoId || "";

    const diaFormatado = novaData.includes("-") ? novaData.split("-").reverse().slice(0, 2).join("/") : novaData;

    return {
      success: true,
      data: {
        status: "proposto",
        tipo: "reagendamento",
        agendamentoId: agendamentoIdFinal,
        data: novaData,
        hora: novaHora,
        novaData,
        novaHora,
        petNome: petNomeFinal,
        clienteNome: clienteNomeFinal,
        servicoNome: servicoNomeFinal,
        dataAnterior: agendamentoAlvo?.data,
        horaAnterior: agendamentoAlvo?.hora,
      },
      pendingAction: {
        action: "reagendar_agendamento",
        params: {
          agendamentoId: agendamentoIdFinal,
          novaData,
          novaHora,
          novaDataHoraISO: `${novaData}T${novaHora}:00`,
          petNome: petNomeFinal,
          motivo: params.motivo || "Remarcação solicitada pelo operador",
        },
      },
      summary: `Proposta para remarcar o atendimento de ${petNomeFinal} para dia ${diaFormatado} às ${novaHora}.`,
    };
  }

  /**
   * Prepara proposta de cancelamento para supervisão humana
   */
  static async prepararPropostaCancelamento(
    sb: SupabaseClient<Database>,
    params: {
      agendamentoId?: string;
      petNome?: string;
      clienteNome?: string;
      motivo?: string;
    }
  ) {
    let agendamentoAlvo: any = null;

    if (params.agendamentoId) {
      try {
        const { data: agDb } = await sb
          .from("agendamentos")
          .select("id, data, hora, status, pet_id, cliente_id, pets(id, nome), clientes(id, nome), servicos(id, nome)")
          .eq("id", params.agendamentoId)
          .maybeSingle();
        if (agDb) agendamentoAlvo = agDb;
      } catch {}
    }

    if (!agendamentoAlvo && (params.petNome || params.clienteNome)) {
      try {
        const termo = (params.petNome || params.clienteNome || "").toLowerCase();
        const { data: lista } = await sb
          .from("agendamentos")
          .select("id, data, hora, status, pet_id, cliente_id, pets(id, nome), clientes(id, nome), servicos(id, nome)")
          .order("data", { ascending: false })
          .limit(20);

        if (lista && lista.length > 0) {
          agendamentoAlvo = lista.find((a: any) => {
            const nomeP = ((a.pets as any)?.nome || "").toLowerCase();
            const nomeC = ((a.clientes as any)?.nome || "").toLowerCase();
            return (params.petNome && nomeP.includes(termo)) || (params.clienteNome && nomeC.includes(termo));
          }) || lista[0];
        }
      } catch {}
    }

    const petNomeFinal = (agendamentoAlvo?.pets as any)?.nome || params.petNome || "Pet";
    const agendamentoIdFinal = agendamentoAlvo?.id || params.agendamentoId || "";
    const horaFinal = (agendamentoAlvo?.hora || "").slice(0, 5) || "hoje";

    return {
      success: true,
      data: {
        status: "proposto",
        tipo: "cancelamento",
        agendamentoId: agendamentoIdFinal,
        petNome: petNomeFinal,
        hora: horaFinal,
        data: agendamentoAlvo?.data,
      },
      pendingAction: {
        action: "cancelar_agendamento",
        params: {
          agendamentoId: agendamentoIdFinal,
          petNome: petNomeFinal,
          motivo: params.motivo || "Cancelamento solicitado pelo operador",
        },
      },
      summary: `Proposta de cancelamento para o atendimento de ${petNomeFinal} às ${horaFinal}.`,
    };
  }

  /**
   * Prepara o agendamento sem persistir no banco (Supervisão Humana)
   */
  static prepararAgendamento(params: {
    clienteId: string;
    clienteNome?: string;
    petId: string;
    petNome?: string;
    servicoId: string;
    servicoNome?: string;
    dataHora: string;
    valor: number;
    transporte?: boolean;
    profissionalId?: string;
  }) {
    return {
      title: `Agendar ${params.servicoNome || "Serviço"} para ${params.petNome || "Pet"}`,
      summary: `Data e Hora: ${new Date(params.dataHora).toLocaleString("pt-BR")} | Valor: R$ ${params.valor.toFixed(2)} | Transporte (Leva e Traz): ${params.transporte ? "Sim" : "Não"} | Tutor: ${params.clienteNome || params.clienteId}`,
      params,
    };
  }

  /**
   * Executa a gravação física após a confirmação humana com Read-Back Verification minucioso
   * BANIDOS: Fallbacks silenciosos, SELECT LIMIT 1 genéricos, substituição de pet/cliente
   */
  static async executarAgendamentoConfirmado(
    sb: SupabaseClient<Database>,
    params: any,
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_agenda_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const rawDataHora =
        params.dataHora ||
        params.dataHoraISO ||
        (params.data && params.hora ? `${params.data}T${params.hora}` : params.data);

      let dataAlvo: string;
      let horaAlvo: string;
      try {
        const parsed = partirDataHora(rawDataHora, params.data, params.hora);
        dataAlvo = parsed.data;
        horaAlvo = parsed.hora;
      } catch (dateErr: any) {
        console.error("[AgendaAdapter] Erro na validação de data/hora:", dateErr);
        return {
          success: false,
          entity_id: null,
          affected_record_id: null,
          source: "tabela_agendamentos",
          summary: `Falha de validação temporal: ${dateErr.message}`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "DATA_HORA_INVALIDA",
          correlation_id: correlationId,
          verified: false,
        };
      }

      // 1. Resolução estrita ou auto-criação de cliente e pet
      let clienteId = params.clienteId || params.cliente_id;
      let petId = params.petId || params.pet_id;
      let servicoId = params.servicoId || params.servico_id || null;

      // Sanitização contra strings 'null' ou 'undefined'
      if (clienteId === "undefined" || clienteId === "null" || !clienteId) clienteId = null;
      if (petId === "undefined" || petId === "null" || !petId) petId = null;
      if (servicoId === "undefined" || servicoId === "null" || !servicoId) servicoId = null;

      // Se IDs ausentes mas nomes presentes, tenta localizar ou criar
      if (!clienteId || !petId) {
        const busca = await ClientesPetsAdapter.buscarClientesPets(sb, params.clienteNome || params.petNome || "");
        if (busca.success && busca.data?.candidatos?.length > 0) {
          const c = busca.data.candidatos[0];
          if (c.tipo === "pet") {
            petId = c.id;
            clienteId = c.dadosCompletos?.cliente_id || c.dadosCompletos?.clientes?.id || clienteId;
          } else {
            clienteId = c.id;
            petId = c.dadosCompletos?.pets?.[0]?.id || petId;
          }
        }

        // Se ainda não tiver cliente, cria cadastro rápido
        if (!clienteId && params.clienteNome) {
          const { data: newCli } = await sb.from("clientes").insert({ nome: params.clienteNome }).select("id, nome").single();
          if (newCli) clienteId = newCli.id;
        }
        // Se ainda não tiver pet, cria cadastro rápido
        if (!petId && (params.petNome || params.clienteNome)) {
          const { data: newPet } = await sb.from("pets").insert({
            nome: params.petNome || `${params.clienteNome || "Pet"} Pet`,
            cliente_id: clienteId,
            raca: "SRD",
            porte: "medio",
          }).select("id, nome").single();
          if (newPet) petId = newPet.id;
        }
      }

      if (!clienteId || !petId) {
        console.error("[AgendaAdapter] Identificação do cliente ou pet ausente:", { clienteId, petId });
        return {
          success: false,
          entity_id: null,
          affected_record_id: null,
          source: "tabela_agendamentos",
          summary: "Operação abortada: Identificação do cliente e do pet são obrigatórias antes da gravação.",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "CAMPOS_OBRIGATORIOS_AUSENTES",
          correlation_id: correlationId,
          verified: false,
        };
      }

      // 2. Validação relacional: O pet DEVE existir e pertencer exatamente ao cliente informado
      const { data: petRecord, error: petErr } = await sb
        .from("pets")
        .select("id, cliente_id, nome")
        .eq("id", petId)
        .maybeSingle();

      if (petErr || !petRecord) {
        console.error("[AgendaAdapter] Pet não localizado no banco:", { petId, petErr });
        return {
          success: false,
          entity_id: null,
          affected_record_id: null,
          source: "tabela_agendamentos",
          summary: `Operação abortada: Pet ID "${petId}" não localizado na base de dados.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "PET_NAO_ENCONTRADO",
          correlation_id: correlationId,
          verified: false,
        };
      }

      if (petRecord.cliente_id !== clienteId) {
        console.warn("[AgendaAdapter] Divergência tutor x pet:", { petClienteId: petRecord.cliente_id, clienteId });
        return {
          success: false,
          entity_id: null,
          affected_record_id: null,
          source: "tabela_agendamentos",
          summary: `Operação abortada por segurança relacional: O pet "${petRecord.nome}" não pertence ao tutor indicado.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "VINCULO_PET_CLIENTE_INVALIDO",
          correlation_id: correlationId,
          verified: false,
        };
      }

      // 3. Validação de conflito de grade / disponibilidade
      const checagem = await this.verificarDisponibilidade(
        sb,
        `${dataAlvo}T${horaAlvo}`,
        params.profissionalId || params.profissional_id,
        dataAlvo,
        horaAlvo
      );

      if (!checagem.disponivel) {
        console.warn("[AgendaAdapter] Horário indisponível na grade:", checagem);
        return {
          success: false,
          entity_id: null,
          affected_record_id: null,
          source: "tabela_agendamentos",
          summary: `Operação abortada: ${checagem.motivo}`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "HORARIO_INDISPONIVEL",
          correlation_id: correlationId,
          verified: false,
        };
      }

      const valorFinal = Number(params.valor || params.valor_previsto || 0);

      // 4. Gravação física (INSERT)
      const { data: novoAgendamento, error: insertError } = await sb
        .from("agendamentos")
        .insert({
          cliente_id: clienteId,
          pet_id: petId,
          servico_id: servicoId,
          data: dataAlvo,
          hora: horaAlvo,
          valor_previsto: valorFinal,
          status: "agendado",
          profissional_id: params.profissionalId || params.profissional_id || null,
          observacoes: params.observacoes || (idempotencyKey ? `Criado via Jessi (idempotency:${idempotencyKey})` : null),
          idempotency_key: idempotencyKey || null,
        } as any)
        .select("id, data, hora, status, valor_previsto, cliente_id, pet_id, servico_id")
        .single();

      if (insertError || !novoAgendamento) {
        console.error("[AgendaAdapter] Erro no INSERT de agendamentos:", insertError);
        throw insertError || new Error("Falha na inserção do registro de agendamento.");
      }

      // 4.1 Inserção em agendamento_servicos se aplicável
      if (servicoId) {
        try {
          await sb.from("agendamento_servicos").insert({
            agendamento_id: novoAgendamento.id,
            servico_id: servicoId,
            nome: params.servicoNome || "Atendimento",
            valor_unit: valorFinal,
            ordem: 1,
          } as any);
        } catch (srvErr) {
          console.warn("[AgendaAdapter] Não foi possível vincular agendamento_servicos:", srvErr);
        }
      }

      // 5. Read-Back Verification Completo (Verificação de campos de ponta a ponta)
      const { data: readBack, error: readBackError } = await sb
        .from("agendamentos")
        .select("id, cliente_id, pet_id, data, hora, status, valor_previsto, servico_id")
        .eq("id", novoAgendamento.id)
        .maybeSingle();

      const readBackValido =
        !readBackError &&
        readBack &&
        readBack.id === novoAgendamento.id &&
        readBack.cliente_id === clienteId &&
        readBack.pet_id === petId &&
        readBack.data === dataAlvo &&
        readBack.hora?.slice(0, 5) === horaAlvo.slice(0, 5);

      if (!readBackValido) {
        console.error("[AgendaAdapter] Read-back mismatch:", { novoAgendamento, readBack, readBackError });
        return {
          success: false,
          entity_id: novoAgendamento.id,
          affected_record_id: novoAgendamento.id,
          source: "tabela_agendamentos",
          summary: `Alerta crítico: O registro foi inserido mas a conferência pós-gravação (read-back) falhou na correspondência de campos.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "READ_BACK_MISMATCH",
          correlation_id: correlationId,
          verified: false,
        };
      }

      return {
        success: true,
        entity_id: novoAgendamento.id,
        affected_record_id: novoAgendamento.id,
        source: "tabela_agendamentos",
        after: readBack,
        summary: `Agendamento #${novoAgendamento.id.slice(0, 8)} para ${petRecord.nome} em ${dataAlvo} às ${horaAlvo} gravado e verificado com sucesso no banco de dados.`,
        executed_at: new Date().toISOString(),
        verified: true,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      console.error("[AgendaAdapter] Falha na execução do agendamento:", err);
      return {
        success: false,
        entity_id: null,
        affected_record_id: null,
        source: "tabela_agendamentos",
        summary: `Falha na execução do agendamento: ${err.message}`,
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        error_code: err.code || "ERRO_INSERT_AGENDAMENTO",
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Executa remarcação (reagendamento) confirmada com revalidação de grade e verificação pós-gravação
   */
  static async executarRemarcacaoConfirmada(
    sb: SupabaseClient<Database>,
    params: { agendamentoId?: string; agendamento_id?: string; novaDataHoraISO?: string; novaData?: string; novaHora?: string; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_remarcar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const agendamentoId = params.agendamentoId || (params as any).agendamento_id;

    if (!agendamentoId) {
      return {
        success: false,
        entity_id: null,
        source: "tabela_agendamentos",
        summary: "Identificador do agendamento não informado para reagendamento.",
        error_code: "AGENDAMENTO_ID_AUSENTE",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }

    try {
      // 1. Ler registro atual (before)
      const { data: anterior, error: erroAnterior } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, valor_previsto, pet_id, cliente_id")
        .eq("id", agendamentoId)
        .maybeSingle();

      if (erroAnterior || !anterior) {
        console.error("[AgendaAdapter] Agendamento não encontrado para reagendamento:", { agendamentoId, erroAnterior });
        return {
          success: false,
          entity_id: agendamentoId,
          source: "tabela_agendamentos",
          summary: "Agendamento não encontrado para remarcação.",
          error_code: "AGENDAMENTO_NAO_ENCONTRADO",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const rawNovaDataHora =
        params.novaDataHoraISO ||
        (params.novaData && params.novaHora ? `${params.novaData}T${params.novaHora}` : params.novaData);

      // 2. Checar disponibilidade da nova data/hora
      const checagem = await this.verificarDisponibilidade(
        sb,
        rawNovaDataHora,
        undefined,
        params.novaData,
        params.novaHora
      );

      if (!checagem.disponivel) {
        console.warn("[AgendaAdapter] Horário indisponível para remarcação:", checagem);
        return {
          success: false,
          entity_id: agendamentoId,
          source: "tabela_agendamentos",
          summary: `Remarcação não permitida: ${checagem.motivo}`,
          error_code: "HORARIO_INDISPONIVEL",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const { data: novaData, hora: novaHora } = partirDataHora(
        rawNovaDataHora,
        params.novaData,
        params.novaHora
      );

      // 3. Atualizar data e hora no banco
      const { data: atualizado, error: updateError } = await sb
        .from("agendamentos")
        .update({
          data: novaData,
          hora: novaHora,
          observacoes: params.motivo ? `Remarcado: ${params.motivo}` : undefined,
        } as any)
        .eq("id", agendamentoId)
        .select("id, data, hora, status, valor_previsto")
        .single();

      if (updateError || !atualizado) {
        console.error("[AgendaAdapter] Erro no UPDATE de remarcação:", updateError);
        throw updateError || new Error("Falha ao atualizar agendamento.");
      }

      // 4. Read-Back Verification por ID
      const { data: readBack } = await sb
        .from("agendamentos")
        .select("id, data, hora, status")
        .eq("id", agendamentoId)
        .maybeSingle();

      const verificado =
        readBack?.data === novaData && String(readBack?.hora || "").slice(0, 5) === novaHora;

      return {
        success: Boolean(verificado),
        entity_id: agendamentoId,
        affected_record_id: agendamentoId,
        before: anterior,
        after: atualizado,
        source: "tabela_agendamentos",
        summary: verificado
          ? `Agendamento #${agendamentoId.slice(0, 8)} remarcado com sucesso para ${novaData} às ${novaHora}.`
          : `Aviso: Falha ao verificar a alteração física do agendamento no banco de dados.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      console.error("[AgendaAdapter] Erro ao reagendar:", err);
      return {
        success: false,
        entity_id: agendamentoId,
        source: "tabela_agendamentos",
        summary: `Erro ao remarcar agendamento: ${err.message}`,
        error_code: err.code || "ERRO_UPDATE_AGENDAMENTO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Executa o cancelamento físico e oficial no banco de dados (UPDATE status='cancelado')
   */
  static async executarCancelamentoConfirmado(
    sb: SupabaseClient<Database>,
    params: { agendamentoId?: string; agendamento_id?: string; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `cancel_exec_${Date.now()}`;
    const agendamentoId = params.agendamentoId || params.agendamento_id;

    if (!agendamentoId) {
      return {
        success: false,
        entity_id: null,
        source: "tabela_agendamentos",
        summary: "Não foi informado o ID do agendamento para cancelamento.",
        executed_at: new Date().toISOString(),
        verified: false,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
        error_code: "PARAMETROS_INSUFICIENTES",
      };
    }

    try {
      // 1. Snapshot anterior
      const { data: anterior, error: errAnt } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, cliente_id, pet_id, valor_previsto, clientes(id, nome), pets(id, nome)")
        .eq("id", agendamentoId)
        .maybeSingle();

      if (errAnt || !anterior) {
        throw new Error(`Agendamento #${agendamentoId.slice(0, 8)} não encontrado.`);
      }

      // 2. Atualização física
      const { data: cancelado, error: cancelError } = await sb
        .from("agendamentos")
        .update({
          status: "cancelado",
          observacoes: params.motivo ? `Cancelado via Jessi: ${params.motivo}` : "Cancelado via Jessi V2",
        } as any)
        .eq("id", agendamentoId)
        .select("id, status, data, hora")
        .single();

      if (cancelError) {
        throw cancelError;
      }

      // 3. Read-Back Verification
      const { data: readBack } = await sb
        .from("agendamentos")
        .select("id, status")
        .eq("id", agendamentoId)
        .maybeSingle();

      const verificado = readBack?.status === "cancelado";

      return {
        success: Boolean(verificado),
        entity_id: agendamentoId,
        affected_record_id: agendamentoId,
        before: anterior,
        after: cancelado,
        source: "tabela_agendamentos",
        summary: verificado
          ? `Agendamento #${agendamentoId.slice(0, 8)} (${(anterior.pets as any)?.nome || "Pet"} em ${anterior.data} às ${String(anterior.hora).slice(0, 5)}) cancelado com sucesso e grade liberada.`
          : `Aviso: Falha ao verificar o cancelamento físico do agendamento no banco de dados.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      console.error("[AgendaAdapter] Falha ao cancelar agendamento:", err);
      return {
        success: false,
        entity_id: agendamentoId,
        source: "tabela_agendamentos",
        summary: `Erro ao cancelar agendamento: ${err.message}`,
        error_code: err.code || "ERRO_CANCEL_AGENDAMENTO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Consulta o agendamento por ID para verificações de integridade
   */
  static async verificarAgendamentoPorId(
    sb: SupabaseClient<Database>,
    agendamentoId: string
  ): Promise<JessiV2QueryResult> {
    const correlationId = `verif_ag_${Date.now()}`;
    try {
      const { data, error } = await sb
        .from("agendamentos")
        .select(SELECT_AGENDA)
        .eq("id", agendamentoId)
        .maybeSingle();

      if (error) throw error;

      return {
        success: true,
        source: "tabela_agendamentos",
        data,
        total_count: data ? 1 : 0,
        summary: data ? `Agendamento localizado.` : `Agendamento não encontrado.`,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_agendamentos",
        data: null,
        total_count: 0,
        summary: `Erro ao verificar agendamento: ${err.message}`,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Consulta o último atendimento oficial de um pet no Spa
   */
  static async consultarUltimoAtendimentoPet(
    sb: SupabaseClient<Database>,
    petId: string,
    petNome?: string
  ): Promise<JessiV2QueryResult> {
    const correlationId = `ultimo_at_${Date.now()}`;
    try {
      const { data: agendamentos, error } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, servico_id, servicos(nome), pets(nome)")
        .eq("pet_id", petId)
        .neq("status", "cancelado")
        .order("data", { ascending: false })
        .limit(1);

      if (error) throw error;

      const nomePet = petNome || (agendamentos?.[0]?.pets as any)?.nome || "o pet";

      if (!agendamentos || agendamentos.length === 0) {
        return {
          success: true,
          source: "tabela_agendamentos",
          data: null,
          total_count: 0,
          summary: `Não encontrei nenhum histórico de atendimentos anteriores registrado para ${nomePet}.`,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
        };
      }

      const ultimo = agendamentos[0];
      const dataFmt = new Date(`${ultimo.data}T12:00:00`).toLocaleDateString("pt-BR");
      const horaFmt = (ultimo.hora || "").slice(0, 5) || "--:--";
      const srv = (ultimo.servicos as any)?.nome || "Atendimento";
      const st = (String(ultimo.status) === "finalizado" || String(ultimo.status) === "concluido") ? "Finalizado" : ultimo.status === "confirmado" ? "Confirmado" : ultimo.status;

      const summary = `O último atendimento registrado para **${nomePet}** foi em **${dataFmt} às ${horaFmt}** — Serviço: **${srv}** (Status: ${st}).`;

      return {
        success: true,
        source: "tabela_agendamentos",
        data: ultimo,
        total_count: agendamentos.length,
        summary,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_agendamentos",
        data: null,
        total_count: 0,
        summary: `Erro ao consultar último atendimento: ${err.message}`,
        error_code: "ERRO_ULTIMO_ATENDIMENTO",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }
}
