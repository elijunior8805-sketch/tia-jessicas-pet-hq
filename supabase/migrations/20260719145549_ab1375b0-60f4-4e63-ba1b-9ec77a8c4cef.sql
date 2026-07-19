
-- 1) Chave Pix na configuração da empresa
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS pix_chave text;

-- 2) Histórico de contatos via WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  atendimento_id uuid REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  destinatario text NOT NULL,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  motivo text,
  status text NOT NULL DEFAULT 'aberto',
  marcado_em timestamptz,
  observacao text,
  CONSTRAINT whatsapp_contatos_status_ck CHECK (
    status IN ('aberto','enviado','respondeu','sem_resposta','promessa','pago')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contatos TO authenticated;
GRANT ALL ON public.whatsapp_contatos TO service_role;

ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_contatos_select_auth"
  ON public.whatsapp_contatos FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "wa_contatos_insert_auth"
  ON public.whatsapp_contatos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "wa_contatos_update_auth"
  ON public.whatsapp_contatos FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "wa_contatos_delete_admin"
  ON public.whatsapp_contatos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_wa_contatos_cliente ON public.whatsapp_contatos (cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_contatos_created ON public.whatsapp_contatos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_contatos_status ON public.whatsapp_contatos (status);
