
-- ===== Enums =====
CREATE TYPE cobranca_status AS ENUM (
  'a_vencer','vencido','enviada','respondeu','promessa',
  'pago_parcial','pago','negociado','sem_retorno','pausada'
);

CREATE TYPE cobranca_evento_tipo AS ENUM (
  'criada','envio_manual','envio_auto','resposta','mudanca_status',
  'promessa','pagamento','pausa','retomada','nota','ia_sugestao'
);

CREATE TYPE cobranca_gatilho AS ENUM (
  'd_menos_1','d_zero','d_mais_3','d_mais_7','d_mais_15','agradecimento'
);

CREATE TYPE cobranca_modo AS ENUM ('manual','auto','pausado');

-- ===== cobrancas =====
CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id UUID NOT NULL UNIQUE REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  atendimento_id UUID REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  valor_original NUMERIC(10,2) NOT NULL,
  valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(10,2) NOT NULL,
  vencimento DATE NOT NULL,
  status cobranca_status NOT NULL DEFAULT 'a_vencer',
  promessa_data DATE,
  tentativas INT NOT NULL DEFAULT 0,
  ultima_cobranca_em TIMESTAMPTZ,
  pausada BOOLEAN NOT NULL DEFAULT false,
  pausada_motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_cliente ON public.cobrancas(cliente_id);
