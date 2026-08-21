-- Adicionar colunas para priorização e detalhes
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS prioridade text DEFAULT 'media';
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS prioridade_justificativa text;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS etapa_kanban text DEFAULT 'identificada';
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS promessas_quebradas integer DEFAULT 0;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS ultima_resposta_em timestamptz;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

-- Tabela de promessas estruturada
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

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage promises') THEN
        CREATE POLICY "Users can manage promises" ON public.cobranca_promessas FOR ALL TO authenticated USING (true);
    END IF;
END $$;
