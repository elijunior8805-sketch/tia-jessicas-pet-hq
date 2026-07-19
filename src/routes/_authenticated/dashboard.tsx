import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, Wallet, Sparkles, PawPrint, Receipt, Users, Calendar, Search, Plus,
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
    { label: "Bilhete Médio", value: data ? brl(data.bilhete) : "—", hint: "Por atendimento", icon: Receipt, tone: "primary" as const },
    { label: "Novos Clientes", value: data?.novosClientes ?? "—", hint: "Cadastrados no período", icon: Users, tone: "primary" as const },
  ];

  const hoje = new Date();

  return (
    <PageShell>
      {/* Barra de busca + CTA */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, pet, serviço…" className="pl-9 h-11 bg-card rounded-full border-border/60" />
        </div>
        <Link to="/agenda">
          <Button size="lg" className="rounded-full gap-2 shadow-elegant w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Novo Agendamento
          </Button>
        </Link>
      </div>

      {/* Saudação */}
      <div className="mb-6">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-primary tracking-tight">
          {greeting()}, {firstName(profile)}
        </h1>
        <p className="text-muted-foreground mt-2 capitalize">
          {format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {([
          ["hoje", "Hoje"],
          ["semana", "Semana"],
          ["mes", "Mês"],
          ["personalizado", "Personalizado"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              period === k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border/60 text-foreground hover:bg-accent"
            }`}
          >
            {l}
          </button>
        ))}
        {period === "personalizado" && (
          <div className="flex items-center gap-2 ml-1">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-auto" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-auto" />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5 hover:shadow-elegant transition rounded-2xl border-border/60">
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {k.label}
              </span>
              <k.icon className={`h-4 w-4 ${k.tone === "gold" ? "text-gold" : k.tone === "muted" ? "text-muted-foreground" : "text-primary"}`} />
            </div>
            <div className="font-display text-2xl sm:text-[26px] font-semibold text-primary leading-tight">
              {k.value}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">{k.hint}</p>
          </Card>
        ))}
      </div>

      {/* Chart + Próximos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6 rounded-2xl border-border/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-primary">Receita do período</h2>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {period === "hoje" ? "Diário" : period === "semana" ? "Semanal" : period === "mes" ? "Mensal" : "Custom"}
            </span>
          </div>
          {data && data.serie.some((p) => p.valor > 0) ? (
            <div className="h-64">
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
            <div className="h-64 grid place-items-center text-sm text-muted-foreground">
              Sem receitas registradas neste período
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-2xl border-border/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-primary">Próximos agendamentos</h2>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {(data?.proximos ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum agendamento futuro.</p>
            )}
            {(data?.proximos ?? []).map((a: any) => (
              <Link key={a.id} to="/agenda" className="flex gap-3 items-start rounded-xl p-3 -m-3 hover:bg-accent transition">
                <div className="text-center shrink-0 w-14">
                  <div className="font-display text-lg font-semibold text-primary leading-none">
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
        </Card>
      </div>
    </PageShell>
  );
}