CREATE INDEX idx_cob_status ON public.cobrancas(status);
CREATE INDEX idx_cob_venc ON public.cobrancas(vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage cobrancas" ON public.cobrancas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_cob_updated BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cob_audit AFTER INSERT OR UPDATE OR DELETE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ===== cobrancas_eventos (append-only) =====
CREATE TABLE public.cobrancas_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cobranca_id UUID NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  tipo cobranca_evento_tipo NOT NULL,
  canal TEXT,
  usuario_id UUID,
  usuario_email TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_ev_cob ON public.cobrancas_eventos(cobranca_id, created_at DESC);

GRANT SELECT, INSERT ON public.cobrancas_eventos TO authenticated;
GRANT ALL ON public.cobrancas_eventos TO service_role;
ALTER TABLE public.cobrancas_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read eventos" ON public.cobrancas_eventos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert eventos" ON public.cobrancas_eventos
  FOR INSERT TO authenticated WITH CHECK (true);
-- Sem UPDATE nem DELETE (append-only para authenticated).

-- ===== cobrancas_templates =====
CREATE TABLE public.cobrancas_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gatilho cobranca_gatilho NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas_templates TO authenticated;
GRANT ALL ON public.cobrancas_templates TO service_role;
ALTER TABLE public.cobrancas_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage templates" ON public.cobrancas_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cob_tpl_updated BEFORE UPDATE ON public.cobrancas_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== cobrancas_config (singleton) =====
CREATE TABLE public.cobrancas_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  modo cobranca_modo NOT NULL DEFAULT 'manual',
  nao_repetir_no_dia BOOLEAN NOT NULL DEFAULT true,
  pix_chave TEXT,
  pix_tipo TEXT,
  horario_envio TIME NOT NULL DEFAULT '09:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cobrancas_config TO authenticated;
GRANT ALL ON public.cobrancas_config TO service_role;
ALTER TABLE public.cobrancas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read config" ON public.cobrancas_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write config" ON public.cobrancas_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_cob_cfg_updated BEFORE UPDATE ON public.cobrancas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed singleton config
INSERT INTO public.cobrancas_config (singleton, modo) VALUES (true, 'manual');

-- Seed templates padrão
INSERT INTO public.cobrancas_templates (gatilho, ordem, titulo, corpo) VALUES
('d_menos_1', 1, 'Lembrete amigável (1 dia antes)',
'Olá, {{cliente}}! 🐾 Passando só pra lembrar carinhosamente que amanhã ({{vencimento}}) vence o pagamento de R$ {{valor}} referente ao atendimento do {{pet}}. Se preferir, já podemos combinar a melhor forma de pagamento. Obrigado! — Spa da Tia Jéssica'),
('d_zero', 2, 'Aviso de vencimento (hoje)',
'Olá, {{cliente}}! 🐾 Hoje vence o pagamento de R$ {{valor}} do atendimento do {{pet}} realizado em {{data_atendimento}}. Se já efetuou, desconsidere. Nossa chave Pix: {{pix}}. Qualquer coisa, é só chamar aqui! — Spa da Tia Jéssica'),
('d_mais_3', 3, 'Primeira cobrança (3 dias de atraso)',
'Olá, {{cliente}}! Tudo bem? Identificamos que o pagamento de R$ {{valor}} do atendimento do {{pet}} ({{data_atendimento}}) está pendente desde {{vencimento}}. Se já pagou, por favor nos avise pra atualizarmos aqui. Chave Pix: {{pix}}. — Spa da Tia Jéssica'),
('d_mais_7', 4, 'Segunda cobrança (7 dias de atraso)',
'Oi, {{cliente}}! Estamos passando novamente sobre o pagamento pendente de R$ {{valor}} referente ao {{pet}}. Podemos combinar uma data para o pagamento? Chave Pix: {{pix}}. Estamos à disposição pra ajudar. — Spa da Tia Jéssica'),
('d_mais_15', 5, 'Contato manual (15 dias de atraso)',
'Olá, {{cliente}}. Queremos entender se está tudo bem com você e o {{pet}}. Ainda temos o pagamento de R$ {{valor}} em aberto desde {{vencimento}}. Pode nos chamar pra conversarmos sobre a melhor forma de resolver? — Spa da Tia Jéssica'),
('agradecimento', 6, 'Agradecimento após pagamento',
'Recebido, {{cliente}}! 🐾💛 Obrigado pela confiança de sempre. O {{pet}} é sempre bem-vindo aqui! — Spa da Tia Jéssica');

-- ===== Sincronização pagamentos -> cobrancas =====
CREATE OR REPLACE FUNCTION public.sync_cobranca_from_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC(10,2);
  v_status cobranca_status;
  v_existing_id UUID;
  v_existing_status cobranca_status;
BEGIN
  IF NEW.vencimento IS NULL OR NEW.status = 'cancelado' THEN
    DELETE FROM public.cobrancas WHERE pagamento_id = NEW.id;
    RETURN NEW;
  END IF;

  v_saldo := COALESCE(NEW.valor_total,0) - COALESCE(NEW.valor_pago,0);

  IF v_saldo <= 0 THEN
    SELECT id INTO v_existing_id FROM public.cobrancas WHERE pagamento_id = NEW.id;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.cobrancas
         SET valor_pago = NEW.valor_pago,
             saldo = 0,
             status = 'pago',
             pausada = false
       WHERE id = v_existing_id;
      INSERT INTO public.cobrancas_eventos(cobranca_id, tipo, payload)
      VALUES (v_existing_id, 'pagamento',
              jsonb_build_object('valor_pago', NEW.valor_pago, 'origem','pagamentos'));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.valor_pago > 0 THEN
    v_status := 'pago_parcial';
  ELSIF NEW.vencimento < CURRENT_DATE THEN
    v_status := 'vencido';
  ELSE
    v_status := 'a_vencer';
  END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
    FROM public.cobrancas WHERE pagamento_id = NEW.id;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.cobrancas(
      pagamento_id, cliente_id, atendimento_id,
      valor_original, valor_pago, saldo, vencimento, status
    ) VALUES (
      NEW.id, NEW.cliente_id, NEW.atendimento_id,
      NEW.valor_total, NEW.valor_pago, v_saldo, NEW.vencimento, v_status
    ) RETURNING id INTO v_existing_id;
    INSERT INTO public.cobrancas_eventos(cobranca_id, tipo, payload)
    VALUES (v_existing_id, 'criada', jsonb_build_object('valor', NEW.valor_total));
  ELSE
    -- Preserva estados operacionais (enviada/respondeu/promessa/negociado/sem_retorno/pausada)
    UPDATE public.cobrancas
       SET valor_original = NEW.valor_total,
           valor_pago = NEW.valor_pago,
           saldo = v_saldo,
           vencimento = NEW.vencimento,
           atendimento_id = NEW.atendimento_id,
           status = CASE
             WHEN v_existing_status IN ('enviada','respondeu','promessa','negociado','sem_retorno','pausada')
               THEN v_existing_status
             ELSE v_status
           END
     WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pag_sync_cobranca
AFTER INSERT OR UPDATE OF valor_total, valor_pago, vencimento, status ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.sync_cobranca_from_pagamento();

-- Backfill inicial
INSERT INTO public.cobrancas (
  pagamento_id, cliente_id, atendimento_id,
  valor_original, valor_pago, saldo, vencimento, status
)
SELECT p.id, p.cliente_id, p.atendimento_id,
       p.valor_total, p.valor_pago,
       (p.valor_total - p.valor_pago),
       p.vencimento,
       CASE
         WHEN p.valor_pago > 0 THEN 'pago_parcial'::cobranca_status
         WHEN p.vencimento < CURRENT_DATE THEN 'vencido'::cobranca_status
         ELSE 'a_vencer'::cobranca_status
       END
  FROM public.pagamentos p
 WHERE p.vencimento IS NOT NULL
   AND p.status <> 'cancelado'
   AND (p.valor_total - p.valor_pago) > 0
ON CONFLICT (pagamento_id) DO NOTHING;
