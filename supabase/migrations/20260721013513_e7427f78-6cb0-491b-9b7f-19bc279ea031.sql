
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.buscar_clientes_inteligente(termo TEXT, max_rows INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  whatsapp TEXT,
  telefone TEXT,
  bairro TEXT,
  email TEXT,
  cpf TEXT,
  vip BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t_norm TEXT;
  t_digits TEXT;
  has_text BOOLEAN;
  has_digits BOOLEAN;
BEGIN
  IF termo IS NULL THEN RETURN; END IF;
  t_norm := lower(unaccent(btrim(termo)));
  t_digits := regexp_replace(coalesce(termo,''), '\D', '', 'g');
  has_text := length(t_norm) >= 2;
  has_digits := length(t_digits) >= 2;

  IF NOT has_text AND NOT has_digits THEN RETURN; END IF;

  RETURN QUERY
  SELECT DISTINCT c.id, c.nome, c.whatsapp, c.telefone, c.bairro, c.email, c.cpf, c.vip
  FROM public.clientes c
  LEFT JOIN public.pets p ON p.cliente_id = c.id AND p.ativo = true
  WHERE
    (has_text AND (
      lower(unaccent(coalesce(c.nome,'')))   LIKE '%'||t_norm||'%'
      OR lower(unaccent(coalesce(c.email,''))) LIKE '%'||t_norm||'%'
      OR lower(unaccent(coalesce(c.bairro,''))) LIKE '%'||t_norm||'%'
      OR lower(unaccent(coalesce(p.nome,'')))  LIKE '%'||t_norm||'%'
    ))
    OR (has_digits AND (
      regexp_replace(coalesce(c.whatsapp,''), '\D', '', 'g') LIKE '%'||t_digits||'%'
      OR regexp_replace(coalesce(c.telefone,''), '\D', '', 'g') LIKE '%'||t_digits||'%'
      OR regexp_replace(coalesce(c.cpf,''), '\D', '', 'g')      LIKE '%'||t_digits||'%'
    ))
  ORDER BY c.nome
  LIMIT max_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_clientes_inteligente(TEXT, INT) TO authenticated;
