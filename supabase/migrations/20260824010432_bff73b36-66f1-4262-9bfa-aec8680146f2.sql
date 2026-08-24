
ALTER TABLE public.auditoria_ia
  ADD COLUMN IF NOT EXISTS command_id text,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS tipo_operacao text,
  ADD COLUMN IF NOT EXISTS resultado jsonb,
  ADD COLUMN IF NOT EXISTS erro text,
  ADD COLUMN IF NOT EXISTS erro_tipo text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registro_afetado_id text,
  ADD COLUMN IF NOT EXISTS duplicidade_bloqueada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intencao_incorreta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correcao_humana boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fase_liberacao text,
  ADD COLUMN IF NOT EXISTS simulado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_auditoria_ia_command_id ON public.auditoria_ia (command_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_ia_created_at ON public.auditoria_ia (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ia_liberacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase text NOT NULL DEFAULT 'observacao',
  atualizado_por uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_liberacao_fase_check CHECK (fase IN ('observacao','teste_controlado','piloto','producao'))
);

GRANT SELECT ON public.ia_liberacao TO authenticated;
GRANT ALL ON public.ia_liberacao TO service_role;
ALTER TABLE public.ia_liberacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_liberacao_select" ON public.ia_liberacao;
CREATE POLICY "ia_liberacao_select" ON public.ia_liberacao FOR SELECT TO authenticated USING (true);

INSERT INTO public.ia_liberacao (fase)
SELECT 'observacao' WHERE NOT EXISTS (SELECT 1 FROM public.ia_liberacao);
