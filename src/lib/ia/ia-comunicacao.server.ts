import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { createIAResponse } from "./ia-retorno.server";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

export async function consultarMensagensRecentes(sb: SupabaseClient<Database>, filtros: { cliente_id?: string; pet_id?: string; limite?: number }) {
  let query = sb
    .from("notificacoes")
    .select(`
      *,
      clientes(nome, telefone),
      pets(nome)
    `)
    .order("created_at", { ascending: false });

  if (filtros.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
  if (filtros.pet_id) query = query.eq("pet_id", filtros.pet_id);

  const { data, error } = await query.limit(filtros.limite || 20);
  if (error) throw error;

  return createIAResponse({
    source: 'consultar_mensagens',
    data: data
  });
}

export async function sugerirRespostaIA(sb: SupabaseClient<Database>, mensagemId: string) {
  const { data: msg, error } = await sb
    .from("notificacoes")
    .select(`
      *,
      clientes(*, pets(*))
    `)
    .eq("id", mensagemId)
    .single();

  if (error) throw error;

  return createIAResponse({
    source: 'sugerir_resposta',
    data: {
      mensagem_original: msg,
      sugestoes: [
        { tom: "Cordial", texto: "Olá! Recebemos sua mensagem e já estamos verificando." },
        { tom: "Objetivo", texto: "Confirmado. Posso ajudar em algo mais?" }
      ]
    }
  });
}

export async function identificarAniversariantesIA(sb: SupabaseClient<Database>) {
  const today = new Date();
  const dia = today.getDate();
  const mes = today.getMonth() + 1;

  // Clientes e Pets fazem aniversário hoje
  const { data: pets } = await sb
    .from("pets")
    .select("*, clientes(nome, telefone)")
    .filter("data_nascimento", "not.is", null);

  const aniversariantes = pets?.filter(p => {
    if (!p.data_nascimento) return false;
    const dt = parseISO(p.data_nascimento);
    return dt.getDate() === dia && (dt.getMonth() + 1) === mes;
  }) || [];

  return createIAResponse({
    source: 'aniversariantes_hoje',
    data: aniversariantes
  });
}

export async function analisarReativacaoIA(sb: SupabaseClient<Database>) {
  // Busca clientes sem agendamentos nos últimos 45 dias
  const limite = format(subDays(new Date(), 45), "yyyy-MM-dd");
  
  const { data: inativos, error } = await sb
    .from("clientes")
    .select(`
      *,
      pets(nome),
      agendamentos(data, status)
    `)
    .order("nome");

  const clientesRisco = inativos?.filter(c => {
    const ags = (c as any).agendamentos || [];
    if (ags.length === 0) return false; // Cliente novo
    const ultimaData = ags.sort((a: any, b: any) => b.data.localeCompare(a.data))[0].data;
    return ultimaData < limite;
  }).map(c => {
    const ags = (c as any).agendamentos || [];
    return {
      ...c,
      dias_inatividade: Math.floor((new Date().getTime() - new Date(ags[0].data).getTime()) / (1000 * 60 * 60 * 24)),
      justificativa: "Mais de 45 dias desde o último atendimento."
    };
  }) || [];

  return createIAResponse({
    source: 'analise_reativacao',
    data: clientesRisco
  });
}
