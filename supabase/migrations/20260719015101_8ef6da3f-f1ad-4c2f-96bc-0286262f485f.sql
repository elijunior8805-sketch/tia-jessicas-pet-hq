
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.agendamento_status AS ENUM ('agendado','confirmado','aguardando','em_atendimento','finalizado','cancelado','nao_compareceu');
CREATE TYPE public.pagamento_forma AS ENUM ('pix','credito','debito','dinheiro','pendente');
CREATE TYPE public.pagamento_status AS ENUM ('pago','parcial','pendente','atrasado','cancelado');
CREATE TYPE public.parcela_status AS ENUM ('pendente','pago','parcial','atrasado','cancelado');
CREATE TYPE public.comportamento_pet AS ENUM ('muito_tranquilo','tranquilo','agitado','muito_agitado','ansioso','medroso','agressivo','necessitou_focinheira','necessitou_pausa');
CREATE TYPE public.ocorrencia_tipo AS ENUM ('machucado','irritacao','pulgas_carrapatos','agressividade','servico_interrompido','acidente','outro');

-- ============================================
-- UTILITY: updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================
-- PROFILES + ROLES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles) INTO is_first;
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::app_role ELSE 'user'::app_role END);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  uemail TEXT;
BEGIN
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  INSERT INTO public.audit_log(user_id, user_email, table_name, record_id, action, old_data, new_data)
  VALUES (uid, uemail, TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END)::TEXT, ''),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;

-- ============================================
-- CONFIG TABLES
-- ============================================
CREATE TABLE public.racas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.racas TO authenticated;
GRANT ALL ON public.racas TO service_role;
ALTER TABLE public.racas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read racas" ON public.racas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage racas" ON public.racas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.portes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portes TO authenticated;
GRANT ALL ON public.portes TO service_role;
ALTER TABLE public.portes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read portes" ON public.portes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage portes" ON public.portes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.temperamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temperamentos TO authenticated;
GRANT ALL ON public.temperamentos TO service_role;
ALTER TABLE public.temperamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read temp" ON public.temperamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage temp" ON public.temperamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  ativo BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_financeiras TO authenticated;
GRANT ALL ON public.categorias_financeiras TO service_role;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read cat" ON public.categorias_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage cat" ON public.categorias_financeiras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read cc" ON public.centros_custo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage cc" ON public.centros_custo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.empresa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL DEFAULT 'Spa de Pet Tia Jéssica',
  razao_social TEXT,
  cnpj TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  logo_url TEXT,
  taxa_leva_traz_padrao NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.empresa_config TO authenticated;
GRANT ALL ON public.empresa_config TO service_role;
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read empresa" ON public.empresa_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage empresa" ON public.empresa_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================
-- SERVIÇOS
-- ============================================
CREATE TABLE public.servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  duracao_min INT NOT NULL DEFAULT 60,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated;
GRANT ALL ON public.servicos TO service_role;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read servicos" ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage servicos" ON public.servicos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_servicos_updated BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_servicos_audit AFTER INSERT OR UPDATE OR DELETE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- CLIENTES
-- ============================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  nascimento DATE,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  cep TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  observacoes TEXT,
  vip BOOLEAN NOT NULL DEFAULT false,
  indicacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_clientes_nome ON public.clientes USING gin (to_tsvector('portuguese', nome));
CREATE INDEX idx_clientes_telefone ON public.clientes(telefone);
CREATE INDEX idx_clientes_whatsapp ON public.clientes(whatsapp);
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clientes_audit AFTER INSERT OR UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- PETS
-- ============================================
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  raca TEXT,
  sexo TEXT CHECK (sexo IN ('macho','femea')),
  peso NUMERIC(6,2),
  porte TEXT,
  cor TEXT,
  nascimento DATE,
  castrado BOOLEAN DEFAULT false,
  alergias TEXT,
  cuidados_saude TEXT,
  temperamento TEXT,
  necessita_focinheira BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  preferencias_tutor TEXT,
  foto_url TEXT,
  ultimo_banho DATE,
  ultima_tosa DATE,
  proxima_visita DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;
GRANT ALL ON public.pets TO service_role;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage pets" ON public.pets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_pets_cliente ON public.pets(cliente_id);
CREATE INDEX idx_pets_nome ON public.pets USING gin (to_tsvector('portuguese', nome));
CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pets_audit AFTER INSERT OR UPDATE OR DELETE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- AGENDAMENTOS
-- ============================================
CREATE TABLE public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  servico_id UUID REFERENCES public.servicos(id),
  data DATE NOT NULL,
  hora TIME NOT NULL,
  duracao_min INT NOT NULL DEFAULT 60,
  valor_previsto NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_leva_traz NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  status agendamento_status NOT NULL DEFAULT 'agendado',
  profissional_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage agend" ON public.agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_agend_data ON public.agendamentos(data);
CREATE INDEX idx_agend_pet ON public.agendamentos(pet_id);
CREATE INDEX idx_agend_cliente ON public.agendamentos(cliente_id);
CREATE TRIGGER trg_agend_updated BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_agend_audit AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- ATENDIMENTOS (planejado x executado)
-- ============================================
CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID UNIQUE REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  pet_id UUID NOT NULL REFERENCES public.pets(id),
  profissional_id UUID REFERENCES auth.users(id),
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  servicos_planejados JSONB NOT NULL DEFAULT '[]'::jsonb,
  servicos_executados JSONB NOT NULL DEFAULT '[]'::jsonb,
  valor_planejado NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_executado NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_leva_traz NUMERIC(10,2) NOT NULL DEFAULT 0,
  fotos_antes JSONB DEFAULT '[]'::jsonb,
  fotos_depois JSONB DEFAULT '[]'::jsonb,
  comportamentos TEXT[],
  observacoes TEXT,
  recomendacoes TEXT,
  proxima_visita DATE,
  check_in_foto TEXT,
  check_in_obs TEXT,
  finalizado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage atend" ON public.atendimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_atend_pet ON public.atendimentos(pet_id);
CREATE INDEX idx_atend_cliente ON public.atendimentos(cliente_id);
CREATE TRIGGER trg_atend_updated BEFORE UPDATE ON public.atendimentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_atend_audit AFTER INSERT OR UPDATE OR DELETE ON public.atendimentos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- OCORRÊNCIAS
-- ============================================
CREATE TABLE public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  pet_id UUID NOT NULL REFERENCES public.pets(id),
  tipo ocorrencia_tipo NOT NULL,
  descricao TEXT NOT NULL,
  fotos JSONB DEFAULT '[]'::jsonb,
  profissional_id UUID REFERENCES auth.users(id),
  tutor_informado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias TO authenticated;
GRANT ALL ON public.ocorrencias TO service_role;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage ocorr" ON public.ocorrencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_ocorr_pet ON public.ocorrencias(pet_id);
CREATE TRIGGER trg_ocorr_audit AFTER INSERT OR UPDATE OR DELETE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- PAGAMENTOS (recebimentos de atendimento)
-- ============================================
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  valor_total NUMERIC(10,2) NOT NULL,
  valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma pagamento_forma NOT NULL DEFAULT 'pendente',
  status pagamento_status NOT NULL DEFAULT 'pendente',
  vencimento DATE,
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage pag" ON public.pagamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_pag_cliente ON public.pagamentos(cliente_id);
CREATE INDEX idx_pag_status ON public.pagamentos(status);
CREATE TRIGGER trg_pag_updated BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pag_audit AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- FORNECEDORES / COMPRAS / PARCELAS
-- ============================================
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  razao_social TEXT,
  cpf_cnpj TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  tipo_produto TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage forn" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_forn_updated BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_forn_audit AFTER INSERT OR UPDATE OR DELETE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id),
  numero_documento TEXT,
  descricao TEXT,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  data_recebimento DATE,
  recebido BOOLEAN NOT NULL DEFAULT false,
  valor_total NUMERIC(12,2) NOT NULL,
  forma_pagamento pagamento_forma NOT NULL DEFAULT 'pendente',
  parcelas INT NOT NULL DEFAULT 1,
  primeiro_vencimento DATE,
  observacoes TEXT,
  anexo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage compras" ON public.compras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_compras_updated BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_compras_audit AFTER INSERT OR UPDATE OR DELETE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.compras_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  numero INT NOT NULL,
  total_parcelas INT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  vencimento DATE NOT NULL,
  valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_pagamento DATE,
  juros NUMERIC(10,2) DEFAULT 0,
  multa NUMERIC(10,2) DEFAULT 0,
  desconto NUMERIC(10,2) DEFAULT 0,
  forma_pagamento pagamento_forma,
  comprovante_url TEXT,
  observacoes TEXT,
  status parcela_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_parcelas TO authenticated;
