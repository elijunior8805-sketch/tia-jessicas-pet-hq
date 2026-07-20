
-- 1) Colunas de auditoria + versão
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['agendamentos','atendimentos','pagamentos','clientes','pets','leva_traz_tarefas','cobrancas']) LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1', t);
  END LOOP;
END $$;

-- 2) Trigger genérico de auditoria + version bump
CREATE OR REPLACE FUNCTION public.set_audit_and_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
    NEW.version := COALESCE(NEW.version, 1);
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    IF NEW.version = OLD.version THEN
      NEW.version := OLD.version + 1;
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['agendamentos','atendimentos','pagamentos','clientes','pets','leva_traz_tarefas','cobrancas']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_version ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_version BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_audit_and_version()', t);
  END LOOP;
END $$;

-- 3) Verificação de conflito de horário (profissional + intervalo)
CREATE OR REPLACE FUNCTION public.verificar_conflito_agendamento(
  _data date,
  _hora time,
  _duracao_min integer,
  _profissional_id uuid,
  _ignorar_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.data = _data
      AND a.status NOT IN ('cancelado','nao_compareceu')
      AND (_ignorar_id IS NULL OR a.id <> _ignorar_id)
      AND (_profissional_id IS NULL OR a.profissional_id = _profissional_id)
      AND tsrange(
            (a.data + a.hora)::timestamp,
            (a.data + a.hora)::timestamp + make_interval(mins => COALESCE(a.duracao_min,60)),
            '[)'
          )
          &&
          tsrange(
            (_data + _hora)::timestamp,
            (_data + _hora)::timestamp + make_interval(mins => COALESCE(_duracao_min,60)),
            '[)'
          )
  );
$$;

