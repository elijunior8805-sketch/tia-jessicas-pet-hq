-- 1. Soft Delete para Pagamentos (Receitas)
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

-- 2. Soft Delete para Compras e Parcelas (Despesas)
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

ALTER TABLE public.compras_parcelas ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;
ALTER TABLE public.compras_parcelas ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.compras_parcelas ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

-- 3. Tabela de Conciliação
CREATE TABLE IF NOT EXISTS public.conciliacao_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_execucao TIMESTAMPTZ DEFAULT now(),
    tipo TEXT NOT NULL, -- 'pagamentos_vs_cobrancas', 'parcelas_vs_compras'
    status TEXT NOT NULL, -- 'sucesso', 'divergencia'
    resumo JSONB,
    detalhes JSONB,
    executado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.conciliacao_logs TO authenticated;
GRANT ALL ON public.conciliacao_logs TO service_role;
ALTER TABLE public.conciliacao_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Admins podem ver logs de conciliação' AND polrelid = 'public.conciliacao_logs'::regclass
    ) THEN
        CREATE POLICY "Admins podem ver logs de conciliação" 
        ON public.conciliacao_logs FOR SELECT 
        TO authenticated 
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

-- 4. Funções e Triggers para Restauração e Sincronização

-- Função para restaurar cobrança quando pagamento é restaurado
CREATE OR REPLACE FUNCTION public.handle_pagamento_restoration()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o registro está sendo 'desarquivado'
  IF OLD.arquivado_em IS NOT NULL AND NEW.arquivado_em IS NULL THEN
    UPDATE public.cobrancas 
    SET arquivada_em = NULL,
        arquivada_motivo = NULL
    WHERE pagamento_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de restauração
DROP TRIGGER IF EXISTS trg_pag_restore_cobranca ON public.pagamentos;
CREATE TRIGGER trg_pag_restore_cobranca
AFTER UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.handle_pagamento_restoration();

-- Ajuste na função de deleção/arquivamento para suportar soft delete via UPDATE
CREATE OR REPLACE FUNCTION public.clean_orphaned_cobrancas()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for um DELETE físico
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.cobrancas 
    SET arquivada_em = NOW(),
        arquivada_motivo = 'Pagamento removido fisicamente do sistema'
    WHERE pagamento_id = OLD.id AND arquivada_em IS NULL;
    RETURN OLD;
  -- Se for um Soft Delete (UPDATE arquivado_em)
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.arquivado_em IS NULL AND NEW.arquivado_em IS NOT NULL THEN
      UPDATE public.cobrancas 
      SET arquivada_em = NEW.arquivado_em,
          arquivada_motivo = COALESCE(NEW.arquivado_motivo, 'Pagamento arquivado na lixeira')
      WHERE pagamento_id = NEW.id AND arquivada_em IS NULL;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-vincular a trigger para UPDATE também
DROP TRIGGER IF EXISTS trg_clean_orphaned_cobrancas ON public.pagamentos;
CREATE TRIGGER trg_clean_orphaned_cobrancas
AFTER DELETE OR UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.clean_orphaned_cobrancas();

-- Garantir GRANTs nas tabelas alteradas
GRANT SELECT, INSERT, UPDATE ON public.pagamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compras TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compras_parcelas TO authenticated;
