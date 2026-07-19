
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS whatsapp_template_receber TEXT NOT NULL DEFAULT
    'Olá, {contraparte}! 🐾

Segue o recibo de pagamento nº {numero} no valor de *{valor}* referente a "{descricao}".

Obrigada pela confiança! ✨
{assinatura}',
  ADD COLUMN IF NOT EXISTS whatsapp_template_pagar TEXT NOT NULL DEFAULT
    'Olá, {contraparte}!

Segue o comprovante nº {numero} referente a "{descricao}" no valor de *{valor}*, pago em {data}.

Obrigada!
{assinatura}',
  ADD COLUMN IF NOT EXISTS whatsapp_assinatura TEXT NOT NULL DEFAULT 'Spa de Pet Tia Jéssica';

CREATE TABLE IF NOT EXISTS public.recibos_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  referencia_id UUID NOT NULL,
  numero_recibo TEXT NOT NULL,
  contraparte TEXT,
  telefone TEXT,
  valor NUMERIC(12,2) NOT NULL,
  mensagem TEXT,
  signed_url TEXT,
  storage_path TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recibos_enviados_ref ON public.recibos_enviados(tipo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_recibos_enviados_data ON public.recibos_enviados(enviado_em DESC);

GRANT SELECT, INSERT ON public.recibos_enviados TO authenticated;
GRANT ALL ON public.recibos_enviados TO service_role;

ALTER TABLE public.recibos_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read recibos_enviados"
  ON public.recibos_enviados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Auth insert recibos_enviados"
  ON public.recibos_enviados FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = enviado_por);

CREATE POLICY "Admin update recibos_enviados"
  ON public.recibos_enviados FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete recibos_enviados"
  ON public.recibos_enviados FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER audit_recibos_enviados
AFTER INSERT OR UPDATE OR DELETE ON public.recibos_enviados
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
