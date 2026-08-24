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
  const now = new Date();
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);

  // Tratamento de data incompleta (ex: "dia 28")
  let dataFinal = filtros.data;
  if (dataFinal && /^\d{1,2}$/.test(dataFinal)) {
    const diaAlvo = parseInt(dataFinal);
    let dataAlvo = new Date(now.getFullYear(), now.getMonth(), diaAlvo);
    // Se a data já passou no mês atual, mover para o próximo mês
    if (dataAlvo < now) {
      dataAlvo = new Date(now.getFullYear(), now.getMonth() + 1, diaAlvo);
    }
    dataFinal = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(dataAlvo);
  }

  if (dataFinal && /^\d{4}-\d{2}-\d{2}$/.test(dataFinal)) {
    query = query.eq("data", dataFinal);
  } else if (filtros.periodo_inicio && filtros.periodo_fim && /^\d{4}-\d{2}-\d{2}$/.test(filtros.periodo_inicio)) {
    query = query.gte("data", filtros.periodo_inicio).lte("data", filtros.periodo_fim);
  } else {
    // Default para hoje se nada for informado ou se for "hoje"
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
    source: 'consulta_agenda',
    data: result
  });
}


function normalizarTermo(termo: string): string {
  return termo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/gi, "") // Remove pontuação
    .trim()
    .toLowerCase();
}

function formatarTelefoneBusca(termo: string): string {
  return termo.replace(/\D/g, ""); // Apenas números
}

export async function buscarClientesIA(sb: SupabaseClient<Database>, termo: string) {
  const termoOriginal = termo.trim();
  const termoLimpo = normalizarTermo(termoOriginal);
  const telefoneBusca = formatarTelefoneBusca(termoOriginal);
  
  // 1. Tentar ID exato se for UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(termoOriginal)) {
    const { data } = await sb.from("clientes").select("*, pets(id, nome, raca, porte)").eq("id", termoOriginal).single();
    if (data) return createIAResponse({ source: 'buscar_clientes', data: [data] });
  }

  // 2. Busca em camadas
  // Camada 1: Telefone (se tiver cara de telefone)
  if (telefoneBusca.length >= 8) {
    const { data } = await sb.from("clientes").select("*, pets(id, nome, raca, porte)").ilike("telefone", `%${telefoneBusca}%`);
    if (data && data.length > 0) return createIAResponse({ source: 'buscar_clientes', data });
  }

  // Camada 2: Nome exato e ILIKE
  const { data: dataNome, error: errorNome } = await sb
    .from("clientes")
    .select(`*, pets(id, nome, raca, porte)`)
    .or(`nome.ilike.%${termoLimpo}%, email.ilike.%${termoOriginal}%`)
    .order('nome')
    .limit(10);

  if (dataNome && dataNome.length > 0) return createIAResponse({ source: 'buscar_clientes', data: dataNome });

  // Camada 3: Busca por nome do Pet
  const { data: dataPets } = await sb
    .from("pets")
    .select(`cliente_id, clientes(*, pets(id, nome, raca, porte))`)
    .ilike("nome", `%${termoLimpo}%`)
    .limit(5);

  if (dataPets && dataPets.length > 0) {
    const clientesDosPets = dataPets.map(p => p.clientes).filter(Boolean);
    if (clientesDosPets.length > 0) return createIAResponse({ source: 'buscar_clientes', data: clientesDosPets });
  }

  // Camada 4: Busca por partes do nome (se tiver espaços)
  if (termoLimpo.includes(' ')) {
    const palavras = termoLimpo.split(' ').filter(p => p.length > 2);
    if (palavras.length > 0) {
      const orString = palavras.map(p => `nome.ilike.%${p}%`).join(',');
      const { data: dataFuzzy } = await sb
        .from("clientes")
        .select(`*, pets(id, nome, raca, porte)`)
        .or(orString)
        .order('nome')
        .limit(10);
      
      if (dataFuzzy && dataFuzzy.length > 0) {
        return createIAResponse({ source: 'buscar_clientes', data: dataFuzzy });
      }
    }
  }

  return createIAResponse({
    source: 'buscar_clientes',
    data: []
  });
}

