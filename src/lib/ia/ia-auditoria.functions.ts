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
  .inputValidator((d) => z.object({ limit: z.number().optional() }).parse(d))
  .handler(async ({ data }) => {
    return auditoriaServer.getLogsAuditoriaIA(data.limit);
  });

export const registrarAuditoriaIA = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    return auditoriaServer.registrarAuditoriaIA(data);
  });

export const realizarAuditoriaDadosIA = createServerFn({ method: "POST" })
  .handler(async () => {
    return auditoriaServer.realizarAuditoriaDadosIA();
  });
