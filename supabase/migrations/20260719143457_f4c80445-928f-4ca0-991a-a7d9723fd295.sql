-- Tabela de vínculo N:N para múltiplos serviços por agendamento
CREATE TABLE IF NOT EXISTS public.agendamento_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  valor_unit numeric(10,2) NOT NULL DEFAULT 0,
  duracao_min integer,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamento_servicos TO authenticated;
GRANT ALL ON public.agendamento_servicos TO service_role;

ALTER TABLE public.agendamento_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_agendamento_servicos"
ON public.agendamento_servicos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agend_servicos_agend ON public.agendamento_servicos(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_agend_servicos_servico ON public.agendamento_servicos(servico_id);

CREATE TRIGGER set_updated_at_agendamento_servicos
BEFORE UPDATE ON public.agendamento_servicos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER audit_agendamento_servicos
AFTER INSERT OR UPDATE OR DELETE ON public.agendamento_servicos
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();