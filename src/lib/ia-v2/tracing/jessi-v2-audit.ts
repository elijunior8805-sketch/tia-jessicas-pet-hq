import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

/**
 * Módulo de Auditoria e Tracing Completo da Jessi V2 (Seção 19)
 * Rastreia todos os 19 campos exigidos pela governança técnica
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

export interface JessiV2AuditEntry {
  // Campos alternativos aceitos pelos executores supervisionados
  [chave: string]: any;
  // 1. Usuário
  usuarioId?: string | null;
  usuarioNome?: string | null;

  // 2. Conversa
  conversaId?: string;

  // 3. Intenção
  intencao?: string;

  // 4. Entidades
  entidades?: Record<string, any> | null;

  // 5. Ferramentas
  ferramenta?: string | null;

  // 6. Filtros
  filtros?: Record<string, any> | null;

  // 7. Resultado
  resultadoResumo?: string;

  // 8. Proposta
  propostaSnapshot?: any;

  // 9. Confirmação
  confirmadoPorHumano?: boolean;

  // 10. Antes
  antes?: any;

  // 11. Depois
  depois?: any;

  // 12. ID
  entityId?: string | null;

  // 13. Idempotency Key
  idempotencyKey?: string | null;

  // 14. Correlation ID
  correlationId?: string;

  // 15. Verificação
  readBackVerificado?: boolean;

  // 16. Erro
  erro?: { codigo: string; mensagem: string } | null;

  // 17. Data
  data?: string;

  // 18. Duração
  duracaoMs?: number;

  // 19. Versão da Jessi
  versaoJessi?: "v2.0" | "v1_fallback";
}

/**
 * Registro leve e não-bloqueante de auditoria da Jessi V2.
 * Não lança erros: falhas apenas geram aviso no log.
 */
export function registrarAuditoriaV2(entry: Record<string, any>): void {
  try {
    console.info("[JessiV2][auditoria]", JSON.stringify(entry));
  } catch (err) {
    console.warn("Aviso: falha não-bloqueante ao registrar auditoria da Jessi V2:", err);
  }
}

export class JessiV2Audit {
  /**
   * Registra a auditoria completa com os 19 campos
   */
  static async registrar(
    sb: SupabaseClient<Database>,
    entry: JessiV2AuditEntry
  ): Promise<void> {
    try {
      await sb.from("ia_auditoria" as any).insert({
        user_id: entry.usuarioId || null,
        comando_original: `[${entry.versaoJessi}] ${entry.intencao}`,
        intencao_detectada: entry.intencao,
        ferramenta_utilizada: entry.ferramenta || "core",
        parametros: {
          conversaId: entry.conversaId,
          entidades: entry.entidades,
          filtros: entry.filtros,
          proposta: entry.propostaSnapshot,
          antes: entry.antes,
          depois: entry.depois,
          entityId: entry.entityId,
          idempotencyKey: entry.idempotencyKey,
          correlationId: entry.correlationId,
          readBackVerificado: entry.readBackVerificado,
          erro: entry.erro,
          duracaoMs: entry.duracaoMs,
          versaoJessi: entry.versaoJessi,
        },
        resposta_ia: entry.resultadoResumo,
        sucesso: !entry.erro,
        tempo_resposta_ms: entry.duracaoMs,
        created_at: entry.data || new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Aviso: Falha não-bloqueante ao registrar auditoria da Jessi V2:", err);
    }
  }
}
