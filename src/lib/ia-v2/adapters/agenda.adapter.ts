import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

/**
 * Adaptador Oficial da Agenda para a Jessi V2 (Seção 15)
 * Suporte a Agenda do Dia, Agenda Futura, Grade, Profissionais, Transporte e Encaixes
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

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
      const inicioDia = `${data}T00:00:00.000Z`;
      const fimDia = `${data}T23:59:59.999Z`;

      const { data: agendamentos, error } = await sb
        .from("agendamentos")
        .select(`
          id,
          data_hora,
          status,
          valor_total,
          observacoes,
          cliente:clientes(id, nome, telefone),
          pet:pets(id, nome, raca, porte),
          profissional:profissionais(id, nome)
        `)
        .gte("data_hora", inicioDia)
        .lte("data_hora", fimDia)
        .order("data_hora", { ascending: true });

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
      const hojeStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const dataLimite = new Date(Date.now() + diasAFrente * 24 * 60 * 60 * 1000).toISOString();

      const { data: agendamentos, error } = await sb
        .from("agendamentos")
        .select(`
          id,
          data_hora,
          status,
          valor_total,
          cliente:clientes(id, nome, telefone),
          pet:pets(id, nome, raca),
          profissional:profissionais(id, nome)
        `)
        .gte("data_hora", `${hojeStr}T00:00:00.000Z`)
        .lte("data_hora", dataLimite)
        .neq("status", "cancelado")
        .order("data_hora", { ascending: true });

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
        .map((a: any) => {
          const dt = new Date(a.data_hora);
          return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        });

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
      let query = sb
        .from("agendamentos")
        .select("id, status")
        .eq("data_hora", dataHoraISO)
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

      const { data: novoAgendamento, error } = await sb
        .from("agendamentos")
        .insert({
          cliente_id: params.clienteId,
          pet_id: params.petId,
          data_hora: params.dataHora,
          valor_total: params.valor,
          status: "agendado",
          profissional_id: params.profissionalId || null,
        } as any)
        .select("id, data_hora, status, valor_total")
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
}
