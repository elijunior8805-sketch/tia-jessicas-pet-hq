
CREATE TABLE IF NOT EXISTS public.programas_cuidado_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid,
  permitir_venda_fracionada boolean NOT NULL DEFAULT false,
  notificar_vencimento boolean NOT NULL DEFAULT false,
  notificar_dias_antes integer NOT NULL DEFAULT 7,
  validade_padrao_dias integer NOT NULL DEFAULT 30,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS programas_cuidado_config_singleton
  ON public.programas_cuidado_config ((COALESCE(estabelecimento_id, '00000000-0000-0000-0000-000000000000'::uuid)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programas_cuidado_config TO authenticated;
GRANT ALL ON public.programas_cuidado_config TO service_role;
ALTER TABLE public.programas_cuidado_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_select_auth" ON public.programas_cuidado_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_write_admin" ON public.programas_cuidado_config
  FOR ALL TO authenticated
  USING (public.pode_gerenciar_usuarios(auth.uid()))
  WITH CHECK (public.pode_gerenciar_usuarios(auth.uid()));

CREATE TRIGGER trg_programas_cuidado_config_updated
  BEFORE UPDATE ON public.programas_cuidado_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.programas_cuidado_config (permitir_venda_fracionada, notificar_vencimento, notificar_dias_antes, validade_padrao_dias)
SELECT false, false, 7, 30
WHERE NOT EXISTS (SELECT 1 FROM public.programas_cuidado_config);

CREATE TABLE IF NOT EXISTS public.programas_vencimento_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid,
  contrato_id uuid NOT NULL REFERENCES public.programas_contratados(id) ON DELETE CASCADE,
  cliente_id uuid,
  pet_id uuid,
  cliente_nome text,
  pet_nome text,
  programa_nome text,
  telefone text,
  data_de_validade date NOT NULL,
  saldo_creditos integer NOT NULL DEFAULT 0,
  mensagem_sugerida text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  idempotency_key text NOT NULL UNIQUE,
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programas_vencimento_alertas TO authenticated;
GRANT ALL ON public.programas_vencimento_alertas TO service_role;
ALTER TABLE public.programas_vencimento_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_select_auth" ON public.programas_vencimento_alertas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "alertas_write_staff" ON public.programas_vencimento_alertas
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE TRIGGER trg_programas_vencimento_alertas_updated
  BEFORE UPDATE ON public.programas_vencimento_alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.auditoria_programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid,
  acao text NOT NULL,
  cliente_id uuid,
  pet_id uuid,
  programa_contratado_id uuid,
  valor_anterior jsonb,
  valor_posterior jsonb,
  motivo text,
  metadata jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditoria_programas TO authenticated;
GRANT ALL ON public.auditoria_programas TO service_role;
ALTER TABLE public.auditoria_programas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_programas_select" ON public.auditoria_programas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auditoria_programas_insert" ON public.auditoria_programas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.programas_contratados
  ADD COLUMN IF NOT EXISTS fracionado boolean NOT NULL DEFAULT false;
