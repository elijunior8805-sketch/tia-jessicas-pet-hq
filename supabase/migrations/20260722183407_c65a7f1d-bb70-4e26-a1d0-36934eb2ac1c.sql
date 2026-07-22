
CREATE OR REPLACE FUNCTION public.criar_agendamento_seguro(_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.atualizar_agendamento_seguro(_id uuid, _version integer, _payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;
