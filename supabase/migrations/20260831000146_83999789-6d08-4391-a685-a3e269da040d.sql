ALTER TABLE public.programas_creditos_movimentacoes
  ADD COLUMN IF NOT EXISTS atendimento_id uuid REFERENCES public.atendimentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pcm_atendimento_id
  ON public.programas_creditos_movimentacoes(atendimento_id);