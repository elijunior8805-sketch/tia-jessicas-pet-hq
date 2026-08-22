import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const registrarAuditoriaIA = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    comando_original: z.string(),
    transcricao: z.string().optional(),
    intencao_identificada: z.string(),
    dados_extraidos: z.any(),
    status: z.enum(['sucesso', 'erro', 'cancelado']),
    erro: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // Por enquanto apenas logamos no console do servidor
    // Na Fase 2 isso irá para uma tabela de auditoria
    console.log('[IA-AUDITORIA]', {
      timestamp: new Date().toISOString(),
      ...data
    });
    return { success: true };
  });
