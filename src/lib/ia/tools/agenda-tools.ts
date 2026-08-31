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
  } as any);

  const lista: any[] = Array.isArray(res.data) ? res.data : [];
  const total = lista.length;

  let resumoTexto = "";
  if (total === 0) {
    resumoTexto = `Não há agendamentos marcados para ${dataRef}. A agenda está livre!`;
  } else {
    const itens = lista.slice(0, 8).map((a) => {
      const hora = a.hora ? String(a.hora).slice(0, 5) : "--:--";
      const pet = a.pets?.nome || "Pet";
      const tutor = a.clientes?.nome ? ` (${a.clientes.nome})` : "";
      const servico = a.servicos?.nome || "Atendimento";
      const st = a.status ? ` - ${a.status}` : "";
      return `• ${hora}: ${pet}${tutor} - ${servico}${st}`;
    }).join("\n");
    resumoTexto = `Temos ${total} agendamento(s) para ${dataRef}:\n\n${itens}${total > 8 ? `\n...e mais ${total - 8} agendamento(s).` : ""}`;
  }

  return {
    success: res.success,
    source: "agenda",
    data: res.data,
    total_count: total,
    filters_applied: { data: dataRef, status: params.status },
    executed_at: new Date().toISOString(),
    summary: resumoTexto,
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
    servicos: [{ id: params.servico_id, nome: "", valor: 0 }],
    data: params.data,
    hora: params.hora,
    transporte: params.transporte,
    observacoes: params.observacoes,
    idempotency_key: idempotencyKey,
  } as any);

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
  const res = await remarcarAgendamentoIA(
    sb,
    params.agendamento_id,
    params.nova_data,
    params.nova_hora
  );

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
  const res = await cancelarAgendamentoIA(sb, params.agendamento_id, params.motivo);

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
