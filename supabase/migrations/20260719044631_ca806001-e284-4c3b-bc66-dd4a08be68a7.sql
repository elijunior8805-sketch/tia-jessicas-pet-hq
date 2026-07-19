
CREATE TABLE public.servicos_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  porte_id uuid NOT NULL REFERENCES public.portes(id) ON DELETE RESTRICT,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servico_id, porte_id)
);
GRANT SELECT ON public.servicos_precos TO authenticated;
GRANT ALL ON public.servicos_precos TO service_role;
ALTER TABLE public.servicos_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read servicos_precos" ON public.servicos_precos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage servicos_precos" ON public.servicos_precos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS is_combo boolean NOT NULL DEFAULT false;

CREATE TABLE public.servicos_combo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (combo_id, servico_id),
  CHECK (combo_id <> servico_id)
);
GRANT SELECT ON public.servicos_combo_itens TO authenticated;
GRANT ALL ON public.servicos_combo_itens TO service_role;
ALTER TABLE public.servicos_combo_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read combo itens" ON public.servicos_combo_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage combo itens" ON public.servicos_combo_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_servicos_precos_servico ON public.servicos_precos(servico_id);
CREATE INDEX idx_combo_itens_combo ON public.servicos_combo_itens(combo_id);
