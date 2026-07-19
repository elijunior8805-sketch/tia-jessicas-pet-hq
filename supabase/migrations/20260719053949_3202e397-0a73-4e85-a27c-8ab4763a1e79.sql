
-- Agendamentos de relatórios diários por WhatsApp (wa.me)
CREATE TABLE public.relatorios_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  hora_envio TIME NOT NULL DEFAULT '08:00',
  destinatarios JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{nome, whatsapp}]
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao DATE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_agendamentos TO authenticated;
GRANT ALL ON public.relatorios_agendamentos TO service_role;

ALTER TABLE public.relatorios_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_relatorios_agendamentos"
  ON public.relatorios_agendamentos FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_relatorios_agendamentos_updated_at
  BEFORE UPDATE ON public.relatorios_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_relatorios_agendamentos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.relatorios_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Execuções: uma linha por (agendamento, destinatário, dia). Idempotente.
CREATE TABLE public.relatorios_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID REFERENCES public.relatorios_agendamentos(id) ON DELETE CASCADE,
  agendamento_nome TEXT NOT NULL,
  destinatario_nome TEXT NOT NULL,
  destinatario_whatsapp TEXT NOT NULL,
  periodo_de DATE NOT NULL,
  periodo_ate DATE NOT NULL,
  mensagem TEXT NOT NULL,
  wa_url TEXT NOT NULL,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, destinatario_whatsapp, periodo_de)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_execucoes TO authenticated;
GRANT ALL ON public.relatorios_execucoes TO service_role;

ALTER TABLE public.relatorios_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_relatorios_execucoes"
  ON public.relatorios_execucoes FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_update_relatorios_execucoes"
  ON public.relatorios_execucoes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_relatorios_execucoes_pendentes
  ON public.relatorios_execucoes (gerado_em DESC)
  WHERE enviado_em IS NULL;

CREATE TRIGGER trg_relatorios_execucoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.relatorios_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
