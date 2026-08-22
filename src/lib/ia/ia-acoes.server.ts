import { Database } from "@/integrations/supabase/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const ValidarAgendamentoSchema = z.object({
  data: z.string(),
  hora: z.string(),
  pet_id: z.string(),
  cliente_id: z.string(),
  profissional_id: z.string().optional(),
  servicos: z.array(z.string()),
});

type AgendamentoStatus = Database["public"]["Enums"]["agendamento_status"];
type LevaTrazModalidade = Database["public"]["Enums"]["leva_traz_modalidade"];

export async function validarDisponibilidadeReal(
  sb: SupabaseClient<Database>,
  params: z.infer<typeof ValidarAgendamentoSchema>
) {
  // 1. Verificar duplicidade (Mesmo cliente, pet, data e hora)
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
    return { disponivel: false, motivo: "Já existe um agendamento idêntico para este pet neste horário." };
  }

  // 2. Verificar ocupação do horário (Aviso, não bloqueio, conforme regra do projeto)
  const { data: ocupados, error: errO } = await sb
    .from("agendamentos")
    .select("id, pets(nome)")
    .eq("data", params.data)
    .eq("hora", params.hora)
    .not("status", "eq", "cancelado");

  if (errO) throw errO;
  
  return {
    disponivel: true,
    conflitos: ocupados?.map(o => (o.pets as any)?.nome) || [],
    aviso: ocupados && ocupados.length > 0 ? `Atenção: Já existem ${ocupados.length} agendamentos para este horário.` : null
  };
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

  // Criar o agendamento
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

  // Inserir os serviços
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

  return agendamento;
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
  return data;
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
  return data;
}
