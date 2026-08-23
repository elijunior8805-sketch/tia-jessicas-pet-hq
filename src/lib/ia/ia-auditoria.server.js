import { supabaseAdmin } from "@/integrations/supabase/client.server";
export async function getResumoNegocioIA() {
    const [atendimentosRes, pagamentosRes, estoqueRes, petsRes] = await Promise.all([
        supabaseAdmin.from('atendimentos').select('id', { count: 'exact', head: true }).eq('data', new Date().toISOString().split('T')[0]),
        supabaseAdmin.from('pagamentos').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabaseAdmin.from('produtos_estoque').select('id', { count: 'exact', head: true }).lte('quantidade', 'estoque_minimo'),
        supabaseAdmin.from('pets').select('id', { count: 'exact', head: true })
    ]);
    return {
        urgencias: (estoqueRes.count || 0) > 0 ? ['Estoque baixo detectado'] : [],
        agenda: { hoje: atendimentosRes.count || 0 },
        financeiro: { pendencias: pagamentosRes.count || 0 },
        estoque: { itens_criticos: estoqueRes.count || 0 },
        oportunidades: petsRes.count ? [`${petsRes.count} pets cadastrados no sistema`] : []
    };
}
export async function getIndicadoresQualidadeIA() {
    // @ts-ignore - Supabase types might not be updated yet
    const { data, error } = await supabaseAdmin
        .from('auditoria_ia')
        .select('sucesso, tempo_resposta_ms');
    if (error) {
        console.error("Erro ao buscar indicadores de qualidade IA:", error);
        return { total_comandos: 0, taxa_sucesso: 100, tempo_medio_ms: 0 };
    }
    const total = data.length;
    const sucessos = data.filter(d => d.sucesso).length;
    const tempoMedio = data.reduce((acc, curr) => acc + (curr.tempo_resposta_ms || 0), 0) / (total || 1);
    return {
        total_comandos: total,
        taxa_sucesso: total > 0 ? (sucessos / total) * 100 : 100,
        tempo_medio_ms: tempoMedio
    };
}
export async function getLogsAuditoriaIA(limit = 50) {
    // @ts-ignore - Supabase types might not be updated yet
    const { data, error } = await supabaseAdmin
        .from('auditoria_ia')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return data;
}
export async function registrarAuditoriaIA(params) {
    // @ts-ignore - Supabase types might not be updated yet
    const { error } = await supabaseAdmin
        .from('auditoria_ia')
        .insert([params]);
    if (error)
        console.error("Erro ao registrar auditoria IA:", error);
}
export async function realizarAuditoriaDadosIA(supabase) {
    // Use admin client if supabase instance not provided
    const client = supabase || supabaseAdmin;
    // Example implementation that returns structure expected by UI
    return {
        status: 'ok',
        data: {
            resumo: { alertas: 0 },
            atendimentos_sem_pagamento: [],
            pagamentos_zerados: [],
            provaveis_duplicidades: []
        }
    };
}
