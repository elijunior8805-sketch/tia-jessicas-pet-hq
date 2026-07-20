
-- ============================================================
-- 1. Papel de transportador
-- ============================================================
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'transportador';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. Enums novos
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.leva_traz_modalidade AS ENUM ('nao_utilizar','somente_buscar','somente_entregar','buscar_entregar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leva_traz_tipo AS ENUM ('busca','entrega');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leva_traz_status AS ENUM (
    'aguardando_responsavel','agendado','a_caminho_busca','pet_coletado',
    'chegou_spa','aguardando_entrega','a_caminho_entrega','pet_entregue',
    'cancelado','nao_realizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3. Campos novos em agendamentos
-- ============================================================
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS leva_traz_modalidade public.leva_traz_modalidade NOT NULL DEFAULT 'nao_utilizar',
  ADD COLUMN IF NOT EXISTS leva_traz_responsavel_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS leva_traz_telefone text,
  ADD COLUMN IF NOT EXISTS leva_traz_obs text,
  ADD COLUMN IF NOT EXISTS leva_traz_isento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leva_traz_isencao_motivo text,
  ADD COLUMN IF NOT EXISTS leva_traz_isencao_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS busca_data date,
  ADD COLUMN IF NOT EXISTS busca_hora time,
  ADD COLUMN IF NOT EXISTS busca_endereco jsonb,
  ADD COLUMN IF NOT EXISTS entrega_data date,
  ADD COLUMN IF NOT EXISTS entrega_hora time,
  ADD COLUMN IF NOT EXISTS entrega_endereco jsonb;

-- ============================================================
-- 4. leva_traz_tarefas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leva_traz_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  pet_id uuid NOT NULL REFERENCES public.pets(id),
  tipo public.leva_traz_tipo NOT NULL,
  data date NOT NULL,
  hora_prevista time NOT NULL,
  responsavel_id uuid REFERENCES auth.users(id),
  status public.leva_traz_status NOT NULL DEFAULT 'aguardando_responsavel',
  endereco jsonb NOT NULL,
  telefone text,
  observacoes text,
  alergias_snapshot text,
  temperamento_snapshot text,
  valor_rateado numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leva_traz_tarefas TO authenticated;
GRANT ALL ON public.leva_traz_tarefas TO service_role;
ALTER TABLE public.leva_traz_tarefas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ltt_data_status ON public.leva_traz_tarefas(data, status);
CREATE INDEX IF NOT EXISTS idx_ltt_responsavel ON public.leva_traz_tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_ltt_agendamento ON public.leva_traz_tarefas(agendamento_id);

CREATE POLICY "ltt_select_staff_or_owner" ON public.leva_traz_tarefas FOR SELECT TO authenticated
USING (
  public.is_staff()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR responsavel_id = auth.uid()
);

CREATE POLICY "ltt_write_staff" ON public.leva_traz_tarefas FOR INSERT TO authenticated
WITH CHECK (public.is_staff() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ltt_update_staff_or_owner" ON public.leva_traz_tarefas FOR UPDATE TO authenticated
USING (
  public.is_staff()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR responsavel_id = auth.uid()
)
WITH CHECK (
  public.is_staff()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR responsavel_id = auth.uid()
);

CREATE POLICY "ltt_delete_admin" ON public.leva_traz_tarefas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ltt_updated_at BEFORE UPDATE ON public.leva_traz_tarefas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. leva_traz_eventos (auditoria)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leva_traz_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.leva_traz_tarefas(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  payload jsonb,
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.leva_traz_eventos TO authenticated;
GRANT ALL ON public.leva_traz_eventos TO service_role;
ALTER TABLE public.leva_traz_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ltev_select_staff" ON public.leva_traz_eventos FOR SELECT TO authenticated
USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ltev_insert_auth" ON public.leva_traz_eventos FOR INSERT TO authenticated
WITH CHECK (true);

-- ============================================================
-- 6. notificacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  payload jsonb,
  idempotency_key text UNIQUE,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notif_user_lida ON public.notificacoes(user_id, lida, created_at DESC);

CREATE POLICY "notif_own" ON public.notificacoes FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_insert_staff" ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (public.is_staff() OR public.has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leva_traz_tarefas;

-- ============================================================
-- 7. Função utilitária: monta endereço do cliente como jsonb
-- ============================================================
CREATE OR REPLACE FUNCTION public.endereco_cliente_jsonb(_cliente_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'rua', rua, 'numero', numero, 'complemento', complemento,
    'bairro', bairro, 'cidade', cidade, 'estado', estado, 'cep', cep,
    'referencia', NULL
  ) FROM public.clientes WHERE id=_cliente_id;
$$;

-- ============================================================
-- 8. Trigger sync agendamento -> tarefas
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_leva_traz_tarefas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _end_busca jsonb;
  _end_entrega jsonb;
  _tel text;
  _obs text;
  _pet record;
  _valor_perna numeric(10,2);
  _pernas int;
BEGIN
  -- Se cancelado ou não utiliza -> cancela tarefas (não apaga)
  IF NEW.leva_traz_modalidade = 'nao_utilizar' OR NEW.status IN ('cancelado','nao_compareceu') THEN
    UPDATE public.leva_traz_tarefas
       SET status = 'cancelado'
     WHERE agendamento_id = NEW.id
       AND status NOT IN ('pet_entregue','cancelado','nao_realizado');
    RETURN NEW;
  END IF;

  SELECT * INTO _pet FROM public.pets WHERE id = NEW.pet_id;

  _end_busca := COALESCE(NEW.busca_endereco, public.endereco_cliente_jsonb(NEW.cliente_id));
  _end_entrega := COALESCE(NEW.entrega_endereco, public.endereco_cliente_jsonb(NEW.cliente_id));
  _tel := NEW.leva_traz_telefone;
  _obs := NEW.leva_traz_obs;

  _pernas := CASE NEW.leva_traz_modalidade
    WHEN 'buscar_entregar' THEN 2 ELSE 1 END;
  _valor_perna := CASE WHEN NEW.leva_traz_isento THEN 0
                       ELSE ROUND(COALESCE(NEW.taxa_leva_traz,0) / GREATEST(_pernas,1), 2) END;

  -- BUSCA
  IF NEW.leva_traz_modalidade IN ('somente_buscar','buscar_entregar') THEN
    INSERT INTO public.leva_traz_tarefas
      (agendamento_id, cliente_id, pet_id, tipo, data, hora_prevista,
       responsavel_id, status, endereco, telefone, observacoes,
       alergias_snapshot, temperamento_snapshot, valor_rateado)
    VALUES
      (NEW.id, NEW.cliente_id, NEW.pet_id, 'busca',
       COALESCE(NEW.busca_data, NEW.data),
       COALESCE(NEW.busca_hora, NEW.hora),
       NEW.leva_traz_responsavel_id,
       CASE WHEN NEW.leva_traz_responsavel_id IS NULL THEN 'aguardando_responsavel'::leva_traz_status
            ELSE 'agendado'::leva_traz_status END,
       _end_busca, _tel, _obs,
       _pet.alergias, _pet.temperamento, _valor_perna)
    ON CONFLICT (agendamento_id, tipo) DO UPDATE SET
      data = EXCLUDED.data,
      hora_prevista = EXCLUDED.hora_prevista,
      responsavel_id = EXCLUDED.responsavel_id,
      endereco = EXCLUDED.endereco,
      telefone = EXCLUDED.telefone,
      observacoes = EXCLUDED.observacoes,
      alergias_snapshot = EXCLUDED.alergias_snapshot,
      temperamento_snapshot = EXCLUDED.temperamento_snapshot,
      valor_rateado = EXCLUDED.valor_rateado,
      status = CASE
        WHEN public.leva_traz_tarefas.status IN ('pet_coletado','chegou_spa','aguardando_entrega','a_caminho_entrega','pet_entregue')
          THEN public.leva_traz_tarefas.status
        WHEN EXCLUDED.responsavel_id IS NULL THEN 'aguardando_responsavel'::leva_traz_status
        WHEN public.leva_traz_tarefas.status = 'cancelado' THEN 'agendado'::leva_traz_status
        ELSE public.leva_traz_tarefas.status
      END;
  ELSE
    UPDATE public.leva_traz_tarefas SET status='cancelado'
     WHERE agendamento_id = NEW.id AND tipo='busca'
       AND status NOT IN ('pet_entregue','cancelado');
  END IF;

  -- ENTREGA
  IF NEW.leva_traz_modalidade IN ('somente_entregar','buscar_entregar') THEN
    INSERT INTO public.leva_traz_tarefas
      (agendamento_id, cliente_id, pet_id, tipo, data, hora_prevista,
       responsavel_id, status, endereco, telefone, observacoes,
       alergias_snapshot, temperamento_snapshot, valor_rateado)
    VALUES
      (NEW.id, NEW.cliente_id, NEW.pet_id, 'entrega',
       COALESCE(NEW.entrega_data, NEW.data),
       COALESCE(NEW.entrega_hora, (NEW.hora + (COALESCE(NEW.duracao_min,60) || ' minutes')::interval)::time),
       NEW.leva_traz_responsavel_id,
       CASE WHEN NEW.leva_traz_responsavel_id IS NULL THEN 'aguardando_responsavel'::leva_traz_status
            ELSE 'agendado'::leva_traz_status END,
       _end_entrega, _tel, _obs,
       _pet.alergias, _pet.temperamento, _valor_perna)
    ON CONFLICT (agendamento_id, tipo) DO UPDATE SET
      data = EXCLUDED.data,
      hora_prevista = EXCLUDED.hora_prevista,
      responsavel_id = EXCLUDED.responsavel_id,
      endereco = EXCLUDED.endereco,
      telefone = EXCLUDED.telefone,
      observacoes = EXCLUDED.observacoes,
      alergias_snapshot = EXCLUDED.alergias_snapshot,
      temperamento_snapshot = EXCLUDED.temperamento_snapshot,
      valor_rateado = EXCLUDED.valor_rateado,
      status = CASE
        WHEN public.leva_traz_tarefas.status IN ('a_caminho_entrega','pet_entregue') THEN public.leva_traz_tarefas.status
        WHEN EXCLUDED.responsavel_id IS NULL THEN 'aguardando_responsavel'::leva_traz_status
        WHEN public.leva_traz_tarefas.status = 'cancelado' THEN 'agendado'::leva_traz_status
        ELSE public.leva_traz_tarefas.status
      END;
  ELSE
    UPDATE public.leva_traz_tarefas SET status='cancelado'
     WHERE agendamento_id = NEW.id AND tipo='entrega'
       AND status NOT IN ('pet_entregue','cancelado');
  END IF;

  -- Notifica responsável (se houver e mudou)
  IF NEW.leva_traz_responsavel_id IS NOT NULL AND (
    TG_OP='INSERT' OR OLD.leva_traz_responsavel_id IS DISTINCT FROM NEW.leva_traz_responsavel_id
  ) THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link, payload, idempotency_key)
    VALUES (
      NEW.leva_traz_responsavel_id,
      'leva_traz_atribuido',
      'Nova tarefa de Leva e Traz',
      'Você foi atribuído a um transporte. Toque para ver detalhes.',
      '/leva-traz',
      jsonb_build_object('agendamento_id', NEW.id),
      'ltt_atribuido:' || NEW.id::text || ':' || NEW.leva_traz_responsavel_id::text || ':' || extract(epoch from now())::text
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_leva_traz ON public.agendamentos;
CREATE TRIGGER trg_sync_leva_traz
AFTER INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.sync_leva_traz_tarefas();

-- ============================================================
-- 9. Migração de agendamentos antigos com taxa > 0
-- ============================================================
UPDATE public.agendamentos
   SET leva_traz_modalidade = 'buscar_entregar'
 WHERE taxa_leva_traz > 0
   AND leva_traz_modalidade = 'nao_utilizar';
