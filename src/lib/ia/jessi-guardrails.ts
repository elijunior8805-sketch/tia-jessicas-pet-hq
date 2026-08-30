import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

/**
 * Guardrails de Segurança Operacional da Jessi
 */

export interface GuardrailCheckResult {
  permitido: boolean;
  motivoBloqueio?: string;
  exigeConfirmacao: boolean;
}

export class JessiGuardrailError extends Error {
  readonly codigo: string;
  constructor(message: string, codigo = "guardrail_bloqueado") {
    super(message);
    this.name = "JessiGuardrailError";
    this.codigo = codigo;
  }
}

/**
 * Verifica se uma operação requer confirmação humana antes de ser executada
 */
export function verificarExigenciaConfirmacao(
  tipoOperacao: "consulta" | "acao",
  ferramenta: string,
  parametros?: any
): boolean {
  // Consultas nunca exigem confirmação prévia
  if (tipoOperacao === "consulta") return false;

  // Todas as ações de escrita (criação, edição, exclusão, agendamento, pagamento) exigem confirmação explícita
  return true;
}

/**
 * Gera ou valida chave de idempotência para evitar execuções duplicadas
 */
export function gerarChaveIdempotencia(
  prefixo: string,
  dadosUnicos: string | number | Record<string, any>
): string {
  const payload = typeof dadosUnicos === "object" ? JSON.stringify(dadosUnicos) : String(dadosUnicos);
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `jessi_${prefixo}_${Math.abs(hash)}_${Date.now()}`;
}

/**
 * Validação pós-execução (Read-Back) para garantir que o registro foi de fato salvo no banco
 */
export async function validarGravacaoReal<T>(
  sb: SupabaseClient<Database>,
  tabela: string,
  id: string,
  selectFields = "id"
): Promise<{ verificado: boolean; dados: T | null }> {
  try {
    const { data, error } = await sb
      .from(tabela as any)
      .select(selectFields)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return { verificado: false, dados: null };
    }
    return { verificado: true, dados: data as unknown as T };
  } catch {
    return { verificado: false, dados: null };
  }
}
