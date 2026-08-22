
-- Recriar a view com correção na conversão de fuso horário e tratamento de nulos
CREATE OR REPLACE VIEW public.vw_financeiro_indicadores AS
WITH receita_competencia AS (
    SELECT 
        (a.data_inicio AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date AS data_referencia,
        'receita_servico'::text AS tipo,
        SUM(GREATEST(0, COALESCE(a.valor_executado, 0) + COALESCE(a.taxa_leva_traz, 0) - COALESCE(a.desconto, 0))) AS valor,
        COUNT(*) FILTER (WHERE a.finalizado = true) AS quantidade_atendimentos
    FROM atendimentos a
    WHERE a.finalizado = true
    GROUP BY 1
),
receita_caixa AS (
    SELECT 
        p.data_pagamento AS data_referencia,
        'receita_recebida'::text AS tipo,
        SUM(p.valor_pago) AS valor,
        0 AS quantidade_atendimentos
    FROM pagamentos p
    WHERE (p.status = 'pago' OR p.status = 'parcial')
    AND p.data_pagamento IS NOT NULL
    AND p.arquivado_em IS NULL
    AND (p.is_teste IS NULL OR p.is_teste = false)
    AND (p.categoria_receita IS NULL OR (p.categoria_receita NOT IN ('aporte', 'ajuste')))
    GROUP BY p.data_pagamento
),
despesas_caixa AS (
    SELECT 
        cp.data_pagamento AS data_referencia,
        'despesa_paga'::text AS tipo,
        SUM(cp.valor_pago) AS valor,
        0 AS quantidade_atendimentos
    FROM compras_parcelas cp
    WHERE (cp.status = 'pago' OR cp.status = 'parcial')
    AND cp.data_pagamento IS NOT NULL
    AND cp.arquivado_em IS NULL
    AND (cp.is_teste IS NULL OR cp.is_teste = false)
    GROUP BY cp.data_pagamento
),
aportes_caixa AS (
    SELECT 
        p.data_pagamento AS data_referencia,
        'aporte_recebido'::text AS tipo,
        SUM(p.valor_pago) AS valor,
        0 AS quantidade_atendimentos
    FROM pagamentos p
    WHERE (p.status = 'pago' OR p.status = 'parcial')
    AND p.data_pagamento IS NOT NULL
    AND p.arquivado_em IS NULL
    AND (p.is_teste IS NULL OR p.is_teste = false)
    AND p.categoria_receita IN ('aporte', 'ajuste')
    GROUP BY p.data_pagamento
)
SELECT * FROM receita_competencia
UNION ALL SELECT * FROM receita_caixa
UNION ALL SELECT * FROM despesas_caixa
UNION ALL SELECT * FROM aportes_caixa;

-- Garantir acesso
GRANT SELECT ON public.vw_financeiro_indicadores TO authenticated;
GRANT ALL ON public.vw_financeiro_indicadores TO service_role;
