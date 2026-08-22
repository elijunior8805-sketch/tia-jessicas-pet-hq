import { Database } from "@/integrations/supabase/types";
import { SupabaseClient } from "@supabase/supabase-js";

export async function buscarDadosAgenda(sb: SupabaseClient<Database>, filtros: { data?: string; pet_nome?: string; cliente_nome?: string; profissional?: string }) {
  let query = sb
    .from("agendamentos")
    .select(`
      *,
      pets(nome, raca, porte, observacoes),
      clientes(nome, telefone),
      servicos(nome, preco)
    `);

  if (filtros.data) {
    query = query.eq("data", filtros.data);
  }
  
  const { data, error } = await query.order("hora", { ascending: true }).limit(50);
  
  if (error) throw error;
  
  let result = (data || []) as any[];
  
  if (filtros.pet_nome) {
    result = result.filter(a => a.pets?.nome?.toLowerCase().includes(filtros.pet_nome!.toLowerCase()));
  }
  if (filtros.cliente_nome) {
    result = result.filter(a => a.clientes?.nome?.toLowerCase().includes(filtros.cliente_nome!.toLowerCase()));
  }
  if (filtros.profissional) {
    // Se profissional_id for UUID, idealmente buscaríamos o nome, mas aqui filtramos pelo ID se for o caso
    result = result.filter(a => a.profissional_id?.toLowerCase().includes(filtros.profissional!.toLowerCase()));
  }

  return result;
}

export async function buscarDadosClientesPets(sb: SupabaseClient<Database>, termo: string) {
  const { data: clientes, error: errC } = await sb
    .from("clientes")
    .select(`*, pets(*)`)
    .or(`nome.ilike.%${termo}%, telefone.ilike.%${termo}%`)
    .limit(10);

  if (errC) throw errC;

  const { data: pets, error: errP } = await sb
    .from("pets")
    .select(`*, clientes(*)`)
    .ilike("nome", `%${termo}%`)
    .limit(10);

  if (errP) throw errP;

  return { clientes, pets };
}

export async function buscarDadosFinanceiros(sb: SupabaseClient<Database>, filtros: { cliente_id?: string; apenas_pendentes?: boolean; data?: string }) {
  let query = sb
    .from("pagamentos")
    .select(`
      *,
      atendimentos(
        id,
        data_inicio,
        pet_id,
        pets(nome),
        clientes(nome)
      )
    `);

  if (filtros.cliente_id) {
    query = query.eq("cliente_id", filtros.cliente_id);
  }
  if (filtros.apenas_pendentes) {
    query = query.eq("status", "pendente");
  }
  if (filtros.data) {
    query = query.eq("vencimento", filtros.data);
  }

  const { data, error } = await query.order("vencimento", { ascending: true }).limit(50);
  if (error) throw error;

  return data;
}

export async function buscarDisponibilidade(sb: SupabaseClient<Database>, params: { servico?: string; data: string; profissional?: string }) {
  const { data: agendamentos, error } = await sb
    .from("agendamentos")
    .select("hora, duracao_min, profissional_id")
    .eq("data", params.data)
    .not("status", "eq", "cancelado");

  if (error) throw error;

  const slots = [];
  let current = 8 * 60; // 08:00
  const end = 18 * 60; // 18:00
  const interval = 30; // 30 min slots

  while (current < end) {
    const hour = Math.floor(current / 60).toString().padStart(2, '0');
    const min = (current % 60).toString().padStart(2, '0');
    const timeStr = `${hour}:${min}:00`;
    
    const isOccupied = (agendamentos || []).some(a => {
      const start = a.hora;
      return start === timeStr;
    });

    if (!isOccupied) {
      slots.push(timeStr.slice(0, 5));
    }
    current += interval;
  }

  return slots;
}
