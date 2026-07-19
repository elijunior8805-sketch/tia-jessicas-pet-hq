
-- 1) Adiciona "outras" ao enum pagamento_forma
ALTER TYPE pagamento_forma ADD VALUE IF NOT EXISTS 'outras';

-- 2) Amplia tabela pagamentos
ALTER TABLE public.pagamentos
  ALTER COLUMN cliente_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS categoria_receita text
    CHECK (categoria_receita IS NULL OR categoria_receita IN (
      'servico','venda_produto','taxa_adicional','reembolso','comissao','aporte','ajuste','outros'
    )),
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

-- Retro-fill: pagamentos vinculados a atendimento são "servico"
UPDATE public.pagamentos SET categoria_receita = 'servico'
  WHERE categoria_receita IS NULL AND atendimento_id IS NOT NULL;

-- 3) Marcador de teste em compras e parcelas
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.compras_parcelas
  ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

-- 4) Novas categorias de receita
INSERT INTO public.categorias_financeiras (nome, tipo) VALUES
  ('Venda de Produto', 'receita'),
  ('Taxa Adicional', 'receita'),
  ('Reembolso Recebido', 'receita'),
  ('Comissão', 'receita'),
  ('Aporte do Proprietário', 'receita'),
  ('Ajuste Financeiro', 'receita')
ON CONFLICT (nome) DO NOTHING;

-- 5) Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_pag_data_pag ON public.pagamentos(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_pag_teste ON public.pagamentos(is_teste) WHERE is_teste = true;
CREATE INDEX IF NOT EXISTS idx_compras_teste ON public.compras(is_teste) WHERE is_teste = true;

-- 6) Função para limpar dados de teste (apenas admin)
CREATE OR REPLACE FUNCTION public.limpar_dados_teste_financeiro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_pag INT := 0;
  n_compras INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem remover dados de teste';
  END IF;

  WITH d AS (
    DELETE FROM public.pagamentos WHERE is_teste = true RETURNING 1
  ) SELECT count(*) INTO n_pag FROM d;

  WITH d AS (
    DELETE FROM public.compras WHERE is_teste = true RETURNING 1
  ) SELECT count(*) INTO n_compras FROM d;

  RETURN jsonb_build_object('pagamentos_removidos', n_pag, 'compras_removidas', n_compras);
END;
$$;

GRANT EXECUTE ON FUNCTION public.limpar_dados_teste_financeiro() TO authenticated;
