import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const classificarIntencao = createServerFn({ method: "POST" })
  .inputValidator((input: any) => z.object({ 
    texto: z.string().nullable().optional(),
    contexto: z.any().optional(),
    comando_original: z.string().optional().default("classificacao"),
  }).parse(input || { texto: "" }))
  .handler(async ({ data }) => {
    const { classificarComandoIA } = await import("./ia-agente.server");
    return classificarComandoIA(data.texto || "", data.contexto);
  });
