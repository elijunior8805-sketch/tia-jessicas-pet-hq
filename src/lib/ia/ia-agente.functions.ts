import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classificarComandoIA } from "./ia-agente.server";

export const classificarIntencao = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ 
    texto: z.string(),
    contexto: z.any().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Note: requireSupabaseAuth is assumed to be handled by the route or middleware
    // We pass the context if available
    return classificarComandoIA(data.texto, data.contexto);
  });
