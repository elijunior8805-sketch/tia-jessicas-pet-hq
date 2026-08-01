ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS contexto_ia jsonb,
  ADD COLUMN IF NOT EXISTS texto_editado text,
  ADD COLUMN IF NOT EXISTS tempo_geracao_ms integer,
  ADD COLUMN IF NOT EXISTS tokens_estimados integer,
  ADD COLUMN IF NOT EXISTS erro_ia text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS agendada_para timestamptz;

CREATE TABLE IF NOT EXISTS public.ia_metricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL,
  modelo text,
  usou_fallback boolean NOT NULL DEFAULT false,
  sucesso boolean NOT NULL DEFAULT true,
  codigo_erro text,
  duracao_ms integer,
  tokens integer,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ia_metricas TO authenticated;
GRANT ALL ON public.ia_metricas TO service_role;

ALTER TABLE public.ia_metricas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le metricas de IA" ON public.ia_metricas;
CREATE POLICY "Equipe le metricas de IA" ON public.ia_metricas
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Equipe registra metricas de IA" ON public.ia_metricas;
CREATE POLICY "Equipe registra metricas de IA" ON public.ia_metricas
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS ia_metricas_created_at_idx ON public.ia_metricas (created_at DESC);