import { Database } from "@/integrations/supabase/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { createIAResponse } from "./ia-retorno.server";

type AgendamentoStatus = Database["public"]["Enums"]["agendamento_status"];
type LevaTrazModalidade = Database["public"]["Enums"]["leva_traz_modalidade"];

export async function validarDisponibilidadeReal(
  sb: SupabaseClient<Database>,
  params: {
    data: string;
    hora: string;
    pet_id: string;
    cliente_id: string;
    profissional_id?: string;
    servicos: string[];
  }
) {
  const { data: duplicados, error: errD } = await sb
    .from("agendamentos")
    .select("id")
    .eq("cliente_id", params.cliente_id)
    .eq("pet_id", params.pet_id)
    .eq("data", params.data)
    .eq("hora", params.hora)
    .not("status", "eq", "cancelado");

  if (errD) throw errD;
  
  if (duplicados && duplicados.length > 0) {
    return createIAResponse({
      success: false,
      action: 'validar_disponibilidade',
      warnings: ["Já existe um agendamento idêntico para este pet neste horário."]
    });
  }

  const { data: ocupados, error: errO } = await sb
    .from("agendamentos")
    .select("id, pets(nome)")
    .eq("data", params.data)
    .eq("hora", params.hora)
    .not("status", "eq", "cancelado");

  if (errO) throw errO;
  
  return createIAResponse({
    success: true,
    action: 'validar_disponibilidade',
    result: {
      disponivel: true,
      conflitos: ocupados?.map(o => (o.pets as any)?.nome) || [],
      aviso: ocupados && ocupados.length > 0 ? `Atenção: Já existem ${ocupados.length} agendamentos para este horário.` : null
    }
  });
}

export async function criarAgendamentoIA(
  sb: SupabaseClient<Database>,
  params: {
    cliente_id: string;
    pet_id: string;
    servicos: { id: string, nome: string, valor: number }[];
    data: string;
    hora: string;
    profissional_id?: string;
    transporte?: boolean;
    taxa_transporte?: number;
    observacoes?: string;
  }
) {
  const modalidade: LevaTrazModalidade = params.transporte ? "buscar_entregar" : "nao_utilizar";

  const { data: agendamento, error: errA } = await sb
    .from("agendamentos")
    .insert({
      cliente_id: params.cliente_id,
      pet_id: params.pet_id,
      data: params.data,
      hora: params.hora,
      profissional_id: params.profissional_id,
      leva_traz_modalidade: modalidade,
      taxa_leva_traz: params.taxa_transporte || 0,
      observacoes: params.observacoes,
      status: "agendado" as AgendamentoStatus
    })
    .select()
    .single();

  if (errA) throw errA;

  const servicosInsert = params.servicos.map((s, idx) => ({
    agendamento_id: agendamento.id,
    servico_id: s.id,
    nome: s.nome,
    valor_unit: s.valor,
    ordem: idx + 1
  }));

  const { error: errS } = await sb
    .from("agendamento_servicos")
    .insert(servicosInsert);

  if (errS) throw errS;

  return createIAResponse({
    action: 'criar_agendamento',
    record_id: agendamento.id,
    result: agendamento
  });
}

export async function remarcarAgendamentoIA(
  sb: SupabaseClient<Database>,
  agendamento_id: string,
  nova_data: string,
  nova_hora: string
) {
  const { data, error } = await sb
    .from("agendamentos")
    .update({
      data: nova_data,
      hora: nova_hora
    })
    .eq("id", agendamento_id)
    .select()
    .single();

  if (error) throw error;
  
  return createIAResponse({
    action: 'remarcar_agendamento',
    record_id: data.id,
    result: data
  });
}

export async function cancelarAgendamentoIA(
  sb: SupabaseClient<Database>,
  agendamento_id: string,
  motivo: string
) {
  const { data, error } = await sb
    .from("agendamentos")
    .update({
      status: "cancelado" as AgendamentoStatus,
      observacoes: motivo ? `Cancelado via IA: ${motivo}` : "Cancelado via IA"
    })
    .eq("id", agendamento_id)
    .select()
    .single();

  if (error) throw error;
  
  return createIAResponse({
    action: 'cancelar_agendamento',
    record_id: data.id,
    result: data
  });
}

export async function registrarPagamentoIA(
  sb: SupabaseClient<Database>,
  params: {
    pagamento_id: string;
    valor_pago: number;
    forma: Database["public"]["Enums"]["pagamento_forma"];
    data_pagamento?: string;
    observacoes?: string;
    comprovante_path?: string;
    id_transacao?: string;
  }
) {
  const { data: pagamento, error: errP } = await sb
    .from("pagamentos")
    .select("*")
    .eq("id", params.pagamento_id)
    .single();

  if (errP) throw errP;
  if (!pagamento) throw new Error("Pagamento não localizado.");
  if (pagamento.status === "pago") throw new Error("Este pagamento já foi baixado anteriormente.");

  const novoValorPago = (pagamento.valor_pago || 0) + params.valor_pago;
  const status: Database["public"]["Enums"]["pagamento_status"] = 
    novoValorPago >= pagamento.valor_total ? "pago" : "pendente";

  const { data, error } = await sb
    .from("pagamentos")
    .update({
      valor_pago: novoValorPago,
      status,
      forma: params.forma,
      data_pagamento: params.data_pagamento || format(new Date(), 'yyyy-MM-dd'),
      observacoes: params.observacoes ? `${pagamento.observacoes || ''}\nIA: ${params.observacoes}`.trim() : pagamento.observacoes,
      updated_at: new Date().toISOString(),
      comprovante_path: params.comprovante_path,
      id_transacao_bancaria: params.id_transacao,
      ia_analisado: !!params.comprovante_path
    })
    .eq("id", params.pagamento_id)
    .select()
    .single();

  if (error) throw error;

  return createIAResponse({
    action: 'registrar_pagamento',
    record_id: data.id,
    result: data
  });
}

export async function estornarPagamentoIA(
  sb: SupabaseClient<Database>,
  pagamento_id: string,
  motivo: string
) {
  const { data, error } = await sb
    .from("pagamentos")
    .update({
      status: "pendente" as Database["public"]["Enums"]["pagamento_status"],
      valor_pago: 0,
      observacoes: `Estornado via IA: ${motivo}`,
      updated_at: new Date().toISOString()
    })
    .eq("id", pagamento_id)
    .select()
    .single();

  if (error) throw error;
  
  return createIAResponse({
    action: 'estornar_pagamento',
    record_id: data.id,
    result: data
  });
}

export async function criarClienteIA(
  sb: SupabaseClient<Database>,
  params: { nome: string; telefone: string; email?: string; observacoes?: string }
) {
  const { data, error } = await sb
    .from("clientes")
    .insert({
      nome: params.nome,
      telefone: params.telefone,
      email: params.email,
      observacoes: params.observacoes
    })
    .select()
    .single();

  if (error) throw error;

  return createIAResponse({
    action: 'criar_cliente',
    record_id: data.id,
    result: data
  });
}

export async function criarPetIA(
  sb: SupabaseClient<Database>,
  params: { cliente_id: string; nome: string; especie?: string; raca?: string; porte?: string; observacoes?: string }
) {
  const { data, error } = await sb
    .from("pets")
    .insert({
      cliente_id: params.cliente_id,
      nome: params.nome,
      raca: params.raca,
      porte: params.porte,
      observacoes: params.observacoes
    } as any)
    .select()
    .single();

  if (error) throw error;

  return createIAResponse({
    action: 'criar_pet',
    record_id: data.id,
    result: data
  });
}
