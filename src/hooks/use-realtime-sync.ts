import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tabelas sincronizadas em tempo real para toda a equipe.
 * Ao receber qualquer INSERT/UPDATE/DELETE, invalida as queries relacionadas
 * para que Agenda, Dashboard, Financeiro, Leva e Traz, Cobranças, Histórico
 * do pet, Notificações etc. atualizem automaticamente em todos os aparelhos.
 */
const TABELAS_REALTIME = [
  "agendamentos",
  "agendamento_servicos",
  "atendimentos",
  "clientes",
  "pets",
  "pagamentos",
  "cobrancas",
  "mensagens",
  "movimentos_estoque",
  "produtos_estoque",
  "recibos_enviados",
  "leva_traz_tarefas",
  "leva_traz_eventos",
  "notificacoes",
] as const;

export type SyncStatus =
  | "conectando"
  | "sincronizado"
  | "reconectando"
  | "offline";

export function useRealtimeSync(): SyncStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("conectando");

  useEffect(() => {
    let cancelled = false;

    function handleOnline() {
      if (!cancelled) setStatus("reconectando");
    }
    function handleOffline() {
      if (!cancelled) setStatus("offline");
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("offline");
    }

    const channel = supabase.channel("realtime-sync-global");
    const pendingTables = new Set<string>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInvalidation = (tabela: string) => {
      pendingTables.add(tabela);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (cancelled || pendingTables.size === 0) return;
        const tablesToInvalidate = Array.from(pendingTables);
        pendingTables.clear();

        qc.invalidateQueries({
          predicate: (q) =>
            q.queryKey.some(
              (k) =>
                typeof k === "string" &&
                tablesToInvalidate.some((tbl) => k.includes(tbl)),
            ),
        });
      }, 250);
    };

    for (const tabela of TABELAS_REALTIME) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabela },
        () => {
          scheduleInvalidation(tabela);
        },
      );
    }

    channel.subscribe((state) => {
      if (cancelled) return;
      if (state === "SUBSCRIBED") setStatus("sincronizado");
      else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT")
        setStatus("reconectando");
      else if (state === "CLOSED") setStatus("offline");
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return status;
}