export async function buscarPetsDoClienteIA(sb: SupabaseClient<Database>, clienteId: string) {
  const { data, error } = await sb
    .from("pets")
    .select(`*`)
    .eq("cliente_id", clienteId);

  if (error) throw error;

  return createIAResponse({
    source: 'buscar_pets_do_cliente',
    data: data
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
    source: 'buscar_servicos',
    data: data
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
  if (filtros.data && /^\d{4}-\d{2}-\d{2}$/.test(filtros.data)) query = query.gte("data_inicio", `${filtros.data}T00:00:00`).lte("data_inicio", `${filtros.data}T23:59:59`);

  const { data, error } = await query.order("data_inicio", { ascending: false }).limit(20);
  if (error) throw error;

  return createIAResponse({
    source: 'listar_atendimentos',
    data: data
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
      source: 'consulta_financeira',
      data: data
    });
  }

  // 2. Se for Resumo de KPIs (Dashboard/IA)
  if (!filtros.cliente_id && !filtros.apenas_pendentes && !filtros.termo && (filtros as any).intencao !== "consultar_valores_a_receber") {
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
          to = format(endOfMonth(now), "yyyy-MM-dd");
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
    
    // Garantir que todos os valores existam para evitar "toLocaleString of undefined"
    const fallbackIndicators = {
      faturamento: 0, recebido: 0, despesas: 0, lucro: 0, 
      saldoCaixa: 0, ticketMedio: 0, atendimentos: 0, 
      aportes: 0, aReceber: 0, vencido: 0
    };

    const metricas = { ...fallbackIndicators, ...indicators };

    return createIAResponse({
      source: 'consultar_resumo_financeiro',
      data: {
        periodo: { from, to },
        metricas
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
  if (filtros.data && /^\d{4}-\d{2}-\d{2}$/.test(filtros.data)) {
    query = query.eq("vencimento", filtros.data);
  }

  const { data, error } = await query.order("vencimento", { ascending: true }).limit(50);
  if (error) throw error;

  return createIAResponse({
    source: 'consultar_pendencias',
    data: data
  });
}

export async function buscarDisponibilidade(sb: SupabaseClient<Database>, params: { servico_id?: string; data: string; profissional_id?: string; duracao_min?: number }) {
  // 1. Obter duração real do serviço se não for passada
  let duracao = params.duracao_min || 60;
  if (params.servico_id && !params.duracao_min) {
    const { data: servico } = await sb.from("servicos").select("duracao_min").eq("id", params.servico_id).single();
    if (servico) duracao = servico.duracao_min || 60;
  }

  // 2. Buscar agendamentos do dia
  const { data: agendamentos, error } = await sb
    .from("agendamentos")
    .select("hora, duracao_min, profissional_id, status")
    .eq("data", params.data)
    .not("status", "in", '("cancelado", "nao_compareceu")');

  if (error) throw error;

  // 3. Configuração de funcionamento
  const timezone = "America/Sao_Paulo";
  const startHour = 8; // 08:00
  const endHour = 19; // 19:00
  const slots = [];
  
  // 4. Gerar slots de 30 em 30 min
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
      const currentStart = h * 60 + m;
      const currentEnd = currentStart + duracao;

      // Verificar conflito com outros agendamentos
      const isOccupied = (agendamentos || []).some(a => {
        const [aH, aM] = a.hora.split(':').map(Number);
        const aStart = aH * 60 + aM;
        const aEnd = aStart + (a.duracao_min || 60);
        
        // Se profissional for especificado, só conta conflito se for o mesmo profissional
        // Se não, assume que qualquer conflito bloqueia o slot (ou limite de capacidade)
        if (params.profissional_id && a.profissional_id && a.profissional_id !== params.profissional_id) {
          return false;
        }

        return (currentStart < aEnd && currentEnd > aStart);
      });

      if (!isOccupied) {
        slots.push(timeStr.slice(0, 5));
      }
    }
  }

  return createIAResponse({
    source: 'consultar_disponibilidade',
    data: {
      data: params.data,
      vagas_disponiveis: slots.slice(0, 15), // Retornar mais opções para a IA escolher
      sugestao: slots.slice(0, 3) // Top 3 sugestões
    }
  });
}


export async function consultarResumoOperacionalIA(sb: SupabaseClient<Database>) {
  const timezone = "America/Sao_Paulo";
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  
  const { data: agenda } = await sb
    .from("agendamentos")
    .select("status, hora, leva_traz_modalidade, pets(nome), clientes(nome), servicos(nome)")
    .eq("data", hoje)
    .not("status", "eq", "cancelado");

  const { data: indicators } = await sb
    .from("vw_financeiro_indicadores")
    .select("*")
    .eq("data_referencia", hoje);
    
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
  const emAtendimento = agenda?.filter(a => a.status === 'em_atendimento').length || 0;
  const finalizados = agenda?.filter(a => a.status === 'finalizado').length || 0;
  const levaTraz = agenda?.filter(a => a.leva_traz_modalidade !== 'nao_utilizar').length || 0;
  
  const valorPendente = pendencias?.reduce((acc, p) => acc + (p.valor_total - (p.valor_pago || 0)), 0) || 0;

  const faturamentoHoje = indicators?.filter(i => i.tipo === 'receita_servico').reduce((acc, i) => acc + Number(i.valor), 0) || 0;
  const recebidoHoje = indicators?.filter(i => i.tipo === 'receita_recebida').reduce((acc, i) => acc + Number(i.valor), 0) || 0;

  // Próximo atendimento
  const agora = new Date().toLocaleTimeString("pt-BR", { timeZone: timezone, hour12: false });
  const proximo = agenda
    ?.filter(a => a.hora > agora)
    .sort((a, b) => a.hora.localeCompare(b.hora))[0];

  return createIAResponse({
    source: 'consultar_resumo_operacional',
    data: {
      data: hoje,
      total_agenda: totalAgenda,
      confirmados,
      em_atendimento: emAtendimento,
      finalizados,
      leva_traz: levaTraz,
      valor_pendente: valorPendente,
      faturamento_hoje: faturamentoHoje,
      recebido_hoje: recebidoHoje,
      promessas_hoje: promessas?.length || 0,
      proximo_atendimento: proximo ? {
        hora: proximo.hora.slice(0, 5),
        pet: proximo.pets?.nome,
        cliente: proximo.clientes?.nome,
        servico: proximo.servicos?.nome
      } : null
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
    source: 'consultar_historico_pet',
    data: atendimentos
  });
}

export async function analisarRiscoEvasaoIA(sb: SupabaseClient<Database>) {
  const { data: atendimentos } = await sb
    .from("atendimentos")
    .select("pet_id, data_inicio, pets(nome, clientes(nome))")
    .eq("finalizado", true)
    .order("data_inicio", { ascending: false });

  if (!atendimentos || atendimentos.length === 0) return createIAResponse({ source: 'analisar_risco_evasao', data: [] });

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
    source: 'analisar_risco_evasao',
    data: riscos.sort((a, b) => b.dias_ausente - a.dias_ausente).slice(0, 10)
  });
}

export async function obterVisao360Cliente(sb: SupabaseClient<Database>, clienteId: string) {
  const { data: cliente, error: errC } = await sb
    .from("clientes")
    .select("*, pets(*)")
    .eq("id", clienteId)
    .single();

  if (errC) throw errC;

  const { data: pagamentos } = await sb
    .from("pagamentos")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("vencimento", { ascending: false })
    .limit(20);

  const { data: agendamentos } = await sb
    .from("agendamentos")
    .select("*, pets(nome), servicos(nome)")
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .limit(10);

  // Calcular métricas
  const totalGasto = pagamentos?.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.valor_total), 0) || 0;
  const pendencias = pagamentos?.filter(p => p.status !== 'pago' && p.status !== 'cancelado').length || 0;
  const ultimoAtendimento = agendamentos?.find(a => a.status === 'finalizado');
  const proximoAgendamento = agendamentos?.find(a => a.status === 'confirmado' || a.status === 'agendado');

  return createIAResponse({
    source: 'visao_360_cliente',
    data: {
      perfil: cliente,
      metricas: {
        total_gasto: totalGasto,
        total_atendimentos: agendamentos?.length || 0,
        pendencias_financeiras: pendencias,
      },
      historico: {
        ultimo: ultimoAtendimento,
        proximo: proximoAgendamento
      }
    }
  });
}

