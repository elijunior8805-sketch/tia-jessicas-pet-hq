import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, Wallet, Sparkles, PawPrint, Receipt, Users, Calendar, Search, Plus, LineChart as LineChartIcon,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMyProfile, firstName } from "@/hooks/use-my-profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Period = "hoje" | "semana" | "mes" | "personalizado";

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const [period, setPeriod] = useState<Period>("hoje");
  const [customFrom, setCustomFrom] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (period === "hoje") return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    if (period === "semana") return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    if (period === "mes") return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const { data: profile } = useMyProfile();


  const { data } = useQuery({
    queryKey: ["dashboard-metrics", from, to],
    queryFn: async () => {
      const [pagRes, comprasRes, atendRes, novosClientesRes, proxAgRes] = await Promise.all([
        supabase.from("pagamentos").select("valor_pago,data_pagamento,valor_total,status").gte("data_pagamento", from).lte("data_pagamento", to),
        supabase.from("compras_parcelas").select("valor_pago,data_pagamento").gte("data_pagamento", from).lte("data_pagamento", to),
        supabase.from("atendimentos").select("id,valor_executado,data_inicio").gte("data_inicio", `${from}T00:00:00`).lte("data_inicio", `${to}T23:59:59`),
        supabase.from("clientes").select("id,created_at").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`),
        supabase.from("agendamentos")
          .select("id,data,hora_inicio,pets(nome),servicos(nome),clientes(nome)")
          .gte("data", format(new Date(), "yyyy-MM-dd"))
          .in("status", ["agendado", "confirmado", "aguardando"])
          .order("data", { ascending: true })
          .order("hora_inicio", { ascending: true })
          .limit(6),
      ]);

      const pagamentos = pagRes.data ?? [];
      const compras = comprasRes.data ?? [];
      const atendimentos = atendRes.data ?? [];
      const novosClientes = novosClientesRes.data ?? [];

      const faturamento = pagamentos.reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
      const despesas = compras.reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
      const lucro = faturamento - despesas;
      const atendCount = atendimentos.length;
      const bilhete = atendCount > 0 ? atendimentos.reduce((s, a) => s + Number(a.valor_executado ?? 0), 0) / atendCount : 0;

      // Série de receita por dia
      const dias = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
      const serie = dias.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const val = pagamentos
          .filter((p) => (p.data_pagamento ?? "").slice(0, 10) === key)
          .reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
        return { dia: format(d, dias.length <= 31 ? "dd/MM" : "dd/MM"), valor: val };
      });

      return {
        faturamento, despesas, lucro,
        atendCount, bilhete,
        novosClientes: novosClientes.length,
        serie,
        proximos: proxAgRes.data ?? [],
      };
    },
  });

  const kpis = [
    { label: "Faturamento", value: data ? brl(data.faturamento) : "—", hint: "Receitas no período", icon: TrendingUp, tone: "primary" as const },
    { label: "Despesas", value: data ? brl(data.despesas) : "—", hint: "Saídas no período", icon: Wallet, tone: "muted" as const },
    { label: "Lucro", value: data ? brl(data.lucro) : "—", hint: "Receitas − despesas", icon: Sparkles, tone: "gold" as const },
    { label: "Atendimentos", value: data?.atendCount ?? "—", hint: "No período", icon: PawPrint, tone: "primary" as const },
    { label: "Ticket Médio", value: data ? brl(data.bilhete) : "—", hint: "Por atendimento", icon: Receipt, tone: "gold" as const },
    { label: "Novos Clientes", value: data?.novosClientes ?? "—", hint: "Cadastrados no período", icon: Users, tone: "primary" as const },
  ];

  const hoje = new Date();
  const periodos = [
    ["hoje", "Hoje", "Hoje"],
    ["semana", "Semana", "Sem."],
    ["mes", "Mês", "Mês"],
    ["personalizado", "Personalizado", "Custom"],
  ] as const;

  return (
    <PageShell>
      {/* Busca + CTA (70/30) */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 mb-4">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, pet, serviço…"
            className="pl-9 h-10 bg-card rounded-full border-border/60 w-full max-w-full"
          />
        </div>
        <Link to="/agenda" className="w-full sm:w-auto">
          <Button size="default" className="rounded-full gap-2 shadow-elegant h-10 w-full sm:w-auto px-5 whitespace-nowrap">
            <Plus className="h-4 w-4" /> Novo Agendamento
          </Button>
        </Link>
      </div>

      {/* Saudação + data */}
      <div className="mb-4">
        <h1 className="font-display text-[1.9rem] sm:text-[2.4rem] leading-tight font-semibold text-primary tracking-tight">
          {greeting()}, {firstName(profile)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 lowercase">
          {format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Filtro segmentado */}
      <div className="mb-5">
        <div
          role="tablist"
          aria-label="Período"
          className="grid grid-cols-4 sm:inline-flex sm:w-auto items-center rounded-full bg-muted/60 p-1 border border-border/50"
        >
          {periodos.map(([k, longLabel, shortLabel]) => {
            const active = period === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(k)}
                className={`h-9 px-2 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition text-center leading-none ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{longLabel}</span>
              </button>
            );
          })}
        </div>
        {period === "personalizado" && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-full sm:w-auto" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-full sm:w-auto" />
          </div>
        )}
      </div>


      {/* KPI Cards — 1/2/3 colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {kpis.map((k) => {
          const isGold = k.tone === "gold";
          return (
            <Card
              key={k.label}
              className="relative overflow-hidden p-4 sm:p-5 rounded-xl border-border/60 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all"
            >
              {isGold && (
                <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {k.label}
                </span>
                <k.icon
                  className={`h-4 w-4 shrink-0 ${
                    isGold ? "text-gold" : k.tone === "muted" ? "text-muted-foreground" : "text-primary"
                  }`}
                  strokeWidth={1.75}
                />
              </div>
              <div className="font-display text-2xl sm:text-[1.65rem] font-semibold text-primary leading-tight mt-3 tabular-nums">
                {k.value}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{k.hint}</p>
            </Card>
          );
        })}
      </div>

      {/* Chart + Próximos — 65/35 */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] gap-4">
        <Card className="p-5 sm:p-6 rounded-xl border-border/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-primary">Receita do período</h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
              {period === "hoje" ? "Diário" : period === "semana" ? "Semanal" : period === "mes" ? "Mensal" : "Custom"}
            </span>
          </div>
          {data && data.serie.some((p) => p.valor > 0) ? (
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.serie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(v: number) => brl(v)}
                  />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="min-h-[9rem] grid place-items-center py-6">
              <div className="text-center">
                <LineChartIcon className="mx-auto h-6 w-6 text-gold/70" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground mt-2">Sem receitas registradas neste período</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6 rounded-xl border-border/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-primary">Próximos agendamentos</h2>
            <Calendar className="h-4 w-4 text-gold" strokeWidth={1.75} />
          </div>
          {(data?.proximos ?? []).length === 0 ? (
            <div className="min-h-[7rem] grid place-items-center py-4">
              <div className="text-center">
                <Calendar className="mx-auto h-6 w-6 text-gold/70" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground mt-2">Nenhum agendamento futuro</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.proximos ?? []).map((a: any) => (
                <Link key={a.id} to="/agenda" className="flex gap-3 items-start rounded-xl p-3 -m-3 hover:bg-accent transition">
                  <div className="text-center shrink-0 w-14">
                    <div className="font-display text-lg font-semibold text-primary leading-none tabular-nums">
                      {a.hora_inicio?.slice(0, 5)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      {format(parseISO(a.data), "dd MMM", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {a.pets?.nome ?? "Pet"} <span className="text-muted-foreground">— {a.servicos?.nome ?? "serviço"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{a.clientes?.nome}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
