import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarMensagensIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    cliente_id: z.string().optional(),
    pet_id: z.string().optional(),
    limite: z.number().optional()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { consultarMensagensRecentes } = await import("./ia-comunicacao.server");
    return consultarMensagensRecentes(context.supabase, data);
  });

export const identificarAniversariantesIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { identificarAniversariantesIA: fn } = await import("./ia-comunicacao.server");
    return fn(context.supabase);
  });

export const analisarReativacaoIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { analisarReativacaoIA: fn } = await import("./ia-comunicacao.server");
    return fn(context.supabase);
  });
