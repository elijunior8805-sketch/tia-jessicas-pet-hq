import { Database } from "@/integrations/supabase/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { createIAResponse } from "./ia-retorno.server";
import { getFinancialKPIs } from "../financial-kpis.functions";


export async function buscarDadosAgenda(sb: SupabaseClient<Database>, filtros: { 
  data?: string; 
  periodo_inicio?: string;
  periodo_fim?: string;
  status?: string;
  pet_nome?: string; 
  cliente_nome?: string; 
  profissional?: string;
  servico_nome?: string;
  leva_e_traz?: boolean;
}) {
  let query = sb
    .from("agendamentos")
    .select(`
      *,
      pets(nome, raca, porte, observacoes),
      clientes(nome, telefone),
      servicos(nome)
    `);

  const timezone = "America/Sao_Paulo";
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  if (filtros.data) {
    query = query.eq("data", filtros.data);
  } else if (filtros.periodo_inicio && filtros.periodo_fim) {
    query = query.gte("data", filtros.periodo_inicio).lte("data", filtros.periodo_fim);
  } else {
    // Default para hoje se nada for passado
    query = query.eq("data", hoje);
  }

  if (filtros.status) {
    query = query.eq("status", filtros.status as any);
  }


  if (filtros.leva_e_traz !== undefined) {
    if (filtros.leva_e_traz) {
      query = query.neq("leva_traz_modalidade", "nao_utilizar");
    } else {
      query = query.eq("leva_traz_modalidade", "nao_utilizar");
    }
  }
  
  const { data, error } = await query.order("hora", { ascending: true }).limit(200);
  
  if (error) throw error;
  
  let result = (data || []) as any[];
  
  if (filtros.pet_nome) {
    result = result.filter(a => a.pets?.nome?.toLowerCase().includes(filtros.pet_nome!.toLowerCase()));
  }
  if (filtros.cliente_nome) {
    result = result.filter(a => a.clientes?.nome?.toLowerCase().includes(filtros.cliente_nome!.toLowerCase()));
  }
  if (filtros.profissional) {
    result = result.filter(a => a.profissional_id?.toLowerCase().includes(filtros.profissional!.toLowerCase()));
  }
  if (filtros.servico_nome) {
    result = result.filter(a => a.servicos?.nome?.toLowerCase().includes(filtros.servico_nome!.toLowerCase()));
  }

  return createIAResponse({
    action: 'consulta_agenda',
    result: result
  });
}


export async function buscarClientesIA(sb: SupabaseClient<Database>, termo: string) {
  const { data, error } = await sb
    .from("clientes")
    .select(`*, pets(id, nome, raca)`)
    .or(`nome.ilike.%${termo}%, telefone.ilike.%${termo}%`)
    .limit(10);

  if (error) throw error;

  return createIAResponse({
    action: 'buscar_clientes',
    result: data
  });
}

export async function buscarPetsDoClienteIA(sb: SupabaseClient<Database>, clienteId: string) {
  const { data, error } = await sb
    .from("pets")
    .select(`*`)
    .eq("cliente_id", clienteId);

  if (error) throw error;

  return createIAResponse({
    action: 'buscar_pets_do_cliente',
    result: data
  });
}

export async function buscarServicosIA(sb: SupabaseClient<Database>, termo?: string) {
  let query = sb.from("servicos").select("*").eq("ativo", true);
  
  if (termo) {
    query = query.ilike("nome", `%${termo}%`);
  }

  const { data, error } = await query.limit(20);
  if (error) throw error;

  return createIAResponse({
    action: 'buscar_servicos',
    result: data
  });
}

export async function listarAtendimentosIA(sb: SupabaseClient<Database>, filtros: { finalizado?: boolean; pet_id?: string; data?: string }) {
  let query = sb
    .from("atendimentos")
    .select(`
      *,
      pets(nome),
      clientes(nome)
    `);

  if (filtros.pet_id) query = query.eq("pet_id", filtros.pet_id);
  if (filtros.finalizado !== undefined) query = query.eq("finalizado", filtros.finalizado);
  if (filtros.data) query = query.gte("data_inicio", `${filtros.data}T00:00:00`).lte("data_inicio", `${filtros.data}T23:59:59`);

  const { data, error } = await query.order("data_inicio", { ascending: false }).limit(20);
  if (error) throw error;

  return createIAResponse({
    action: 'listar_atendimentos',
    result: data
  });
}

