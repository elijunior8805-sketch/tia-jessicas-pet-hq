import React from "react";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";

interface AlertaCardProps {
  data: any;
  onAcao?: (acao: string) => void;
}

export const AlertaCard: React.FC<AlertaCardProps> = ({ data, onAcao }) => {
  const alertas = Array.isArray(data) ? data : data?.pontosDeAtencao || (data?.titulo ? [data] : []);

  if (!alertas.length) return null;

  return (
    <div className="space-y-2 text-xs">
      {alertas.map((al: any, idx: number) => {
        const tipo = al.tipo || "aviso";
        const Icon = tipo === "urgente" ? AlertCircle : tipo === "aviso" ? AlertTriangle : Info;
        const colorClasses =
          tipo === "urgente"
            ? "border-red-200 bg-red-50 text-red-950"
            : tipo === "aviso"
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-blue-200 bg-blue-50 text-blue-950";

        return (
          <div key={idx} className={`rounded-xl border p-3.5 space-y-1.5 shadow-xs ${colorClasses}`}>
            <div className="flex items-center gap-1.5 font-semibold">
              <Icon className="h-4 w-4 shrink-0" />
              <span>{al.titulo}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">{al.descricao}</p>
            {al.acaoSugerida && (
              <div className="pt-1 flex items-center justify-between text-[11px] font-medium border-t border-current/10">
                <span>{al.acaoSugerida}</span>
                {onAcao && (
                  <button
                    onClick={() => onAcao(al.acaoSugerida)}
                    className="inline-flex items-center gap-0.5 underline font-semibold hover:opacity-80"
                  >
                    Ver <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
