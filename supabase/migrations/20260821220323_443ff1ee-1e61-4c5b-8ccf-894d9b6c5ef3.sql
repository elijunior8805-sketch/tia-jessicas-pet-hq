-- Cleanup orphaned charges that should have been removed when their attendances were deleted
UPDATE public.cobrancas 
SET arquivada_em = now() 
WHERE arquivada_em IS NULL 
AND atendimento_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.atendimentos a WHERE a.id = cobrancas.atendimento_id);

-- Also cleanup for deleted payments
UPDATE public.cobrancas 
SET arquivada_em = now() 
WHERE arquivada_em IS NULL 
AND pagamento_id NOT IN (SELECT id FROM public.pagamentos);
