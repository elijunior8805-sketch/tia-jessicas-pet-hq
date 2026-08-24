import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const upsertServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1, "Nome é obrigatório"),
    categoria: z.string().optional().nullable(),
    descricao: z.string().optional().nullable(),
    valor: z.number().min(0),
    duracao_min: z.number().min(0),
    ativo: z.boolean().default(true),
    is_combo: z.boolean().default(false),
    preco_a_partir: z.boolean().default(false),
    itens_inclusos: z.array(z.string()).optional(),
    observacoes_internas: z.string().optional().nullable()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { id, ...rest } = data;

    if (id) {
      const { data: updated, error } = await sb
        .from("servicos")
        .update(rest as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await sb
        .from("servicos")
        .insert(rest as any)
        .select()
        .single();
      if (error) throw error;
      return inserted;
    }
  });
