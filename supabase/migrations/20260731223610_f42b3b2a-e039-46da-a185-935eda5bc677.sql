CREATE POLICY "Staff delete eventos" ON public.cobrancas_eventos FOR DELETE TO authenticated USING (public.is_staff());

ALTER TABLE public.cobrancas_eventos DROP CONSTRAINT IF EXISTS cobrancas_eventos_cobranca_id_fkey;
ALTER TABLE public.cobrancas_eventos ADD CONSTRAINT cobrancas_eventos_cobranca_id_fkey FOREIGN KEY (cobranca_id) REFERENCES public.cobrancas(id) ON DELETE CASCADE;