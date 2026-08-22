-- Função para verificar integridade financeira do atendimento
CREATE OR REPLACE FUNCTION public.check_attendance_financial_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_valor_executado DECIMAL;
    v_total_pagamento DECIMAL;
BEGIN
    -- Só age quando o atendimento é marcado como finalizado/encerrado
    IF (NEW.finalizado = true AND OLD.finalizado = false) OR (NEW.encerrado_em IS NOT NULL AND OLD.encerrado_em IS NULL) THEN
        v_valor_executado := COALESCE(NEW.valor_executado, 0) + COALESCE(NEW.taxa_leva_traz, 0) - COALESCE(NEW.desconto, 0);
        
        -- Busca o total vinculado em pagamentos (considerando que um atendimento pode ter múltiplos pagamentos parciais)
        SELECT SUM(COALESCE(valor_total, 0))
        INTO v_total_pagamento
        FROM public.pagamentos
        WHERE atendimento_id = NEW.id;

        -- Se houver divergência significativa (> 0.01)
        IF ABS(v_valor_executado - COALESCE(v_total_pagamento, 0)) > 0.01 THEN
            -- Aqui poderíamos inserir em uma tabela de alertas/pendências
            -- Por enquanto, registramos no log de auditoria se existir
            INSERT INTO public.auditoria_financeira (
                periodo_de,
                periodo_ate,
                fuso_horario,
                metadados,
                resultado
            ) VALUES (
                NEW.data_inicio::date,
                NEW.data_inicio::date,
                'America/Sao_Paulo',
                jsonb_build_object(
                    'tipo', 'DIVERGENCIA_ENCERRAMENTO',
                    'atendimento_id', NEW.id,
                    'valor_executado', v_valor_executado,
                    'valor_pagamento', v_total_pagamento
                ),
                jsonb_build_object('status', 'pendencia_gerada')
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger disparada após update no atendimento
DROP TRIGGER IF EXISTS trg_check_attendance_financial_integrity ON public.atendimentos;
CREATE TRIGGER trg_check_attendance_financial_integrity
AFTER UPDATE ON public.atendimentos
FOR EACH ROW
EXECUTE FUNCTION public.check_attendance_financial_integrity();
