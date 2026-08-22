import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registrarAuditoriaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    comando_original: z.string(),
    transcricao: z.string().optional(),
    intencao_identificada: z.string(),
    dados_extraidos: z.any(),
    status: z.enum(['sucesso', 'erro', 'cancelado']),
    erro: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    try {
      await supabaseAdmin.from('ia_auditoria').insert({
        usuario_id: context.userId,
        comando_original: data.comando_original,
        transcricao: data.transcricao,
        intencao_identificada: data.intencao_identificada,
        dados_extraidos: data.dados_extraidos,
        status: data.status,
        erro: data.erro,
        tempo_resposta_ms: data.dados_extraidos?.tempo_processamento || 0
      });
    } catch (e) {
      console.error('[IA-AUDITORIA-ERRO]', e);
    }
    
    return { success: true };
  });
