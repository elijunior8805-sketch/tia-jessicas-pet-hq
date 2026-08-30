import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { createIAResponse } from "./ia-retorno.server";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

export async function consultarMensagensRecentes(sb: SupabaseClient<Database>, filtros: { cliente_id?: string; pet_id?: string; limite?: number }) {
  try {
    let query = sb
      .from("mensagens" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (filtros.cliente_id) {
      query = query.eq("cliente_id", filtros.cliente_id);
    }

    const { data, error } = await query.limit(filtros.limite || 20);
    if (!error && data && data.length > 0) {
      return createIAResponse({
        source: 'consultar_mensagens',
        data: data
      });
    }
  } catch {
    // Fallback para notificacoes
  }

  const { data } = await sb
    .from("notificacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtros.limite || 20);

  return createIAResponse({
    source: 'consultar_mensagens',
    data: data || []
  });
}

export async function sugerirRespostaIA(sb: SupabaseClient<Database>, mensagemId: string) {
  let textoMensagem = "Olá, gostaria de informações sobre o atendimento do meu pet.";

  try {
    const { data: msg } = await sb
      .from("mensagens" as any)
      .select("texto, conteudo, mensagem")
      .eq("id", mensagemId)
      .maybeSingle();

    if (msg) {
      textoMensagem = (msg as any).texto || (msg as any).conteudo || (msg as any).mensagem || textoMensagem;
    }
  } catch {
    // fallback
  }

  try {
    const { chamarIATexto, carregarIaConfig } = await import("../ia-core.server");
    const config = await carregarIaConfig(sb);

    const [respCordial, respDireta] = await Promise.all([
      chamarIATexto({
        system: "Você é a assistente de atendimento do Spa de Pet Tia Jéssica. Crie uma resposta curta, educada e calorosa (1 a 2 frases) para o tutor. Sem emojis exagerados.",
        prompt: `Mensagem do cliente: "${textoMensagem}"`,
        config,
        temperatura: 0.6,
        origem: "sugestao_resposta_cordial"
      }),
      chamarIATexto({
        system: "Você é a assistente operacional do Spa de Pet Tia Jéssica. Crie uma resposta direta, objetiva e profissional (1 frase) confirmando ou esclarecendo a solicitação.",
        prompt: `Mensagem do cliente: "${textoMensagem}"`,
        config,
        temperatura: 0.3,
        origem: "sugestao_resposta_direta"
      })
    ]);

    return createIAResponse({
      source: 'sugerir_resposta',
      data: {
        mensagem_original: textoMensagem,
        sugestoes: [
          { tom: "Cordial", texto: respCordial },
          { tom: "Objetivo", texto: respDireta }
        ]
      }
    });
  } catch {
    return createIAResponse({
      source: 'sugerir_resposta',
      data: {
        mensagem_original: textoMensagem,
        sugestoes: [
          { tom: "Cordial", texto: "Olá! Recebemos sua mensagem e já estamos verificando com nossa equipe para te responder em instantes." },
          { tom: "Objetivo", texto: "Mensagem recebida. Estamos conferindo na agenda e já te retornamos." }
        ]
      }
    });
  }
}

export async function identificarAniversariantesIA(sb: SupabaseClient<Database>) {
  const today = new Date();
  const dia = today.getDate();
  const mes = today.getMonth() + 1;

  // Clientes e Pets fazem aniversário hoje
  const { data: pets } = await sb
    .from("pets")
    .select("*, clientes(nome, telefone)")
    .filter("nascimento", "not.is", null);

  const aniversariantes = pets?.filter(p => {
    if (!p.nascimento) return false;
    const dt = parseISO(p.nascimento);
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
      agendamentos(data, status)
    `)
    .order("nome");

  if (error) throw error;

  const clientesRisco = inativos?.filter(c => {
    const ags = (c as any).agendamentos || [];
    if (ags.length === 0) return false; // Cliente novo
    const ultimaData = ags.sort((a: any, b: any) => b.data.localeCompare(a.data))[0].data;
    return ultimaData < limite;
  }).map(c => {
    const ags = (c as any).agendamentos || [];
    const ultima = ags.sort((a: any, b: any) => b.data.localeCompare(a.data))[0];
    return {
      ...c,
      dias_inatividade: Math.floor((new Date().getTime() - new Date(ultima.data).getTime()) / (1000 * 60 * 60 * 24)),
      justificativa: "Mais de 45 dias desde o último atendimento."
    };
  }) || [];

  return createIAResponse({
    source: 'analise_reativacao',
    data: clientesRisco
  });
}
