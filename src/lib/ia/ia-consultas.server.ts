import { Database } from "@/integrations/supabase/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { getFinancialKPIs } from "../financial-kpis.functions";
import { format, subDays } from "date-fns";

export async function buscarDadosAgenda(sb: SupabaseClient<Database>, filtros: { data?: string; pet_nome?: string; cliente_nome?: string; profissional?: string }) {
  let query = sb
    .from("agendamentos")
    .select(`
      *,
      pets(nome, raca, porte, observacoes),
      clientes(nome, telefone),
      servicos(nome)
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

export async function buscarDadosFinanceiros(sb: SupabaseClient<Database>, filtros: { cliente_id?: string; apenas_pendentes?: boolean; data?: string; period?: "hoje" | "mes" | "30dias" }) {
  // Para consultas de KPIs financeiros, usamos a fonte central
  if (!filtros.cliente_id && !filtros.data && !filtros.apenas_pendentes) {
    const now = new Date();
    let from = format(subDays(now, 29), "yyyy-MM-dd");
    let to = format(now, "yyyy-MM-dd");

    if (filtros.period === "hoje") {
      from = format(now, "yyyy-MM-dd");
      to = from;
    } else if (filtros.period === "mes") {
      from = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      to = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
    }

    // getFinancialKPIs é um server function, mas ia-consultas.server.ts já roda no servidor.
    // Podemos chamar o handler diretamente se necessário ou simular a chamada.
    // Como estamos no servidor, chamamos a lógica de consulta centralizada.
    const { data: indicators } = await sb
      .from("vw_financeiro_indicadores")
      .select("*")
      .gte("data_referencia", from)
      .lte("data_referencia", to);

    return indicators;
  }

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
    query = query
      .not("status", "in", '("pago","cancelado")')
      .is("arquivado_em", null)
      .or("is_teste.is.null,is_teste.eq.false");
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

export async function consultarResumoOperacionalIA(sb: SupabaseClient<Database>) {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  
  // 1. Agendamentos do dia
  const { data: agenda } = await sb
    .from("agendamentos")
    .select("status, hora, leva_traz_modalidade, pets(nome)")
    .eq("data", hoje);

  // 2. Pendências financeiras (USANDO FONTE CENTRAL)
  const { data: indicators } = await sb
    .from("vw_financeiro_indicadores")
    .select("*")
    .gte("data_referencia", hoje)
    .lte("data_referencia", hoje);
    
  // A Receber total (não apenas de hoje)
  const { data: pendencias } = await sb
    .from("pagamentos")
    .select("valor_total, valor_pago")
    .not("status", "in", '("pago","cancelado")')
    .is("arquivado_em", null)
    .or("is_teste.is.null,is_teste.eq.false")
    .or(`categoria_receita.is.null,and(categoria_receita.neq.aporte,categoria_receita.neq.ajuste)`);

  // 3. Promessas vencendo
  const { data: promessas } = await sb
    .from("cobranca_promessas")
    .select("id")
    .eq("data_prometida", hoje)
    .eq("status", "pendente");

  const totalAgenda = agenda?.length || 0;
  const confirmados = agenda?.filter(a => a.status === 'confirmado').length || 0;
  const cancelados = agenda?.filter(a => a.status === 'cancelado').length || 0;
  const levaTraz = agenda?.filter(a => a.leva_traz_modalidade !== 'nao_utilizar').length || 0;
  
  const valorPendente = pendencias?.reduce((acc, p) => acc + (p.valor_total - (p.valor_pago || 0)), 0) || 0;

  const faturamentoHoje = indicators?.filter(i => i.tipo === 'receita_servico').reduce((acc, i) => acc + Number(i.valor), 0) || 0;
  const recebidoHoje = indicators?.filter(i => i.tipo === 'receita_recebida').reduce((acc, i) => acc + Number(i.valor), 0) || 0;

  return {
    data: hoje,
    total_agenda: totalAgenda,
    confirmados,
    cancelados,
    leva_traz: levaTraz,
    valor_pendente: valorPendente,
    faturamento_hoje: faturamentoHoje,
    recebido_hoje: recebidoHoje,
    promessas_hoje: promessas?.length || 0,
    alertas: []
  };
}

export async function analisarRiscoEvasaoIA(sb: SupabaseClient<Database>) {
  // Busca últimos atendimentos de todos os pets
  const { data: atendimentos } = await sb
    .from("atendimentos")
    .select("pet_id, data_inicio, pets(nome, clientes(nome))")
    .eq("finalizado", true)
    .order("data_inicio", { ascending: false });

  if (!atendimentos || atendimentos.length === 0) return [];

  const petStats: Record<string, { datas: Date[], nome: string, tutor: string }> = {};

  atendimentos.forEach(a => {
    if (!petStats[a.pet_id]) {
      petStats[a.pet_id] = { 
        datas: [], 
        nome: (a.pets as any)?.nome || 'Pet', 
        tutor: (a.pets as any)?.clientes?.nome || 'Tutor' 
      };
    }
    petStats[a.pet_id].datas.push(new Date(a.data_inicio));
  });

  const hoje = new Date();
  const riscos = [];

  for (const petId in petStats) {
    const stats = petStats[petId];
    if (stats.datas.length < 2) continue; // Precisa de pelo menos 2 para calcular média

    // Calcula intervalos em dias
    const intervalos = [];
    for (let i = 0; i < stats.datas.length - 1; i++) {
      const diff = Math.abs(stats.datas[i].getTime() - stats.datas[i+1].getTime());
      intervalos.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const mediaIntervalo = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const diasDesdeUltimo = Math.ceil(Math.abs(hoje.getTime() - stats.datas[0].getTime()) / (1000 * 60 * 60 * 24));

    // Risco se estiver 50% acima da média
    if (diasDesdeUltimo > mediaIntervalo * 1.5) {
      riscos.push({
        pet_id: petId,
        nome: stats.nome,
        tutor: stats.tutor,
        media_dias: Math.round(mediaIntervalo),
        dias_ausente: diasDesdeUltimo,
        nivel_risco: diasDesdeUltimo > mediaIntervalo * 2.5 ? 'Alto' : 'Médio'
      });
    }
  }

  return riscos.sort((a, b) => b.dias_ausente - a.dias_ausente).slice(0, 10);
}
