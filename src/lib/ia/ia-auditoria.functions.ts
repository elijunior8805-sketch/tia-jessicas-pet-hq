import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as auditoriaServer from "./ia-auditoria.server";

export const getResumoProprietarioIA = createServerFn({ method: "GET" })
  .handler(async () => {
    return auditoriaServer.getResumoNegocioIA();
  });

export const getQualidadeIA = createServerFn({ method: "GET" })
  .handler(async () => {
    return auditoriaServer.getIndicadoresQualidadeIA();
  });

export const getAuditoriaIA = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ limit: z.number().optional() }).parse(d || {}))
  .handler(async ({ data }) => {
    return auditoriaServer.getLogsAuditoriaIA(data.limit);
  });

export const registrarAuditoriaIA = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    comando_original: z.string().optional(),
    comando: z.string().optional(),
    intencao_detectada: z.string().optional(),
    intencao: z.string().optional(),
    especialista: z.string().optional(),
    ferramenta_utilizada: z.string().optional(),
    parametros: z.any().optional(),
    metadata: z.any().optional(),
    resposta_ia: z.string().optional(),
    sucesso: z.boolean().optional(),
    tempo_resposta_ms: z.number().optional(),
    tempo_ms: z.number().optional(),
  }).parse(d || {}))
  .handler(async ({ data }) => {
    // Mapping keys to match the server side expectations if needed, or just passing through
    const mappedData = {
      comando_original: data.comando_original || data.comando || "Comando não capturado",
      intencao_detectada: data.intencao_detectada || data.intencao,
      especialista: data.especialista,
      ferramenta_utilizada: data.ferramenta_utilizada,
      parametros: data.parametros || data.metadata,
      resposta_ia: data.resposta_ia,
      sucesso: data.sucesso,
      tempo_resposta_ms: data.tempo_resposta_ms || data.tempo_ms,
    };
    return auditoriaServer.registrarAuditoriaIA(mappedData);
  });

export const realizarAuditoriaDadosIA = createServerFn({ method: "POST" })
  .handler(async () => {
    return auditoriaServer.realizarAuditoriaDadosIA();
  });
