import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

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

      if (total === 0) {
        summary = `Não há nenhum agendamento registrado para a data ${data}. A grade está totalmente livre.`;
      } else {
        const itens = (agendamentos || []).map((ag: any) => {
          const horaFmt = (ag.hora || "").slice(0, 5) || "--:--";
          const pet = ag.pets?.nome || "Pet";
          const raca = ag.pets?.raca ? ` (${ag.pets.raca})` : "";
          const tutor = ag.clientes?.nome ? ` • Tutor: ${ag.clientes.nome}` : "";
          const srv = ag.servicos?.nome || "Atendimento";
          const st = ag.status === "confirmado" ? "Confirmado" : ag.status === "em_atendimento" ? "Em Atendimento" : ag.status === "concluido" ? "Concluído" : "Aguardando confirmação";
          const transp = ag.leva_traz_modalidade && ag.leva_traz_modalidade !== "nao_utilizar" ? " 🚐 (Leva e Traz)" : "";
          return `• ${horaFmt} — **${pet}**${raca} • ${srv}${tutor} • Status: ${st}${transp}`;
        });

        summary = `Encontrei ${total} agendamento(s) para ${data}:\n\n${itens.join("\n")}`;
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

      // 1. Validação estrita de identificadores obrigatórios
      let clienteId = params.clienteId || params.cliente_id;
      let petId = params.petId || params.pet_id;
      let servicoId = params.servicoId || params.servico_id || null;

      // Sanitização contra strings 'null' ou 'undefined'
      if (clienteId === "undefined" || clienteId === "null" || !clienteId) clienteId = null;
      if (petId === "undefined" || petId === "null" || !petId) petId = null;
      if (servicoId === "undefined" || servicoId === "null" || !servicoId) servicoId = null;

      if (!clienteId || !petId) {
        return {
          success: false,
          entity_id: null,
          affected_record_id: null,
          source: "tabela_agendamentos",
          summary: "Operação abortada: Identificação do cliente e do pet são obrigatórias antes da execução física.",
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
          observacoes: params.observacoes || null,
        } as any)
        .select("id, data, hora, status, valor_previsto, cliente_id, pet_id, servico_id")
        .single();

      if (insertError || !novoAgendamento) {
        throw insertError || new Error("Falha na inserção do registro de agendamento.");
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
    params: { agendamentoId: string; novaDataHoraISO?: string; novaData?: string; novaHora?: string; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_remarcar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      // 1. Ler registro atual (before)
      const { data: anterior, error: erroAnterior } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, valor_previsto, pet_id, cliente_id")
        .eq("id", params.agendamentoId)
        .maybeSingle();

      if (erroAnterior || !anterior) {
        return {
          success: false,
          entity_id: params.agendamentoId,
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
        return {
          success: false,
          entity_id: params.agendamentoId,
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
        .eq("id", params.agendamentoId)
        .select("id, data, hora, status, valor_previsto")
        .single();

      if (updateError || !atualizado) throw updateError || new Error("Falha ao atualizar agendamento.");

      // 4. Read-Back Verification por ID
      const { data: readBack } = await sb
        .from("agendamentos")
        .select("id, data, hora, status")
        .eq("id", params.agendamentoId)
        .maybeSingle();

      const verificado =
        readBack?.data === novaData && String(readBack?.hora || "").slice(0, 5) === novaHora;

      return {
        success: true,
        entity_id: params.agendamentoId,
        affected_record_id: params.agendamentoId,
        before: anterior,
        after: atualizado,
        source: "tabela_agendamentos",
        summary: `Agendamento #${params.agendamentoId.slice(0, 8)} remarcado com sucesso para ${novaData} às ${novaHora}.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.agendamentoId,
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
   * Executa cancelamento confirmado de agendamento com verificação física e liberação de grade
   */
  static async executarCancelamentoConfirmado(
    sb: SupabaseClient<Database>,
    params: { agendamentoId: string; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_cancelar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const { data: anterior } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, valor_previsto")
        .eq("id", params.agendamentoId)
        .maybeSingle();

      if (!anterior) {
        return {
          success: false,
          entity_id: params.agendamentoId,
          source: "tabela_agendamentos",
          summary: "Agendamento não localizado para cancelamento.",
          error_code: "AGENDAMENTO_NAO_ENCONTRADO",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const { data: cancelado, error } = await sb
        .from("agendamentos")
        .update({
          status: "cancelado",
          observacoes: params.motivo ? `Cancelado pelo operador: ${params.motivo}` : undefined,
        } as any)
        .eq("id", params.agendamentoId)
        .select("id, data, hora, status, valor_previsto")
        .single();

      if (error || !cancelado) throw error || new Error("Falha ao cancelar agendamento.");

      // Read-back Verification
      const { data: readBack } = await sb
        .from("agendamentos")
        .select("id, status")
        .eq("id", params.agendamentoId)
        .maybeSingle();

      const verificado = readBack?.status === "cancelado";

      return {
        success: true,
        entity_id: params.agendamentoId,
        affected_record_id: params.agendamentoId,
        before: anterior,
        after: cancelado,
        source: "tabela_agendamentos",
        summary: `Agendamento #${params.agendamentoId.slice(0, 8)} cancelado e horário liberado na grade com sucesso.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.agendamentoId,
        source: "tabela_agendamentos",
        summary: `Erro ao cancelar agendamento: ${err.message}`,
        error_code: err.code || "ERRO_CANCELAMENTO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Consulta e verifica agendamento diretamente por ID (Read-Back Verification)
   */
  static async verificarAgendamentoPorId(
    sb: SupabaseClient<Database>,
    agendamentoId: string
  ): Promise<JessiV2QueryResult> {
    const correlationId = `verif_agenda_${Date.now()}`;
    try {
      const { data: agendamento, error } = await sb
        .from("agendamentos")
        .select(SELECT_AGENDA)
        .eq("id", agendamentoId)
        .maybeSingle();

      if (error || !agendamento) {
        return {
          success: false,
          source: "tabela_agendamentos",
          data: null,
          summary: `Agendamento #${agendamentoId} não encontrado no banco de dados.`,
          error_code: "AGENDAMENTO_NAO_ENCONTRADO",
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
        };
      }

      return {
        success: true,
        source: "tabela_agendamentos",
        data: agendamento,
        total_count: 1,
        summary: `Agendamento #${agendamento.id.slice(0, 8)} verificado: Status ${agendamento.status}, Data: ${agendamento.data} às ${String(agendamento.hora).slice(0, 5)}.`,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_agendamentos",
        data: null,
        summary: `Erro ao verificar agendamento: ${err.message}`,
        error_code: "ERRO_VERIFICACAO_AGENDAMENTO",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Consulta o último atendimento realizado ou registrado de um pet específico
   */
  static async consultarUltimoAtendimentoPet(
    sb: SupabaseClient<Database>,
    petId: string,
    petNome?: string
  ): Promise<JessiV2QueryResult> {
    const correlationId = `ultimo_atendimento_${Date.now()}`;
    try {
      const { data: agendamentos, error } = await sb
        .from("agendamentos")
        .select(SELECT_AGENDA)
        .eq("pet_id", petId)
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(3);

      if (error) throw error;

      const ultimo = agendamentos?.[0];
      const nomePet = petNome || (ultimo?.pets as any)?.nome || "o pet";

      if (!ultimo) {
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

      const dataFmt = new Date(`${ultimo.data}T12:00:00`).toLocaleDateString("pt-BR");
      const horaFmt = (ultimo.hora || "").slice(0, 5) || "--:--";
      const srv = (ultimo.servicos as any)?.nome || "Atendimento";
      const st = String(ultimo.status) === "concluido" ? "Concluído" : ultimo.status === "confirmado" ? "Confirmado" : ultimo.status;

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
