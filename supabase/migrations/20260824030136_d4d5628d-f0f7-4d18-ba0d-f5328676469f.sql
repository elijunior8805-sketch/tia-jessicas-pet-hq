ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS comprovante_hash text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_comprovante_hash_uidx
  ON public.pagamentos (comprovante_hash)
  WHERE comprovante_hash IS NOT NULL AND arquivado_em IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_idempotency_key_uidx
  ON public.pagamentos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_id_transacao_uidx
  ON public.pagamentos (id_transacao_bancaria)
  WHERE id_transacao_bancaria IS NOT NULL AND arquivado_em IS NULL;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_idempotency_key_uidx
  ON public.agendamentos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;