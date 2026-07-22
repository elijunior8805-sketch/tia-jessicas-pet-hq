GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_parcelas TO authenticated;
GRANT ALL ON public.compras_parcelas TO service_role;

-- Garante que as permissões continuem explícitas mesmo se uma migração antiga/remix tiver removido grants.
COMMENT ON TABLE public.compras IS 'Data API access: authenticated staff via RLS; service role for backend maintenance.';
COMMENT ON TABLE public.compras_parcelas IS 'Data API access: authenticated staff via RLS; service role for dashboard/financeiro expense reads.';