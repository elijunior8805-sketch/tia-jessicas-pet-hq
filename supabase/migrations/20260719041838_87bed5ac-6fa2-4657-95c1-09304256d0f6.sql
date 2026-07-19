
CREATE OR REPLACE FUNCTION public.excluir_atendimento(_atendimento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  _pet_id uuid;
  _agend_id uuid;
  _ultimo_banho date;
  _ultima_tosa date;
  _proxima_visita date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir atendimentos';
  END IF;

  SELECT id, agendamento_id, pet_id INTO a
    FROM public.atendimentos WHERE id = _atendimento_id;
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Atendimento não encontrado';
  END IF;

  _pet_id := a.pet_id;
  _agend_id := a.agendamento_id;

  -- 1) Remove pagamentos vinculados
  DELETE FROM public.pagamentos WHERE atendimento_id = _atendimento_id;

  -- 2) Remove o atendimento
  DELETE FROM public.atendimentos WHERE id = _atendimento_id;

  -- 3) Reverte agendamento vinculado
  IF _agend_id IS NOT NULL THEN
    UPDATE public.agendamentos
       SET status = 'agendado'
     WHERE id = _agend_id;
  END IF;

  -- 4) Recalcula histórico do pet a partir dos atendimentos remanescentes
  IF _pet_id IS NOT NULL THEN
    SELECT MAX((data_fim)::date)
      INTO _ultimo_banho
      FROM public.atendimentos
     WHERE pet_id = _pet_id
       AND encerrado_em IS NOT NULL
       AND (
         EXISTS (
           SELECT 1 FROM jsonb_array_elements(servicos_executados) e
            WHERE lower(coalesce(e->>'nome','')) LIKE '%banho%'
         )
       );

    SELECT MAX((data_fim)::date)
      INTO _ultima_tosa
      FROM public.atendimentos
     WHERE pet_id = _pet_id
       AND encerrado_em IS NOT NULL
       AND (
         EXISTS (
           SELECT 1 FROM jsonb_array_elements(servicos_executados) e
            WHERE lower(coalesce(e->>'nome','')) LIKE '%tosa%'
         )
       );

    SELECT MAX(proxima_visita)
      INTO _proxima_visita
      FROM public.atendimentos
     WHERE pet_id = _pet_id
       AND encerrado_em IS NOT NULL
       AND proxima_visita IS NOT NULL;

    UPDATE public.pets
       SET ultimo_banho = _ultimo_banho,
           ultima_tosa = _ultima_tosa,
           proxima_visita = _proxima_visita
     WHERE id = _pet_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_atendimento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_atendimento(uuid) TO authenticated;
