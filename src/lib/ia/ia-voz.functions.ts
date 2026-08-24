import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const salvarTranscricaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    texto: z.string(),
    agendamento_id: z.string().uuid().optional(),
    cliente_id: z.string().uuid().optional(),
    pet_id: z.string().uuid().optional(),
    metadata: z.any().optional(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: result, error } = await sb
      .from("ia_transcricoes" as any)
      .insert({
        usuario_id: userId,
        texto: data.texto,
        agendamento_id: data.agendamento_id,
        cliente_id: data.cliente_id,
        pet_id: data.pet_id,
        metadata: data.metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error("[IA-VOZ] Erro ao salvar transcrição:", error);
      throw new Error("Falha ao salvar transcrição");
    }

    return { success: true, id: (result as any).id };
  });

export const listarTranscricoesIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data, error } = await sb
      .from("ia_transcricoes" as any)
      .select("*")
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  });

