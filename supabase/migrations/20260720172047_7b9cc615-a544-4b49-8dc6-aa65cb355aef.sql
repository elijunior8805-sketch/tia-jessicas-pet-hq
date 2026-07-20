
-- Estado por conversa (por cliente): responsável, resolvida, atualizações
CREATE TABLE IF NOT EXISTS public.conversas_estado (
  cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_atribuido_em timestamptz,
  responsavel_atribuido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolvida_em timestamptz,
  resolvida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_estado TO authenticated;
GRANT ALL ON public.conversas_estado TO service_role;

ALTER TABLE public.conversas_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage conversas_estado"
  ON public.conversas_estado
  FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP TRIGGER IF EXISTS trg_conversas_estado_updated_at ON public.conversas_estado;
CREATE TRIGGER trg_conversas_estado_updated_at
  BEFORE UPDATE ON public.conversas_estado
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ao chegar nova mensagem "in", reabre conversa (limpa resolvida_em)
CREATE OR REPLACE FUNCTION public.reabrir_conversa_ao_receber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direcao = 'in' THEN
    INSERT INTO public.conversas_estado(cliente_id)
      VALUES (NEW.cliente_id)
    ON CONFLICT (cliente_id) DO UPDATE
      SET resolvida_em = NULL,
          resolvida_por = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensagens_reabrir ON public.mensagens;
CREATE TRIGGER trg_mensagens_reabrir
  AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.reabrir_conversa_ao_receber();

-- View enriquecida da inbox (substitui/estende mensagens_threads)
CREATE OR REPLACE VIEW public.mensagens_threads_v2
WITH (security_invoker = true) AS
WITH ult AS (
  SELECT DISTINCT ON (m.cliente_id)
    m.cliente_id, m.corpo, m.direcao, m.created_at
  FROM public.mensagens m
  ORDER BY m.cliente_id, m.created_at DESC
),
last_in AS (
  SELECT cliente_id, max(created_at) AS ultima_em_in
    FROM public.mensagens WHERE direcao = 'in' GROUP BY cliente_id
),
pet_primeiro AS (
  SELECT DISTINCT ON (p.cliente_id)
    p.cliente_id, p.nome
  FROM public.pets p
  WHERE p.ativo = true
  ORDER BY p.cliente_id, p.created_at
),
prox_agend AS (
  SELECT DISTINCT ON (a.cliente_id)
    a.cliente_id, a.id AS agendamento_id, a.data AS agendamento_data, a.hora AS agendamento_hora
  FROM public.agendamentos a
  WHERE a.status IN ('agendado','confirmado')
    AND (a.data > CURRENT_DATE OR (a.data = CURRENT_DATE AND a.hora >= CURRENT_TIME))
  ORDER BY a.cliente_id, a.data, a.hora
)
SELECT
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.telefone AS cliente_telefone,
  c.whatsapp AS cliente_whatsapp,
  pp.nome AS pet_primeiro_nome,
  u.corpo AS ultima_mensagem,
  u.direcao AS ultima_direcao,
  u.created_at AS ultima_em,
  li.ultima_em_in,
  (SELECT count(*) FROM public.mensagens m
     WHERE m.cliente_id = c.id AND m.direcao='in' AND m.status='nao_lida') AS nao_lidas,
  (SELECT count(*) FROM public.mensagens m WHERE m.cliente_id = c.id) AS total_mensagens,
  ce.responsavel_id,
  pr.nome AS responsavel_nome,
  pr.email AS responsavel_email,
  pr.avatar_url AS responsavel_avatar,
  ce.resolvida_em,
  CASE
    WHEN ce.resolvida_em IS NOT NULL
      AND (li.ultima_em_in IS NULL OR li.ultima_em_in <= ce.resolvida_em)
      THEN 'resolvida'
    WHEN u.direcao = 'in' THEN 'aguardando_resposta'
    WHEN u.direcao = 'out' THEN 'respondida'
    ELSE 'sem_mensagens'
  END AS status_conversa,
  pa.agendamento_id AS proximo_agendamento_id,
  pa.agendamento_data AS proximo_agendamento_data,
  pa.agendamento_hora AS proximo_agendamento_hora
FROM public.clientes c
JOIN ult u ON u.cliente_id = c.id
LEFT JOIN last_in li ON li.cliente_id = c.id
LEFT JOIN pet_primeiro pp ON pp.cliente_id = c.id
LEFT JOIN public.conversas_estado ce ON ce.cliente_id = c.id
LEFT JOIN public.profiles pr ON pr.id = ce.responsavel_id
LEFT JOIN prox_agend pa ON pa.cliente_id = c.id;

GRANT SELECT ON public.mensagens_threads_v2 TO authenticated;
