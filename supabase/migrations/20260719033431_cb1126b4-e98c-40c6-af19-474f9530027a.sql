
-- Adiciona controle de etapas ao atendimento
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS etapa_atual INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS etapas_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS servicos_solicitados JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS servicos_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usou_focinheira BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS precisou_pausa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_observada TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_checkin TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_internas TEXT,
  ADD COLUMN IF NOT EXISTS foto_principal_depois TEXT,
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_motivo TEXT,
  ADD COLUMN IF NOT EXISTS pagamento_status TEXT,
  ADD COLUMN IF NOT EXISTS pagamento_forma TEXT,
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS encerrado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS encerrado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reaberto_motivo TEXT,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- Índice para painel
CREATE INDEX IF NOT EXISTS idx_atend_etapa ON public.atendimentos(etapa_atual);
CREATE INDEX IF NOT EXISTS idx_atend_encerrado ON public.atendimentos(encerrado_em);

-- Policy para bloquear edição de atendimento encerrado por não-admin
DROP POLICY IF EXISTS "Auth manage atend" ON public.atendimentos;

CREATE POLICY "Atend select auth"
  ON public.atendimentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Atend insert auth"
  ON public.atendimentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Atend update auth"
  ON public.atendimentos FOR UPDATE
  TO authenticated
  USING (
    encerrado_em IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (true);

CREATE POLICY "Atend delete admin"
  ON public.atendimentos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
