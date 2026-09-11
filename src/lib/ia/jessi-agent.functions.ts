import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server Function Pública para a Assistente Operacional Jessi
 */

export const processarMensagemJessi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      mensagem: z.string(),
      contexto: z.record(z.any()).optional(),
      historico: z.array(z.any()).optional(),
      confirmacaoAcaoPendenteId: z.string().nullable().optional(),
      dadosConfirmacao: z.record(z.any()).nullable().optional(),
      correlationId: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const { despacharMensagemJessi } = await import("@/lib/ia-v2/agent/jessi-v2-bridge");

      // Busca dados do perfil do usuário para contexto
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, cargo")
        .eq("id", userId)
        .maybeSingle();

      return await despacharMensagemJessi(
        supabase,
        data as any,
        {
          id: userId,
          nome: (profile as any)?.nome || "Proprietário",
          cargo: (profile as any)?.cargo || "Administrador",
        }
      );
    } catch (err: any) {
      console.error("[processarMensagemJessi] Erro no handler:", err);
      return {
        versao: "v2",
        respostaTexto: "Desculpe, ocorreu um erro interno ao processar sua solicitação no servidor. Por favor, tente novamente.",
        cards: [
          {
            type: "alerta",
            title: "Erro Operacional",
            subtitle: "Falha de processamento no servidor",
            data: {
              tipo: "erro",
              mensagem: err?.message || "Erro desconhecido no servidor.",
            },
          },
        ],
        pendingAction: null,
        tempoProcessamentoMs: 0,
        correlationId: (data as any)?.correlationId || `err_${Date.now()}`,
      };
    }
  });

/**
 * Server Function para carregar a Central Operacional Proativa com dados reais
 */
export const obterCentralOperacionalJessiFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { gerarCentralOperacionalJessi } = await import("./jessi-proactive.server");

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, cargo")
      .eq("id", userId)
      .maybeSingle();

    return await gerarCentralOperacionalJessi(supabase, {
      id: userId,
      nome: (profile as any)?.nome || "Eli",
    });
  });
