-- Campanhas Segmentadas
CREATE TABLE public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pronta','em_envio','concluida','cancelada')),
  total_destinatarios INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  total_falhas INT NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agendada_para TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage campanhas" ON public.campanhas FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_campanhas_updated BEFORE UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.campanhas_destinatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  pet_nome TEXT,
  telefone TEXT,
  mensagem_renderizada TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falhou','cancelado')),
  enviado_em TIMESTAMPTZ,
  erro TEXT,
  tentativas INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, cliente_id, pet_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas_destinatarios TO authenticated;
GRANT ALL ON public.campanhas_destinatarios TO service_role;
ALTER TABLE public.campanhas_destinatarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage campanhas_dest" ON public.campanhas_destinatarios FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_campdest_updated BEFORE UPDATE ON public.campanhas_destinatarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_campdest_campanha ON public.campanhas_destinatarios(campanha_id, status);
CREATE INDEX idx_campanhas_status ON public.campanhas(status, created_at DESC);