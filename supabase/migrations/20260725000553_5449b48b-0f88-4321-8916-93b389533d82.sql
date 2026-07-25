-- Trigger de auditoria específica para mudanças em taxa_leva_traz / desconto
CREATE OR REPLACE FUNCTION public.audit_atendimento_taxa_desconto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  mudou_taxa boolean := COALESCE(NEW.taxa_leva_traz,0) IS DISTINCT FROM COALESCE(OLD.taxa_leva_traz,0);
  mudou_desc boolean := COALESCE(NEW.desconto,0)      IS DISTINCT FROM COALESCE(OLD.desconto,0);
  payload_old jsonb;
  payload_new jsonb;
BEGIN
  IF NOT (mudou_taxa OR mudou_desc) THEN
    RETURN NEW;
  END IF;

  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  payload_old := jsonb_build_object(
    'taxa_leva_traz', OLD.taxa_leva_traz,
    'desconto',       OLD.desconto,
    'valor_executado',OLD.valor_executado
  );
  payload_new := jsonb_build_object(
    'taxa_leva_traz', NEW.taxa_leva_traz,
    'desconto',       NEW.desconto,
    'valor_executado',NEW.valor_executado,
    'campos_alterados',
      (CASE WHEN mudou_taxa THEN jsonb_build_array('taxa_leva_traz') ELSE '[]'::jsonb END)
      || (CASE WHEN mudou_desc THEN jsonb_build_array('desconto') ELSE '[]'::jsonb END),
    'cliente_id', NEW.cliente_id,
    'pet_id',     NEW.pet_id
  );

  INSERT INTO public.audit_log(user_id, user_email, table_name, record_id, action, old_data, new_data)
  VALUES (uid, uemail, 'atendimentos', NEW.id::text, 'UPDATE_TAXA_DESCONTO', payload_old, payload_new);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atend_audit_taxa_desconto ON public.atendimentos;
CREATE TRIGGER trg_atend_audit_taxa_desconto
AFTER UPDATE OF taxa_leva_traz, desconto ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.audit_atendimento_taxa_desconto();