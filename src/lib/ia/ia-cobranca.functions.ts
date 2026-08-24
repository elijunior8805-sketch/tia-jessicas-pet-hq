import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarFilaCobrancaIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { consultarFilaCobrancaIA: consultar } = await import("./ia-cobranca.server");
    return consultar(context.supabase);
  });

export const gerarMensagensCobrancaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pagamento_id: z.string()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { gerarMensagensCobrancaIA: gerar } = await import("./ia-cobranca.server");
    return gerar(context.supabase, data);
  });

export const registrarPromessaPagamentoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pagamento_id: z.string(),
    cliente_id: z.string(),
    data_prometida: z.string(),
    valor_prometido: z.number(),
    observacoes: z.string().optional()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { registrarPromessaPagamentoIA: registrar } = await import("./ia-cobranca.server");
    return registrar(context.supabase, data);
  });
