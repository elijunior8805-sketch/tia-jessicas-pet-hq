ALTER TABLE public.relatorios_agendamentos
  ADD COLUMN IF NOT EXISTS kpis jsonb NOT NULL DEFAULT '["faturamento","atendimentos","ticket","clientes","leva_traz","a_receber"]'::jsonb,
  ADD COLUMN IF NOT EXISTS titulo_mensagem text,
  ADD COLUMN IF NOT EXISTS rodape_mensagem text;