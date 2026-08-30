import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult, JessiMutationResult } from "../jessi-contracts";
import { buscarDadosAgenda, buscarDisponibilidade } from "../ia-consultas.server";
import { criarAgendamentoIA, remarcarAgendamentoIA, cancelarAgendamentoIA } from "../ia-acoes.server";
import { gerarChaveIdempotencia, validarGravacaoReal } from "../jessi-guardrails";

/**
 * Adaptadores de Agenda para a Jessi
 */

export async function consultarAgendaJessi(
  sb: SupabaseClient<Database>,
  params: { data?: string; status?: string; cliente_id?: string }
): Promise<JessiQueryResult> {
  const dataRef = params.data || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const res = await buscarDadosAgenda(sb, {
    data: dataRef,
    status: params.status,
    cliente_id: params.cliente_id,
  });

  return {
    success: res.success,
    source: "agenda",
    data: res.data,
    total_count: Array.isArray(res.data) ? res.data.length : 0,
    filters_applied: { data: dataRef, status: params.status },
    executed_at: new Date().toISOString(),
    summary: `Agenda consultada para ${dataRef}. Encontrados ${Array.isArray(res.data) ? res.data.length : 0} agendamentos.`,
  };
}

export async function consultarDisponibilidadeJessi(
  sb: SupabaseClient<Database>,
  params: { data?: string; servico_id?: string }
): Promise<JessiQueryResult> {
  const dataRef = params.data || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const res = await buscarDisponibilidade(sb, {
    data: dataRef,
    servico_id: params.servico_id,
  });

  return {
    success: res.success,
    source: "disponibilidade",
    data: res.data,
    filters_applied: { data: dataRef },
    executed_at: new Date().toISOString(),
    summary: `Disponibilidade verificada para ${dataRef}.`,
  };
}

export async function criarAgendamentoJessi(
  sb: SupabaseClient<Database>,
  params: {
    cliente_id: string;
    pet_id: string;
    servico_id: string;
    data: string;
    hora: string;
    transporte?: boolean;
    observacoes?: string;
  }
): Promise<JessiMutationResult> {
  const idempotencyKey = gerarChaveIdempotencia("agendamento", `${params.pet_id}_${params.data}_${params.hora}`);

  const res = await criarAgendamentoIA(sb, {
    cliente_id: params.cliente_id,
    pet_id: params.pet_id,
    servico_id: params.servico_id,
    data: params.data,
    hora: params.hora,
    transporte: params.transporte,
    observacoes: params.observacoes,
    idempotency_key: idempotencyKey,
  });

  const validacao = res.affected_record_id
    ? await validarGravacaoReal(sb, "agendamentos", res.affected_record_id)
    : { verificado: false, dados: null };

  return {
    success: res.success,
    source: "criar_agendamento",
    affected_record_id: res.affected_record_id,
    after: res.data,
    verified: validacao.verificado,
    idempotency_key: idempotencyKey,
    executed_at: new Date().toISOString(),
    summary: `Agendamento criado com sucesso para ${params.data} às ${params.hora}.`,
  };
}

export async function reagendarJessi(
  sb: SupabaseClient<Database>,
  params: { agendamento_id: string; nova_data: string; nova_hora: string; motivo?: string }
): Promise<JessiMutationResult> {
  const res = await remarcarAgendamentoIA(sb, {
    agendamento_id: params.agendamento_id,
    nova_data: params.nova_data,
    nova_hora: params.nova_hora,
    motivo: params.motivo,
  });

  return {
    success: res.success,
    source: "reagendar",
    affected_record_id: params.agendamento_id,
    after: res.data,
    verified: true,
    executed_at: new Date().toISOString(),
    summary: `Agendamento remarcado para ${params.nova_data} às ${params.nova_hora}.`,
  };
}

export async function cancelarAgendamentoJessi(
  sb: SupabaseClient<Database>,
  params: { agendamento_id: string; motivo: string }
): Promise<JessiMutationResult> {
  const res = await cancelarAgendamentoIA(sb, {
    agendamento_id: params.agendamento_id,
    motivo: params.motivo,
  });

  return {
    success: res.success,
    source: "cancelar_agendamento",
    affected_record_id: params.agendamento_id,
    after: res.data,
    verified: true,
    executed_at: new Date().toISOString(),
    summary: `Agendamento cancelado com sucesso.`,
  };
}
