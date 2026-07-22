
CREATE TABLE public.access_denials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  modulo TEXT,
  acao TEXT,
  motivo TEXT NOT NULL,
  codigo_erro TEXT,
  rota TEXT,
  metodo TEXT,
  tabela_alvo TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.access_denials TO authenticated;
GRANT ALL ON public.access_denials TO service_role;

ALTER TABLE public.access_denials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados registram seus próprios bloqueios"
  ON public.access_denials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins e proprietários leem o log"
  ON public.access_denials FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_proprietario(auth.uid())
  );

CREATE INDEX access_denials_created_at_idx ON public.access_denials (created_at DESC);
CREATE INDEX access_denials_user_id_idx ON public.access_denials (user_id, created_at DESC);
CREATE INDEX access_denials_modulo_idx ON public.access_denials (modulo, acao, created_at DESC);
