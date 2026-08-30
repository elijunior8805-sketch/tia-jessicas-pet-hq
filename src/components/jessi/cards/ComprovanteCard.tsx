import React from "react";
import { FileText, CheckCircle, AlertCircle, User, Calendar, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComprovanteCardProps {
  data: any;
  onConfirmarConciliacao?: (candidato: any) => void;
}

export const ComprovanteCard: React.FC<ComprovanteCardProps> = ({ data, onConfirmarConciliacao }) => {
  const valor = Number(data?.valor || 0);
  const pagador = data?.pagador || "-";
  const dataTransacao = data?.data || "-";
  const instituicao = data?.instituicao || "-";
  const situacao = data?.situacao || "concluido";
  const candidatos = data?.candidatos || [];

  return (
    <div className="rounded-xl border border-border/80 bg-background/95 p-3.5 space-y-3 text-xs shadow-xs">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-emerald-600" />
          <span>Comprovante Pix Processado</span>
        </span>
        <Badge
          className={
            situacao === "concluido"
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : "bg-amber-100 text-amber-800 border-amber-200"
          }
        >
          {situacao === "concluido" ? "Concluído" : "Agendado"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-muted-foreground block">Valor</span>
          <span className="font-bold text-sm text-foreground">
            R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Data / Hora</span>
          <span className="font-medium text-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {dataTransacao}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Pagador</span>
          <span className="font-medium text-foreground flex items-center gap-1 truncate">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            {pagador}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Instituição</span>
          <span className="font-medium text-foreground flex items-center gap-1 truncate">
            <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
            {instituicao}
          </span>
        </div>
      </div>

      {candidatos.length > 0 && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          <span className="text-[11px] font-semibold text-foreground block">
            Sugestões de Conciliação em Aberto:
          </span>
          <div className="space-y-1.5">
            {candidatos.map((c: any, idx: number) => (
              <div
                key={c.pagamento_id || idx}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50 hover:bg-muted transition-colors"
              >
                <div>
                  <span className="font-medium text-foreground">{c.cliente_nome}</span>
                  {c.pet_nome && <span className="text-muted-foreground"> ({c.pet_nome})</span>}
                  <span className="text-[10px] text-muted-foreground block">
                    Em aberto: R$ {Number(c.valor_previsto || 0).toFixed(2)} · {c.motivo}
                  </span>
                </div>
                {onConfirmarConciliacao && (
                  <button
                    onClick={() => onConfirmarConciliacao(c)}
                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-medium"
                  >
                    Vincular
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
