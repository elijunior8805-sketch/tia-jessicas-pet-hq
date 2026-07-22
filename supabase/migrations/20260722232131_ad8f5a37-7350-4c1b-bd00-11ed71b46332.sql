
-- 1) Trigger function: mantém agendamentos.status sincronizado com atendimentos.finalizado
CREATE OR REPLACE FUNCTION public.sync_agendamento_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.agendamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.finalizado = true THEN
      UPDATE public.agendamentos SET status = 'finalizado'
       WHERE id = NEW.agendamento_id AND status IS DISTINCT FROM 'finalizado';
    ELSE
      UPDATE public.agendamentos SET status = 'em_atendimento'
       WHERE id = NEW.agendamento_id
         AND status NOT IN ('em_atendimento','finalizado','cancelado','nao_compareceu');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.finalizado IS DISTINCT FROM OLD.finalizado THEN
      IF NEW.finalizado = true THEN
        UPDATE public.agendamentos SET status = 'finalizado'
         WHERE id = NEW.agendamento_id AND status IS DISTINCT FROM 'finalizado';
      ELSE
        UPDATE public.agendamentos SET status = 'em_atendimento'
         WHERE id = NEW.agendamento_id AND status = 'finalizado';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agendamento_status ON public.atendimentos;
CREATE TRIGGER trg_sync_agendamento_status
AFTER INSERT OR UPDATE OF finalizado ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.sync_agendamento_status();

-- 2) Backfill dos agendamentos que ficaram travados em "em_atendimento"
UPDATE public.agendamentos ag
   SET status = 'finalizado'
  FROM public.atendimentos at
 WHERE at.agendamento_id = ag.id
   AND at.finalizado = true
   AND ag.status IS DISTINCT FROM 'finalizado'
   AND ag.status NOT IN ('cancelado','nao_compareceu');
