import React from "react";
import { DollarSign, TrendingUp, AlertCircle, ArrowRight, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FinanceiroCardProps {
  data: any;
  onActionClick?: (cmd: string) => void;
}

export const FinanceiroCard: React.FC<FinanceiroCardProps> = ({ data, onActionClick }) => {
  const faturamento = Number(data?.faturamento || data?.faturamento_total || data?.receita || 0);
  const pendente = Number(data?.pendente || data?.a_receber || data?.valor_pendente || 0);
  const itensPendentes = Array.isArray(data?.itens_pendentes) ? data.itens_pendentes : (Array.isArray(data) ? data : []);

  return (
    <div className="rounded-2xl border border-emerald-800/20 bg-card p-4 space-y-3 text-xs shadow-xs my-2">
      <div className="font-semibold text-emerald-950 flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-emerald-700" />
          <span>Indicadores Financeiros Oficiais (vw_financeiro_indicadores)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 p-3 border border-border/80">
          <span className="text-[11px] text-muted-foreground block mb-0.5">Faturamento (Mês)</span>
          <span className="text-base font-bold text-emerald-800 flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="rounded-xl bg-muted/40 p-3 border border-border/80">
          <span className="text-[11px] text-muted-foreground block mb-0.5">Valores em Aberto</span>
          <span className="text-base font-bold text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            R$ {pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {itensPendentes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-foreground block">
            Cobranças / Pendências Localizadas ({itensPendentes.length}):
          </span>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {itensPendentes.slice(0, 5).map((p: any, idx: number) => {
              const nome = p.clientes?.nome || p.cliente_nome || "Cliente";
              const val = Number(p.valor_total || p.saldo || 0) - Number(p.valor_pago || 0);

              return (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/70 text-xs"
                >
                  <div>
                    <span className="font-medium text-foreground block">{nome}</span>
                    <span className="text-[10px] text-muted-foreground">
                      Venc: {p.vencimento ? new Date(p.vencimento).toLocaleDateString("pt-BR") : "Não informado"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-700 block">
                      R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {onActionClick && (
                      <button
                        type="button"
                        onClick={() => onActionClick(`Gerar mensagem de cobrança para ${nome}`)}
                        className="text-[10px] text-emerald-800 hover:underline font-semibold"
                      >
                        Cobrar WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onActionClick && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onActionClick("consultar valores a receber")}
            className="h-7 px-2.5 text-xs text-emerald-900 border-emerald-300 hover:bg-emerald-50 rounded-lg font-medium"
          >
            Ver Todas Pendências
          </Button>
          <Button
            size="sm"
            onClick={() => onActionClick("Analisar comprovante Pix")}
            className="h-7 px-2.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-medium ml-auto"
          >
            Conciliar Pix
          </Button>
        </div>
      )}
    </div>
  );
};
