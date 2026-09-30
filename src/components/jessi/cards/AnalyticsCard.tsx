import React from "react";
import { BarChart3, TrendingUp, Sparkles, ArrowRight, DollarSign, Users, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyticsResultPayload, AnalyticsItemRanking } from "@/lib/ia-v2/adapters/analytics.adapter";

interface AnalyticsCardProps {
  data: AnalyticsResultPayload | any;
  onActionClick?: (comando: string) => void;
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ data, onActionClick }) => {
  const payload = data as AnalyticsResultPayload;
  const itens: AnalyticsItemRanking[] = payload?.itens || [];

  if (!payload || itens.length === 0) {
    return null;
  }

  const brl = (v: number | undefined | null) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="rounded-2xl border border-emerald-800/20 bg-card p-4 space-y-3.5 text-xs shadow-xs my-2">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-800 text-[#F5E6BE] flex items-center justify-center font-bold shadow-2xs">
            <BarChart3 className="h-4 w-4 text-[#C8A951]" />
          </div>
          <div>
            <span className="font-bold text-foreground text-xs sm:text-sm block">
              {payload.titulo || "Análise Estatística de Negócio"}
            </span>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground">
              {payload.subtitulo || "Cruzamento analítico de desempenho"}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-medium">
          {payload.periodoReferencia || "Consolidado"}
        </Badge>
      </div>

      {/* Grid de 3 KPIs */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-xl bg-muted/40 border border-border/60">
          <span className="text-[10px] text-muted-foreground block">Volume</span>
          <span className="font-bold text-xs sm:text-sm text-foreground block">
            {payload.totalGeral} itens
          </span>
        </div>
        <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
          <span className="text-[10px] text-emerald-900 block">Faturamento</span>
          <span className="font-bold text-xs sm:text-sm text-emerald-900 block">
            {brl(payload.faturamentoGeral)}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/60">
          <span className="text-[10px] text-amber-900 block">Ticket Médio</span>
          <span className="font-bold text-xs sm:text-sm text-amber-900 block">
            {brl(payload.ticketMedioGeral)}
          </span>
        </div>
      </div>

      {/* Lista com Barras de Progresso / Ranking */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Award className="h-3.5 w-3.5 text-[#C8A951]" />
          Ranking por Participação:
        </span>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {itens.map((item, idx) => {
            const perc = Math.min(100, Math.max(0, item.percentual || 0));

            return (
              <div
                key={idx}
                className="p-2.5 rounded-xl border border-border/70 bg-background space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    {item.nome}
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-emerald-800">{brl(item.faturamentoTotal)}</span>
                    <span className="text-[10px] text-muted-foreground block">
                      {item.totalAtendimentos} atend. ({perc.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso Visual */}
                <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-[#C8A951] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${perc}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Box de Insight Estratégico */}
      {payload.insightEstrategico && (
        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1 text-xs text-emerald-950">
          <span className="font-semibold flex items-center gap-1 text-[11px]">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700" /> Insight Estratégico da Jessi:
          </span>
          <p className="text-[11px] leading-relaxed text-emerald-900/90">
            {payload.insightEstrategico}
          </p>
        </div>
      )}

      {/* Ação Recomendada com 1 Clique */}
      {payload.acaoRecomendada && onActionClick && (
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground truncate">
            Ação sugerida:
          </span>
          <Button
            size="sm"
            onClick={() => onActionClick(payload.acaoRecomendada.comando)}
            className="h-7 px-3 text-[11px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-semibold gap-1 shrink-0 shadow-2xs"
          >
            {payload.acaoRecomendada.texto}
            <ArrowRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      )}
    </div>
  );
};
