-- 1. Políticas de Segurança para o Bucket (RLS em storage.objects)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Acesso privado aos comprovantes'
    ) THEN
        CREATE POLICY "Acesso privado aos comprovantes" ON storage.objects
        FOR ALL TO authenticated
        USING (bucket_id = 'comprovantes')
        WITH CHECK (bucket_id = 'comprovantes');
    END IF;
END $$;

-- 2. Adicionar colunas na tabela de pagamentos para rastreabilidade da IA
ALTER TABLE public.pagamentos 
ADD COLUMN IF NOT EXISTS comprovante_path TEXT,
ADD COLUMN IF NOT EXISTS id_transacao_bancaria TEXT,
ADD COLUMN IF NOT EXISTS ia_meta_dados JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ia_analisado BOOLEAN DEFAULT false;

-- 3. Índice para evitar duplicidade de transações
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_id_transacao_bancaria 
ON public.pagamentos(id_transacao_bancaria) 
WHERE id_transacao_bancaria IS NOT NULL;

-- 4. Atualizar permissões (Boas práticas conforme diretrizes)
GRANT ALL ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
