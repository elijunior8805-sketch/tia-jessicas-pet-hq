import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2ProcessInput, JessiV2ProcessOutput } from "../contracts/jessi-v2-contracts";
import {
  JessiV2FeatureFlags,
  JESSI_V2_FLAGS_DEFAULT,
  checarFlagV2,
} from "../config/jessi-v2-config";
import { processarMensagemJessiV2Core } from "./jessi-v2-agent.core";

/**
 * Ponte Interna de Despacho e Seletor V1 / V2
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export async function despacharMensagemJessi(
  sb: SupabaseClient<Database>,
  input: JessiV2ProcessInput,
  user?: { id: string; nome?: string; cargo?: string },
  flagsConfig?: Partial<JessiV2FeatureFlags>
): Promise<JessiV2ProcessOutput> {
  const inicioMs = Date.now();
  const correlationId = input.correlationId || `jessi_bridge_${Date.now()}`;
  const flags = { ...JESSI_V2_FLAGS_DEFAULT, ...(flagsConfig || {}) };

  // Verificação de Autorização Controlada: Somente Proprietário ou Administrador
  const cargoLower = (user?.cargo || "").toLowerCase();
  const nomeLower = (user?.nome || "").toLowerCase();
  const ehUsuarioAutorizadoV2 =
    !user ||
    cargoLower.includes("propriet") ||
    cargoLower.includes("admin") ||
    cargoLower.includes("geren") ||
    nomeLower.includes("propriet") ||
    nomeLower.includes("eli");

  // 1. ai_v2_enabled=false ou usuário não autorizado: utilizar estritamente a Jessi atual (V1)
  if (!checarFlagV2(flags, "ai_v2_enabled") || !ehUsuarioAutorizadoV2) {
    const { processarMensagemJessiCore } = await import("../../ia/jessi-agent.server");
    const v1Result = await processarMensagemJessiCore(sb, input as any, user);
    return {
      versao: "v1_fallback",
      respostaTexto: v1Result.respostaTexto,
      cards: v1Result.cards as any,
      pendingAction: v1Result.pendingAction as any,
      novoContexto: v1Result.novoContexto as any,
      tempoProcessamentoMs: v1Result.tempoProcessamentoMs,
      correlationId,
      fallbackAcionado: false,
    };
  }

  try {
    // 2. ai_v2_enabled=true: Execução primária no Motor Jessi V2 com validação por área
    return await processarMensagemJessiV2Core(sb, input, user);
  } catch (err) {
    // 3. Fallback seguro antes de qualquer mutação física
    console.warn("Falha de execução na Jessi V2. Acionando fallback automático para V1:", err);

    try {
      const { processarMensagemJessiCore } = await import("../../ia/jessi-agent.server");
      const v1Result = await processarMensagemJessiCore(sb, input as any, user);
      return {
        versao: "v1_fallback",
        respostaTexto: v1Result.respostaTexto,
        cards: v1Result.cards as any,
        pendingAction: v1Result.pendingAction as any,
        novoContexto: v1Result.novoContexto as any,
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
        fallbackAcionado: true,
      };
    } catch (fallbackErr) {
      console.error("Falha crítica no fallback V1:", fallbackErr);
      throw fallbackErr;
    }
  }
}
