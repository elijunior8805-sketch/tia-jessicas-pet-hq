
CREATE OR REPLACE VIEW public.pets_reativacao
WITH (security_invoker = true) AS
WITH ult_atend AS (
  SELECT
    a.pet_id,
    MAX(COALESCE(a.encerrado_em, a.data_fim, a.data_inicio))::timestamptz AS ultimo_em,
    AVG(NULLIF(COALESCE(a.valor_executado, a.valor_planejado, 0), 0))::numeric(10,2) AS ticket_medio,
    COUNT(*) AS total_atendimentos
  FROM public.atendimentos a
  WHERE a.pet_id IS NOT NULL
  GROUP BY a.pet_id
),
prox_agend AS (
  SELECT DISTINCT ag.pet_id
  FROM public.agendamentos ag
  WHERE ag.pet_id IS NOT NULL
    AND ag.data >= CURRENT_DATE
    AND ag.status NOT IN ('cancelado','nao_compareceu')
),
ult_contato AS (
  SELECT
    p.id AS pet_id,
    MAX(m.created_at) FILTER (
      WHERE m.direcao = 'out' AND (m.tags ? 'reativacao')
    ) AS ultimo_contato_em
  FROM public.pets p
  LEFT JOIN public.mensagens m ON m.cliente_id = p.cliente_id
  GROUP BY p.id
),
retorno_pos_contato AS (
  SELECT DISTINCT p.id AS pet_id
  FROM public.pets p
  JOIN ult_contato uc ON uc.pet_id = p.id AND uc.ultimo_contato_em IS NOT NULL
  JOIN public.agendamentos ag ON ag.pet_id = p.id
  WHERE ag.created_at >= uc.ultimo_contato_em
)
SELECT
  p.id AS pet_id,
  p.nome AS pet_nome,
  p.foto_url AS pet_foto,
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.telefone AS cliente_telefone,
  c.whatsapp AS cliente_whatsapp,
  ua.ultimo_em AS ultimo_atendimento_em,
  GREATEST(0, (CURRENT_DATE - ua.ultimo_em::date))::int AS dias_inativo,
  CASE
    WHEN ua.ultimo_em IS NULL THEN 'sem_historico'
    WHEN (CURRENT_DATE - ua.ultimo_em::date) >= 120 THEN 'critico'
    WHEN (CURRENT_DATE - ua.ultimo_em::date) >= 90  THEN 'alto'
    WHEN (CURRENT_DATE - ua.ultimo_em::date) >= 60  THEN 'medio'
    WHEN (CURRENT_DATE - ua.ultimo_em::date) >= 30  THEN 'baixo'
    ELSE 'recente'
  END AS faixa,
  COALESCE(ua.ticket_medio, 0)::numeric(10,2) AS ticket_medio,
  COALESCE(ua.total_atendimentos, 0)::int AS total_atendimentos,
  uc.ultimo_contato_em AS ultimo_contato_reativacao_em,
  (rpc.pet_id IS NOT NULL) AS retornou_apos_contato
FROM public.pets p
JOIN public.clientes c ON c.id = p.cliente_id
LEFT JOIN ult_atend ua ON ua.pet_id = p.id
LEFT JOIN ult_contato uc ON uc.pet_id = p.id
LEFT JOIN retorno_pos_contato rpc ON rpc.pet_id = p.id
WHERE p.id NOT IN (SELECT pet_id FROM prox_agend)
  AND (ua.ultimo_em IS NULL OR (CURRENT_DATE - ua.ultimo_em::date) >= 30);

GRANT SELECT ON public.pets_reativacao TO authenticated;
