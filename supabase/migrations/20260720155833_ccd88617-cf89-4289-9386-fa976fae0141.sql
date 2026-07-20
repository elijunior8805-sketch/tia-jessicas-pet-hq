
-- =========================================================
-- Central de Usuários, Acessos e Segurança
-- =========================================================

-- 1) Perfil operacional e status na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perfil TEXT NOT NULL DEFAULT 'atendente',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS desativado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS convidado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS observacoes_admin TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_perfil_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_perfil_check
  CHECK (perfil IN ('proprietario','admin','gestor','atendente','banho_tosa','leva_traz','financeiro','consulta'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('ativo','bloqueado','desativado','convite_pendente','expirado'));

-- Marca proprietários iniciais
UPDATE public.profiles SET perfil='proprietario', status='ativo'
 WHERE email IN ('elijunior8805@gmail.com','jessicaxavier579@gmail.com');

-- 2) Permissões granulares por usuário e módulo
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  permitido BOOLEAN NOT NULL DEFAULT true,
  concedido_por UUID REFERENCES auth.users(id),
  concedido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, modulo, acao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 3) Convites
CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nome TEXT,
  telefone TEXT,
  perfil TEXT NOT NULL CHECK (perfil IN ('proprietario','admin','gestor','atendente','banho_tosa','leva_traz','financeiro','consulta')),
  permissoes JSONB DEFAULT '[]'::jsonb,
  mensagem TEXT,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ,
  aceito_em TIMESTAMPTZ,
  aceito_por UUID REFERENCES auth.users(id),
  cancelado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','expirado','cancelado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO authenticated;
GRANT ALL ON public.user_invites TO service_role;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- 4) Helpers
CREATE OR REPLACE FUNCTION public.is_proprietario(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND perfil='proprietario' AND status='ativo');
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_usuarios(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND perfil IN ('proprietario','admin') AND status='ativo');
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _modulo TEXT, _acao TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    CASE
      WHEN public.is_proprietario(_user_id) THEN true
      ELSE COALESCE(
        (SELECT permitido FROM public.user_permissions
          WHERE user_id=_user_id AND modulo=_modulo AND acao=_acao),
        false
      )
    END;
$$;

-- 5) Proteção de proprietários: trigger em profiles
CREATE OR REPLACE FUNCTION public.protect_proprietarios()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _caller UUID := auth.uid();
  _caller_owner BOOLEAN := false;
  _ativos_owner INT;
BEGIN
  IF _caller IS NOT NULL THEN
    SELECT public.is_proprietario(_caller) INTO _caller_owner;
  END IF;

  IF TG_OP='UPDATE' THEN
    -- Se alvo é proprietário e chamador não é proprietário, bloqueia
    IF OLD.perfil='proprietario' AND NOT _caller_owner AND _caller IS NOT NULL AND _caller <> OLD.id THEN
      RAISE EXCEPTION 'Somente um proprietário pode alterar outro proprietário' USING ERRCODE='42501';
    END IF;
    -- Impede rebaixar proprietário se sobrar zero ativos
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
END; $$;

DROP TRIGGER IF EXISTS protect_proprietarios_trg ON public.profiles;
CREATE TRIGGER protect_proprietarios_trg
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_proprietarios();

-- 6) Políticas: administradores e proprietários leem/editam todos os profiles
DROP POLICY IF EXISTS "Admins leem todos profiles" ON public.profiles;
CREATE POLICY "Admins leem todos profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.pode_gerenciar_usuarios(auth.uid()));

DROP POLICY IF EXISTS "Admins editam profiles" ON public.profiles;
CREATE POLICY "Admins editam profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_usuarios(auth.uid()))
  WITH CHECK (public.pode_gerenciar_usuarios(auth.uid()));

-- 7) Políticas user_permissions e user_invites
DROP POLICY IF EXISTS "Usuário lê suas permissões" ON public.user_permissions;
CREATE POLICY "Usuário lê suas permissões" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode_gerenciar_usuarios(auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam permissões" ON public.user_permissions;
CREATE POLICY "Admins gerenciam permissões" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.pode_gerenciar_usuarios(auth.uid()))
  WITH CHECK (public.pode_gerenciar_usuarios(auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam convites" ON public.user_invites;
CREATE POLICY "Admins gerenciam convites" ON public.user_invites
  FOR ALL TO authenticated
  USING (public.pode_gerenciar_usuarios(auth.uid()))
  WITH CHECK (public.pode_gerenciar_usuarios(auth.uid()));
