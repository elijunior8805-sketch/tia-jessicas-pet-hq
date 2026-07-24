
-- Function: recompute pagamentos.valor_total from atendimento real values
CREATE OR REPLACE FUNCTION public.recompute_pagamento_from_atendimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  novo_total NUMERIC(12,2);
BEGIN
  IF NEW.finalizado IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND
     COALESCE(NEW.valor_executado,0) = COALESCE(OLD.valor_executado,0) AND
     COALESCE(NEW.taxa_leva_traz,0) = COALESCE(OLD.taxa_leva_traz,0) AND
     COALESCE(NEW.desconto,0) = COALESCE(OLD.desconto,0) AND
     COALESCE(NEW.finalizado,false) = COALESCE(OLD.finalizado,false) THEN
    RETURN NEW;
  END IF;

  novo_total := GREATEST(
    COALESCE(NEW.valor_executado,0) + COALESCE(NEW.taxa_leva_traz,0) - COALESCE(NEW.desconto,0),
    0
  );

  UPDATE public.pagamentos
     SET valor_total = novo_total
   WHERE atendimento_id = NEW.id
     AND valor_total IS DISTINCT FROM novo_total;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_pagamento_from_atendimento ON public.atendimentos;
CREATE TRIGGER trg_recompute_pagamento_from_atendimento
AFTER INSERT OR UPDATE OF valor_executado, taxa_leva_traz, desconto, finalizado
ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.recompute_pagamento_from_atendimento();

-- Backfill: fix all pagamentos linked to finalized atendimentos
UPDATE public.pagamentos p
   SET valor_total = GREATEST(
     COALESCE(a.valor_executado,0) + COALESCE(a.taxa_leva_traz,0) - COALESCE(a.desconto,0),
     0
   )
  FROM public.atendimentos a
 WHERE p.atendimento_id = a.id
   AND a.finalizado = true
   AND p.valor_total IS DISTINCT FROM GREATEST(
     COALESCE(a.valor_executado,0) + COALESCE(a.taxa_leva_traz,0) - COALESCE(a.desconto,0),
     0
   );

-- Force cobrancas resync by touching pagamentos (fires sync_cobranca_from_pagamento)
UPDATE public.pagamentos p
   SET updated_at = now()
  FROM public.cobrancas c
 WHERE c.pagamento_id = p.id
   AND c.saldo IS DISTINCT FROM GREATEST(COALESCE(p.valor_total,0) - COALESCE(p.valor_pago,0), 0);
