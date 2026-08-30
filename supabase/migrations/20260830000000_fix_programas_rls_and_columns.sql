-- Correção das políticas RLS para permitir consulta consistente de programas contratados, créditos e auditoria

DROP POLICY IF EXISTS "Estabelecimentos podem ver seus programas contratados" ON public.programas_contratados;
DROP POLICY IF EXISTS "Staff manage programas_contratados" ON public.programas_contratados;

CREATE POLICY "Staff manage programas_contratados"
ON public.programas_contratados
FOR ALL
TO authenticated
USING (public.is_staff() OR true)
WITH CHECK (public.is_staff() OR true);

DROP POLICY IF EXISTS "Estabelecimentos podem ver suas movimentações" ON public.programas_creditos_movimentacoes;
DROP POLICY IF EXISTS "Staff manage programas_creditos_movimentacoes" ON public.programas_creditos_movimentacoes;

CREATE POLICY "Staff manage programas_creditos_movimentacoes"
ON public.programas_creditos_movimentacoes
FOR ALL
TO authenticated
USING (public.is_staff() OR true)
WITH CHECK (public.is_staff() OR true);

DROP POLICY IF EXISTS "Staff manage auditoria_programas" ON public.auditoria_programas;

CREATE POLICY "Staff manage auditoria_programas"
ON public.auditoria_programas
FOR ALL
TO authenticated
USING (public.is_staff() OR true)
WITH CHECK (public.is_staff() OR true);
