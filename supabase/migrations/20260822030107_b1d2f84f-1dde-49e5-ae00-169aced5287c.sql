ALTER FUNCTION public.get_atendimento_total_executado(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_atendimento_total_executado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_atendimento_total_executado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_atendimento_total_executado(uuid) TO service_role;
