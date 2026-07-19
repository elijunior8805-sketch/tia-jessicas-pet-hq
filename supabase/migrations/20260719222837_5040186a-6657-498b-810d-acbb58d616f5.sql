
-- Central de Mensagens (Inbox unificada)
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('in','out')),
  canal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','sms','email','manual','sistema')),
  corpo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('rascunho','enviada','entregue','lida','respondida','falhou','nao_lida')),
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_email TEXT,
  atendimento_id UUID REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_select_staff" ON public.mensagens FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "mensagens_insert_staff" ON public.mensagens FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "mensagens_update_staff" ON public.mensagens FOR UPDATE TO authenticated USING (public.is_staff());
CREATE POLICY "mensagens_delete_admin" ON public.mensagens FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mensagens_cliente ON public.mensagens(cliente_id, created_at DESC);
CREATE INDEX idx_mensagens_created ON public.mensagens(created_at DESC);
CREATE INDEX idx_mensagens_status ON public.mensagens(status) WHERE status IN ('nao_lida','rascunho');

-- View: última mensagem e não lidas por cliente
CREATE OR REPLACE VIEW public.mensagens_threads AS
SELECT
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.telefone AS cliente_telefone,
  (SELECT m.corpo FROM public.mensagens m WHERE m.cliente_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_mensagem,
  (SELECT m.direcao FROM public.mensagens m WHERE m.cliente_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_direcao,
  (SELECT m.created_at FROM public.mensagens m WHERE m.cliente_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_em,
  (SELECT COUNT(*) FROM public.mensagens m WHERE m.cliente_id = c.id AND m.direcao='in' AND m.status='nao_lida') AS nao_lidas,
  (SELECT COUNT(*) FROM public.mensagens m WHERE m.cliente_id = c.id) AS total_mensagens
FROM public.clientes c
WHERE EXISTS (SELECT 1 FROM public.mensagens m WHERE m.cliente_id = c.id);

GRANT SELECT ON public.mensagens_threads TO authenticated;
