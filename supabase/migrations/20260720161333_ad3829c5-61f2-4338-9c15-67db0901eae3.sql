
-- === Clientes: tom preferido + opt-out LGPD ===
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tom_preferido text
    CHECK (tom_preferido IN ('amigavel','profissional','acolhedor','formal','descontraido','carinhoso','direto') OR tom_preferido IS NULL),
  ADD COLUMN IF NOT EXISTS opt_out_comunicacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_out_em timestamptz,
  ADD COLUMN IF NOT EXISTS opt_out_motivo text;

-- === Templates de mensagem ===
CREATE TABLE IF NOT EXISTS public.mensagem_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  nome text NOT NULL,
  corpo text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  is_padrao boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensagem_templates_tipo ON public.mensagem_templates(tipo) WHERE ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagem_templates TO authenticated;
GRANT ALL ON public.mensagem_templates TO service_role;

ALTER TABLE public.mensagem_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagem_templates_read_staff" ON public.mensagem_templates
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "mensagem_templates_write_admin" ON public.mensagem_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_mt_updated_at BEFORE UPDATE ON public.mensagem_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === Sugestões proativas ===
CREATE TABLE IF NOT EXISTS public.mensagem_sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  atendimento_id uuid REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  motivo text NOT NULL,
  prioridade integer NOT NULL DEFAULT 50,
  prevista_para timestamptz,
  mensagem_sugerida text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviada','ignorada','expirada')),
  feedback text CHECK (feedback IN ('positivo','negativo') OR feedback IS NULL),
  feedback_em timestamptz,
  feedback_por uuid,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msug_status ON public.mensagem_sugestoes(status, prioridade DESC, prevista_para);
CREATE INDEX IF NOT EXISTS idx_msug_cliente ON public.mensagem_sugestoes(cliente_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagem_sugestoes TO authenticated;
GRANT ALL ON public.mensagem_sugestoes TO service_role;

ALTER TABLE public.mensagem_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagem_sugestoes_staff" ON public.mensagem_sugestoes
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TRIGGER trg_msug_updated_at BEFORE UPDATE ON public.mensagem_sugestoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === Extensões em mensagens ===
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.mensagem_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sugestao_id uuid REFERENCES public.mensagem_sugestoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mensagem_original text;

-- === Config de janelas de sugestão ===
ALTER TABLE public.lembretes_config
  ADD COLUMN IF NOT EXISTS sugestao_confirmacao_horas integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS sugestao_reengajamento_dias integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS sugestao_pos_atendimento_horas integer NOT NULL DEFAULT 24;

-- === Seed dos templates padrão ===
INSERT INTO public.mensagem_templates(tipo, nome, corpo, is_padrao) VALUES
  ('confirmacao_agendamento', 'Confirmação padrão',
   'Olá, {tutor}! Aqui é do Spa da Tia Jéssica 🐾' || chr(10) ||
   'Confirmando o atendimento do {pet} em {data} às {hora}. Podemos manter?', true),
  ('lembrete_agendamento', 'Lembrete 24h antes',
   'Oi, {tutor}! Lembrete carinhoso: o atendimento do {pet} é amanhã, {data} às {hora}. 💛' || chr(10) ||
   'Qualquer ajuste, é só avisar por aqui.', true),
  ('pos_atendimento', 'Pós-atendimento',
   'Oi, {tutor}! Foi um prazer receber o {pet} hoje. ✨' || chr(10) ||
   'Ele(a) saiu cheiroso(a) e no melhor humor. Conta pra gente como ficou em casa?', true),
  ('vacina_vencendo', 'Lembrete de vacina',
   'Oi, {tutor}! Passando para lembrar que a vacina do {pet} está próxima do vencimento. 🐾' || chr(10) ||
   'Quer que a gente ajude a reorganizar a agenda?', true),
  ('aniversario_pet', 'Aniversário do pet',
   '🎂 Feliz aniversário, {pet}! 🎉' || chr(10) ||
   'O Spa da Tia Jéssica manda um abraço apertado. Um dia cheio de petiscos e carinho pra você!', true),
  ('cobranca_pendente', 'Cobrança educada',
   'Olá, {tutor}. Tudo bem?' || chr(10) ||
   'Passando para lembrar do pagamento de R$ {valor} referente ao atendimento do {pet} em {data}.' || chr(10) ||
   'Se já efetuou, por favor desconsidere. Qualquer coisa, estamos aqui.', true),
  ('reagendamento', 'Reagendamento',
   'Oi, {tutor}! Precisamos reajustar o horário do {pet} do dia {data}.' || chr(10) ||
   'Consegue nos dizer qual seria o melhor dia/horário para você?', true),
  ('boas_vindas', 'Boas-vindas',
   'Seja muito bem-vindo(a), {tutor}! 🐾' || chr(10) ||
   'Ficamos felizes em receber você e o {pet} no Spa da Tia Jéssica. Estamos por aqui para o que precisar.', true),
  ('pesquisa_satisfacao', 'Pesquisa de satisfação',
   'Oi, {tutor}! Como o {pet} ficou após o atendimento? 💛' || chr(10) ||
   'Seu retorno em uma frase já ajuda demais a gente a melhorar. Obrigada!', true),
  ('promocao', 'Promoção / campanha',
   'Oi, {tutor}! Preparamos uma condição especial pensando no {pet}. ✨' || chr(10) ||
   'Quer saber os detalhes? Só responder aqui que a gente te conta.', true),
  ('reengajamento', 'Reengajamento',
   'Oi, {tutor}! Faz um tempinho que o {pet} não vem por aqui. Sentimos saudade! 🐾' || chr(10) ||
   'Quer que a gente reserve um horário especial pra vocês essa semana?', true)
ON CONFLICT DO NOTHING;
