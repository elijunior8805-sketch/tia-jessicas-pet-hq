-- ============ 1. Configurações da IA (singleton) ============
CREATE TABLE public.ia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  ia_ativa boolean NOT NULL DEFAULT true,
  provedor text NOT NULL DEFAULT 'lovable',
  modelo_principal text NOT NULL DEFAULT 'google/gemini-3.6-flash',
  modelo_alternativo text NOT NULL DEFAULT 'google/gemini-3.1-flash-lite',
  criatividade numeric NOT NULL DEFAULT 0.6,
  limite_caracteres integer NOT NULL DEFAULT 600,
  timeout_ms integer NOT NULL DEFAULT 25000,
  max_tentativas_ia integer NOT NULL DEFAULT 2,
  horario_inicio time NOT NULL DEFAULT '08:00',
  horario_fim time NOT NULL DEFAULT '20:00',
  intervalo_min_horas integer NOT NULL DEFAULT 24,
  max_tentativas_contato integer NOT NULL DEFAULT 4,
  instrucoes_empresa text NOT NULL DEFAULT '',
  assinatura text NOT NULL DEFAULT '',
  pix_chave text,
  link_pagamento text,
  palavras_proibidas text[] NOT NULL DEFAULT ARRAY['inadimplente','devedor','caloteiro','protesto','negativação','judicial','serasa','spc'],
  permitir_mencao_juridica boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_config_singleton_uq UNIQUE (singleton)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_config TO authenticated;
GRANT ALL ON public.ia_config TO service_role;
ALTER TABLE public.ia_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ia_config" ON public.ia_config FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_ia_config_updated BEFORE UPDATE ON public.ia_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ia_config (singleton) VALUES (true);

-- ============ 2. Regras de tom configuráveis ============
CREATE TABLE public.ia_regras_tom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem integer NOT NULL DEFAULT 0,
  nome text NOT NULL,
  condicao text NOT NULL,
  dias_min integer,
  dias_max integer,
  tom text NOT NULL,
  nivel_firmeza smallint NOT NULL DEFAULT 3,
  requer_revisao_humana boolean NOT NULL DEFAULT true,
  bloquear_ia boolean NOT NULL DEFAULT false,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_regras_tom TO authenticated;
GRANT ALL ON public.ia_regras_tom TO service_role;
ALTER TABLE public.ia_regras_tom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage ia_regras_tom" ON public.ia_regras_tom FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_ia_regras_tom_updated BEFORE UPDATE ON public.ia_regras_tom FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ia_regras_tom (ordem, nome, condicao, dias_min, dias_max, tom, nivel_firmeza, bloquear_ia, observacao) VALUES
 (10,'Antes do vencimento','atraso',-99,-1,'amigavel',1,false,'Lembrete amigável antes do vencimento'),
 (20,'No vencimento','atraso',0,0,'cordial',2,false,'Vence hoje'),
 (30,'1 a 3 dias de atraso','atraso',1,3,'cordial',2,false,'Cordial e objetivo'),
 (40,'4 a 7 dias de atraso','atraso',4,7,'profissional',3,false,null),
 (50,'8 a 15 dias de atraso','atraso',8,15,'direto',4,false,null),
 (60,'Mais de 15 dias','atraso',16,9999,'negociacao',4,false,'Firme ou proposta de negociação'),
 (70,'Promessa próxima','promessa_proxima',null,null,'lembrete_promessa',1,false,'Lembrete gentil da promessa'),
 (80,'Promessa vencida','promessa_vencida',null,null,'firme_respeitoso',4,false,null),
 (90,'Dificuldade financeira','dificuldade',null,null,'empatico',1,false,null),
 (100,'Cliente antigo com bom histórico','bom_historico',null,null,'acolhedor',1,false,'Preservar relacionamento'),
 (110,'Muitas tentativas sem resposta','sem_resposta',null,null,'profissional',3,true,'Encaminhar para revisão humana'),
 (120,'Cliente irritado','irritado',null,null,'empatico',1,true,'Não gerar cobrança automática — atendimento humano');

-- ============ 3. Promessas de pagamento ============
CREATE TABLE public.promessas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor_prometido numeric NOT NULL DEFAULT 0,
  data_prometida date NOT NULL,
  forma_pagamento text,
  observacoes text,
  status text NOT NULL DEFAULT 'aguardando',
  valor_recebido numeric NOT NULL DEFAULT 0,
  registrado_por uuid REFERENCES auth.users(id),
  registrado_por_email text,
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promessas_status_ck CHECK (status IN ('aguardando','cumprida','parcialmente_cumprida','vencida','renegociada','cancelada'))
);
CREATE INDEX idx_promessas_cliente ON public.promessas_pagamento(cliente_id);
CREATE INDEX idx_promessas_data ON public.promessas_pagamento(data_prometida);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promessas_pagamento TO authenticated;
GRANT ALL ON public.promessas_pagamento TO service_role;
ALTER TABLE public.promessas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage promessas" ON public.promessas_pagamento FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER trg_promessas_updated BEFORE UPDATE ON public.promessas_pagamento FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. Colunas aditivas no histórico ============
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS tom_sugerido text,
  ADD COLUMN IF NOT EXISTS tom_escolhido text,
  ADD COLUMN IF NOT EXISTS nivel_firmeza smallint,
  ADD COLUMN IF NOT EXISTS modelo_ia text,
  ADD COLUMN IF NOT EXISTS mensagem_ia_original text,
  ADD COLUMN IF NOT EXISTS resultado_contato text,
  ADD COLUMN IF NOT EXISTS promessa_id uuid REFERENCES public.promessas_pagamento(id) ON DELETE SET NULL;

-- ============ 5. Colunas aditivas na fila proativa ============
ALTER TABLE public.mensagem_sugestoes
  ADD COLUMN IF NOT EXISTS prioridade_label text,
  ADD COLUMN IF NOT EXISTS tom_sugerido text,
  ADD COLUMN IF NOT EXISTS motivo_do_tom text,
  ADD COLUMN IF NOT EXISTS proxima_acao text,
  ADD COLUMN IF NOT EXISTS prazo_proxima_acao_horas integer,
  ADD COLUMN IF NOT EXISTS adiada_para timestamptz,
  ADD COLUMN IF NOT EXISTS valor_pendente numeric,
  ADD COLUMN IF NOT EXISTS dias_atraso integer,
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp';