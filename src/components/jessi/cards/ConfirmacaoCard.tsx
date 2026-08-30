import React from "react";
import { CheckCircle, AlertTriangle, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmacaoCardProps {
  data: any;
  onConfirmar?: (pendingAction: any) => void;
  onCancelar?: () => void;
  isLoading?: boolean;
}

export const ConfirmacaoCard: React.FC<ConfirmacaoCardProps> = ({
  data,
  onConfirmar,
  onCancelar,
  isLoading,
}) => {
  const pendingAction = data?.pendingAction;
  const executado = data?.executado;
  const resumo = data?.resumo || pendingAction?.summary || "Deseja confirmar a execução?";

  if (executado) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3.5 space-y-2 text-xs text-emerald-950">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Ação Executada e Registrada com Sucesso</span>
        </div>
        <p className="text-[11px] text-emerald-900 leading-relaxed">
          {data?.resultado?.summary || "Operação realizada no sistema e auditada com sucesso."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 space-y-3 text-xs text-amber-950 shadow-xs">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 border-b border-amber-200 pb-2">
        <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
        <span>Confirmação Operacional Obrigatória</span>
      </div>

      <p className="text-[12px] font-medium leading-relaxed">{resumo}</p>

      {onConfirmar && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => onConfirmar(pendingAction)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8 px-3 font-semibold gap-1.5"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {isLoading ? "Registrando..." : "Confirmar e Executar"}
          </Button>
          {onCancelar && (
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={onCancelar}
              className="text-xs h-8 px-3 border-amber-300 text-amber-900 hover:bg-amber-100/60 gap-1"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
