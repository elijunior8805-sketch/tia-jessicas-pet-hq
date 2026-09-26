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
    resumoTexto = `📅 **Agenda de ${dataRef}**: Não há agendamentos confirmados para este dia. A grade está 100% livre!\n\n💡 **Sugestão Jessi**: Você pode preencher esses horários acionando clientes inativos ou disparando convites pelo WhatsApp. Deseja que eu liste clientes sugeridos para hoje?`;
  } else {
    const confirmados = lista.filter(a => a.status === "confirmado" || a.status === "finalizado").length;
    const emAtendimento = lista.filter(a => a.status === "em_atendimento").length;
    const levaTraz = lista.filter(a => a.leva_traz_modalidade && a.leva_traz_modalidade !== "nao_utilizar").length;

    const itens = lista.slice(0, 8).map((a) => {
      const hora = a.hora ? String(a.hora).slice(0, 5) : "--:--";
      const pet = a.pets?.nome || "Pet";
      const tutor = a.clientes?.nome ? ` (${a.clientes.nome})` : "";
      const servico = a.servicos?.nome || "Atendimento";
      const st = a.status ? ` [${a.status}]` : "";
      const lt = a.leva_traz_modalidade && a.leva_traz_modalidade !== "nao_utilizar" ? " 🚐" : "";
      return `• **${hora}**: ${pet}${tutor} — ${servico}${lt}${st}`;
    }).join("\n");

    const header = `📋 **Visão Executiva da Agenda (${dataRef})**:\n- **Total agendados**: ${total} (${confirmados} confirmados, ${emAtendimento} em atendimento)\n${levaTraz > 0 ? `- **Leva & Traz**: ${levaTraz} viagens programadas\n` : ""}\n`;
    resumoTexto = `${header}**Atendimentos programados:**\n${itens}${total > 8 ? `\n...e mais ${total - 8} agendamento(s).` : ""}`;
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

  const slots: string[] = res.data?.vagas_disponiveis || [];
  const total = slots.length;

  const manha = slots.filter((s) => {
    const hora = parseInt(s.split(":")[0], 10);
    return hora < 12;
  });

  const tarde = slots.filter((s) => {
    const hora = parseInt(s.split(":")[0], 10);
    return hora >= 12;
  });

  let resumoTexto = "";
  if (total === 0) {
    resumoTexto = `📅 **Disponibilidade para ${dataRef}**:\nGrade completa! Não temos horários livres neste dia. Deseja registrar encaixe ou consultar o dia seguinte?`;
  } else {
    const manhaTxt = manha.length > 0 ? `☀️ **Manhã (${manha.length} vagas)**: ${manha.join(", ")}` : "☀️ **Manhã**: Sem vagas";
    const tardeTxt = tarde.length > 0 ? `🌤️ **Tarde (${tarde.length} vagas)**: ${tarde.join(", ")}` : "🌤️ **Tarde**: Sem vagas";
    
    resumoTexto = `✨ **Horários Livres Encontrados (${dataRef})**:\nEncontrei **${total} horários disponíveis** na grade operacional:\n\n${manhaTxt}\n${tardeTxt}\n\n💡 **Recomendação Estratégica**: Clique em um horário no card abaixo para agendar imediatamente ou peça *"Sugerir encaixes"* para convidar clientes inativos via WhatsApp.`;
  }

  return {
    success: res.success,
    source: "disponibilidade",
    data: {
      tipo: "disponibilidade",
      data: dataRef,
      totalVagas: total,
      vagas_disponiveis: slots,
      manha,
      tarde,
      sugestao: res.data?.sugestao || slots.slice(0, 3),
    },
    filters_applied: { data: dataRef },
    executed_at: new Date().toISOString(),
    summary: resumoTexto,
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
