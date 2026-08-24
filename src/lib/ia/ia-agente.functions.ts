import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classificarComandoIA } from "./ia-agente.server";

export const classificarIntencao = createServerFn({ method: "POST" })
  .inputValidator((input: any) => z.object({ 
    texto: z.string().nullable().optional(),
    contexto: z.any().optional(),
    comando_original: z.string().optional().default("classificacao"),
  }).parse(input || { texto: "" }))
  .handler(async ({ data }) => {
    return classificarComandoIA(data.texto || "", data.contexto);
  });
