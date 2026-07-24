
-- 1) Substituir a política de UPDATE em profiles para bloquear alteração de colunas sensíveis por não-gestores
DROP POLICY IF EXISTS "Own profile update" ON public.profiles;

CREATE POLICY "Own profile update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.pode_gerenciar_usuarios(auth.uid()))
WITH CHECK (auth.uid() = id OR public.pode_gerenciar_usuarios(auth.uid()));

-- 2) Trigger BEFORE UPDATE que bloqueia mudança de colunas sensíveis por não-gestores
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_manager boolean := false;
BEGIN
  IF _caller IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.pode_gerenciar_usuarios(_caller) INTO _is_manager;

  IF _is_manager THEN
    RETURN NEW;
  END IF;

  -- Usuário comum editando o próprio profile: campos sensíveis devem permanecer inalterados
  IF NEW.perfil IS DISTINCT FROM OLD.perfil
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.bloqueado_em IS DISTINCT FROM OLD.bloqueado_em
     OR NEW.desativado_em IS DISTINCT FROM OLD.desativado_em
     OR NEW.convidado_por IS DISTINCT FROM OLD.convidado_por
     OR NEW.observacoes_admin IS DISTINCT FROM OLD.observacoes_admin
  THEN
    RAISE EXCEPTION 'Alteração de campos administrativos não permitida'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_fields();

-- 3) Reforçar protect_proprietarios: bloquear promoção para proprietario/admin por não-proprietários
CREATE OR REPLACE FUNCTION public.protect_proprietarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller UUID := auth.uid();
  _caller_owner BOOLEAN := false;
  _ativos_owner INT;
BEGIN
  IF _caller IS NOT NULL THEN
    SELECT public.is_proprietario(_caller) INTO _caller_owner;
  END IF;

  IF TG_OP='UPDATE' THEN
    -- Bloquear promoção para proprietario/admin quando o chamador não é proprietário
    IF (NEW.perfil IN ('proprietario','admin'))
       AND (OLD.perfil IS DISTINCT FROM NEW.perfil)
       AND NOT _caller_owner
       AND _caller IS NOT NULL
    THEN
      RAISE EXCEPTION 'Somente um proprietário pode promover usuários a proprietário/admin'
        USING ERRCODE='42501';
    END IF;

    IF OLD.perfil='proprietario' AND NOT _caller_owner AND _caller IS NOT NULL AND _caller <> OLD.id THEN
      RAISE EXCEPTION 'Somente um proprietário pode alterar outro proprietário' USING ERRCODE='42501';
    END IF;
    IF OLD.perfil='proprietario' AND (NEW.perfil <> 'proprietario' OR NEW.status <> 'ativo') THEN
      SELECT count(*) INTO _ativos_owner
        FROM public.profiles
       WHERE perfil='proprietario' AND status='ativo' AND id <> OLD.id;
      IF _ativos_owner < 1 THEN
        RAISE EXCEPTION 'O sistema deve manter ao menos um proprietário ativo' USING ERRCODE='P0001';
      END IF;
    END IF;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.perfil='proprietario' AND NOT _caller_owner THEN
      RAISE EXCEPTION 'Somente um proprietário pode remover outro proprietário' USING ERRCODE='42501';
    END IF;
    IF OLD.perfil='proprietario' THEN
      SELECT count(*) INTO _ativos_owner
        FROM public.profiles
       WHERE perfil='proprietario' AND status='ativo' AND id <> OLD.id;
      IF _ativos_owner < 1 THEN
        RAISE EXCEPTION 'O sistema deve manter ao menos um proprietário ativo' USING ERRCODE='P0001';
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$function$;
