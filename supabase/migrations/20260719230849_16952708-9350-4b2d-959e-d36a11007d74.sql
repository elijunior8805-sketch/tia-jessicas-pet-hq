-- ============ Aniversários & Datas Especiais ============

-- 1) Estende lembretes_config com aniversário do tutor + petversário
ALTER TABLE public.lembretes_config
  ADD COLUMN IF NOT EXISTS aniversario_tutor_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS aniversario_tutor_template text NOT NULL DEFAULT
    '🎉 Feliz aniversário, {{tutor}}! O Spa da Tia Jéssica deseja um dia lindo pra você. Um beijo pra vocês e pro(a) {{pet}}! 🐾',
  ADD COLUMN IF NOT EXISTS petversario_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS petversario_template text NOT NULL DEFAULT
    '🎂 Hoje é aniversário do(a) {{pet}}! Parabéns, {{tutor}}, por cuidar com tanto amor. Um beijinho especial pro nosso aniversariante! 🐾',
  ADD COLUMN IF NOT EXISTS datas_especiais_ativo boolean NOT NULL DEFAULT true;

-- 2) Tabela de datas comemorativas configuráveis
CREATE TABLE IF NOT EXISTS public.datas_comemorativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  dia smallint NOT NULL CHECK (dia BETWEEN 1 AND 31),
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  template text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dia, mes, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datas_comemorativas TO authenticated;
GRANT ALL ON public.datas_comemorativas TO service_role;

ALTER TABLE public.datas_comemorativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage datas_comemorativas"
  ON public.datas_comemorativas FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE TRIGGER trg_datas_comemorativas_updated
  BEFORE UPDATE ON public.datas_comemorativas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed de datas padrão (idempotente)
INSERT INTO public.datas_comemorativas (nome, dia, mes, template) VALUES
  ('Natal', 25, 12, '🎄 Feliz Natal, {{tutor}}! O Spa da Tia Jéssica deseja muito amor, paz e biscoitinhos pro(a) {{pet}}. 🐾'),
  ('Ano Novo', 1, 1, '🎆 Feliz Ano Novo, {{tutor}}! Que 2026 traga saúde e alegria pra você e pro(a) {{pet}}. 🐾'),
  ('Dia do Cliente', 15, 9, '💛 Hoje é o Dia do Cliente e a gente quer agradecer por confiar no Spa da Tia Jéssica pra cuidar do(a) {{pet}}. Obrigado, {{tutor}}!'),
  ('Dia Mundial dos Animais', 4, 10, '🐾 Hoje é o Dia Mundial dos Animais! Uma homenagem especial pro(a) {{pet}} e pra você, {{tutor}}, que cuida com tanto carinho.'),
  ('Dia do Cachorro', 10, 8, '🐶 Feliz Dia do Cachorro pro(a) {{pet}}! Um cheirinho especial da Tia Jéssica. 🐾')
ON CONFLICT (dia, mes, nome) DO NOTHING;

-- 3) Reescreve enfileirar_lembretes incluindo tutor, petversário e datas
CREATE OR REPLACE FUNCTION public.enfileirar_lembretes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg public.lembretes_config;
  n_24h INT := 0;
  n_pos INT := 0;
  n_niver_pet INT := 0;
  n_niver_tutor INT := 0;
  n_petversario INT := 0;
  n_datas INT := 0;
  d RECORD;
