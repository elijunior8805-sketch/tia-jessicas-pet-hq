
CREATE OR REPLACE FUNCTION public.recalcular_agregados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pets_recalc  INT := 0;
  _agend_reab   INT := 0;
  _atend_reset  INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem recalcular agregados' USING ERRCODE = '42501';
  END IF;

  -- 1) Reset de valor_executado / encerramento em atendimentos sem
  --    serviços executados nem pagamentos remanescentes. Assim, atendimentos
  --    "fantasma" (que ficaram com valor executado herdado após exclusão de
  --    lançamentos) voltam ao estado aberto e somem dos KPIs.
  WITH alvos AS (
    SELECT a.id
      FROM public.atendimentos a
      LEFT JOIN public.pagamentos p ON p.atendimento_id = a.id
     WHERE p.id IS NULL
       AND (
         a.servicos_executados IS NULL
         OR jsonb_typeof(a.servicos_executados) <> 'array'
         OR jsonb_array_length(a.servicos_executados) = 0
       )
       AND (
         COALESCE(a.valor_executado, 0) > 0
         OR a.encerrado_em IS NOT NULL
         OR a.finalizado = true
       )
  ), upd AS (
    UPDATE public.atendimentos a
       SET valor_executado = 0,
           encerrado_em    = NULL,
           finalizado      = false
      FROM alvos
     WHERE a.id = alvos.id
    RETURNING a.id
  ) SELECT count(*) INTO _atend_reset FROM upd;

  -- 2) Reabre agendamentos que apontam para atendimentos que não existem mais
  --    (ex.: atendimento excluído sem passar pela RPC). Volta ao estado "agendado".
  WITH upd AS (
    UPDATE public.agendamentos ag
       SET status = 'agendado'
     WHERE ag.status = 'finalizado'
       AND NOT EXISTS (
         SELECT 1 FROM public.atendimentos a
          WHERE a.agendamento_id = ag.id
            AND a.encerrado_em IS NOT NULL
            AND a.finalizado = true
       )
    RETURNING ag.id
  ) SELECT count(*) INTO _agend_reab FROM upd;

  -- 3) Recalcula histórico de cada pet a partir dos atendimentos remanescentes
  --    (apenas os efetivamente encerrados contam).
  WITH base AS (
    SELECT p.id AS pet_id,
           (SELECT MAX((a.data_fim)::date)
              FROM public.atendimentos a
             WHERE a.pet_id = p.id
               AND a.encerrado_em IS NOT NULL
               AND a.finalizado = true
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(COALESCE(a.servicos_executados, '[]'::jsonb)) e
                  WHERE lower(coalesce(e->>'nome','')) LIKE '%banho%'
               )
           ) AS ultimo_banho,
           (SELECT MAX((a.data_fim)::date)
              FROM public.atendimentos a
             WHERE a.pet_id = p.id
               AND a.encerrado_em IS NOT NULL
               AND a.finalizado = true
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(COALESCE(a.servicos_executados, '[]'::jsonb)) e
                  WHERE lower(coalesce(e->>'nome','')) LIKE '%tosa%'
               )
           ) AS ultima_tosa,
           (SELECT MAX(a.proxima_visita)
              FROM public.atendimentos a
             WHERE a.pet_id = p.id
               AND a.encerrado_em IS NOT NULL
               AND a.finalizado = true
               AND a.proxima_visita IS NOT NULL
           ) AS proxima_visita
      FROM public.pets p
  ), upd AS (
    UPDATE public.pets p
       SET ultimo_banho   = base.ultimo_banho,
           ultima_tosa    = base.ultima_tosa,
           proxima_visita = base.proxima_visita
      FROM base
     WHERE p.id = base.pet_id
       AND (
         p.ultimo_banho   IS DISTINCT FROM base.ultimo_banho
         OR p.ultima_tosa   IS DISTINCT FROM base.ultima_tosa
         OR p.proxima_visita IS DISTINCT FROM base.proxima_visita
       )
    RETURNING p.id
  ) SELECT count(*) INTO _pets_recalc FROM upd;

  RETURN jsonb_build_object(
    'atendimentos_resetados', _atend_reset,
    'agendamentos_reabertos', _agend_reab,
    'pets_recalculados',      _pets_recalc,
    'executado_em',           now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_agregados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_agregados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_agregados() TO service_role;
