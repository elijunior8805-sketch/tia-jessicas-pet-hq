-- 1) Coluna de envio explícita
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz;

UPDATE public.mensagens
   SET enviado_em = COALESCE(enviado_em, created_at)
 WHERE direcao = 'out' AND enviado_em IS NULL;

-- 2) Marcação dos registros legados (anteriores à trilha de auditoria)
UPDATE public.mensagens
   SET contexto_ia = COALESCE(contexto_ia, '{}'::jsonb) || jsonb_build_object(
         'registro_legado', true,
         'observacao', 'Registro anterior à trilha de auditoria: aprovação humana ocorreu na interface, mas não foi persistida.'
       )
 WHERE direcao = 'out'
   AND aprovado_por IS NULL;

-- 3) Integridade na inserção + imutabilidade na atualização
CREATE OR REPLACE FUNCTION public.mensagens_historico_integridade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.direcao = 'out' THEN
      IF NEW.aprovado_por IS NULL OR NEW.aprovado_em IS NULL THEN
        RAISE EXCEPTION 'Mensagem enviada exige aprovação humana registrada (aprovado_por/aprovado_em)'
          USING ERRCODE = '23514';
      END IF;
      NEW.enviado_em := COALESCE(NEW.enviado_em, now());
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: apenas campos operacionais podem mudar
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
     OR NEW.direcao IS DISTINCT FROM OLD.direcao
     OR NEW.canal IS DISTINCT FROM OLD.canal
     OR NEW.corpo IS DISTINCT FROM OLD.corpo
     OR NEW.autor_id IS DISTINCT FROM OLD.autor_id
     OR NEW.autor_email IS DISTINCT FROM OLD.autor_email
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.enviado_em IS DISTINCT FROM OLD.enviado_em
     OR NEW.mensagem_ia_original IS DISTINCT FROM OLD.mensagem_ia_original
     OR NEW.mensagem_original IS DISTINCT FROM OLD.mensagem_original
     OR NEW.texto_editado IS DISTINCT FROM OLD.texto_editado
     OR NEW.contexto_ia IS DISTINCT FROM OLD.contexto_ia
     OR NEW.modelo_ia IS DISTINCT FROM OLD.modelo_ia
     OR NEW.tom_sugerido IS DISTINCT FROM OLD.tom_sugerido
     OR NEW.tom_escolhido IS DISTINCT FROM OLD.tom_escolhido
     OR NEW.nivel_firmeza IS DISTINCT FROM OLD.nivel_firmeza
     OR NEW.tempo_geracao_ms IS DISTINCT FROM OLD.tempo_geracao_ms
     OR NEW.tokens_estimados IS DISTINCT FROM OLD.tokens_estimados
     OR NEW.erro_ia IS DISTINCT FROM OLD.erro_ia
     OR NEW.aprovado_por IS DISTINCT FROM OLD.aprovado_por
     OR NEW.aprovado_em IS DISTINCT FROM OLD.aprovado_em
     OR NEW.template_id IS DISTINCT FROM OLD.template_id
     OR NEW.sugestao_id IS DISTINCT FROM OLD.sugestao_id
     OR NEW.cobranca_id IS DISTINCT FROM OLD.cobranca_id
     OR NEW.pagamento_id IS DISTINCT FROM OLD.pagamento_id
     OR NEW.atendimento_id IS DISTINCT FROM OLD.atendimento_id
     OR NEW.promessa_id IS DISTINCT FROM OLD.promessa_id
  THEN
    RAISE EXCEPTION 'Histórico de mensagens é imutável: apenas status, leitura e resultado do contato podem ser atualizados'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensagens_historico_integridade ON public.mensagens;
CREATE TRIGGER trg_mensagens_historico_integridade
BEFORE INSERT OR UPDATE ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.mensagens_historico_integridade();

REVOKE ALL ON FUNCTION public.mensagens_historico_integridade() FROM PUBLIC, anon, authenticated;