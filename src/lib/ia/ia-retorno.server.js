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
export function createIAResponse(data) {
    return {
        success: true,
        executed_at: new Date().toISOString(),
        requires_confirmation: false,
        ...data,
    };
}
export async function logIAAuditoria(sb, userId, comando, intencao, dados, status, erro) {
    try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const dadosLimpos = dados ? JSON.parse(JSON.stringify(dados)) : {};
        if (dadosLimpos.data && Array.isArray(dadosLimpos.data)) {
            dadosLimpos.count = dadosLimpos.data.length;
            dadosLimpos.data = dadosLimpos.data.slice(0, 5);
        }
        const { data: logData, error: logError } = await supabaseAdmin.from('ia_auditoria').insert({
            usuario_id: userId,
            comando_original: comando,
            intencao_identificada: intencao,
            dados_extraidos: dadosLimpos,
            status: status,
            erro: erro,
            tempo_resposta_ms: dados?.tempo_processamento || 0
        }).select('id').single();
        if (logError)
            console.error('[IA-AUDITORIA-LOG-ERROR]', logError);
        return logData?.id;
    }
    catch (e) {
        console.error('[IA-AUDITORIA-FATAL-ERROR]', e);
    }
}
