-- Adicionar novas etapas e prioridade ao status de cobrança
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'identificada';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'objetiva';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'incisiva';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'ultima_tentativa';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'contestada';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'negociacao';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'encerrada';

-- Adicionar colunas para priorização e detalhes
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS prioridade text DEFAULT 'media'; -- 'critica', 'alta', 'media', 'baixa'
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS prioridade_justificativa text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS etapa_kanban text DEFAULT 'identificada';
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS promessas_quebradas integer DEFAULT 0;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS ultima_resposta_em timestamptz;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

-- Tabela de promessas estruturada (já existe uma simplificada no log de eventos, mas vamos estruturar)
CREATE TABLE IF NOT EXISTS public.cobranca_promessas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE CASCADE NOT NULL,
    valor numeric(10,2) NOT NULL,
    data_prometida date NOT NULL,
    status text DEFAULT 'aguardando', -- 'aguardando', 'cumprida', 'vencida', 'renegociada'
    observacao text,
    responsavel_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_promessas TO authenticated;
GRANT ALL ON public.cobranca_promessas TO service_role;

-- RLS
ALTER TABLE public.cobranca_promessas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage promises" ON public.cobranca_promessas FOR ALL TO authenticated USING (true);

-- Trigger para atualizar promessas quebradas
CREATE OR REPLACE FUNCTION public.check_promessas_vencidas()
RETURNS trigger AS $$
BEGIN
    UPDATE public.cobrancas
    SET promessas_quebradas = promessas_quebradas + 1,
        prioridade = 'critica',
        prioridade_justificativa = 'Prioridade crítica: promessa de pagamento não cumprida.'
    WHERE id = NEW.cobranca_id AND NEW.status = 'vencida';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promessa_vencida
AFTER UPDATE OF status ON public.cobranca_promessas
FOR EACH ROW WHEN (NEW.status = 'vencida' AND OLD.status != 'vencida')
EXECUTE FUNCTION public.check_promessas_vencidas();
