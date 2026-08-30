import { z } from "zod";

export const IAResponseSchema = z.object({
  success: z.boolean(),
  status: z.string().optional(),
  message: z.string().optional(),
  data: z.any().optional(),
  error_code: z.string().optional().nullable(),
  validation_errors: z.array(z.string()).optional(),
  affected_record_id: z.string().optional().nullable(),
  source: z.string().optional(),
  filters_applied: z.record(z.any()).optional(),
  executed_at: z.string(),
  requires_confirmation: z.boolean().default(false),
});

export type IAResponse = z.infer<typeof IAResponseSchema>;

export function createIAResponse(data: Partial<IAResponse>): IAResponse {
  return {
    success: true,
    executed_at: new Date().toISOString(),
    requires_confirmation: false,
    ...data,
  } as IAResponse;
}

export async function logIAAuditoria(
  sb: any, 
  userId: string, 
  comando: string, 
  intencao: string, 
  dados: any, 
  status: 'sucesso' | 'erro' | 'cancelado',
  erro?: string
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const dadosLimpos = dados ? JSON.parse(JSON.stringify(dados)) : {};
    if (dadosLimpos.data && Array.isArray(dadosLimpos.data)) {
      dadosLimpos.count = dadosLimpos.data.length;
      dadosLimpos.data = dadosLimpos.data.slice(0, 5); 
    }

    const { data: logData, error: logError } = await supabaseAdmin.from('auditoria_ia' as any).insert({
      user_id: userId,
      comando_original: comando,
      intencao_detectada: intencao,
      parametros: dadosLimpos,
      sucesso: status === 'sucesso',
      tempo_resposta_ms: dados?.tempo_processamento || 0,
      metadata: erro ? { erro } : undefined
    } as any).select('id').single();

    if (logError) console.error('[IA-AUDITORIA-LOG-ERROR]', logError);
    return logData?.id;

  } catch (e) {
    console.error('[IA-AUDITORIA-FATAL-ERROR]', e);
  }
}