GRANT ALL ON public.compras_parcelas TO service_role;
ALTER TABLE public.compras_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage parcelas" ON public.compras_parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_parc_compra ON public.compras_parcelas(compra_id);
CREATE INDEX idx_parc_venc ON public.compras_parcelas(vencimento);
CREATE TRIGGER trg_parc_updated BEFORE UPDATE ON public.compras_parcelas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_parc_audit AFTER INSERT OR UPDATE OR DELETE ON public.compras_parcelas FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- ESTOQUE
-- ============================================
CREATE TABLE public.produtos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  custo_medio NUMERIC(10,2) NOT NULL DEFAULT 0,
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_estoque TO authenticated;
GRANT ALL ON public.produtos_estoque TO service_role;
ALTER TABLE public.produtos_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage prod" ON public.produtos_estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.produtos_estoque FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prod_audit AFTER INSERT OR UPDATE OR DELETE ON public.produtos_estoque FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.movimentos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos_estoque(id) ON DELETE CASCADE,
  compra_id UUID REFERENCES public.compras(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade NUMERIC(12,3) NOT NULL,
  custo_unitario NUMERIC(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentos_estoque TO authenticated;
GRANT ALL ON public.movimentos_estoque TO service_role;
ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage mov" ON public.movimentos_estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mov_audit AFTER INSERT OR UPDATE OR DELETE ON public.movimentos_estoque FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================
-- SEEDS
-- ============================================
INSERT INTO public.portes(nome, ordem) VALUES
  ('Mini',1),('Pequeno',2),('Médio',3),('Grande',4),('Gigante',5);

INSERT INTO public.temperamentos(nome) VALUES
  ('Dócil'),('Brincalhão'),('Tímido'),('Ansioso'),('Agitado'),('Agressivo'),('Medroso');

INSERT INTO public.racas(nome) VALUES
  ('SRD'),('Shih Tzu'),('Maltês'),('Poodle'),('Yorkshire'),('Lhasa Apso'),
  ('Bulldog Francês'),('Bulldog Inglês'),('Pug'),('Chihuahua'),('Pinscher'),
  ('Dachshund'),('Beagle'),('Cocker Spaniel'),('Border Collie'),('Labrador'),
  ('Golden Retriever'),('Pastor Alemão'),('Rottweiler'),('Boxer'),('Husky Siberiano'),
  ('Schnauzer'),('Spitz Alemão'),('West Highland'),('Bichon Frisé'),('Cavalier King Charles'),
  ('Pit Bull'),('American Staffordshire'),('Doberman'),('Akita'),('Outro');

INSERT INTO public.categorias_financeiras(nome, tipo) VALUES
  ('Atendimentos','receita'),('Leva e Traz','receita'),('Vendas','receita'),
  ('Produtos','despesa'),('Aluguel','despesa'),('Energia','despesa'),('Água','despesa'),
  ('Internet','despesa'),('Marketing','despesa'),('Salários','despesa'),('Impostos','despesa'),
  ('Manutenção','despesa'),('Outras despesas','despesa');

INSERT INTO public.centros_custo(nome) VALUES
  ('Operação'),('Administrativo'),('Marketing'),('Estrutura');

INSERT INTO public.servicos(nome, categoria, valor, duracao_min) VALUES
  ('Banho Simples','Banho',50.00,60),
  ('Banho Premium','Banho',80.00,90),
  ('Hidratação','Banho',30.00,30),
  ('Desembolo','Banho',25.00,30),
  ('Remoção de Subpelo','Banho',40.00,45),
  ('Tosa Higiênica','Tosa',30.00,30),
  ('Tosa na Tesoura','Tosa',90.00,90),
  ('Tosa na Máquina','Tosa',70.00,60),
  ('Corte de Unhas','Extras',15.00,15),
  ('Limpeza de Pata','Extras',10.00,10),
  ('Limpeza de Rosto','Extras',15.00,15),
  ('Pata + Rosto','Extras',20.00,20);

INSERT INTO public.empresa_config(nome_fantasia) VALUES ('Spa de Pet Tia Jéssica');
