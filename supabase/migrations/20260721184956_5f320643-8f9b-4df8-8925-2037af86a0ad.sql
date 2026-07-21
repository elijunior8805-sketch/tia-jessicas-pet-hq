
-- 1) Fechar INSERT permissivo em leva_traz_eventos
DROP POLICY IF EXISTS "ltev_insert_auth" ON public.leva_traz_eventos;
CREATE POLICY "ltev_insert_staff" ON public.leva_traz_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Revogar EXECUTE de anon nas funções que vazam dados ou permitem abuso operacional.
--    Mantém acesso para authenticated (o app usa via sessão).
REVOKE EXECUTE ON FUNCTION public.buscar_clientes_inteligente(text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.endereco_cliente_jsonb(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verificar_conflito_agendamento(date, time, integer, uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_lembretes_pendentes(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enfileirar_lembretes() FROM anon, PUBLIC;

-- Também revogar de anon nas funções internas SECURITY DEFINER que não deveriam
-- ser expostas via RPC pública (o app chama por RLS ou via server functions autenticadas).
REVOKE EXECUTE ON FUNCTION public.excluir_atendimento(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_agendamento_seguro(jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atualizar_agendamento_seguro(uuid, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_agregados() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.limpar_dados_teste_financeiro() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_compra(uuid) FROM anon, PUBLIC;

-- Garantir que authenticated continua podendo chamar (necessário para o app).
GRANT EXECUTE ON FUNCTION public.buscar_clientes_inteligente(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.endereco_cliente_jsonb(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_conflito_agendamento(date, time, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_atendimento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_seguro(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_agendamento_seguro(uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_agregados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_dados_teste_financeiro() TO authenticated;

-- claim_lembretes_pendentes e enfileirar_lembretes são chamadas por pg_cron/service_role,
-- não precisam de authenticated. Mantém só service_role.

-- get_recibo_publico é intencionalmente pública (recibo por link) — manter EXECUTE para anon.

-- 3) Fixar search_path em render_lembrete (evita function hijacking).
CREATE OR REPLACE FUNCTION public.render_lembrete(_template text, _tutor text, _pet text, _data text, _hora text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  SELECT replace(replace(replace(replace(
    coalesce(_template,''),
    '{{tutor}}', coalesce(_tutor,'')),
    '{{pet}}', coalesce(_pet,'')),
    '{{data}}', coalesce(_data,'')),
    '{{hora}}', coalesce(_hora,''));
$function$;
