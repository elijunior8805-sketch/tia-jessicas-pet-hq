GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_parcelas TO authenticated;
GRANT ALL ON public.compras_parcelas TO service_role;