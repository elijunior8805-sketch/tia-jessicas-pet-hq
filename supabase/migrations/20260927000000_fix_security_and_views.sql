-- Fix critical security warnings: Security Invoker on views and search_path on security definer functions

-- 1. Ensure get_atendimento_total_executado has search_path explicitly set
CREATE OR REPLACE FUNCTION public.get_atendimento_total_executado(atendimento_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT SUM(valor_unit) FROM public.agendamento_servicos WHERE agendamento_id = $1), 
    0
  ) + COALESCE(
    (SELECT taxa_leva_traz FROM public.atendimentos WHERE id = $1),
    0
  ) - COALESCE(
    (SELECT desconto FROM public.atendimentos WHERE id = $1),
    0
  );
$$;

-- 2. Set security_invoker = on for all views to respect RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'vw_financeiro_indicadores') THEN
    ALTER VIEW public.vw_financeiro_indicadores SET (security_invoker = on);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'mensagens_threads') THEN
    ALTER VIEW public.mensagens_threads SET (security_invoker = on);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'mensagens_threads_v2') THEN
    ALTER VIEW public.mensagens_threads_v2 SET (security_invoker = on);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'pets_reativacao') THEN
    ALTER VIEW public.pets_reativacao SET (security_invoker = on);
  END IF;
END $$;
