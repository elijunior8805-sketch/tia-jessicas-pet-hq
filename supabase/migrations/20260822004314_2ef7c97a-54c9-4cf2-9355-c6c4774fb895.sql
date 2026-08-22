-- Garantir que cobranças órfãs (sem pagamento associado) sejam removidas
DELETE FROM public.cobrancas 
WHERE pagamento_id NOT IN (SELECT id FROM public.pagamentos);

-- Função para limpar cobranças quando o pagamento associado for removido
CREATE OR REPLACE FUNCTION public.clean_orphaned_cobrancas()
RETURNS TRIGGER AS $$
BEGIN
  -- Arquivamos a cobrança na lixeira se o pagamento for deletado
  UPDATE public.cobrancas 
  SET arquivada_em = NOW(),
      arquivada_motivo = 'Pagamento removido do sistema'
  WHERE pagamento_id = OLD.id AND arquivada_em IS NULL;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para limpeza automática
DROP TRIGGER IF EXISTS trg_clean_orphaned_cobrancas ON public.pagamentos;
CREATE TRIGGER trg_clean_orphaned_cobrancas
AFTER DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.clean_orphaned_cobrancas();
