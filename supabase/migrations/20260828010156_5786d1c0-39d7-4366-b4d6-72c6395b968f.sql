ALTER TABLE public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_categoria_receita_check;

ALTER TABLE public.pagamentos ADD CONSTRAINT pagamentos_categoria_receita_check
CHECK (
  categoria_receita IS NULL OR categoria_receita = ANY (ARRAY[
    'servico'::text,
    'venda_produto'::text,
    'taxa_adicional'::text,
    'reembolso'::text,
    'comissao'::text,
    'aporte'::text,
    'ajuste'::text,
    'outros'::text,
    'programa_cuidado'::text
  ])
);