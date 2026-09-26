import React, { useState } from "react";
import { FileText, CheckCircle, AlertCircle, User, Calendar, CreditCard, Copy, Check, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ComprovanteCardProps {
  data: any;
  onConfirmarConciliacao?: (candidato: any) => void;
  onActionClick?: (comando: string) => void;
}

export const ComprovanteCard: React.FC<ComprovanteCardProps> = ({ data, onConfirmarConciliacao, onActionClick }) => {
  const [copied, setCopied] = useState(false);
  const valor = Number(data?.valor || 0);
  const pagador = data?.pagador || "-";
  const dataTransacao = data?.data || "-";
  const instituicao = data?.instituicao || "-";
  const situacao = data?.situacao || "concluido";
  const candidatos = data?.candidatos || [];

  const handleCopyResumo = () => {
    const resumo = `Comprovante Pix: R$ ${valor.toFixed(2)} - Pagador: ${pagador} - Data: ${dataTransacao}`;
    navigator.clipboard.writeText(resumo);
    setCopied(true);
    toast.success("Dados do comprovante copiados!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConciliar = (c: any) => {
    if (onConfirmarConciliacao) {
      onConfirmarConciliacao(c);
    } else if (onActionClick) {
      const valorStr = Number(c.valor_previsto || c.valor || valor || 0).toFixed(2);
      onActionClick(`Conciliar e baixar comprovante de R$ ${valorStr} para ${c.cliente_nome || pagador}`);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 text-xs shadow-xs my-2">
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-emerald-700" />
          <span>Comprovante Pix Processado (OCR)</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyResumo}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="Copiar dados"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Badge
            className={
              situacao === "concluido"
                ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium"
                : "bg-amber-100 text-amber-800 border-amber-300 font-medium"
            }
          >
            {situacao === "concluido" ? "Concluído" : "Agendado"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
          <span className="text-muted-foreground block text-[10px]">Valor do Pix</span>
          <span className="font-bold text-sm text-emerald-900">
            R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-muted/40 border border-border/60">
          <span className="text-muted-foreground block text-[10px]">Data / Hora</span>
          <span className="font-medium text-foreground flex items-center gap-1 text-[11px] truncate">
            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
            {dataTransacao}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-muted/40 border border-border/60">
          <span className="text-muted-foreground block text-[10px]">Pagador Identificado</span>
          <span className="font-medium text-foreground flex items-center gap-1 truncate text-[11px]">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            {pagador}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-muted/40 border border-border/60">
          <span className="text-muted-foreground block text-[10px]">Banco / Instituição</span>
          <span className="font-medium text-foreground flex items-center gap-1 truncate text-[11px]">
            <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
            {instituicao}
          </span>
        </div>
      </div>

      {candidatos.length > 0 && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          <span className="text-[11px] font-semibold text-foreground block">
            Vínculo Sugerido com Pendências ({candidatos.length}):
          </span>
          <div className="space-y-1.5">
            {candidatos.map((c: any, idx: number) => (
              <div
                key={c.pagamento_id || idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors"
              >
                <div>
                  <span className="font-bold text-foreground block text-xs">{c.cliente_nome}</span>
                  {c.pet_nome && <span className="text-muted-foreground text-[10px] block">Pet: {c.pet_nome}</span>}
                  <span className="text-[10px] text-amber-800 font-medium block">
                    Em aberto: R$ {Number(c.valor_previsto || 0).toFixed(2)} {c.motivo ? `· ${c.motivo}` : ""}
                  </span>
                </div>
                {(onConfirmarConciliacao || onActionClick) && (
                  <Button
                    size="sm"
                    onClick={() => handleConciliar(c)}
                    className="h-7 px-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-[10px] font-semibold ml-2 shrink-0 shadow-2xs"
                  >
                    Vincular & Baixar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
