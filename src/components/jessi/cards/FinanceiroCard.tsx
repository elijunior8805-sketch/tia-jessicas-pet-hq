import React from "react";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";

interface FinanceiroCardProps {
  data: any;
}

export const FinanceiroCard: React.FC<FinanceiroCardProps> = ({ data }) => {
  const faturamento = Number(data?.faturamento || data?.faturamento_total || data?.receita || 0);
  const pendente = Number(data?.pendente || data?.a_receber || data?.valor_pendente || 0);
  const despesas = Number(data?.despesas || data?.despesas_total || 0);

  return (
    <div className="rounded-xl border border-emerald-800/20 bg-emerald-950/5 p-3.5 space-y-3 text-xs">
      <div className="font-semibold text-emerald-950 flex items-center gap-1.5 border-b border-emerald-900/10 pb-2">
        <DollarSign className="h-4 w-4 text-emerald-700" />
        <span>Resumo Financeiro Consolidado</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-background/90 p-2.5 border border-border/80">
          <span className="text-[11px] text-muted-foreground block mb-0.5">Faturamento Realizado</span>
          <span className="text-sm font-bold text-emerald-700 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="rounded-lg bg-background/90 p-2.5 border border-border/80">
          <span className="text-[11px] text-muted-foreground block mb-0.5">Valores em Aberto</span>
          <span className="text-sm font-bold text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            R$ {pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {despesas > 0 && (
        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border/40">
          <span>Despesas Pagas:</span>
          <span className="font-medium text-foreground">
            R$ {despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
};
