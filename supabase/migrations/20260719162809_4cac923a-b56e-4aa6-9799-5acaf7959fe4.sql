
-- 1) Função central de gate: só quem tem papel admin ou user opera.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'user'::app_role)
  );
$$;

-- 2) handle_new_user: primeiro vira admin; demais NÃO recebem papel automático.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role) INTO is_first;
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role);
  END IF;
  RETURN NEW;
END; $$;

-- 3) Substituir políticas permissivas pelo gate is_staff().
-- agendamentos
DROP POLICY IF EXISTS "Auth manage agend" ON public.agendamentos;
CREATE POLICY "Staff manage agend" ON public.agendamentos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "auth_manage_agendamento_servicos" ON public.agendamento_servicos;
CREATE POLICY "staff_manage_agendamento_servicos" ON public.agendamento_servicos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- atendimentos: preservar delete-admin; trocar select/update/insert
DROP POLICY IF EXISTS "Atend select auth" ON public.atendimentos;
DROP POLICY IF EXISTS "Atend insert auth" ON public.atendimentos;
DROP POLICY IF EXISTS "Atend update auth" ON public.atendimentos;
CREATE POLICY "Atend select staff" ON public.atendimentos FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Atend insert staff" ON public.atendimentos FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Atend update staff" ON public.atendimentos FOR UPDATE TO authenticated
  USING (public.is_staff() AND (encerrado_em IS NULL OR public.has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (public.is_staff());

-- clientes / pets / ocorrências
DROP POLICY IF EXISTS "Auth manage clientes" ON public.clientes;
CREATE POLICY "Staff manage clientes" ON public.clientes FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage pets" ON public.pets;
CREATE POLICY "Staff manage pets" ON public.pets FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage ocorr" ON public.ocorrencias;
CREATE POLICY "Staff manage ocorr" ON public.ocorrencias FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- cobranças
DROP POLICY IF EXISTS "Auth manage cobrancas" ON public.cobrancas;
CREATE POLICY "Staff manage cobrancas" ON public.cobrancas FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth read eventos" ON public.cobrancas_eventos;
DROP POLICY IF EXISTS "Auth insert eventos" ON public.cobrancas_eventos;
CREATE POLICY "Staff read eventos" ON public.cobrancas_eventos FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Staff insert eventos" ON public.cobrancas_eventos FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage templates" ON public.cobrancas_templates;
CREATE POLICY "Staff manage templates" ON public.cobrancas_templates FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth read config" ON public.cobrancas_config;
CREATE POLICY "Staff read config" ON public.cobrancas_config FOR SELECT TO authenticated USING (public.is_staff());

-- compras / parcelas / fornecedores / pagamentos
DROP POLICY IF EXISTS "Auth manage compras" ON public.compras;
CREATE POLICY "Staff manage compras" ON public.compras FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage parcelas" ON public.compras_parcelas;
CREATE POLICY "Staff manage parcelas" ON public.compras_parcelas FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage forn" ON public.fornecedores;
CREATE POLICY "Staff manage forn" ON public.fornecedores FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage pag" ON public.pagamentos;
CREATE POLICY "Staff manage pag" ON public.pagamentos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- estoque
DROP POLICY IF EXISTS "Auth manage prod" ON public.produtos_estoque;
CREATE POLICY "Staff manage prod" ON public.produtos_estoque FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Auth manage mov" ON public.movimentos_estoque;
CREATE POLICY "Staff manage mov" ON public.movimentos_estoque FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- recibos_enviados (insert/select amplos)
DROP POLICY IF EXISTS "Auth read recibos_enviados" ON public.recibos_enviados;
DROP POLICY IF EXISTS "Auth insert recibos_enviados" ON public.recibos_enviados;
CREATE POLICY "Staff read recibos_enviados" ON public.recibos_enviados FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Staff insert recibos_enviados" ON public.recibos_enviados FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- relatórios
DROP POLICY IF EXISTS "auth_all_relatorios_agendamentos" ON public.relatorios_agendamentos;
CREATE POLICY "staff_all_relatorios_agendamentos" ON public.relatorios_agendamentos FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "auth_select_relatorios_execucoes" ON public.relatorios_execucoes;
DROP POLICY IF EXISTS "auth_update_relatorios_execucoes" ON public.relatorios_execucoes;
CREATE POLICY "staff_select_relatorios_execucoes" ON public.relatorios_execucoes FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff_update_relatorios_execucoes" ON public.relatorios_execucoes FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- whatsapp_contatos
DROP POLICY IF EXISTS "wa_contatos_select_auth" ON public.whatsapp_contatos;
DROP POLICY IF EXISTS "wa_contatos_insert_auth" ON public.whatsapp_contatos;
DROP POLICY IF EXISTS "wa_contatos_update_auth" ON public.whatsapp_contatos;
CREATE POLICY "wa_contatos_select_staff" ON public.whatsapp_contatos FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "wa_contatos_insert_staff" ON public.whatsapp_contatos FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "wa_contatos_update_staff" ON public.whatsapp_contatos FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- catálogos (leitura "Auth read X" -> staff read)
DROP POLICY IF EXISTS "Auth read cat" ON public.categorias_financeiras;
CREATE POLICY "Staff read cat" ON public.categorias_financeiras FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read cc" ON public.centros_custo;
CREATE POLICY "Staff read cc" ON public.centros_custo FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read empresa" ON public.empresa_config;
CREATE POLICY "Staff read empresa" ON public.empresa_config FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read portes" ON public.portes;
CREATE POLICY "Staff read portes" ON public.portes FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read racas" ON public.racas;
CREATE POLICY "Staff read racas" ON public.racas FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read temp" ON public.temperamentos;
CREATE POLICY "Staff read temp" ON public.temperamentos FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read servicos" ON public.servicos;
CREATE POLICY "Staff read servicos" ON public.servicos FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read servicos_precos" ON public.servicos_precos;
CREATE POLICY "Staff read servicos_precos" ON public.servicos_precos FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Auth read combo itens" ON public.servicos_combo_itens;
CREATE POLICY "Staff read combo itens" ON public.servicos_combo_itens FOR SELECT TO authenticated USING (public.is_staff());
