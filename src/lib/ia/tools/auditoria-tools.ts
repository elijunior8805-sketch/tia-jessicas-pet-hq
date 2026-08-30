import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult } from "../jessi-contracts";
import { getResumoNegocioIA, realizarAuditoriaDadosIA, getIndicadoresQualidadeIA } from "../ia-auditoria.server";

/**
 * Adaptadores de Auditoria e Qualidade para a Jessi
 */

export async function consultarResumoNegocioJessi(): Promise<JessiQueryResult> {
  const data = await getResumoNegocioIA();

  return {
    success: true,
    source: "resumo_negocio",
    data,
    executed_at: new Date().toISOString(),
    summary: `Resumo geral da operação carregado com sucesso.`,
  };
}

export async function realizarAuditoriaIntegridadeJessi(
  sb: SupabaseClient<Database>
): Promise<JessiQueryResult> {
  const res = await realizarAuditoriaDadosIA(sb);

  return {
    success: res.status === "ok",
    source: "auditoria_integridade",
    data: res.data,
    executed_at: new Date().toISOString(),
    summary: `Auditoria de dados realizada. ${res.data?.resumo?.alertas || 0} alertas encontrados.`,
  };
}

export async function consultarQualidadeIAJessi(): Promise<JessiQueryResult> {
  const data = await getIndicadoresQualidadeIA();

  return {
    success: true,
    source: "qualidade_ia",
    data,
    executed_at: new Date().toISOString(),
    summary: `Métricas de qualidade da IA carregadas. Taxa de sucesso: ${data.taxa_sucesso.toFixed(1)}%.`,
  };
}
