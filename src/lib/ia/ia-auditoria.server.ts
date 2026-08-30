import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getResumoNegocioIA() {
  const hoje = new Date().toISOString().split('T')[0];
  const [
    atendimentosRes,
    pagamentosRes,
    estoqueRes,
    petsRes
  ] = await Promise.all([
    supabaseAdmin.from('atendimentos').select('id', { count: 'exact', head: true }).eq('data' as any, hoje),
    supabaseAdmin.from('pagamentos').select('id', { count: 'exact', head: true }).eq('status', 'pendente').is('arquivado_em', null),
    supabaseAdmin.from('produtos_estoque').select('id, quantidade, estoque_minimo').eq('ativo', true),
    supabaseAdmin.from('pets').select('id', { count: 'exact', head: true })
  ]);

  const itensCriticos = (estoqueRes.data || []).filter(
    (item: any) => Number(item.quantidade || 0) <= Number(item.estoque_minimo || 0)
  ).length;

  return {
    urgencias: itensCriticos > 0 ? [`${itensCriticos} item(ns) com estoque baixo detectado`] : [],
    agenda: { hoje: atendimentosRes.count || 0 },
    financeiro: { pendencias: pagamentosRes.count || 0 },
    estoque: { itens_criticos: itensCriticos },
    oportunidades: petsRes.count ? [`${petsRes.count} pets cadastrados no sistema`] : []
  };
}

export async function getIndicadoresQualidadeIA() {
  // @ts-ignore - Supabase types might not be updated yet
  const { data, error } = await supabaseAdmin
    .from('auditoria_ia' as any)
    .select('sucesso, tempo_resposta_ms');

  if (error) {
    console.error("Erro ao buscar indicadores de qualidade IA:", error);
    return { total_comandos: 0, taxa_sucesso: 100, tempo_medio_ms: 0 };
  }

  const total = (data as any[]).length;
  const sucessos = (data as any[]).filter(d => d.sucesso).length;
  const tempoMedio = (data as any[]).reduce((acc, curr) => acc + (curr.tempo_resposta_ms || 0), 0) / (total || 1);

  return {
    total_comandos: total,
    taxa_sucesso: total > 0 ? (sucessos / total) * 100 : 100,
    tempo_medio_ms: tempoMedio
  };
}

export async function getLogsAuditoriaIA(limit = 50) {
  // @ts-ignore - Supabase types might not be updated yet
  const { data, error } = await supabaseAdmin
    .from('auditoria_ia' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function registrarAuditoriaIA(params: {
  user_id?: string;
  comando_original: string;
  intencao_detectada?: string;
  especialista?: string;
  ferramenta_utilizada?: string;
  parametros?: any;
  resposta_ia?: string;
  sucesso?: boolean;
  tempo_resposta_ms?: number;
}) {
  // @ts-ignore - Supabase types might not be updated yet
  const { error } = await supabaseAdmin
    .from('auditoria_ia' as any)
    .insert([params]);

  if (error) console.error("Erro ao registrar auditoria IA:", error);
}

export async function realizarAuditoriaDadosIA(supabase?: any) {
  const client = supabase || supabaseAdmin;

  try {
    const [atendimentos, pagamentos] = await Promise.all([
      client
        .from("atendimentos")
        .select("id, data, cliente_id, pet_id, finalizado, valor_executado, clientes(nome), pets(nome)")
        .eq("finalizado", true)
        .order("data", { ascending: false })
        .limit(100),
      client
        .from("pagamentos")
        .select("id, atendimento_id, valor_total, valor_pago, status, arquivado_em")
        .is("arquivado_em", null)
        .limit(200)
    ]);

    const pagamentosMap = new Map((pagamentos.data || []).map((p: any) => [p.atendimento_id, p]));

    const atendimentosSemPagamento = (atendimentos.data || []).filter(
      (a: any) => !pagamentosMap.has(a.id) && Number(a.valor_executado || 0) > 0
    );

    const pagamentosZerados = (pagamentos.data || []).filter(
      (p: any) => Number(p.valor_total || 0) <= 0 && p.status !== "cancelado"
    );

    const alertasTotal = atendimentosSemPagamento.length + pagamentosZerados.length;

    return {
      status: "ok",
      data: {
        resumo: { alertas: alertasTotal },
        atendimentos_sem_pagamento: atendimentosSemPagamento,
        pagamentos_zerados: pagamentosZerados,
        provaveis_duplicidades: []
      }
    };
  } catch (err: any) {
    console.error("[ia-auditoria] Erro ao realizar auditoria de dados:", err);
    return {
      status: "erro",
      data: {
        resumo: { alertas: 0 },
        atendimentos_sem_pagamento: [],
        pagamentos_zerados: [],
        provaveis_duplicidades: []
      }
    };
  }
}
