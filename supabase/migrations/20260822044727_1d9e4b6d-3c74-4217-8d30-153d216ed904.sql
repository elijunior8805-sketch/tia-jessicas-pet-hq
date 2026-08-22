CREATE TABLE IF NOT EXISTS public.auditoria_financeira (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_consulta TIMESTAMP WITH TIME ZONE DEFAULT now(),
    periodo_de DATE NOT NULL,
    periodo_ate DATE NOT NULL,
    fuso_horario TEXT DEFAULT 'America/Sao_Paulo',
    metadados JSONB,
    resultado JSONB,
    user_id UUID REFERENCES auth.users(id)
);

GRANT SELECT ON public.auditoria_financeira TO authenticated;
GRANT ALL ON public.auditoria_financeira TO service_role;

ALTER TABLE public.auditoria_financeira ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar auditoria financeira"
ON public.auditoria_financeira
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
