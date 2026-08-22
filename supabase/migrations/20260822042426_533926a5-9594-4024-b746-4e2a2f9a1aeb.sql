CREATE OR REPLACE FUNCTION public.get_atendimento_total_executado(atendimento_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    COALESCE(a.valor_executado, 0) + COALESCE(a.taxa_leva_traz, 0) - COALESCE(a.desconto, 0)
  )
  FROM public.atendimentos a
  WHERE a.id = $1;
$$;

CREATE OR REPLACE VIEW public.vw_financeiro_indicadores AS
WITH receita_competencia AS (
  SELECT (a.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date AS data_referencia,
         'receita_servico'::text AS tipo,
         sum(GREATEST(0, COALESCE(a.valor_executado,0) + COALESCE(a.taxa_leva_traz,0) - COALESCE(a.desconto,0))) AS valor,
         count(*) FILTER (
           WHERE GREATEST(0, COALESCE(a.valor_executado,0) + COALESCE(a.taxa_leva_traz,0) - COALESCE(a.desconto,0)) > 0
         ) AS quantidade_atendimentos
  FROM public.atendimentos a
  WHERE a.finalizado = true
  GROUP BY 1
), receita_caixa AS (
  SELECT p.data_pagamento AS data_referencia,
         'receita_recebida'::text AS tipo,
         sum(p.valor_pago) AS valor,
         0 AS quantidade_atendimentos
  FROM public.pagamentos p
  WHERE p.status IN ('pago'::pagamento_status, 'parcial'::pagamento_status)
    AND COALESCE(p.valor_pago,0) > 0
    AND p.data_pagamento IS NOT NULL
    AND p.arquivado_em IS NULL
    AND COALESCE(p.is_teste,false) = false
    AND (p.categoria_receita IS NULL OR p.categoria_receita <> ALL (ARRAY['aporte','ajuste']))
  GROUP BY 1
), despesas_caixa AS (
  SELECT cp.data_pagamento AS data_referencia,
         'despesa_paga'::text AS tipo,
         sum(cp.valor_pago) AS valor,
         0 AS quantidade_atendimentos
  FROM public.compras_parcelas cp
  WHERE cp.status IN ('pago'::parcela_status, 'parcial'::parcela_status)
    AND COALESCE(cp.valor_pago,0) > 0
    AND cp.data_pagamento IS NOT NULL
    AND cp.arquivado_em IS NULL
    AND COALESCE(cp.is_teste,false) = false
  GROUP BY 1
), aportes_caixa AS (
  SELECT p.data_pagamento AS data_referencia,
         'aporte_recebido'::text AS tipo,
         sum(p.valor_pago) AS valor,
         0 AS quantidade_atendimentos
  FROM public.pagamentos p
  WHERE p.status IN ('pago'::pagamento_status, 'parcial'::pagamento_status)
    AND COALESCE(p.valor_pago,0) > 0
    AND p.data_pagamento IS NOT NULL
    AND p.arquivado_em IS NULL
    AND COALESCE(p.is_teste,false) = false
    AND p.categoria_receita = ANY (ARRAY['aporte','ajuste'])
  GROUP BY 1
)
SELECT * FROM receita_competencia
UNION ALL SELECT * FROM receita_caixa
UNION ALL SELECT * FROM despesas_caixa
UNION ALL SELECT * FROM aportes_caixa;

GRANT SELECT ON public.vw_financeiro_indicadores TO authenticated;
GRANT SELECT ON public.vw_financeiro_indicadores TO service_role;