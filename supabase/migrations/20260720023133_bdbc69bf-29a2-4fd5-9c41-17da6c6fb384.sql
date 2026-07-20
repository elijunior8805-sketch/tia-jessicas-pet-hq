
REVOKE ALL ON FUNCTION public.verificar_conflito_agendamento(date, time, integer, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_agendamento_seguro(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atualizar_agendamento_seguro(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificar_conflito_agendamento(date, time, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_seguro(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_agendamento_seguro(uuid, integer, jsonb) TO authenticated;
