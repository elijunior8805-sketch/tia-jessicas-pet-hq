import { CheckCircle2, RefreshCw, WifiOff, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/hooks/use-realtime-sync";

const LABELS: Record<SyncStatus, string> = {
  conectando: "Conectando…",
  sincronizado: "Sincronizado",
  reconectando: "Reconectando…",
  offline: "Sem conexão",
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const Icon =
    status === "sincronizado"
      ? CheckCircle2
      : status === "offline"
        ? WifiOff
        : status === "reconectando"
          ? RefreshCw
          : CloudOff;

  return (
    <div
      title={LABELS[status]}
      aria-label={`Status de sincronização: ${LABELS[status]}`}
      className={cn(
        "hidden sm:flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium",
        status === "sincronizado" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "conectando" &&
          "border-muted-foreground/20 bg-muted text-muted-foreground",
        status === "reconectando" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 animate-pulse",
        status === "offline" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          status === "reconectando" && "animate-spin",
        )}
      />
      <span>{LABELS[status]}</span>
    </div>
  );
}