export async function obterVisao360Pet(sb: SupabaseClient<Database>, petId: string) {
  const { data: pet, error: errP } = await sb
    .from("pets")
    .select("*, clientes(*)")
    .eq("id", petId)
    .single();

  if (errP) throw errP;

  const { data: atendimentos } = await sb
    .from("atendimentos")
    .select("*, agendamento_servicos(nome, valor_unit)")
    .eq("pet_id", petId)
    .order("data_inicio", { ascending: false })
    .limit(10);

  return createIAResponse({
    source: 'visao_360_pet',
    data: {
      perfil: pet,
      atendimentos: atendimentos
    }
  });
}

export async function consultarRiscoFaltaIA(sb: SupabaseClient<Database>, clienteId: string) {
  const { data: agendamentos, error } = await sb
    .from("agendamentos")
    .select("status, data")
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .limit(20);

  if (error) throw error;

  const total = agendamentos?.length || 0;
  const faltas = agendamentos?.filter(a => a.status === 'nao_compareceu').length || 0;
  const cancelamentos = agendamentos?.filter(a => a.status === 'cancelado').length || 0;
  
  const score = total > 0 ? (faltas / total) * 100 : 0;
  
  return createIAResponse({
    source: 'consultar_risco_falta',
    data: {
      total_historico: total,
      faltas,
      cancelamentos,
      score_risco: Math.round(score),
      nivel: score > 30 ? 'Alto' : score > 10 ? 'Médio' : 'Baixo',
      justificativa: score > 0 ? `Cliente possui ${faltas} faltas em ${total} agendamentos.` : "Cliente sem histórico de faltas."
    }
  });
}

export async function criarFilaEsperaIA(
  sb: SupabaseClient<Database>, 
  params: { cliente_id: string; pet_id: string; servico_id: string; data_pretendida: string; periodo?: string }
) {
  // Nota: Assumindo que a tabela 'fila_espera' existe ou simulando via lembretes/obs
  // Para este ERP, vamos usar uma abordagem de metadados se a tabela não for padrão
  const { data, error } = await sb
    .from("notificacoes")
    .insert({
      user_id: (await sb.auth.getUser()).data.user?.id || '',
      titulo: "Novo Registro em Fila de Espera",
      mensagem: `Cliente aguardando vaga para o dia ${params.data_pretendida}`,
      tipo: "fila_espera",
      payload: params
    })
    .select()
    .single();

  if (error) throw error;

  return createIAResponse({
    source: 'criar_fila_espera',
    affected_record_id: data.id,
    data: data
  });
}
