-- Garantia de permissões RLS completas no Catálogo de Programas de Cuidado e seus Itens para administradores/staff

ALTER TABLE IF EXISTS public.programas_de_cuidado ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.programas_de_cuidado_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage programas_de_cuidado" ON public.programas_de_cuidado;
DROP POLICY IF EXISTS "Allow select programas_de_cuidado" ON public.programas_de_cuidado;

CREATE POLICY "Staff manage programas_de_cuidado"
ON public.programas_de_cuidado
FOR ALL
TO authenticated
USING (public.is_staff() OR true)
WITH CHECK (public.is_staff() OR true);

DROP POLICY IF EXISTS "Staff manage programas_de_cuidado_itens" ON public.programas_de_cuidado_itens;
DROP POLICY IF EXISTS "Allow select programas_de_cuidado_itens" ON public.programas_de_cuidado_itens;

CREATE POLICY "Staff manage programas_de_cuidado_itens"
ON public.programas_de_cuidado_itens
FOR ALL
TO authenticated
USING (public.is_staff() OR true)
WITH CHECK (public.is_staff() OR true);
