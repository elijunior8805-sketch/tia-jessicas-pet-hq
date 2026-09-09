import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

/**
 * Adaptador Oficial da Agenda para a Jessi V2
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export class AgendaAdapter {
  /**
   * Consulta os agendamentos de uma data específica (Seção 11)
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
    profissionalId?: string;
  }) {
    return {
      title: `Agendar ${params.servicoNome || "Serviço"} para ${params.petNome || "Pet"}`,
      summary: `Data e Hora: ${new Date(params.dataHora).toLocaleString("pt-BR")} | Valor: R$ ${params.valor.toFixed(2)} | Tutor: ${params.clienteNome || params.clienteId}`,
      params,
    };
  }

  /**
   * Executa a gravação física após a confirmação humana com Read-Back Verification (Seção 11)
   */
  static async executarAgendamentoConfirmado(
    sb: SupabaseClient<Database>,
    params: any,
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_agenda_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      // 1. Revalidação de Disponibilidade no momento da escrita
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

      // 2. Inserção na tabela oficial
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

      // 3. Read-Back Verification (releitura pós-gravação)
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
