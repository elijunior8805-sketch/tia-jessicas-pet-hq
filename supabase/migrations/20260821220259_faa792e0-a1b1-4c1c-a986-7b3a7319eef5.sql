-- Apply the fix for attendance/charge deletion synchronization
DO $$
BEGIN
  -- Update the function
  CREATE OR REPLACE FUNCTION public.excluir_atendimento(_atendimento_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
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

    -- Archive charges
    UPDATE public.cobrancas 
       SET arquivada_em = now() 
     WHERE atendimento_id = _atendimento_id;

    -- Remove pagamentos (this will trigger further cleanups if any)
    DELETE FROM public.pagamentos WHERE atendimento_id = _atendimento_id;

    -- Remove the attendance
    DELETE FROM public.atendimentos WHERE id = _atendimento_id;

    -- Revert appointment status
    IF _agend_id IS NOT NULL THEN
      UPDATE public.agendamentos
         SET status = 'agendado'
       WHERE id = _agend_id;
    END IF;

    -- Recalculate pet stats
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
  $func$;

  -- Add payment deletion handler
  CREATE OR REPLACE FUNCTION public.handle_pagamento_deletion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
  BEGIN
    UPDATE public.cobrancas 
       SET arquivada_em = now() 
     WHERE pagamento_id = OLD.id;
    RETURN OLD;
  END;
  $func$;

  DROP TRIGGER IF EXISTS trg_pag_delete_cobranca ON public.pagamentos;
  CREATE TRIGGER trg_pag_delete_cobranca
  BEFORE DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_pagamento_deletion();
END $$;
