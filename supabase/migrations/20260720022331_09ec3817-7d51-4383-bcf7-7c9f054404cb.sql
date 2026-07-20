
CREATE TABLE IF NOT EXISTS public.pet_acessos_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('consulta_historico','gerou_pdf','preview_pdf')),
  escopo JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pet_acessos_log TO authenticated;
GRANT ALL ON public.pet_acessos_log TO service_role;
ALTER TABLE public.pet_acessos_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read pet_acessos_log" ON public.pet_acessos_log
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Staff insert pet_acessos_log" ON public.pet_acessos_log
  FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND (user_id IS NULL OR user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_pet_acessos_pet ON public.pet_acessos_log (pet_id, created_at DESC);
