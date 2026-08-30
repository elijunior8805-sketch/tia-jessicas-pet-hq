import React from "react";
import { Sparkles, Mic, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export type JessiStatus = "disponivel" | "ouvindo" | "transcrevendo" | "processando" | "aguardando_confirmacao" | "erro";

interface JessiStatusIndicatorProps {
  status: JessiStatus;
  statusDetalhe?: string;
}

export const JessiStatusIndicator: React.FC<JessiStatusIndicatorProps> = ({ status, statusDetalhe }) => {
  const configs: Record<JessiStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badge: string }> = {
    disponivel: {
      label: "Jessi Pronta",
      icon: Sparkles,
      color: "text-emerald-700",
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    ouvindo: {
      label: "Ouvindo sua voz...",
      icon: Mic,
      color: "text-red-600 animate-pulse",
      badge: "bg-red-50 text-red-800 border-red-200",
    },
    transcrevendo: {
      label: "Transcrevendo áudio...",
      icon: Loader2,
      color: "text-amber-600 animate-spin",
      badge: "bg-amber-50 text-amber-800 border-amber-200",
    },
    processando: {
      label: "Consultando o sistema...",
      icon: Loader2,
      color: "text-emerald-700 animate-spin",
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    aguardando_confirmacao: {
      label: "Aguardando sua confirmação",
      icon: AlertCircle,
      color: "text-amber-600",
      badge: "bg-amber-50 text-amber-800 border-amber-200",
    },
    erro: {
      label: "Dificuldade de conexão",
      icon: AlertCircle,
      color: "text-red-600",
      badge: "bg-red-50 text-red-800 border-red-200",
    },
  };

  const cfg = configs[status] || configs.disponivel;
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badge}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        <span>{statusDetalhe || cfg.label}</span>
      </span>
    </div>
  );
};
