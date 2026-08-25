
ALTER TABLE public.auditoria_programas
  ADD CONSTRAINT auditoria_programas_cliente_fk
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.auditoria_programas
  ADD CONSTRAINT auditoria_programas_pet_fk
  FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE SET NULL;

ALTER TABLE public.programas_vencimento_alertas
  ADD CONSTRAINT programas_vencimento_alertas_cliente_fk
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.programas_vencimento_alertas
  ADD CONSTRAINT programas_vencimento_alertas_pet_fk
  FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE SET NULL;