-- 4) RPC de criação segura
CREATE OR REPLACE FUNCTION public.criar_agendamento_seguro(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _data date := (_payload->>'data')::date;
  _hora time := (_payload->>'hora')::time;
  _duracao integer := COALESCE((_payload->>'duracao_min')::int, 60);
  _prof uuid := NULLIF(_payload->>'profissional_id','')::uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sem permissão para criar agendamento' USING ERRCODE = '42501';
  END IF;
  IF public.verificar_conflito_agendamento(_data, _hora, _duracao, _prof, NULL) THEN
    RAISE EXCEPTION 'HORARIO_OCUPADO' USING ERRCODE = 'P0001',
      HINT = 'Este horário acabou de ser ocupado por outro usuário.';
  END IF;

  INSERT INTO public.agendamentos (
    cliente_id, pet_id, servico_id, data, hora, duracao_min,
    valor_previsto, taxa_leva_traz, observacoes, status, profissional_id,
    leva_traz_modalidade, leva_traz_responsavel_id, leva_traz_telefone,
    leva_traz_obs, leva_traz_isento, busca_data, busca_hora, busca_endereco,
    entrega_data, entrega_hora, entrega_endereco
  ) VALUES (
    NULLIF(_payload->>'cliente_id','')::uuid,
    NULLIF(_payload->>'pet_id','')::uuid,
    NULLIF(_payload->>'servico_id','')::uuid,
    _data, _hora, _duracao,
    NULLIF(_payload->>'valor_previsto','')::numeric,
    NULLIF(_payload->>'taxa_leva_traz','')::numeric,
    _payload->>'observacoes',
    COALESCE((_payload->>'status')::agendamento_status, 'agendado'),
    _prof,
    NULLIF(_payload->>'leva_traz_modalidade','')::leva_traz_modalidade,
    NULLIF(_payload->>'leva_traz_responsavel_id','')::uuid,
    _payload->>'leva_traz_telefone',
    _payload->>'leva_traz_obs',
    COALESCE((_payload->>'leva_traz_isento')::boolean, false),
    NULLIF(_payload->>'busca_data','')::date,
    NULLIF(_payload->>'busca_hora','')::time,
    NULLIF(_payload->'busca_endereco','null'::jsonb),
    NULLIF(_payload->>'entrega_data','')::date,
    NULLIF(_payload->>'entrega_hora','')::time,
    NULLIF(_payload->'entrega_endereco','null'::jsonb)
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END $$;

-- 5) RPC de atualização com bloqueio otimista
CREATE OR REPLACE FUNCTION public.atualizar_agendamento_seguro(
  _id uuid, _version integer, _payload jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cur integer;
  _data date := (_payload->>'data')::date;
  _hora time := (_payload->>'hora')::time;
  _duracao integer := COALESCE((_payload->>'duracao_min')::int, 60);
  _prof uuid := NULLIF(_payload->>'profissional_id','')::uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT version INTO _cur FROM public.agendamentos WHERE id = _id FOR UPDATE;
  IF _cur IS NULL THEN
    RAISE EXCEPTION 'AGENDAMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  IF _cur <> _version THEN
    RAISE EXCEPTION 'VERSAO_DESATUALIZADA' USING ERRCODE = 'P0001',
      HINT = 'Este agendamento foi atualizado por outro usuário. Recarregue as informações.';
  END IF;

  IF public.verificar_conflito_agendamento(_data, _hora, _duracao, _prof, _id) THEN
    RAISE EXCEPTION 'HORARIO_OCUPADO' USING ERRCODE = 'P0001',
      HINT = 'Este horário acabou de ser ocupado por outro usuário.';
  END IF;

  UPDATE public.agendamentos SET
    data = _data,
    hora = _hora,
    duracao_min = _duracao,
    profissional_id = _prof,
    valor_previsto = COALESCE(NULLIF(_payload->>'valor_previsto','')::numeric, valor_previsto),
    taxa_leva_traz = COALESCE(NULLIF(_payload->>'taxa_leva_traz','')::numeric, taxa_leva_traz),
    observacoes = COALESCE(_payload->>'observacoes', observacoes),
    status = COALESCE(NULLIF(_payload->>'status','')::agendamento_status, status),
    leva_traz_modalidade = COALESCE(NULLIF(_payload->>'leva_traz_modalidade','')::leva_traz_modalidade, leva_traz_modalidade),
    leva_traz_responsavel_id = COALESCE(NULLIF(_payload->>'leva_traz_responsavel_id','')::uuid, leva_traz_responsavel_id),
    leva_traz_telefone = COALESCE(_payload->>'leva_traz_telefone', leva_traz_telefone),
    leva_traz_obs = COALESCE(_payload->>'leva_traz_obs', leva_traz_obs),
    leva_traz_isento = COALESCE((_payload->>'leva_traz_isento')::boolean, leva_traz_isento),
    busca_data = COALESCE(NULLIF(_payload->>'busca_data','')::date, busca_data),
    busca_hora = COALESCE(NULLIF(_payload->>'busca_hora','')::time, busca_hora),
    entrega_data = COALESCE(NULLIF(_payload->>'entrega_data','')::date, entrega_data),
    entrega_hora = COALESCE(NULLIF(_payload->>'entrega_hora','')::time, entrega_hora)
  WHERE id = _id;

  RETURN _cur + 1;
END $$;

-- 6) Notificação em tempo real de alterações de agenda para toda a equipe
CREATE OR REPLACE FUNCTION public.notificar_alteracao_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _acao text;
  _pet text;
  _tutor text;
  _quando text;
  _autor text;
  _user record;
BEGIN
  IF TG_OP = 'INSERT' THEN _acao := 'criou';
  ELSIF TG_OP = 'DELETE' THEN _acao := 'excluiu';
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN _acao := 'alterou status de';
    ELSIF NEW.data IS DISTINCT FROM OLD.data OR NEW.hora IS DISTINCT FROM OLD.hora THEN _acao := 'reagendou';
    ELSE _acao := 'editou';
    END IF;
  END IF;

  SELECT p.nome INTO _pet FROM public.pets p WHERE p.id = COALESCE(NEW.pet_id, OLD.pet_id);
  SELECT c.nome INTO _tutor FROM public.clientes c WHERE c.id = COALESCE(NEW.cliente_id, OLD.cliente_id);
  _quando := to_char(COALESCE(NEW.data, OLD.data), 'DD/MM') || ' ' || to_char(COALESCE(NEW.hora, OLD.hora), 'HH24:MI');
  SELECT COALESCE(nome, split_part(email,'@',1)) INTO _autor FROM public.profiles WHERE id = auth.uid();

  FOR _user IN
    SELECT DISTINCT user_id FROM public.user_roles
     WHERE role IN ('admin'::app_role,'user'::app_role)
       AND user_id IS DISTINCT FROM auth.uid()
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link, payload, idempotency_key)
    VALUES (
      _user.user_id,
      'agendamento_' || _acao,
      'Agenda atualizada',
      COALESCE(_autor,'Alguém') || ' ' || _acao || ' agendamento de ' ||
        COALESCE(_pet,'pet') || ' (' || COALESCE(_tutor,'tutor') || ') em ' || _quando,
      '/agenda',
      jsonb_build_object('agendamento_id', COALESCE(NEW.id, OLD.id), 'acao', _acao),
      'agenda_' || COALESCE(NEW.id, OLD.id)::text || '_' || _acao || '_' || extract(epoch from now())::text || '_' || _user.user_id::text
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_notificar_agenda ON public.agendamentos;
CREATE TRIGGER trg_notificar_agenda
AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.notificar_alteracao_agenda();

-- 7) Realtime: REPLICA IDENTITY FULL + publication
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agendamentos','agendamento_servicos','atendimentos','clientes','pets',
    'pagamentos','cobrancas','mensagens','movimentos_estoque','produtos_estoque',
    'recibos_enviados','leva_traz_tarefas','leva_traz_eventos','notificacoes'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
