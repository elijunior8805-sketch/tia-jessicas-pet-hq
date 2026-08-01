ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivada_por uuid,
  ADD COLUMN IF NOT EXISTS arquivada_motivo text;

CREATE INDEX IF NOT EXISTS idx_cobrancas_arquivada_em ON public.cobrancas (arquivada_em);