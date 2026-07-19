
-- 1) Novos campos em recibos_enviados
ALTER TABLE public.recibos_enviados
  ADD COLUMN IF NOT EXISTS codigo_publico TEXT,
  ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_nome TEXT,
  ADD COLUMN IF NOT EXISTS servico TEXT,
  ADD COLUMN IF NOT EXISTS data_atendimento DATE,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;

-- Backfill codigo_publico para registros antigos
UPDATE public.recibos_enviados
   SET codigo_publico = upper(regexp_replace(encode(gen_random_bytes(9), 'base64'), '[^A-Za-z0-9]', '', 'g'))
 WHERE codigo_publico IS NULL;

-- Índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_enviados_codigo_publico
  ON public.recibos_enviados(codigo_publico);

-- 2) Função pública para consulta segura do recibo
CREATE OR REPLACE FUNCTION public.get_recibo_publico(_codigo TEXT)
RETURNS TABLE (
  codigo TEXT,
  tipo TEXT,
  numero_recibo TEXT,
  contraparte TEXT,
  valor NUMERIC,
  enviado_em TIMESTAMPTZ,
  cancelado BOOLEAN,
  pet_nome TEXT,
  servico TEXT,
  data_atendimento DATE,
  forma_pagamento TEXT,
  data_pagamento DATE,
  empresa_nome TEXT,
  empresa_telefone TEXT,
  empresa_whatsapp TEXT,
  empresa_logo TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.codigo_publico,
    r.tipo,
    r.numero_recibo,
    r.contraparte,
    r.valor,
    r.enviado_em,
    COALESCE(r.cancelado, false),
    COALESCE(
      r.pet_nome,
      (SELECT p.nome FROM public.pets p
         JOIN public.atendimentos a ON a.pet_id = p.id
         JOIN public.pagamentos pg ON pg.atendimento_id = a.id
        WHERE pg.id = r.referencia_id AND r.tipo = 'receita'
        LIMIT 1)
    ) AS pet_nome,
    COALESCE(
      r.servico,
      (SELECT string_agg(COALESCE(e->>'nome',''), ', ')
         FROM public.pagamentos pg
         JOIN public.atendimentos a ON a.id = pg.atendimento_id,
              LATERAL jsonb_array_elements(COALESCE(a.servicos_executados, a.servicos_planejados, '[]'::jsonb)) e
        WHERE pg.id = r.referencia_id AND r.tipo = 'receita')
    ) AS servico,
    COALESCE(
      r.data_atendimento,
      (SELECT a.data_inicio::date FROM public.atendimentos a
         JOIN public.pagamentos pg ON pg.atendimento_id = a.id
        WHERE pg.id = r.referencia_id AND r.tipo = 'receita'
        LIMIT 1)
    ) AS data_atendimento,
    COALESCE(
      r.forma_pagamento,
      (SELECT pg.forma::text FROM public.pagamentos pg WHERE pg.id = r.referencia_id AND r.tipo = 'receita')
    ) AS forma_pagamento,
    COALESCE(
      r.data_pagamento,
      (SELECT pg.data_pagamento FROM public.pagamentos pg WHERE pg.id = r.referencia_id AND r.tipo = 'receita')
    ) AS data_pagamento,
    (SELECT nome_fantasia FROM public.empresa_config LIMIT 1),
    (SELECT telefone FROM public.empresa_config LIMIT 1),
    (SELECT whatsapp FROM public.empresa_config LIMIT 1),
    (SELECT logo_url FROM public.empresa_config LIMIT 1)
  FROM public.recibos_enviados r
  WHERE r.codigo_publico = _codigo
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_recibo_publico(TEXT) TO anon, authenticated;

-- 3) Atualiza defaults dos templates para usar {link} e texto revisado
ALTER TABLE public.empresa_config
  ALTER COLUMN whatsapp_template_receber SET DEFAULT
  'Olá, {contraparte}! Tudo bem?

Seu pagamento de *{valor}* foi confirmado com sucesso. Agradecemos pela confiança em nosso trabalho e pelo carinho com o Spa de Pet Tia Jéssica. 🐾

Você pode consultar seu recibo com segurança pelo link abaixo:
{link}

{assinatura}
Cuidado e carinho em cada atendimento.',
  ALTER COLUMN whatsapp_template_pagar SET DEFAULT
  'Olá, {contraparte}!

Segue o comprovante de pagamento no valor de *{valor}*, referente a "{descricao}", pago em {data}.

Consulte o comprovante com segurança pelo link:
{link}

{assinatura}';

-- Atualiza registros existentes que ainda usam o template antigo (com URL bruta)
UPDATE public.empresa_config
   SET whatsapp_template_receber = 'Olá, {contraparte}! Tudo bem?

Seu pagamento de *{valor}* foi confirmado com sucesso. Agradecemos pela confiança em nosso trabalho e pelo carinho com o Spa de Pet Tia Jéssica. 🐾

Você pode consultar seu recibo com segurança pelo link abaixo:
{link}

{assinatura}
Cuidado e carinho em cada atendimento.'
 WHERE whatsapp_template_receber IS NULL
    OR whatsapp_template_receber NOT LIKE '%{link}%';

UPDATE public.empresa_config
   SET whatsapp_template_pagar = 'Olá, {contraparte}!

Segue o comprovante de pagamento no valor de *{valor}*, referente a "{descricao}", pago em {data}.

Consulte o comprovante com segurança pelo link:
{link}

{assinatura}'
 WHERE whatsapp_template_pagar IS NULL
    OR whatsapp_template_pagar NOT LIKE '%{link}%';
