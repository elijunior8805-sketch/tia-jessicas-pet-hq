import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2ProcessInput, JessiV2ProcessOutput } from "../contracts/jessi-v2-contracts";
import { JESSI_V2_FLAGS_DEFAULT } from "../config/jessi-v2-config";
import { processarMensagemJessiV2Core } from "./jessi-v2-agent.core";
import { processarMensagemJessiCore } from "../../ia/jessi-agent.server";

/**
 * Ponte Inteligente de Despacho (Seletor V1 / V2 com Fallback Transparente)
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export async function despacharMensagemJessi(
  sb: SupabaseClient<Database>,
  input: JessiV2ProcessInput,
  user?: { id: string; nome?: string; cargo?: string }
): Promise<JessiV2ProcessOutput> {
  const inicioMs = Date.now();
  const correlationId = input.correlationId || `jessi_bridge_${Date.now()}`;

  // Se a V2 estiver desabilitada por Feature Flag, direciona 100% para o Core V1
  if (!JESSI_V2_FLAGS_DEFAULT.v2_global_enabled) {
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
    // Execução primária no Motor Jessi V2
    return await processarMensagemJessiV2Core(sb, input, user);
  } catch (err) {
    console.warn("Jessi V2 encontrou instabilidade. Acionando fallback automático para V1:", err);

    if (JESSI_V2_FLAGS_DEFAULT.v2_auto_fallback_v1) {
      try {
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
        console.error("Falha crítica em cascata no fallback V1:", fallbackErr);
        throw fallbackErr;
      }
    }

    throw err;
  }
}
