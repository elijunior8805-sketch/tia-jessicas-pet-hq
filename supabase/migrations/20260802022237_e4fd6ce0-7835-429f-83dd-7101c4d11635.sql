-- Storage: restringir bucket spa-fotos a equipe (escrita) e equipe+transportador (leitura)
DROP POLICY IF EXISTS "Auth delete spa-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert spa-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth read spa-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update spa-fotos" ON storage.objects;
DROP POLICY IF EXISTS "spa_fotos_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "spa_fotos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "spa_fotos_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "spa_fotos_auth_update" ON storage.objects;

CREATE POLICY "spa_fotos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'spa-fotos'
    AND (public.is_staff() OR public.has_role(auth.uid(), 'transportador'))
  );

CREATE POLICY "spa_fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'spa-fotos' AND public.is_staff());

CREATE POLICY "spa_fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'spa-fotos' AND public.is_staff())
  WITH CHECK (bucket_id = 'spa-fotos' AND public.is_staff());

CREATE POLICY "spa_fotos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'spa-fotos' AND public.is_staff());

-- conversas_estado: limitar a política ao papel authenticated
DROP POLICY IF EXISTS "staff manage conversas_estado" ON public.conversas_estado;
CREATE POLICY "staff manage conversas_estado" ON public.conversas_estado
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());