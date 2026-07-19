
-- Storage policies para bucket spa-fotos
CREATE POLICY "Auth read spa-fotos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'spa-fotos');
CREATE POLICY "Auth insert spa-fotos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'spa-fotos');
CREATE POLICY "Auth update spa-fotos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'spa-fotos');
CREATE POLICY "Auth delete spa-fotos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'spa-fotos');

-- Função: gerar parcelas de compra automaticamente
CREATE OR REPLACE FUNCTION public.gerar_parcelas_compra(_compra_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  i INT;
  valor_parcela NUMERIC(12,2);
  soma NUMERIC(12,2) := 0;
  venc DATE;
BEGIN
  SELECT * INTO c FROM public.compras WHERE id = _compra_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  DELETE FROM public.compras_parcelas WHERE compra_id = _compra_id;
  IF c.parcelas < 1 THEN RETURN; END IF;
  valor_parcela := ROUND(c.valor_total / c.parcelas, 2);
  venc := COALESCE(c.primeiro_vencimento, c.data_compra);
  FOR i IN 1..c.parcelas LOOP
    IF i = c.parcelas THEN
      valor_parcela := c.valor_total - soma;
    END IF;
    INSERT INTO public.compras_parcelas(compra_id, numero, total_parcelas, valor, vencimento)
    VALUES (_compra_id, i, c.parcelas, valor_parcela, venc + ((i-1) || ' months')::INTERVAL);
    soma := soma + valor_parcela;
  END LOOP;
END; $$;
