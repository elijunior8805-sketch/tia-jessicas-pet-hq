import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Calendar, ClipboardList, Wallet, AlertTriangle, TrendingUp,
  Package, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  tone?: "default" | "warning" | "success" | "gold";
};

function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: kpis } = useQuery({
    queryKey: ["dashboard", today],
    queryFn: async () => {
      const [agHoje, clientes, pagPend, estoqueBaixo, parcVenc] = await Promise.all([
        supabase.from("agendamentos").select("id,status", { count: "exact" }).eq("data", today),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("pagamentos").select("id,valor_total,valor_pago").in("status", ["pendente", "parcial", "atrasado"]),
        supabase.from("produtos_estoque").select("id,quantidade,estoque_minimo"),
        supabase.from("compras_parcelas").select("id,valor,valor_pago,status,vencimento").in("status", ["pendente", "parcial", "atrasado"]),
      ]);

      const agendHoje = agHoje.data ?? [];
      const totalPagPend = (pagPend.data ?? []).reduce(
        (s, r) => s + (Number(r.valor_total) - Number(r.valor_pago)), 0
      );
      const estoqueBaixoCount = (estoqueBaixo.data ?? []).filter(
        (p) => Number(p.quantidade) <= Number(p.estoque_minimo)
      ).length;
      const parcVencidas = (parcVenc.data ?? []).filter(
        (p) => new Date(p.vencimento) < new Date(today)
      );
      const totalParcVenc = parcVencidas.reduce(
        (s, p) => s + (Number(p.valor) - Number(p.valor_pago)), 0
      );

      return {
        agendHoje: agendHoje.length,
        agendConfirmados: agendHoje.filter((a) => a.status === "confirmado").length,
        agendEmAtend: agendHoje.filter((a) => a.status === "em_atendimento").length,
        clientes: clientes.count ?? 0,
        pagPendTotal: totalPagPend,
        pagPendCount: (pagPend.data ?? []).length,
        estoqueBaixo: estoqueBaixoCount,
        parcVencidas: parcVencidas.length,
        parcVencTotal: totalParcVenc,
      };
    },
  });

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards: Kpi[] = [
    { label: "Agendamentos hoje", value: kpis?.agendHoje ?? "—", hint: `${kpis?.agendConfirmados ?? 0} confirmados`, icon: Calendar, to: "/agenda" },
    { label: "Em atendimento", value: kpis?.agendEmAtend ?? "—", icon: ClipboardList, to: "/atendimentos", tone: "gold" },
    { label: "Clientes cadastrados", value: kpis?.clientes ?? "—", icon: Users, to: "/clientes" },
    { label: "A receber (aberto)", value: kpis ? brl(kpis.pagPendTotal) : "—", hint: `${kpis?.pagPendCount ?? 0} pendências`, icon: Wallet, to: "/pagamentos-abertos", tone: kpis && kpis.pagPendTotal > 0 ? "warning" : "default" },
    { label: "Parcelas vencidas", value: kpis?.parcVencidas ?? "—", hint: kpis ? brl(kpis.parcVencTotal) : "", icon: AlertTriangle, to: "/compras", tone: kpis && kpis.parcVencidas > 0 ? "warning" : "default" },
    { label: "Estoque baixo", value: kpis?.estoqueBaixo ?? "—", icon: Package, to: "/estoque", tone: kpis && kpis.estoqueBaixo > 0 ? "warning" : "default" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Painel"
        description="O que precisa da sua atenção hoje."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const content = (
            <Card className={`transition hover:shadow-elegant hover:-translate-y-0.5 cursor-pointer h-full ${
              c.tone === "warning" ? "border-warning/40 bg-warning/5" :
              c.tone === "gold" ? "border-gold/40 bg-gold/5" : ""
            }`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardDescription className="text-xs uppercase tracking-wider">{c.label}</CardDescription>
                <c.icon className={`h-5 w-5 ${c.tone === "warning" ? "text-warning" : c.tone === "gold" ? "text-gold" : "text-primary"}`} />
              </CardHeader>
              <CardContent>
                <CardTitle className="font-display text-3xl font-semibold text-primary">{c.value}</CardTitle>
                {c.hint && <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>}
              </CardContent>
            </Card>
          );
          return c.to ? (
            <Link key={c.label} to={c.to as string} className="block">{content}</Link>
          ) : (
            <div key={c.label}>{content}</div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Clock className="h-5 w-5 text-primary"/>Próximos passos</CardTitle>
            <CardDescription>Comece cadastrando cliente e pet, e depois abra o primeiro agendamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link to="/clientes" className="block rounded-md border p-3 hover:bg-accent transition">
              → Cadastrar cliente e pet
            </Link>
            <Link to="/servicos" className="block rounded-md border p-3 hover:bg-accent transition">
              → Revisar tabela de serviços
            </Link>
            <Link to="/configuracoes" className="block rounded-md border p-3 hover:bg-accent transition">
              → Ajustar dados da empresa e taxa de leva-e-traz
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="h-5 w-5 text-gold"/>Diferenciais do sistema</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>• Ficha operacional do pet com alertas visuais</p>
            <p>• Serviço planejado x serviço executado</p>
            <p>• Registro de ocorrências vinculado ao histórico</p>
            <p>• Auditoria automática de toda alteração sensível</p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
