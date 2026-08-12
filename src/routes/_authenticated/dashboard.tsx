import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, Wallet, Sparkles, PawPrint, Receipt, Users, Calendar, Search, Plus, LineChart as LineChartIcon, Clock, AlertCircle, RefreshCw, Coins,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isToday, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMyProfile, firstName } from "@/hooks/use-my-profile";
import { recalcularAgregados } from "@/lib/agregados.functions";
import { toast } from "sonner";
import { useRealtimeFinanceiro } from "@/lib/use-realtime-financeiro";



export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Period = "hoje" | "semana" | "mes" | "30dias" | "personalizado";

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function valorRealExecutado(atendimento: any) {
  // O painel precisa bater com o total exibido nos atendimentos concluídos:
  // valor realizado + taxa de Leva e Traz, descontando abatimentos quando houver.
  // Antes ele somava apenas `valor_executado`, por isso faltavam R$ 20,00
  // quando havia dois atendimentos com taxa de R$ 10,00.
  return Math.max(
    0,
    Number(atendimento?.valor_executado ?? 0) +
      Number(atendimento?.taxa_leva_traz ?? 0) -
      Number(atendimento?.desconto ?? 0),
  );
}

// Paleta sofisticada por indicador (oklch inline — escopo visual)
const KPI_TONES = {
  esmeralda:  { chip: "oklch(0.55 0.13 155)", soft: "oklch(0.55 0.13 155 / 0.12)", bar: "oklch(0.45 0.11 155)" },
  terracota:  { chip: "oklch(0.62 0.13 40)",  soft: "oklch(0.62 0.13 40 / 0.12)",  bar: "oklch(0.55 0.12 40)"  },
  dourado:    { chip: "oklch(0.78 0.11 82)",  soft: "oklch(0.78 0.11 82 / 0.14)",  bar: "oklch(0.72 0.12 78)"  },
  petroleo:   { chip: "oklch(0.45 0.07 220)", soft: "oklch(0.45 0.07 220 / 0.12)", bar: "oklch(0.42 0.08 220)" },
  ambar:      { chip: "oklch(0.72 0.14 68)",  soft: "oklch(0.72 0.14 68 / 0.14)",  bar: "oklch(0.66 0.14 65)"  },
  salvia:     { chip: "oklch(0.62 0.06 150)", soft: "oklch(0.62 0.06 150 / 0.14)", bar: "oklch(0.55 0.07 150)" },
} as const;

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  agendado:     { label: "Agendado",   className: "bg-[oklch(0.94_0.02_155)] text-[oklch(0.32_0.06_155)] border border-[oklch(0.85_0.03_155)]" },
  confirmado:   { label: "Confirmado", className: "bg-[oklch(0.94_0.06_150)] text-[oklch(0.32_0.09_155)] border border-[oklch(0.75_0.08_150)]" },
  aguardando:   { label: "Aguardando", className: "bg-[oklch(0.95_0.08_82)]  text-[oklch(0.38_0.08_60)]  border border-[oklch(0.80_0.10_82)]" },
  finalizado:   { label: "Concluído",  className: "bg-[oklch(0.92_0.03_155)] text-[oklch(0.30_0.06_155)] border border-[oklch(0.78_0.05_155)]" },
  cancelado:    { label: "Cancelado",  className: "bg-[oklch(0.95_0.03_25)]  text-[oklch(0.45_0.15_25)]  border border-[oklch(0.85_0.06_25)]"  },
};

