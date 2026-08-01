-- ia_config: leitura para equipe, escrita só admin/proprietário
DROP POLICY IF EXISTS "Staff manage ia_config" ON public.ia_config;
CREATE POLICY "Equipe le ia_config" ON public.ia_config
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admin gerencia ia_config" ON public.ia_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_proprietario(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_proprietario(auth.uid()));

-- ia_regras_tom: leitura para equipe, escrita só admin/proprietário
DROP POLICY IF EXISTS "Staff manage ia_regras_tom" ON public.ia_regras_tom;
CREATE POLICY "Equipe le ia_regras_tom" ON public.ia_regras_tom
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admin gerencia ia_regras_tom" ON public.ia_regras_tom
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_proprietario(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_proprietario(auth.uid()));

-- ia_metricas: autoria automática + leitura própria (admin vê tudo)
ALTER TABLE public.ia_metricas ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Equipe le metricas de IA" ON public.ia_metricas;
CREATE POLICY "Equipe le metricas de IA" ON public.ia_metricas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_proprietario(auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Equipe registra metricas de IA" ON public.ia_metricas;
CREATE POLICY "Equipe registra metricas de IA" ON public.ia_metricas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND (user_id IS NULL OR user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ia_metricas_user_created
  ON public.ia_metricas (user_id, created_at DESC);