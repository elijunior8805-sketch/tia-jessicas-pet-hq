import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

/**
 * Módulo de Auditoria e Tracing Dedicado da Jessi V2
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

export interface JessiV2AuditEntry {
  correlationId: string;
  userId?: string;
  operadorNome?: string;
  comandoOriginal: string;
  intencaoDetectada: string;
  dominio: string;
  ferramentaUtilizada?: string;
  parametros?: Record<string, any>;
  confirmadoPorHumano: boolean;
  sucesso: boolean;
  readBackVerificado?: boolean;
  tempoProcessamentoMs: number;
  detalhesErro?: string;
}

export class JessiV2Audit {
  static async registrar(
    sb: SupabaseClient<Database>,
    entry: JessiV2AuditEntry
  ): Promise<void> {
    try {
      await sb.from("ia_auditoria" as any).insert({
        user_id: entry.userId || null,
        comando_original: entry.comandoOriginal,
        intencao_detectada: entry.intencaoDetectada,
        ferramenta_utilizada: entry.ferramentaUtilizada || entry.dominio,
        parametros: entry.parametros || {},
        resposta_ia: entry.sucesso ? "Execução completada" : `Falha: ${entry.detalhesErro}`,
        sucesso: entry.sucesso,
        tempo_resposta_ms: entry.tempoProcessamentoMs,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Aviso: Falha não-bloqueante ao registrar auditoria da Jessi V2:", err);
    }
  }
}
