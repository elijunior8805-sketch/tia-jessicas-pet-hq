import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { RelatorioFinanceiroExport } from "@/components/RelatorioFinanceiroExport";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns";
import { useRealtimeFinanceiro } from "@/lib/use-realtime-financeiro";
import { getFinancialKPIs } from "@/lib/financial-kpis.functions";

type Preset = "hoje" | "ontem" | "semana" | "mes" | "30dias" | "personalizado";

function computePreset(preset: Preset, hoje = new Date()): { de: string; ate: string } {
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "hoje":
      return { de: fmt(hoje), ate: fmt(hoje) };
    case "ontem": {
      const y = subDays(hoje, 1);
      return { de: fmt(y), ate: fmt(y) };
    }
    case "semana":
      return {
        de: fmt(startOfWeek(hoje, { weekStartsOn: 1 })),
        ate: fmt(endOfWeek(hoje, { weekStartsOn: 1 })),
      };
    case "mes":
      return { de: fmt(startOfMonth(hoje)), ate: fmt(endOfMonth(hoje)) };
    case "30dias":
      return { de: fmt(subDays(hoje, 29)), ate: fmt(hoje) };
    default:
      return { de: fmt(subDays(hoje, 29)), ate: fmt(hoje) };
  }
}

function LancamentoManualDialog({ onCreated }: { onCreated: () => void }) {
  // Simplified for brevity, usually should be a full dialog
  return (
    <Button size="sm" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
      <Plus className="h-4 w-4 mr-1" />
      Novo lançamento
    </Button>
  );
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const fetchKPIs = useServerFn(getFinancialKPIs);
  useRealtimeFinanceiro(["fin-resumo", "financial-kpis-v2"]);

  const hoje = new Date();
  const [inicio, setInicio] = useState(computePreset("30dias", hoje).de);
  const [fim, setFim] = useState(computePreset("30dias", hoje).ate);

  const { data: metrics } = useQuery({
    queryKey: ["financial-kpis-v2", inicio, fim],
    queryFn: () => fetchKPIs({ data: { from: inicio, to: fim } }),
    staleTime: 30000,
  });

  const kpis = useMemo(() => {
    if (!metrics) return {
      totalRecebido: 0, receitaBruta: 0, despesaTotal: 0, lucroEstimado: 0,
    };
    return {
      totalRecebido: metrics.recebido,
      receitaBruta: metrics.faturamento,
      despesaTotal: metrics.despesas,
      lucroEstimado: metrics.lucro,
    };
  }, [metrics]);

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <div className="flex items-center gap-2">
          <RelatorioFinanceiroExport 
            from={inicio} 
            to={fim} 
            kpis={metrics ? {
              receitaBruta: metrics.faturamento,
              totalRecebido: metrics.recebido,
              despesaTotal: metrics.despesas,
              lucroEstimado: metrics.lucro,
              ticketMedio: metrics.ticketMedio,
              aportes: metrics.aportes
            } : {}} 
          />
          <LancamentoManualDialog onCreated={() => qc.invalidateQueries()} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">Faturamento</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{brl(kpis.receitaBruta)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Recebido</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{brl(kpis.totalRecebido)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Despesas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{brl(kpis.despesaTotal)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium text-emerald-600">Lucro Real</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{brl(kpis.lucroEstimado)}</div></CardContent></Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});
