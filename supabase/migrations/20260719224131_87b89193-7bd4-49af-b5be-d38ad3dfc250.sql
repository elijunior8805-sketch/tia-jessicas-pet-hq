
-- 1) Config table (single row expected)
CREATE TABLE public.lembretes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lembrete_24h_ativo BOOLEAN NOT NULL DEFAULT true,
  lembrete_24h_hora TIME NOT NULL DEFAULT '18:00',
  lembrete_24h_template TEXT NOT NULL DEFAULT 'Oi {{tutor}}! 🐾 Passando para lembrar do banho do {{pet}} amanhã ({{data}}) às {{hora}} no Spa da Tia Jéssica. Qualquer coisa, é só chamar por aqui. Até já! 💚',
  pos_atendimento_ativo BOOLEAN NOT NULL DEFAULT true,
  pos_atendimento_horas INT NOT NULL DEFAULT 24,
  pos_atendimento_template TEXT NOT NULL DEFAULT 'Oi {{tutor}}! Como o {{pet}} está depois do spa? 💚 Se puder, adoraríamos seu feedback. Obrigada pela confiança!',
  aniversario_pet_ativo BOOLEAN NOT NULL DEFAULT true,
  aniversario_hora TIME NOT NULL DEFAULT '09:00',
  aniversario_template TEXT NOT NULL DEFAULT '🎉🐾 Feliz aniversário, {{pet}}! Toda a equipe do Spa da Tia Jéssica deseja um dia cheio de amor, petiscos e carinho. Um beijo pra vocês, {{tutor}}! 💚',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_config TO authenticated;
GRANT ALL ON public.lembretes_config TO service_role;
ALTER TABLE public.lembretes_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_lembretes_config" ON public.lembretes_config
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_lembretes_config_upd BEFORE UPDATE ON public.lembretes_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.lembretes_config DEFAULT VALUES;

-- 2) Queue
CREATE TABLE public.lembretes_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('lembrete_24h','pos_atendimento','aniversario_pet')),
  idempotency_key TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  atendimento_id UUID REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  telefone TEXT,
  cliente_nome TEXT,
  pet_nome TEXT,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falhou','cancelado')),
  tentativas INT NOT NULL DEFAULT 0,
  max_tentativas INT NOT NULL DEFAULT 5,
  proximo_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_tentativa TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes_fila TO authenticated;
GRANT ALL ON public.lembretes_fila TO service_role;
ALTER TABLE public.lembretes_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_lembretes_fila" ON public.lembretes_fila
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_lembretes_fila_upd BEFORE UPDATE ON public.lembretes_fila
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_lembretes_fila_status_prox ON public.lembretes_fila(status, proximo_envio);
CREATE INDEX idx_lembretes_fila_tipo ON public.lembretes_fila(tipo, status);

-- 3) Helper: render template
CREATE OR REPLACE FUNCTION public.render_lembrete(_template TEXT, _tutor TEXT, _pet TEXT, _data TEXT, _hora TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(replace(
    coalesce(_template,''),
    '{{tutor}}', coalesce(_tutor,'')),
    '{{pet}}', coalesce(_pet,'')),
    '{{data}}', coalesce(_data,'')),
    '{{hora}}', coalesce(_hora,''));
$$;

-- 4) Enqueue function
CREATE OR REPLACE FUNCTION public.enfileirar_lembretes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.lembretes_config;
  n_24h INT := 0;
  n_pos INT := 0;
  n_niver INT := 0;
BEGIN
  SELECT * INTO cfg FROM public.lembretes_config LIMIT 1;
  IF cfg IS NULL THEN RETURN jsonb_build_object('error','sem config'); END IF;

  -- Lembrete 24h: agendamentos de amanhã, status agendado/confirmado
  IF cfg.lembrete_24h_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id, agendamento_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'lembrete_24h',
        'lembrete_24h:' || a.id,
        c.id, p.id, a.id,
        coalesce(c.whatsapp, c.telefone),
        c.nome, p.nome,
        public.render_lembrete(cfg.lembrete_24h_template, c.nome, p.nome,
          to_char(a.data, 'DD/MM'),
          to_char(a.hora, 'HH24:MI')),
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

  -- Pós-atendimento: atendimentos encerrados há N horas (janela do último dia)
  IF cfg.pos_atendimento_ativo THEN
    WITH ins AS (
      INSERT INTO public.lembretes_fila (
        tipo, idempotency_key, cliente_id, pet_id, atendimento_id,
        telefone, cliente_nome, pet_nome, mensagem, proximo_envio
      )
      SELECT
        'pos_atendimento',
        'pos_atendimento:' || at.id,
        c.id, p.id, at.id,
        coalesce(c.whatsapp, c.telefone),
        c.nome, p.nome,
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
        coalesce(c.whatsapp, c.telefone),
        c.nome, p.nome,
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
    ) SELECT count(*) INTO n_niver FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'lembrete_24h', n_24h,
    'pos_atendimento', n_pos,
    'aniversario_pet', n_niver,
    'executado_em', now()
  );
END;
$$;

-- 5) Reclaim/backoff helper (for future automatic worker)
CREATE OR REPLACE FUNCTION public.claim_lembretes_pendentes(_limit INT DEFAULT 20)
RETURNS SETOF public.lembretes_fila
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.lembretes_fila
     SET tentativas = tentativas + 1,
         ultima_tentativa = now()
   WHERE id IN (
     SELECT id FROM public.lembretes_fila
      WHERE status = 'pendente'
        AND proximo_envio <= now()
        AND tentativas < max_tentativas
      ORDER BY proximo_envio
      FOR UPDATE SKIP LOCKED
      LIMIT _limit
   )
  RETURNING *;
$$;
