-- Function to calculate total executed value consistently
CREATE OR REPLACE FUNCTION public.get_atendimento_total_executado(atendimento_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT SUM(valor_unit) FROM public.agendamento_servicos WHERE agendamento_id = $1), 
    0
  ) + COALESCE(
    (SELECT taxa_leva_traz FROM public.atendimentos WHERE id = $1),
    0
  ) - COALESCE(
    (SELECT desconto FROM public.atendimentos WHERE id = $1),
    0
  );
$$;

-- View for unified financial indicators
CREATE OR REPLACE VIEW public.vw_financeiro_indicadores AS
WITH receita_competencia AS (
  -- Faturamento por data de atendimento (Competência)
  SELECT 
    data_inicio::date as data_referencia,
    'receita_servico' as tipo,
    SUM(public.get_atendimento_total_executado(id)) as valor,
    COUNT(*) as quantidade_atendimentos
  FROM public.atendimentos
  WHERE finalizado = true 
  GROUP BY 1
),
receita_caixa AS (
  -- Entradas por data de pagamento (Caixa)
  -- Filtra apenas categorias que não são 'aporte' ou 'ajuste' para faturamento de serviços
  SELECT 
    data_pagamento::date as data_referencia,
    'receita_recebida' as tipo,
    SUM(valor_pago) as valor,
    0 as quantidade_atendimentos
  FROM public.pagamentos
  WHERE status = 'pago' 
    AND (is_teste IS FALSE OR is_teste IS NULL)
    AND (categoria_receita NOT IN ('aporte', 'ajuste') OR categoria_receita IS NULL)
  GROUP BY 1
),
despesas_caixa AS (
  -- Saídas por data de pagamento (Caixa)
  SELECT 
    data_pagamento::date as data_referencia,
    'despesa_paga' as tipo,
    SUM(valor_pago) as valor,
    0 as quantidade_atendimentos
  FROM public.compras_parcelas
  WHERE status = 'pago' 
    AND (is_teste IS FALSE OR is_teste IS NULL)
  GROUP BY 1
),
aportes_caixa AS (
  -- Aportes por data de pagamento
  SELECT 
    data_pagamento::date as data_referencia,
    'aporte_recebido' as tipo,
    SUM(valor_pago) as valor,
    0 as quantidade_atendimentos
  FROM public.pagamentos
  WHERE status = 'pago' 
    AND (is_teste IS FALSE OR is_teste IS NULL)
    AND categoria_receita IN ('aporte', 'ajuste')
  GROUP BY 1
)
SELECT * FROM receita_competencia
UNION ALL
SELECT * FROM receita_caixa
UNION ALL
SELECT * FROM despesas_caixa
UNION ALL
SELECT * FROM aportes_caixa;

GRANT SELECT ON public.vw_financeiro_indicadores TO authenticated;
GRANT SELECT ON public.vw_financeiro_indicadores TO service_role;