function DashboardPage() {
  const [period, setPeriod] = useState<Period>("30dias");
  const [customFrom, setCustomFrom] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (period === "hoje") return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    if (period === "semana") return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    if (period === "mes") return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    if (period === "30dias") return { from: format(subDays(now, 29), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const { data: profile } = useMyProfile();
  const queryClient = useQueryClient();
  const recalcFn = useServerFn(recalcularAgregados);
  useRealtimeFinanceiro(["dashboard-metrics", "agendamentos"]);

  const recalc = useMutation({
    mutationFn: () => recalcFn({ data: undefined as any }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      const parts = [
        res.atendimentos_resetados ? `${res.atendimentos_resetados} atendimento(s) reabertos` : null,
        res.agendamentos_reabertos ? `${res.agendamentos_reabertos} agendamento(s) reabertos` : null,
        res.pets_recalculados ? `${res.pets_recalculados} pet(s) com histórico atualizado` : null,
      ].filter(Boolean);
      toast.success(
        parts.length
          ? `Agregados recalculados — ${parts.join(", ")}.`
          : "Tudo em dia — nenhum ajuste necessário."
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao recalcular agregados."),
  });



  const { data } = useQuery({
    queryKey: ["dashboard-metrics", from, to],
    staleTime: 30000,

    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Alarga a janela em ±1 dia no filtro do servidor para não perder
      // atendimentos cuja data local (America/Sao_Paulo, UTC-3) cai no
      // período, mas cujo timestamp UTC (encerrado_em/data_inicio) fica
      // fora dele. O filtro definitivo é feito em JS usando o fuso local.
      const pad = (n: number) => String(n).padStart(2, "0");
      const shiftDay = (iso: string, delta: number) => {
        const d = parseISO(iso);
        d.setDate(d.getDate() + delta);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const fromWide = shiftDay(from, -1);
      const toWide = shiftDay(to, 1);
      const toLocalDay = (v: any): string => {
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v).slice(0, 10);
        // yyyy-mm-dd em America/Sao_Paulo
        return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      };

      const [comprasRes, atendRes, novosClientesRes, proxAgRes, pagamentosRes] = await Promise.all([
        // Despesas do painel: considera parcelas pagas pela data de pagamento
        // e parcelas ainda em aberto pela data de vencimento. Assim o card não
        // some quando a compra foi lançada mas ainda não foi baixada/paga.
        supabase
          .from("compras_parcelas")
          .select("valor,valor_pago,vencimento,data_pagamento,status,is_teste")
          .or(
            `and(data_pagamento.gte.${from},data_pagamento.lte.${to}),and(vencimento.gte.${from},vencimento.lte.${to})`,
          )
          .or("is_teste.is.false,is_teste.is.null"),
        // Fonte única de faturamento: atendimentos finalizados com
        // encerrado_em no período. Não usa `pagamentos` nem `valor_planejado`.
        supabase
          .from("atendimentos")
          .select("id,valor_executado,encerrado_em,finalizado,servicos_solicitados,servicos_planejados,servicos_extras,servicos_executados,taxa_leva_traz,desconto")
          .eq("finalizado", true)
          .not("encerrado_em", "is", null)
          .gte("encerrado_em", `${fromWide}T00:00:00`)
          .lte("encerrado_em", `${toWide}T23:59:59`),
        supabase.from("clientes").select("id,created_at").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`),
        supabase.from("agendamentos")
          .select("id,data,hora_inicio,status,pets(nome),servicos(nome),clientes(nome)")
          .gte("data", format(new Date(), "yyyy-MM-dd"))
          .in("status", ["agendado", "confirmado", "aguardando"])
          .order("data", { ascending: true })
          .order("hora_inicio", { ascending: true })
          .limit(6),
        // Buscar aportes e ajustes (categorias específicas conforme solicitado)
        supabase
          .from("pagamentos")
          .select("valor_pago, data_pagamento, categoria_receita")
          .in("categoria_receita", ["aporte", "ajuste"])
          .eq("status", "pago")
          .gte("data_pagamento", from)
          .lte("data_pagamento", to),
      ]);

      if (comprasRes.error) {
        console.error("[dashboard] Falha ao carregar despesas", comprasRes.error);
      }

      const compras = comprasRes.data ?? [];
      const atendimentos = atendRes.data ?? [];
      const novosClientes = novosClientesRes.data ?? [];

      const despesas = compras.reduce((s, r: any) => {
        if (r.status === "cancelado") return s;
        const pagaNoPeriodo = r.data_pagamento && r.data_pagamento >= from && r.data_pagamento <= to;
        const venceNoPeriodo = r.vencimento && r.vencimento >= from && r.vencimento <= to;

        if (pagaNoPeriodo) return s + Number(r.valor_pago || r.valor || 0);
        if (venceNoPeriodo && r.status !== "pago") {
          return s + Math.max(0, Number(r.valor || 0) - Number(r.valor_pago || 0));
        }
        return s;
      }, 0);
      // Faturamento / Atendimentos / Ticket Médio: somente atendimentos
      // finalizados (finalizado=true), com encerrado_em preenchido e
      // valor_executado > 0, cuja data local (America/Sao_Paulo) de
      // `encerrado_em` cai dentro do período selecionado.
      const executados = atendimentos.filter((a: any) => {
        if (a.finalizado !== true || !a.encerrado_em) return false;
        if (valorRealExecutado(a) <= 0) return false;
        const ref = toLocalDay(a.encerrado_em);
        return ref >= from && ref <= to;
      });
      const atendCount = executados.length;
      const somaExec = executados.reduce((s, a: any) => s + valorRealExecutado(a), 0);
      
      // Aportes e Ajustes: qualquer categoria que não seja 'servico'
      const aportesAjustes = (pagamentosRes.data ?? []).reduce((s, p: any) => s + Number(p.valor_pago || 0), 0);
      
      const bilhete = atendCount > 0 ? somaExec / atendCount : 0;
      const faturamento = somaExec;
      const lucro = faturamento + aportesAjustes - despesas;

      const dias = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
      const serie = dias.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const val = executados
          .filter((a: any) => toLocalDay(a.encerrado_em) === key)
          .reduce((s, a: any) => s + valorRealExecutado(a), 0);
        return { dia: format(d, "dd/MM"), valor: val };
      });

      return {
        faturamento, despesas, lucro,
        atendCount, bilhete,
        aportesAjustes,
        novosClientes: novosClientes.length,
        serie,
        proximos: proxAgRes.data ?? [],
      };
    },
  });

  const kpis = [
    { label: "Faturamento",   value: data ? brl(data.faturamento) : "—", hint: "Receitas de serviços",     icon: TrendingUp, tone: KPI_TONES.esmeralda },
    { label: "Despesas",      value: data ? brl(data.despesas)    : "—", hint: "Saídas no período",       icon: Wallet,     tone: KPI_TONES.terracota },
    { label: "Lucro",         value: data ? brl(data.lucro)       : "—", hint: "Saldo operacional",       icon: Sparkles,   tone: KPI_TONES.dourado   },
    { label: "Ticket Médio",  value: data ? brl(data.bilhete)     : "—", hint: "Média por serviço",       icon: Receipt,    tone: KPI_TONES.ambar     },
    { label: "Aportes",       value: data ? brl(data.aportesAjustes) : "—", hint: "Entradas diversas", icon: Coins,      tone: KPI_TONES.salvia    },
    { label: "Atendimentos",  value: data?.atendCount ?? "—",           hint: "Realizados no período",   icon: PawPrint,   tone: KPI_TONES.petroleo  },
  ];

  const hoje = new Date();
  const periodos = [
    ["hoje", "Hoje", "Hoje"],
    ["semana", "Semana", "Sem."],
    ["mes", "Mês", "Mês"],
    ["30dias", "30 dias", "30d"],
    ["personalizado", "Personalizado", "Custom"],
  ] as const;

  const proximos = data?.proximos ?? [];
  const atendimentosHoje = proximos.filter((a: any) => a.data === format(hoje, "yyyy-MM-dd")).length;
  const aguardando = proximos.filter((a: any) => a.status === "aguardando");

  return (
    <PageShell>
      {/* ============ HERO BANNER PREMIUM ============ */}
      <div
        className="relative overflow-hidden rounded-3xl mb-6 border border-[oklch(0.30_0.06_155)]"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.24 0.045 155) 0%, oklch(0.30 0.06 155) 55%, oklch(0.34 0.07 155) 100%)",
          boxShadow: "0 20px 50px -22px oklch(0.20 0.05 155 / 0.55)",
        }}
      >
        {/* Textura dourada sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            background:
              "radial-gradient(circle at 88% 20%, oklch(0.85 0.11 82 / 0.9), transparent 40%), radial-gradient(circle at 100% 100%, oklch(0.78 0.11 82 / 0.6), transparent 45%)",
          }}
        />
        {/* Marca d'água pet */}
        <PawPrint
          className="pointer-events-none absolute -right-6 -bottom-8 h-56 w-56 text-white/[0.06] rotate-[-18deg]"
          strokeWidth={1}
        />
        <PawPrint
          className="pointer-events-none absolute right-24 top-6 h-16 w-16 text-white/[0.08] rotate-[22deg] hidden sm:block"
          strokeWidth={1}
        />

        <div className="relative p-5 sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[oklch(0.85_0.10_82)] font-semibold">
                Spa de Pet · Painel
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.05] font-semibold text-white tracking-tight mt-2">
                {greeting()},{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(120deg, oklch(0.92 0.09 82), oklch(0.78 0.11 82))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {firstName(profile)}
                </span>
              </h1>
              <p className="text-sm sm:text-base text-white/75 mt-2 first-letter:uppercase">
                {format(hoje, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3.5 py-1.5 border border-white/15">
                <Calendar className="h-3.5 w-3.5 text-[oklch(0.88_0.10_82)]" strokeWidth={2} />
                <span className="text-xs sm:text-sm text-white/90">
                  {atendimentosHoje > 0
                    ? `${atendimentosHoje} atendimento${atendimentosHoje > 1 ? "s" : ""} agendado${atendimentosHoje > 1 ? "s" : ""} para hoje`
                    : "Nenhum agendamento para hoje"}
                </span>
              </div>
            </div>

            {/* Busca + CTA no banner */}
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 lg:min-w-[460px]">
              <div className="relative min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  placeholder="Buscar cliente, pet, serviço…"
                  className="pl-10 h-11 rounded-full bg-white/10 backdrop-blur border-white/20 text-white placeholder:text-white/60 focus-visible:ring-[oklch(0.78_0.11_82)] focus-visible:ring-offset-0"
                />
              </div>
              <Link to="/agenda" search={{}} className="w-full sm:w-auto">
                <Button
                  size="default"
                  className="h-11 w-full sm:w-auto px-6 rounded-full gap-2 whitespace-nowrap font-semibold border-0 transition-all hover:-translate-y-[1px]"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.85 0.11 82), oklch(0.72 0.12 78))",
                    color: "oklch(0.22 0.04 60)",
                    boxShadow:
                      "0 8px 20px -8px oklch(0.55 0.12 78 / 0.7), inset 0 1px 0 oklch(0.95 0.08 82 / 0.5)",
                  }}
                >
                  <Plus className="h-4 w-4" /> Novo Agendamento
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Filtro segmentado + Recalcular */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <PeriodTabs
          period={period}
          onChange={setPeriod}
          periodos={periodos}
          customFrom={customFrom}
          customTo={customTo}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-full gap-2 border-[oklch(0.85_0.05_155)] hover:bg-[oklch(0.94_0.03_155)]"
          onClick={() => recalc.mutate()}
          disabled={recalc.isPending}
          title="Recalcula históricos e agregados a partir dos lançamentos atuais (admin)"
        >
          <RefreshCw className={`h-4 w-4 ${recalc.isPending ? "animate-spin" : ""}`} />
          {recalc.isPending ? "Recalculando…" : "Recalcular KPIs"}
        </Button>
      </div>


      {/* ============ KPI CARDS PREMIUM ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 mb-6">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="group relative overflow-hidden p-4 sm:p-5 rounded-2xl border-border/60 bg-card shadow-[0_1px_2px_oklch(0.25_0.05_155/0.05),0_4px_16px_-8px_oklch(0.30_0.08_155/0.10)] hover:shadow-[0_8px_28px_-12px_oklch(0.30_0.08_155/0.22)] hover:-translate-y-0.5 transition-all duration-300"
          >
            {/* Faixa lateral colorida */}
            <span
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: `linear-gradient(180deg, ${k.tone.chip}, ${k.tone.bar})` }}
            />
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-muted-foreground truncate">
                  {k.label}
                </p>
                <div className="font-display text-2xl sm:text-3xl font-semibold text-primary leading-[1.1] mt-1.5 sm:mt-2 tabular-nums truncate">
                  {k.value}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground mt-1 sm:mt-1.5 line-clamp-2">{k.hint}</p>
              </div>
              <div
                className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: k.tone.soft, color: k.tone.chip }}
              >
                <k.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ============ CHART + PRÓXIMOS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] gap-4">
        <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card shadow-[0_1px_2px_oklch(0.25_0.05_155/0.05),0_4px_16px_-8px_oklch(0.30_0.08_155/0.10)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-semibold text-primary">Receita do período</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Total recebido dia a dia</p>
            </div>
            <span className="text-[10px] text-[oklch(0.45_0.11_155)] uppercase tracking-[0.16em] font-semibold px-2.5 py-1 rounded-full bg-[oklch(0.94_0.04_150)]">
              {period === "hoje" ? "Diário" : period === "semana" ? "Semanal" : period === "mes" ? "Mensal" : period === "30dias" ? "30 dias" : "Custom"}
            </span>
          </div>
          {data && data.serie.some((p) => p.valor > 0) ? (
            <div className="h-48 sm:h-60 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.serie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.55 0.13 155)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.55 0.13 155)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.90 0.01 120)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: "oklch(0.50 0.02 155)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "oklch(0.50 0.02 155)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.90 0.01 120)", background: "oklch(1 0 0)", boxShadow: "0 10px 30px -12px oklch(0.30 0.08 155 / 0.18)" }}
                    labelStyle={{ color: "oklch(0.32 0.06 155)", fontWeight: 600 }}
                    formatter={(v: number) => [brl(v), "Receita"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="oklch(0.45 0.11 155)"
                    strokeWidth={2.5}
                    fill="url(#fillReceita)"
                    dot={{ r: 3.5, fill: "oklch(0.45 0.11 155)", strokeWidth: 2, stroke: "oklch(1 0 0)" }}
                    activeDot={{ r: 6, fill: "oklch(0.78 0.11 82)", strokeWidth: 2, stroke: "oklch(1 0 0)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="min-h-[11rem] grid place-items-center py-8 rounded-xl bg-[oklch(0.97_0.01_120)]/50 border border-dashed border-border/60">
              <div className="text-center px-6">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[oklch(0.94_0.04_150)]">
                  <LineChartIcon className="h-5 w-5 text-[oklch(0.45_0.11_155)]" strokeWidth={1.8} />
                </div>
                <p className="text-sm font-medium text-primary mt-3">Sem receitas neste período</p>
                <p className="text-xs text-muted-foreground mt-1">Os pagamentos recebidos aparecerão aqui.</p>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {/* Atenção hoje */}
          {aguardando.length > 0 && (
            <Card className="p-4 rounded-2xl border-[oklch(0.85_0.10_82)] bg-[oklch(0.98_0.03_82)]/70">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[oklch(0.85_0.11_82)] text-[oklch(0.30_0.06_60)]">
                  <AlertCircle className="h-4 w-4" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold text-[oklch(0.35_0.08_60)]">Atenção hoje</h3>
                  <p className="text-xs text-[oklch(0.40_0.06_60)] mt-0.5">
                    {aguardando.length} pet{aguardando.length > 1 ? "s" : ""} aguardando check-in.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card shadow-[0_1px_2px_oklch(0.25_0.05_155/0.05),0_4px_16px_-8px_oklch(0.30_0.08_155/0.10)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-primary">Próximos agendamentos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Fila operacional</p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[oklch(0.95_0.08_82)] text-[oklch(0.55_0.12_78)]">
                <Calendar className="h-4 w-4" strokeWidth={2} />
              </div>
            </div>
            {proximos.length === 0 ? (
              <div className="min-h-[8rem] grid place-items-center py-4 rounded-xl bg-[oklch(0.97_0.01_120)]/50 border border-dashed border-border/60">
                <div className="text-center px-4">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[oklch(0.94_0.04_150)]">
                    <Calendar className="h-5 w-5 text-[oklch(0.45_0.11_155)]" strokeWidth={1.8} />
                  </div>
                  <p className="text-sm font-medium text-primary mt-3">Agenda livre</p>
                  <p className="text-xs text-muted-foreground mt-1">Nenhum agendamento futuro.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {proximos.map((a: any) => {
                  const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.agendado;
                  const dt = parseISO(a.data);
                  const initial = (a.pets?.nome ?? "P").trim().charAt(0).toUpperCase();
                  return (
                    <Link
                      key={a.id}
                      to="/agenda"
                      search={{}}

                      className="group flex gap-2.5 sm:gap-3 items-center rounded-xl p-2 sm:p-2.5 -mx-2 sm:-mx-2.5 hover:bg-[oklch(0.97_0.02_150)] transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center w-[52px] sm:w-14 shrink-0 rounded-lg py-1.5 bg-[oklch(0.96_0.02_155)] border border-[oklch(0.90_0.02_155)]">
                        <div className="flex items-center gap-1 font-display text-sm sm:text-[15px] font-semibold text-primary leading-none tabular-nums">
                          <Clock className="h-3 w-3 text-[oklch(0.55_0.10_82)]" strokeWidth={2.2} />
                          {a.hora_inicio?.slice(0, 5)}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
                          {isToday(dt) ? "Hoje" : format(dt, "dd MMM", { locale: ptBR })}
                        </div>
                      </div>
                      <div className="hidden sm:grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[oklch(0.94_0.04_150)] to-[oklch(0.88_0.05_150)] text-[oklch(0.32_0.06_155)] font-display font-semibold text-sm border border-[oklch(0.85_0.04_150)]">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground truncate leading-tight">
                          {a.pets?.nome ?? "Pet"}
                          <span className="text-muted-foreground font-normal"> · {a.servicos?.nome ?? "serviço"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{a.clientes?.nome}</div>
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shrink-0 whitespace-nowrap ${st.className}`}>
                        {st.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

type PeriodTuple = readonly [Period, string, string];

function PeriodTabs({
  period,
  onChange,
  periodos,
  customFrom,
  customTo,
  setCustomFrom,
  setCustomTo,
}: {
  period: Period;
  onChange: (p: Period) => void;
  periodos: readonly PeriodTuple[];
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
}) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = periodos.findIndex(([k]) => k === period);

  const focusTab = (idx: number) => {
    const len = periodos.length;
    const next = ((idx % len) + len) % len;
    const btn = tabsRef.current[next];
    if (btn) {
      btn.focus();
      onChange(periodos[next][0]);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusTab(activeIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusTab(activeIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(0);
        break;
      case "End":
        e.preventDefault();
        focusTab(periodos.length - 1);
        break;
    }
  };

  const activeLongLabel = periodos[activeIndex]?.[1] ?? "";

  return (
    <div className="mb-6">
      <div
        role="tablist"
        aria-label="Filtro de período"
        aria-orientation="horizontal"
        className="grid grid-cols-4 sm:inline-flex sm:w-auto items-center rounded-full bg-card p-1 border border-border/60 shadow-[0_1px_2px_oklch(0.25_0.05_155/0.05)]"
      >
        {periodos.map(([k, longLabel, shortLabel], idx) => {
          const active = period === k;
          return (
            <button
              key={k}
              ref={(el) => {
                tabsRef.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`period-tab-${k}`}
              aria-selected={active}
              aria-label={longLabel}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(k)}
              onKeyDown={onKeyDown}
              className={`h-9 px-2 sm:px-5 rounded-full text-xs sm:text-sm font-semibold transition-all text-center leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                active
                  ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_oklch(0.30_0.08_155/0.40)]"
                  : "text-muted-foreground hover:text-primary hover:bg-[oklch(0.96_0.02_150)]"
              }`}
            >
              <span className="sm:hidden" aria-hidden="true">{shortLabel}</span>
              <span className="hidden sm:inline" aria-hidden="true">{longLabel}</span>
            </button>
          );
        })}
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        Período selecionado: {activeLongLabel}
        {period === "personalizado" && customFrom && customTo
          ? `, de ${customFrom} até ${customTo}`
          : ""}
      </div>

      {period === "personalizado" && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <label className="sr-only" htmlFor="period-custom-from">Data inicial</label>
          <Input
            id="period-custom-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 w-full sm:w-auto rounded-full"
            aria-label="Data inicial do período personalizado"
          />
          <span className="text-muted-foreground text-sm" aria-hidden="true">até</span>
          <label className="sr-only" htmlFor="period-custom-to">Data final</label>
          <Input
            id="period-custom-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 w-full sm:w-auto rounded-full"
            aria-label="Data final do período personalizado"
          />
        </div>
      )}
    </div>
  );
}
