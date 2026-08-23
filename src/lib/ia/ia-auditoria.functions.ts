import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { 
  getResumoNegocioIA,
  getIndicadoresQualidadeIA,
  getLogsAuditoriaIA
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
