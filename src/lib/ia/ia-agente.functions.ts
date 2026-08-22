import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IAIntentSchema } from "./ia-agente.server";

export const classificarIntencao = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    texto: z.string(),
    contexto: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    // Importação dinâmica para evitar que o código de servidor vaze para o cliente
    const { classificarComandoIA } = await import("./ia-agente.server");
    return classificarComandoIA(data.texto, data.contexto, context.supabase);
  });
