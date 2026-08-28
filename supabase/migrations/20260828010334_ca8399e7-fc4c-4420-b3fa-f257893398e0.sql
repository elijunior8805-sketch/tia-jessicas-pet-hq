ALTER TABLE public.programas_contratados
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

CREATE UNIQUE INDEX IF NOT EXISTS programas_contratados_idempotency_key_uidx
  ON public.programas_contratados (idempotency_key)
  WHERE idempotency_key IS NOT NULL;