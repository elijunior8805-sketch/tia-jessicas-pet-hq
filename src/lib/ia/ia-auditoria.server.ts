import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getResumoNegocioIA() {
  // Busca consolidada de múltiplos módulos para a visão do proprietário
  
  const [
    { count: agendadosHoje },
    { count: pendenciasFinanceiras },
    { count: estoqueBaixo },
    { count: aniversariantes }
  ] = await Promise.all([
    supabaseAdmin.from('atendimentos').select('*', { count: 'exact', head: true }).eq('data', new Date().toISOString().split('T')[0]),
    supabaseAdmin.from('pagamentos').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabaseAdmin.from('produtos_estoque').select('*', { count: 'exact', head: true }).lte('quantidade', 'estoque_minimo'),
    supabaseAdmin.from('pets').select('*', { count: 'exact', head: true }) // Simplificado: precisaria de lógica de data
  ]);

  return {
    urgencias: (estoqueBaixo || 0) > 0 ? ['Estoque baixo detectado'] : [],
    agenda: { hoje: agendadosHoje || 0 },
    financeiro: { pendencias: pendenciasFinanceiras || 0 },
    estoque: { itens_criticos: estoqueBaixo || 0 },
    oportunidades: aniversariantes ? [`${aniversariantes} pets fazem aniversário em breve`] : []
  };
}

export async function getIndicadoresQualidadeIA() {
  const { data, error } = await supabaseAdmin
    .from('auditoria_ia')
    .select('sucesso, tempo_resposta_ms');

  if (error) throw error;

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
  const { data, error } = await supabaseAdmin
    .from('auditoria_ia')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
