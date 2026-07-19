
REVOKE ALL ON FUNCTION public.enfileirar_lembretes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enfileirar_lembretes() TO service_role;
REVOKE ALL ON FUNCTION public.claim_lembretes_pendentes(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lembretes_pendentes(INT) TO service_role;
REVOKE ALL ON FUNCTION public.render_lembrete(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.render_lembrete(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;
