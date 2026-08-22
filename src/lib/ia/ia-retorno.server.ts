import { z } from "zod";

export const IAResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  result: z.any().optional(),
  record_id: z.string().optional().nullable(),
  warnings: z.array(z.string()).optional(),
  validation_errors: z.array(z.string()).optional(),
  requires_confirmation: z.boolean().default(false),
  timestamp: z.string(),
});

export type IAResponse = z.infer<typeof IAResponseSchema>;

export function createIAResponse(data: Partial<IAResponse>): IAResponse {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    requires_confirmation: false,
    ...data,
  };
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
    // Importação dinâmica para evitar problemas no bundling de cliente
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Filtra dados sensíveis ou muito grandes antes de salvar
    const dadosLimpos = dados ? JSON.parse(JSON.stringify(dados)) : {};
    if (dadosLimpos.result && Array.isArray(dadosLimpos.result)) {
      dadosLimpos.count = dadosLimpos.result.length;
      dadosLimpos.result = dadosLimpos.result.slice(0, 3); // Apenas amostra
    }

    await supabaseAdmin.from('ia_auditoria').insert({
      usuario_id: userId,
      comando_original: comando,
      intencao_identificada: intencao,
      dados_extraidos: dadosLimpos,
      status: status,
      erro: erro,
      tempo_resposta_ms: dados?.tempo_processamento || 0
    });
  } catch (e) {
    console.error('[IA-AUDITORIA-ERRO]', e);
  }
}
