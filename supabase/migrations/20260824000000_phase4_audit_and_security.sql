-- 1. Permissões Granulares (Roles e Permissões)
-- Já temos roles no sistema (admin, proprietario, atendente, etc). 
-- Vamos garantir que as tabelas de programas tenham RLS robusto.

-- 2. Tabela de Auditoria Genérica (se não existir) ou uso de logs específicos
-- Vamos usar uma tabela de auditoria para ações sensíveis em programas.

CREATE TABLE IF NOT EXISTS public.auditoria_programas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id uuid REFERENCES public.estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    acao text NOT NULL, -- 'venda', 'ajuste_credito', 'cancelamento', 'reserva', 'consumo'
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
    programa_contratado_id uuid REFERENCES public.programas_contratados(id) ON DELETE SET NULL,
    valor_anterior jsonb,
    valor_posterior jsonb,
    motivo text,
    metadata jsonb DEFAULT '{}'::jsonb,
    criado_em timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditoria_programas TO authenticated;
GRANT ALL ON public.auditoria_programas TO service_role;

ALTER TABLE public.auditoria_programas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estabelecimentos podem ver sua própria auditoria"
ON public.auditoria_programas
FOR SELECT
TO authenticated
USING (estabelecimento_id = (SELECT estabelecimento_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Funções de Reconciliação (Backend Logic)

CREATE OR REPLACE FUNCTION public.reconciliar_creditos_pet(_pet_id uuid)
RETURNS TABLE (
    divergencia boolean,
    saldo_calculado integer,
    saldo_atual integer,
    detalhes jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _calc_total integer;
    _atual_total integer;
BEGIN
    -- Soma de todas as movimentações no ledger
    SELECT COALESCE(SUM(quantidade), 0)
    INTO _calc_total
    FROM public.programas_creditos_movimentacoes
    WHERE pet_id = _pet_id;

    -- Saldo atual armazenado nos programas contratados ativos
    SELECT COALESCE(SUM(saldo_creditos), 0)
    INTO _atual_total
    FROM public.programas_contratados
    WHERE pet_id = _pet_id AND status = 'ativo';

    RETURN QUERY SELECT 
        (_calc_total != _atual_total) as divergencia,
        _calc_total as saldo_calculado,
        _atual_total as saldo_atual,
        jsonb_build_object(
            'pet_id', _pet_id,
            'ledger_sum', _calc_total,
            'active_contracts_sum', _atual_total
        ) as detalhes;
END;
$$;

-- 4. Melhorias em RLS nas tabelas existentes para garantir isolamento total

DROP POLICY IF EXISTS "Estabelecimentos podem ver seus programas contratados" ON public.programas_contratados;
CREATE POLICY "Estabelecimentos podem ver seus programas contratados"
ON public.programas_contratados
FOR ALL
TO authenticated
USING (estabelecimento_id = (SELECT estabelecimento_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Estabelecimentos podem ver suas movimentações" ON public.programas_creditos_movimentacoes;
CREATE POLICY "Estabelecimentos podem ver suas movimentações"
ON public.programas_creditos_movimentacoes
FOR ALL
TO authenticated
USING (estabelecimento_id = (SELECT estabelecimento_id FROM public.profiles WHERE id = auth.uid()));

