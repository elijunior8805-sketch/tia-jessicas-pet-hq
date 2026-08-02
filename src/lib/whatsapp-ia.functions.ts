import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TomEnum = z.enum([
  "amigavel",
  "profissional",
  "acolhedor",
  "cobranca_educada",
  "confirmacao_objetiva",
]);

const Input = z.object({
  texto: z.string().trim().min(1).max(3500),
  tom: TomEnum.default("amigavel"),
  modo: z.enum(["ortografia", "melhorar"]).default("ortografia"),
});

export const revisarMensagemWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { revisarTextoIa } = await import("./ia-geracao.server");
    const r = await revisarTextoIa(context.supabase, {
      texto: data.texto,
      tom: data.tom,
      modo: data.modo,
    });

    return {
      original: data.texto,
      revisado: r.texto,
      mudou: r.texto.trim() !== data.texto.trim(),
      modelo: r.modelo,
      doCache: r.doCache,
    };
  });

