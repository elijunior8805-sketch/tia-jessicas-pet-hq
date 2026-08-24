import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarPagamentoIA, estornarPagamentoIA } from "./ia-acoes.server";
import { analisarComprovanteIA } from "./ia-comprovante.server";

export const executarBaixaPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pagamento_id: z.string(),
    valor_pago: z.number(),
    forma: z.string(),
    data_pagamento: z.string().optional(),
    observacoes: z.string().optional(),
    comprovante_path: z.string().optional(),
    id_transacao: z.string().optional(),
    comando_original: z.string().nullish(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    
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
  .inputValidator((input: any) => z.object({
    pagamento_id: z.string(),
    motivo: z.string(),
    comando_original: z.string().optional().default("estorno"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { estornarPagamentoIA: estornar } = await import("./ia-acoes.server");
    return estornar(context.supabase, data.pagamento_id, data.motivo);
  });

export const processarComprovanteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    imagemBase64: z.string(),
    contentType: z.string().optional()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    return analisarComprovanteIA(sb, data.imagemBase64, data.contentType);
  });