import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { processarMensagemJessiCore } from "./jessi-agent.server";

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
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Busca dados do perfil do usuário para contexto
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, cargo")
      .eq("id", userId)
      .maybeSingle();

    return await processarMensagemJessiCore(
      supabase,
      data,
      {
        id: userId,
        nome: (profile as any)?.nome || "Proprietário",
        cargo: (profile as any)?.cargo || "Administrador",
      }
    );
  });
