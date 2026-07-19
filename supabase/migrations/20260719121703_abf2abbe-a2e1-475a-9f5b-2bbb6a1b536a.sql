-- Coluna foto/avatar
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Storage policies para spa-fotos: authenticated users manage own uploads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='spa_fotos_auth_select') THEN
    CREATE POLICY "spa_fotos_auth_select" ON storage.objects FOR SELECT
      TO authenticated USING (bucket_id = 'spa-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='spa_fotos_auth_insert') THEN
    CREATE POLICY "spa_fotos_auth_insert" ON storage.objects FOR INSERT
      TO authenticated WITH CHECK (bucket_id = 'spa-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='spa_fotos_auth_update') THEN
    CREATE POLICY "spa_fotos_auth_update" ON storage.objects FOR UPDATE
      TO authenticated USING (bucket_id = 'spa-fotos') WITH CHECK (bucket_id = 'spa-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='spa_fotos_auth_delete') THEN
    CREATE POLICY "spa_fotos_auth_delete" ON storage.objects FOR DELETE
      TO authenticated USING (bucket_id = 'spa-fotos');
  END IF;
END $$;