import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { registrarPagamentoIA, estornarPagamentoIA } from "./ia-acoes.server";
import { analisarComprovanteIA } from "./ia-comprovante.server";

export const executarBaixaPagamento = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pagamento_id: z.string(),
    valor_pago: z.number(),
    forma: z.string(),
    data_pagamento: z.string().optional(),
    observacoes: z.string().optional(),
    comprovante_path: z.string().optional(),
    id_transacao: z.string().optional()
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;
    
    return registrarPagamentoIA(sb, {
      pagamento_id: data.pagamento_id,
      valor_pago: data.valor_pago,
      forma: data.forma as any,
      data_pagamento: data.data_pagamento,
      observacoes: data.observacoes,
      comprovante_path: data.comprovante_path,
      id_transacao: data.id_transacao
    });
  });

export const executarEstornoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pagamento_id: z.string(),
    motivo: z.string()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { estornarPagamentoIA: estornar } = await import("./ia-acoes.server");
    return estornar(context.supabase, data.pagamento_id, data.motivo);
  });

export const processarComprovanteIA = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    imagemBase64: z.string(),
    contentType: z.string().optional()
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;
    return analisarComprovanteIA(sb, data.imagemBase64, data.contentType);
  });