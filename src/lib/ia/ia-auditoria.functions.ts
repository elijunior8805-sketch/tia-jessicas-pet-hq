import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { 
  getResumoNegocioIA,
  getIndicadoresQualidadeIA,
  getLogsAuditoriaIA,
  registrarAuditoriaIA
} from "./ia-auditoria.server";

export const getResumoProprietarioIA = createServerFn({ method: "GET" })
  .handler(async () => {
    return getResumoNegocioIA();
  });

export const getQualidadeIA = createServerFn({ method: "GET" })
  .handler(async () => {
    return getIndicadoresQualidadeIA();
  });

export const getAuditoriaIA = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ limit: z.number().optional() }).parse(d))
  .handler(async ({ data }) => {
    return getLogsAuditoriaIA(data.limit);
  });

export const registrarAuditoriaIAFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    comando_original: z.string(),
    intencao_detectada: z.string().optional(),
    especialista: z.string().optional(),
    ferramenta_utilizada: z.string().optional(),
    parametros: z.any().optional(),
    resposta_ia: z.string().optional(),
    sucesso: z.boolean().optional(),
    tempo_resposta_ms: z.number().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // We could extract user_id from context here if auth middleware is present
    return registrarAuditoriaIA(data);
  });

// Compatibility export
export const registrarAuditoriaIA = registrarAuditoriaIAFn;