BEGIN
  SELECT * INTO cfg FROM public.lembretes_config LIMIT 1;
  IF cfg IS NULL THEN RETURN jsonb_build_object('error','sem config'); END IF;

  -- Lembrete 24h
  IF cfg.lembrete_24h_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id, agendamento_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'lembrete_24h', 'lembrete_24h:' || a.id,
        c.id, p.id, a.id,
        coalesce(c.whatsapp, c.telefone), c.nome, p.nome,
        public.render_lembrete(cfg.lembrete_24h_template, c.nome, p.nome,
          to_char(a.data, 'DD/MM'), to_char(a.hora, 'HH24:MI')),
        (a.data::timestamp - interval '1 day') + cfg.lembrete_24h_hora
      FROM public.agendamentos a
      JOIN public.clientes c ON c.id = a.cliente_id
      JOIN public.pets p ON p.id = a.pet_id
      WHERE a.data = CURRENT_DATE + 1
        AND a.status IN ('agendado','confirmado')
        AND coalesce(c.whatsapp, c.telefone) IS NOT NULL
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING 1
    ) SELECT count(*) INTO n_24h FROM ins;
  END IF;

  -- Pós-atendimento
  IF cfg.pos_atendimento_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id, atendimento_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'pos_atendimento', 'pos_atendimento:' || at.id,
        c.id, p.id, at.id,
        coalesce(c.whatsapp, c.telefone), c.nome, p.nome,
        public.render_lembrete(cfg.pos_atendimento_template, c.nome, p.nome, null, null),
        at.encerrado_em + make_interval(hours => cfg.pos_atendimento_horas)
      FROM public.atendimentos at
      JOIN public.clientes c ON c.id = at.cliente_id
      JOIN public.pets p ON p.id = at.pet_id
      WHERE at.encerrado_em IS NOT NULL
        AND at.encerrado_em >= now() - interval '2 days'
        AND at.encerrado_em <= now() - make_interval(hours => cfg.pos_atendimento_horas - 24)
        AND coalesce(c.whatsapp, c.telefone) IS NOT NULL
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING 1
    ) SELECT count(*) INTO n_pos FROM ins;
  END IF;

  -- Aniversário do pet
  IF cfg.aniversario_pet_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'aniversario_pet',
        'aniversario_pet:' || p.id || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD'),
        c.id, p.id,
        coalesce(c.whatsapp, c.telefone), c.nome, p.nome,
        public.render_lembrete(cfg.aniversario_template, c.nome, p.nome, null, null),
        CURRENT_DATE::timestamp + cfg.aniversario_hora
      FROM public.pets p
      JOIN public.clientes c ON c.id = p.cliente_id
      WHERE p.ativo = true
        AND p.nascimento IS NOT NULL
        AND to_char(p.nascimento, 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
        AND coalesce(c.whatsapp, c.telefone) IS NOT NULL
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING 1
    ) SELECT count(*) INTO n_niver_pet FROM ins;
  END IF;

  -- Aniversário do tutor
  IF cfg.aniversario_tutor_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'aniversario_tutor',
        'aniversario_tutor:' || c.id || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD'),
        c.id,
        (SELECT p.id FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true ORDER BY p.created_at LIMIT 1),
        coalesce(c.whatsapp, c.telefone), c.nome,
        (SELECT p.nome FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true ORDER BY p.created_at LIMIT 1),
        public.render_lembrete(cfg.aniversario_tutor_template, c.nome,
          coalesce((SELECT p.nome FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true ORDER BY p.created_at LIMIT 1), 'seu pet'),
          null, null),
        CURRENT_DATE::timestamp + cfg.aniversario_hora
      FROM public.clientes c
      WHERE c.ativo = true
        AND c.nascimento IS NOT NULL
        AND to_char(c.nascimento, 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
        AND coalesce(c.whatsapp, c.telefone) IS NOT NULL
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING 1
    ) SELECT count(*) INTO n_niver_tutor FROM ins;
  END IF;

  -- Petversário (aniversário de cadastro do pet, a partir do 1º ano)
  IF cfg.petversario_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'petversario',
        'petversario:' || p.id || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD'),
        c.id, p.id,
        coalesce(c.whatsapp, c.telefone), c.nome, p.nome,
        public.render_lembrete(cfg.petversario_template, c.nome, p.nome, null, null),
        CURRENT_DATE::timestamp + cfg.aniversario_hora
      FROM public.pets p
      JOIN public.clientes c ON c.id = p.cliente_id
      WHERE p.ativo = true
        AND to_char(p.created_at, 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
        AND p.created_at::date < CURRENT_DATE
        AND coalesce(c.whatsapp, c.telefone) IS NOT NULL
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING 1
    ) SELECT count(*) INTO n_petversario FROM ins;
  END IF;

  -- Datas comemorativas
  IF cfg.datas_especiais_ativo THEN
    FOR d IN
      SELECT * FROM public.datas_comemorativas
       WHERE ativo = true
         AND dia = EXTRACT(day FROM CURRENT_DATE)::int
         AND mes = EXTRACT(month FROM CURRENT_DATE)::int
    LOOP
      WITH ins AS (
        INSERT INTO public.lembretes_fila (
          tipo, idempotency_key, cliente_id, pet_id,
          telefone, cliente_nome, pet_nome, mensagem, proximo_envio
        )
        SELECT
          'data_especial',
          'data_especial:' || d.id || ':' || c.id || ':' || to_char(CURRENT_DATE, 'YYYY-MM-DD'),
          c.id,
          (SELECT p.id FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true ORDER BY p.created_at LIMIT 1),
          coalesce(c.whatsapp, c.telefone), c.nome,
          (SELECT p.nome FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true ORDER BY p.created_at LIMIT 1),
          public.render_lembrete(d.template, c.nome,
            coalesce((SELECT p.nome FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true ORDER BY p.created_at LIMIT 1), 'seu pet'),
            null, null),
          CURRENT_DATE::timestamp + cfg.aniversario_hora
        FROM public.clientes c
        WHERE c.ativo = true
          AND coalesce(c.whatsapp, c.telefone) IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.pets p WHERE p.cliente_id = c.id AND p.ativo = true)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING 1
      ) SELECT count(*) + coalesce(n_datas,0) INTO n_datas FROM ins;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'lembrete_24h', n_24h,
    'pos_atendimento', n_pos,
    'aniversario_pet', n_niver_pet,
    'aniversario_tutor', n_niver_tutor,
    'petversario', n_petversario,
    'data_especial', n_datas,
    'executado_em', now()
  );
END;
$function$;
