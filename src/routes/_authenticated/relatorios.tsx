import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  carregarIndicadores,
  listarLinhasExport,
  type LinhaExport,
} from "@/lib/relatorios.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import {
  Download, TrendingUp, Users, Wallet, AlertCircle, Sparkles, PawPrint,
  CircleDollarSign, BarChart3, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { RelatoriosAgendamentos } from "@/components/relatorios-agendamentos";
import { PageShell, PageHeader, KpiCard, SectionCard } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
  head: () => ({
    meta: [
      { title: "Relatórios — Spa de Pet Tia Jéssica" },
      { name: "description", content: "Indicadores gerenciais, gráficos e exportações do Spa de Pet Tia Jéssica." },
      { property: "og:title", content: "Relatórios — Spa de Pet Tia Jéssica" },
      { property: "og:description", content: "Painel de indicadores financeiros, ranking de clientes e serviços." },
    ],
  }),
});

const brl = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toLocalDay(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}
function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return toLocalDay(d);
}
function today() {
  return toLocalDay(new Date());
}

// Proteção contra CSV Injection
function safeCsvCell(v: unknown): string {
  const raw = v === null || v === undefined ? "" : String(v);
  const escaped = raw.replace(/"/g, '""');
  const needsQuote = /[",;\n\r]/.test(raw);
  const dangerous = /^[=+\-@\t\r]/.test(raw);
  const cell = dangerous ? `'${escaped}` : escaped;
  return needsQuote ? `"${cell}"` : cell;
}

function toCsv(rows: LinhaExport[]): string {
  const header = [
    "Data", "Cliente", "Pet", "Serviços",
    "Valor planejado", "Valor executado", "Desconto",
    "Taxa leva e traz", "Pagamento",
  ];
  const linhas = rows.map((r) => [
    r.data, r.cliente, r.pet, r.servicos,
    r.valor_planejado.toFixed(2).replace(".", ","),
    r.valor_executado.toFixed(2).replace(".", ","),
    r.desconto.toFixed(2).replace(".", ","),
    r.taxa_leva_traz.toFixed(2).replace(".", ","),
    r.pagamento_status,
  ]);
  return [header, ...linhas]
    .map((row) => row.map(safeCsvCell).join(";"))
    .join("\r\n");
}

function downloadFile(nome: string, conteudo: string, mime: string) {
  const seguro = nome.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const blob = new Blob(["\uFEFF" + conteudo], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = seguro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RelatoriosPage() {
  const [de, setDe] = useState<string>(firstOfMonth());
  const [ate, setAte] = useState<string>(today());
  const carregar = useServerFn(carregarIndicadores);
  const listar = useServerFn(listarLinhasExport);

  const query = useQuery({
    queryKey: ["relatorios", de, ate],
    queryFn: () => carregar({ data: { de, ate } }),
    staleTime: 0,
  });

  const ind = query.data?.indicadores;
  const serie = query.data?.serie ?? [];
  const ranking = query.data?.rankingClientes ?? [];
  const servicos = query.data?.servicos ?? [];

  const presetDias = (dias: number) => {
    const a = new Date();
    const d = new Date();
    d.setDate(a.getDate() - dias + 1);
    setDe(toLocalDay(d));
    setAte(toLocalDay(a));
  };
  const presetHoje = () => {
    const h = today();
    setDe(h);
    setAte(h);
  };
  const presetMes = () => {
    setDe(firstOfMonth());
    setAte(today());
  };
  const presetAno = () => {
    const y = new Date().getFullYear();
    setDe(`${y}-01-01`);
    setAte(today());
  };

  const exportarCsv = async () => {
    try {
      const r = await listar({ data: { de, ate } });
      if (!r.linhas.length) {
        toast.info("Nenhuma linha para exportar no período");
        return;
      }
      downloadFile(`relatorio_${de}_a_${ate}.csv`, toCsv(r.linhas), "text/csv");
      toast.success(`Exportado ${r.linhas.length} atendimento(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    }
  };

  const chartData = useMemo(
    () => serie.map((s) => ({ ...s, label: s.dia.slice(5) })),
    [serie],
  );

  const conversao = ind && ind.faturamento_planejado > 0
    ? `${((ind.faturamento / ind.faturamento_planejado) * 100).toFixed(1)}%`
    : "—";

  return (
    <PageShell>
      <PageHeader
        title="Relatórios"
        description="Indicadores gerenciais, ranking e exportações do período selecionado."
        icon={BarChart3}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${query.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={exportarCsv}
              className="bg-[var(--color-gold)] text-primary hover:bg-[var(--color-gold)]/90"
            >
              <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
            </Button>
          </>
        }
      />

      {/* Filtros de período */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={de}
              max={ate}
              onChange={(e) => setDe(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => setAte(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={presetHoje}>Hoje</Button>
            <Button size="sm" variant="outline" onClick={() => presetDias(7)}>7d</Button>
            <Button size="sm" variant="outline" onClick={() => presetDias(30)}>30d</Button>
            <Button size="sm" variant="outline" onClick={() => presetDias(90)}>90d</Button>
            <Button size="sm" variant="outline" onClick={presetMes}>Mês</Button>
            <Button size="sm" variant="outline" onClick={presetAno}>Ano</Button>
          </div>
          {query.isFetching && (
            <div className="text-xs text-muted-foreground ml-auto flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" /> Atualizando indicadores…
            </div>
          )}
        </div>
      </SectionCard>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={CircleDollarSign}
          label="Faturamento"
          value={brl(ind?.faturamento ?? 0)}
          hint={`Planejado ${brl(ind?.faturamento_planejado ?? 0)}`}
          accent="forest"
        />
        <KpiCard
          icon={TrendingUp}
          label="Ticket médio"
          value={brl(ind?.ticket_medio ?? 0)}
          hint={`${ind?.atendimentos_finalizados ?? 0} finalizados`}
          accent="gold"
        />
        <KpiCard
          icon={Users}
          label="Clientes atendidos"
          value={String(ind?.clientes_atendidos ?? 0)}
          hint={`${ind?.novos_clientes ?? 0} novos no período`}
          accent="petrol"
        />
        <KpiCard
          icon={Wallet}
          label="A receber"
          value={brl(ind?.a_receber ?? 0)}
          hint={`${brl(ind?.em_atraso ?? 0)} em atraso · snapshot atual`}
          accent={(ind?.em_atraso ?? 0) > 0 ? "terracotta" : "sage"}
        />
        <KpiCard
          icon={Sparkles}
          label="Leva e traz"
          value={brl(ind?.taxa_leva_traz_total ?? 0)}
          hint="Taxas cobradas nos executados"
          accent="emerald"
        />
        <KpiCard
          icon={AlertCircle}
          label="Descontos concedidos"
          value={brl(ind?.descontos_total ?? 0)}
          hint="Somente em atendimentos executados"
          accent="terracotta"
        />
        <KpiCard
          icon={PawPrint}
          label="Cancelados / não compareceu"
          value={String(ind?.atendimentos_cancelados ?? 0)}
          hint="Agendamentos do período"
          accent="sage"
        />
        <KpiCard
          icon={TrendingUp}
          label="Conversão executado"
          value={conversao}
          hint="Faturado ÷ planejado"
          accent="gold"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <SectionCard title="Faturamento por dia" icon={CircleDollarSign}>
          <div className="h-[300px]">
            {chartData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Sem dados no período selecionado
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} stroke="currentColor" opacity={0.6} />
                  <YAxis
                    fontSize={12}
                    stroke="currentColor"
                    opacity={0.6}
                    tickFormatter={(v) => brl(v).replace("R$", "").trim()}
                  />
                  <Tooltip
                    formatter={(v: any) => brl(Number(v))}
                    labelFormatter={(l) => `Dia ${l}`}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="faturamento"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--color-gold)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Atendimentos por dia" icon={BarChart3}>
          <div className="h-[300px]">
            {chartData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Sem dados no período selecionado
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} stroke="currentColor" opacity={0.6} />
                  <YAxis fontSize={12} stroke="currentColor" opacity={0.6} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="atendimentos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Top clientes" icon={Users} description="Ranking pelo total executado no período">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Atend.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
              {ranking.map((r, i) => (
                <TableRow key={`${r.nome}-${i}`}>
                  <TableCell className="font-medium truncate max-w-[220px]">{r.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qtd}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Serviços mais executados" icon={PawPrint} description="Ordenado por quantidade">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
              {servicos.map((s, i) => (
                <TableRow key={`${s.nome}-${i}`}>
                  <TableCell className="font-medium truncate max-w-[220px]">{s.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.qtd}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(s.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      <RelatoriosAgendamentos />
    </PageShell>
  );
}
