import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function consultarEstoque(filtros: { termo?: string; categoria?: string; apenasBaixo?: boolean }) {
  let query = supabaseAdmin
    .from('produtos_estoque')
    .select('*')
    .eq('ativo', true);

  if (filtros.termo) {
    query = query.ilike('nome', `%${filtros.termo}%`);
  }

  if (filtros.categoria) {
    query = query.eq('categoria', filtros.categoria);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (filtros.apenasBaixo && data) {
    return data.filter(p => Number(p.quantidade || 0) <= Number(p.estoque_minimo || 0));
  }

  return data;
}

export async function consultarComprasAbertas(status?: string) {
  let query = supabaseAdmin
    .from('compras')
    .select('*, fornecedores(nome)')
    .eq('recebido', false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function consultarFornecedores(termo?: string) {
  let query = supabaseAdmin
    .from('fornecedores')
    .select('*')
    .eq('ativo', true);

  if (termo) {
    query = query.ilike('nome', `%${termo}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function sugerirCompras() {
  // Busca produtos abaixo do mínimo
  const { data: produtos, error } = await supabaseAdmin
    .from('produtos_estoque')
    .select('*')
    .eq('ativo', true);
  
  if (error) throw error;

  const sugestoes = produtos
    .filter(p => (p.quantidade || 0) <= (p.estoque_minimo || 0))
    .map(p => ({
      produto_id: p.id,
      nome: p.nome,
      saldo: p.quantidade,
      minimo: p.estoque_minimo,
      sugestao: (p.estoque_minimo || 0) * 2 - (p.quantidade || 0), // Lógica simples de reposição
      prioridade: (p.quantidade || 0) <= 0 ? 'CRÍTICA' : 'ALTA'
    }));

  return sugestoes;
}

export async function detectarAnomaliasEstoque() {
  const { data: produtos } = await supabaseAdmin
    .from('produtos_estoque')
    .select('*');

  const anomalias = [];

  for (const p of (produtos || [])) {
    if (p.quantidade < 0) {
      anomalias.push({
        tipo: 'SALDO_NEGATIVO',
        produto: p.nome,
        detalhe: `Saldo atual: ${p.quantidade}`
      });
    }
    
    if (!p.unidade) {
      anomalias.push({
        tipo: 'PRODUTO_SEM_UNIDADE',
        produto: p.nome,
        detalhe: 'Unidade de medida não definida'
      });
    }
  }

  return anomalias;
}
