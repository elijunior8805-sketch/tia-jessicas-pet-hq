import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult } from "../jessi-contracts";
import { gerarMensagensCobrancaIA } from "../ia-cobranca.server";
import { identificarAniversariantesIA, analisarReativacaoIA, sugerirRespostaIA } from "../ia-comunicacao.server";

/**
 * Adaptadores de Comunicação e Mensagens para a Jessi
 */

export async function gerarMensagensCobrancaJessi(
  sb: SupabaseClient<Database>,
  params: { cobranca_id: string }
): Promise<JessiQueryResult> {
  const res = await gerarMensagensCobrancaIA(sb, { pagamento_id: params.cobranca_id });

  return {
    success: res.success,
    source: "gerar_cobranca",
    data: res.data,
    executed_at: new Date().toISOString(),
    summary: `Mensagens de cobrança geradas com sucesso.`,
  };
}

export async function consultarAniversariantesJessi(
  sb: SupabaseClient<Database>
): Promise<JessiQueryResult> {
  const res = await identificarAniversariantesIA(sb);

  return {
    success: res.success,
    source: "aniversariantes",
    data: res.data,
    total_count: Array.isArray(res.data) ? res.data.length : 0,
    executed_at: new Date().toISOString(),
    summary: `Encontrados ${Array.isArray(res.data) ? res.data.length : 0} aniversariante(s) hoje.`,
  };
}

export async function consultarReativacaoJessi(
  sb: SupabaseClient<Database>
): Promise<JessiQueryResult> {
  const res = await analisarReativacaoIA(sb);

  return {
    success: res.success,
    source: "reativacao",
    data: res.data,
    total_count: Array.isArray(res.data) ? res.data.length : 0,
    executed_at: new Date().toISOString(),
    summary: `${Array.isArray(res.data) ? res.data.length : 0} cliente(s) em potencial para reativação.`,
  };
}

export async function sugerirRespostaJessi(
  sb: SupabaseClient<Database>,
  params: { mensagem_id: string }
): Promise<JessiQueryResult> {
  const res = await sugerirRespostaIA(sb, params.mensagem_id);

  return {
    success: res.success,
    source: "sugestao_resposta",
    data: res.data,
    executed_at: new Date().toISOString(),
    summary: `Sugestões de resposta geradas.`,
  };
}