export async function buscarDadosFinanceiros(sb: SupabaseClient<Database>, filtros: { 
  cliente_id?: string; 
  apenas_pendentes?: boolean; 
  data?: string; 
  period?: "hoje" | "ontem" | "semana" | "mes" | "mes_passado" | "30dias"; 
  periodo_inicio?: string;
  periodo_fim?: string;
  termo?: string;
}) {
  const timezone = "America/Sao_Paulo";
  const now = new Date();
  const hojeStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

  // 1. Se for busca por termo em pagamentos
  if (filtros.termo) {
    const { data, error } = await sb
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
      `)
      .ilike("descricao", `%${filtros.termo}%`)
      .limit(50);
    if (error) throw error;
    
    return createIAResponse({
      action: 'consulta_financeira',
      result: data
    });
  }

  // 2. Se for Resumo de KPIs (Dashboard/IA)
  if (!filtros.cliente_id && !filtros.apenas_pendentes && !filtros.termo) {
    let from = filtros.periodo_inicio || hojeStr;
    let to = filtros.periodo_fim || hojeStr;

    if (filtros.period) {
      switch (filtros.period) {
        case "hoje":
          from = hojeStr;
          to = hojeStr;
          break;
        case "ontem":
          const ontem = subDays(now, 1);
          from = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ontem);
          to = from;
          break;
        case "semana":
          from = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
          to = hojeStr;
          break;
        case "mes":
          from = format(startOfMonth(now), "yyyy-MM-dd");
          to = hojeStr;
          break;
        case "mes_passado":
          const firstOfLastMonth = startOfMonth(subDays(startOfMonth(now), 1));
          from = format(firstOfLastMonth, "yyyy-MM-dd");
          to = format(endOfMonth(firstOfLastMonth), "yyyy-MM-dd");
          break;
        case "30dias":
          from = format(subDays(now, 30), "yyyy-MM-dd");
          to = hojeStr;
          break;
      }
    }

    // Usar a função central de KPIs para garantir paridade
    // Precisamos importar o helper admin pois server functions chamadas de dentro de outras podem ter problemas de RLS se não estiverem no contexto correto
    // Mas buscarDadosFinanceiros é exportada como helper, então deve funcionar se o client sb tiver as permissões
    const indicators = await getFinancialKPIs({ data: { from, to } });

    return createIAResponse({
      action: 'consultar_resumo_financeiro',
      result: {
        periodo: { from, to },
        metricas: indicators
      }
    });
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

  return createIAResponse({
    action: 'consultar_pendencias',
    result: data
  });
}

export async function buscarDisponibilidade(sb: SupabaseClient<Database>, params: { servico?: string; data: string; profissional?: string }) {
  const { data: agendamentos, error } = await sb
    .from("agendamentos")
    .select("hora, duracao_min, profissional_id")
    .eq("data", params.data)
    .not("status", "eq", "cancelado");

  if (error) throw error;

  const slots = [];
  let current = 8 * 60; 
  const end = 18 * 60; 
  const interval = 30; 

  while (current < end) {
    const hour = Math.floor(current / 60).toString().padStart(2, '0');
    const min = (current % 60).toString().padStart(2, '0');
    const timeStr = `${hour}:${min}:00`;
    
    const isOccupied = (agendamentos || []).some(a => a.hora === timeStr);

    if (!isOccupied) {
      slots.push(timeStr.slice(0, 5));
    }
    current += interval;
  }

  return createIAResponse({
    action: 'consultar_disponibilidade',
    result: slots
  });
}

export async function consultarResumoOperacionalIA(sb: SupabaseClient<Database>) {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  
  const { data: agenda } = await sb
    .from("agendamentos")
    .select("status, hora, leva_traz_modalidade, pets(nome)")
    .eq("data", hoje);

  const { data: indicators } = await sb
    .from("vw_financeiro_indicadores")
    .select("*")
    .gte("data_referencia", hoje)
    .lte("data_referencia", hoje);
    
  const { data: pendencias } = await sb
    .from("pagamentos")
    .select("valor_total, valor_pago")
    .not("status", "in", '("pago","cancelado")')
    .is("arquivado_em", null)
    .or("is_teste.is.null,is_teste.eq.false")
    .or(`categoria_receita.is.null,and(categoria_receita.neq.aporte,categoria_receita.neq.ajuste)`);

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

  return createIAResponse({
    action: 'consultar_resumo_operacional',
    result: {
      data: hoje,
      total_agenda: totalAgenda,
      confirmados,
      cancelados,
      leva_traz: levaTraz,
      valor_pendente: valorPendente,
      faturamento_hoje: faturamentoHoje,
      recebido_hoje: recebidoHoje,
      promessas_hoje: promessas?.length || 0,
    }
  });
}

export async function consultarHistoricoPetIA(sb: SupabaseClient<Database>, petId: string) {
  const { data: atendimentos, error: errA } = await sb
    .from("atendimentos")
    .select("*, agendamento_servicos(nome, valor_unit)")
    .eq("pet_id", petId)
    .order("data_inicio", { ascending: false })
    .limit(10);

  if (errA) throw errA;

  return createIAResponse({
    action: 'consultar_historico_pet',
    result: atendimentos
  });
}

export async function analisarRiscoEvasaoIA(sb: SupabaseClient<Database>) {
  const { data: atendimentos } = await sb
    .from("atendimentos")
    .select("pet_id, data_inicio, pets(nome, clientes(nome))")
    .eq("finalizado", true)
    .order("data_inicio", { ascending: false });

  if (!atendimentos || atendimentos.length === 0) return createIAResponse({ action: 'analisar_risco_evasao', result: [] });

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
    if (stats.datas.length < 2) continue; 

    const intervalos = [];
    for (let i = 0; i < stats.datas.length - 1; i++) {
      const diff = Math.abs(stats.datas[i].getTime() - stats.datas[i+1].getTime());
      intervalos.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const mediaIntervalo = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const diasDesdeUltimo = Math.ceil(Math.abs(hoje.getTime() - stats.datas[0].getTime()) / (1000 * 60 * 60 * 24));

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

  return createIAResponse({
    action: 'analisar_risco_evasao',
    result: riscos.sort((a, b) => b.dias_ausente - a.dias_ausente).slice(0, 10)
  });
}
