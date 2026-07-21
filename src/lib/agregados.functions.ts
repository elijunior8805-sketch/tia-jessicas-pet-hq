import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecalcularAgregadosResult = {
  atendimentos_resetados: number;
  agendamentos_reabertos: number;
  pets_recalculados: number;
  executado_em: string;
};

/**
 * Recalcula agregados/históricos derivados de atendimentos e pagamentos.
 * Deve ser chamada após exclusão em massa de lançamentos financeiros para
 * garantir que KPIs, históricos de pet e status de agendamento voltem a
 * refletir apenas os dados remanescentes. Apenas administradores.
 */
export const recalcularAgregados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecalcularAgregadosResult> => {
    const { data, error } = await context.supabase.rpc("recalcular_agregados" as any);
    if (error) throw new Error(error.message);
    return data as RecalcularAgregadosResult;
  });
