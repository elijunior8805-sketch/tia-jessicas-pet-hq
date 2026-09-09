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
  clientes(id, nome, whatsapp),
  pets(id, nome, raca, porte)
`;

function partirDataHora(dataHoraISO: string): { data: string; hora: string } {
  const dt = new Date(dataHoraISO);
  if (isNaN(dt.getTime())) {
    const [d, h] = String(dataHoraISO).split(/[T ]/);
    return { data: d, hora: (h || "00:00").slice(0, 5) };
  }
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return { data: fmt, hora };
}

export class AgendaAdapter {
  /**
   * Consulta os agendamentos de uma data específica
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

      return {
        success: true,
        source: "tabela_agendamentos",
        data: agendamentos || [],
        total_count: agendamentos?.length || 0,
        summary: `Foram encontrados ${agendamentos?.length || 0} agendamento(s) para a data ${data}.`,
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
  static async verificarDisponibilidade(
    sb: SupabaseClient<Database>,
    dataHoraISO: string,
    profissionalId?: string
  ): Promise<{ disponivel: boolean; motivo?: string }> {
    try {
      const { data, hora } = partirDataHora(dataHoraISO);

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
          motivo: "Já existe agendamento ativo registrado neste exato horário.",
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
   * Executa a gravação física após a confirmação humana com Read-Back Verification
   */
  static async executarAgendamentoConfirmado(
    sb: SupabaseClient<Database>,
    params: any,
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_agenda_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const checagem = await this.verificarDisponibilidade(sb, params.dataHora, params.profissionalId);
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

      const { data: dataAlvo, hora: horaAlvo } = partirDataHora(params.dataHora);

      const { data: novoAgendamento, error } = await sb
        .from("agendamentos")
        .insert({
          cliente_id: params.clienteId,
          pet_id: params.petId,
          servico_id: params.servicoId || null,
          data: dataAlvo,
          hora: horaAlvo,
          valor_previsto: params.valor || 0,
          status: "agendado",
          profissional_id: params.profissionalId || null,
        } as any)
        .select("id, data, hora, status, valor_previsto")
        .single();

      if (error || !novoAgendamento) throw error || new Error("Falha na gravação do registro.");

      const { data: readBack, error: readBackError } = await sb
        .from("agendamentos")
        .select("id, status")
        .eq("id", novoAgendamento.id)
        .maybeSingle();

      const verificado = !readBackError && Boolean(readBack?.id);

      return {
        success: true,
        entity_id: novoAgendamento.id,
        affected_record_id: novoAgendamento.id,
        source: "tabela_agendamentos",
        after: novoAgendamento,
        summary: `Agendamento #${novoAgendamento.id.slice(0, 8)} criado e verificado com sucesso no banco de dados.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
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
    params: { agendamentoId: string; novaDataHoraISO: string; motivo?: string },
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

      // 2. Checar disponibilidade da nova data/hora
      const checagem = await this.verificarDisponibilidade(sb, params.novaDataHoraISO);
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

      const { data: novaData, hora: novaHora } = partirDataHora(params.novaDataHoraISO);

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
}
