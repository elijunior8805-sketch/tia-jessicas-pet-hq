import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  TrendingUp, 
  Coins, 
  Wallet, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  Calendar,
  Filter
} from "lucide-react";
import { RelatorioFinanceiroExport } from "@/components/RelatorioFinanceiroExport";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRealtimeFinanceiro } from "@/lib/use-realtime-financeiro";
import { getFinancialKPIs } from "@/lib/financial-kpis.functions";
import { PageShell } from "@/components/page-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function FinanceiroPage() {
  const qc = useQueryClient();
  const fetchKPIs = useServerFn(getFinancialKPIs);
  useRealtimeFinanceiro(["fin-resumo", "financial-kpis-v2"]);

  const hoje = new Date();
  const [periodo, setPeriodo] = useState<Preset>("30dias");
  const [customDe, setCustomDe] = useState(computePreset("30dias", hoje).de);
  const [customAte, setCustomAte] = useState(computePreset("30dias", hoje).ate);

  const { de: from, ate: to } = useMemo(() => {
    if (periodo !== "personalizado") return computePreset(periodo, hoje);
    return { de: customDe, ate: customAte };
  }, [periodo, customDe, customAte]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["financial-kpis-v2", from, to],
    queryFn: () => fetchKPIs({ data: { from, to } }),
    staleTime: 30000,
  });

  const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch (e) {
      return dateStr;
    }
  };

  const kpis = [
    {
      label: "Faturamento por Competência",
      value: metrics ? brl(metrics.faturamento) : "—",
      hint: "Valor líquido dos atendimentos realizados no período (independente de quando foram pagos).",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      label: "Recebido no Período",
      value: metrics ? brl(metrics.recebido) : "—",
      hint: "Pagamentos efetivamente confirmados dentro deste intervalo de datas.",
      icon: Coins,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      label: "Despesas por Competência",
      value: metrics ? brl(metrics.despesas) : "—",
      hint: "Gastos e compras atribuídos ao período selecionado.",
      icon: Wallet,
      color: "text-rose-600",
      bg: "bg-rose-50"
    },
    {
      label: "Resultado por Competência",
      value: metrics ? brl(metrics.lucro) : "—",
      hint: "Faturamento dos atendimentos realizados no período menos despesas atribuídas à mesma competência.",
      icon: ArrowUpRight,
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
    {
      label: "Saldo de Caixa do Período",
      value: metrics ? brl(metrics.saldoCaixa) : "—",
      hint: "Recebimentos do período menos despesas efetivamente pagas no período, considerando aportes.",
      icon: Sparkles,
      color: "text-amber-600",
      bg: "bg-amber-50"
    }
  ];

  return (
    <PageShell>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Período analisado: <span className="font-medium text-foreground">{formatDate(from)}</span> até <span className="font-medium text-foreground">{formatDate(to)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <RelatorioFinanceiroExport 
              from={from} 
              to={to} 
              kpis={metrics ? {
                receitaBruta: metrics.faturamento,
                totalRecebido: metrics.recebido,
                despesaTotal: metrics.despesas,
                lucroEstimado: metrics.lucro,
                ticketMedio: metrics.ticketMedio,
                aportes: metrics.aportes
              } : {}} 
            />
            <Button size="sm" onClick={() => toast.info("Funcionalidade em desenvolvimento")} className="bg-primary hover:bg-primary/90 rounded-full px-4">
              <Plus className="h-4 w-4 mr-2" />
              Novo lançamento
            </Button>
          </div>
        </div>

        {/* Filtros de Período Premium */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/40 w-fit">
          {(["hoje", "semana", "mes", "30dias", "personalizado"] as Preset[]).map((p) => (
            <Button
              key={p}
              variant={periodo === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriodo(p)}
              className={periodo === p ? "rounded-xl shadow-sm" : "rounded-xl hover:bg-muted/50"}
            >
              {p.charAt(0).toUpperCase() + p.slice(1).replace("30dias", "Últimos 30 dias")}
            </Button>
          ))}
        </div>

        {periodo === "personalizado" && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid gap-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-2">De</label>
              <Input
                type="date"
                value={customDe}
                onChange={(e) => setCustomDe(e.target.value)}
                className="h-9 rounded-xl w-[160px]"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-2">Até</label>
              <Input
                type="date"
                value={customAte}
                onChange={(e) => setCustomAte(e.target.value)}
                className="h-9 rounded-xl w-[160px]"
              />
            </div>
            <Button size="icon" variant="ghost" className="mt-5 rounded-xl">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <TooltipProvider>
            {kpis.map((k, i) => (
              <Card key={i} className="relative overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="p-4 pb-2 space-y-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {k.label}
                    </CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-xs">
                        {k.hint}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={`text-xl sm:text-2xl font-bold ${k.color}`}>
                    {isLoading ? "..." : k.value}
                  </div>
                  <div className={`absolute top-0 right-0 p-3 opacity-[0.08] ${k.color}`}>
                    <k.icon className="h-10 w-10" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TooltipProvider>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Seções futuras como lançamentos, extrato, etc */}
          <Card className="lg:col-span-2 border-dashed border-2 bg-muted/5 min-h-[300px] flex items-center justify-center rounded-3xl">
            <div className="text-center space-y-2">
              <div className="bg-muted w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg text-muted-foreground">Extrato Detalhado</h3>
              <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto">
                As seções de lançamentos individuais e movimentações de caixa serão carregadas aqui.
              </p>
            </div>
          </Card>
          
          <Card className="border-border/40 rounded-3xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-rose-500" />
              Contas a Pagar
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Resumo de compras e parcelas pendentes para o período.</p>
              <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />
              <Button variant="outline" className="w-full rounded-2xl">Ver Detalhes</Button>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});
