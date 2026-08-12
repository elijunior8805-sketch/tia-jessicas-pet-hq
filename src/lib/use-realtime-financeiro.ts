import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on `pagamentos` and `atendimentos`
 * and invalidate the provided query keys so financeiro KPIs auto-refresh
 * whenever a payment is created, edited, or reversed.
 */
export function useRealtimeFinanceiro(queryKeys: (string | (string | undefined | null)[])[]) {
  const qc = useQueryClient();
  // Stable dep signature so we don't re-subscribe on every render.
  const dep = JSON.stringify(queryKeys);

  useEffect(() => {
    const keys: (string | (string | undefined | null)[])[] = JSON.parse(dep);
    const invalidate = () => {
      keys.forEach((k) => {
        const queryKey = Array.isArray(k) ? k : [k];
        qc.invalidateQueries({ queryKey: queryKey as any });
      });
    };

    const channel = supabase
      .channel(`rt-financeiro-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pagamentos" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "compras_parcelas" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cobrancas" }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
