import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const faseSchema = z.enum(["observacao", "teste_controlado", "piloto", "producao"]);

export const registrarEventoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        command_id: z.string().optional(),
        correlation_id: z.string().optional(),
        session_id: z.string().optional(),
        idempotency_key: z.string().optional(),
        comando_original: z.string().optional().default("comando_nao_capturado"),
        intencao_detectada: z.string().optional(),
        especialista: z.string().optional(),
        ferramenta_utilizada: z.string().optional(),
        tipo_operacao: z.string().optional(),
        parametros: z.any().optional(),
        resposta_ia: z.string().optional(),
        resultado: z.any().optional(),
        sucesso: z.boolean().optional(),
        erro: z.string().optional(),
        erro_tipo: z.string().optional(),
        retry_count: z.number().optional().default(0),
        confirmado: z.boolean().optional().default(false),
        registro_afetado_id: z.string().optional(),
        duplicidade_bloqueada: z.boolean().optional().default(false),
        intencao_incorreta: z.boolean().optional().default(false),
        correcao_humana: z.boolean().optional().default(false),
        simulado: z.boolean().optional().default(false),
        tempo_resposta_ms: z.number().optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data, context }) => {
    const obs = await import("./ia-observabilidade.server");
    const fase = await obs.getFaseLiberacaoIA();
    await obs.registrarEventoIA({
      ...data,
      user_id: context.userId,
      fase_liberacao: fase,
    });
    return { ok: true };
  });

export const getFaseLiberacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const obs = await import("./ia-observabilidade.server");
    return { fase: await obs.getFaseLiberacaoIA() };
  });

export const setFaseLiberacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({ fase: faseSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("Apenas administradores podem alterar a fase de liberação da IA.");
    const obs = await import("./ia-observabilidade.server");
    return obs.setFaseLiberacaoIA(data.fase, context.userId);
  });

export const getPainelQualidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({ dias: z.number().optional().default(7) }).parse(input || {}))
  .handler(async ({ data }) => {
    const obs = await import("./ia-observabilidade.server");
    return obs.getPainelQualidadeIA(data.dias);
  });

export const marcarCorrecaoHumana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({ command_id: z.string(), intencao_incorreta: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data }) => {
    const obs = await import("./ia-observabilidade.server");
    return obs.marcarCorrecaoHumanaIA(data.command_id, data.intencao_incorreta);
  });
