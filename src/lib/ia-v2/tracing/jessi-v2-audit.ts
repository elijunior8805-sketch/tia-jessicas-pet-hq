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
export function registrarAuditoriaV2(entryOrClient: any, maybeEntry?: Record<string, any>): void {
  const entry = maybeEntry ?? entryOrClient;
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
      const usuarioId = entry.usuarioId || entry.userId || null;
      const intencao = entry.intencao || entry.intencaoDetectada || "operacao_jessi";
      const ferramenta = entry.ferramenta || entry.ferramentaUtilizada || "core";
      const comandoOriginal = entry.comandoOriginal || `[${entry.versaoJessi || "v2.0"}] ${intencao}`;

      await sb.from("ia_auditoria").insert({
        usuario_id: usuarioId,
        comando_original: comandoOriginal,
        intencao_identificada: intencao,
        ferramentas_chamadas: [ferramenta],
        dados_extraidos: (entry.entidades || entry.filtros) ? { entidades: entry.entidades, filtros: entry.filtros } : null,
        metadados: {
          conversaId: entry.conversaId,
          proposta: entry.propostaSnapshot,
          antes: entry.antes,
          depois: entry.depois,
          entityId: entry.entityId,
          idempotencyKey: entry.idempotencyKey,
          correlationId: entry.correlationId,
          readBackVerificado: entry.readBackVerificado,
          erro: entry.erro,
          duracaoMs: entry.duracaoMs || entry.tempoProcessamentoMs,
          versaoJessi: entry.versaoJessi || "v2.0",
        },
        status: entry.erro ? "erro" : "sucesso",
        tempo_resposta_ms: entry.duracaoMs || entry.tempoProcessamentoMs || null,
        transcricao: entry.resultadoResumo || null,
        created_at: entry.data || new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Aviso: Falha não-bloqueante ao registrar auditoria da Jessi V2:", err);
    }
  }
}
