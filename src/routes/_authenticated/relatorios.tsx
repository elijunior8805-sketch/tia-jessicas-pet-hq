import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  carregarIndicadores,
  listarLinhasExport,
  type LinhaExport,
} from "@/lib/relatorios.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { Download, TrendingUp, Users, Wallet, AlertCircle, Sparkles, PawPrint, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { RelatoriosAgendamentos } from "@/components/relatorios-agendamentos";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

const brl = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return iso(d);
}
function today() {
  return iso(new Date());
}

// Proteção contra CSV Injection: prefixa células iniciadas por = + - @ com apóstrofo
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
  });

  const ind = query.data?.indicadores;
  const serie = query.data?.serie ?? [];
  const ranking = query.data?.rankingClientes ?? [];
  const servicos = query.data?.servicos ?? [];

  const preset = (dias: number) => {
    const a = new Date();
    const d = new Date();
    d.setDate(a.getDate() - dias + 1);
    setDe(iso(d));
    setAte(iso(a));
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
    [serie]
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-primary">Relatórios</h1>
          <p className="text-muted-foreground">Indicadores gerenciais e exportações</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className="w-[150px]" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => preset(7)}>7d</Button>
            <Button size="sm" variant="outline" onClick={() => preset(30)}>30d</Button>
            <Button size="sm" variant="outline" onClick={() => { setDe(firstOfMonth()); setAte(today()); }}>Mês</Button>
          </div>
          <Button onClick={exportarCsv} className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<CircleDollarSign className="w-4 h-4" />} label="Faturamento" value={brl(ind?.faturamento ?? 0)} sub={`Planejado ${brl(ind?.faturamento_planejado ?? 0)}`} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Ticket médio" value={brl(ind?.ticket_medio ?? 0)} sub={`${ind?.atendimentos_finalizados ?? 0} atendimentos`} />
        <Kpi icon={<Users className="w-4 h-4" />} label="Clientes atendidos" value={String(ind?.clientes_atendidos ?? 0)} sub={`${ind?.novos_clientes ?? 0} novos no período`} />
        <Kpi icon={<Wallet className="w-4 h-4" />} label="A receber" value={brl(ind?.a_receber ?? 0)} sub={`${brl(ind?.em_atraso ?? 0)} em atraso`} destaque={(ind?.em_atraso ?? 0) > 0} />
        <Kpi icon={<Sparkles className="w-4 h-4" />} label="Leva e traz" value={brl(ind?.taxa_leva_traz_total ?? 0)} />
        <Kpi icon={<AlertCircle className="w-4 h-4" />} label="Descontos concedidos" value={brl(ind?.descontos_total ?? 0)} />
        <Kpi icon={<PawPrint className="w-4 h-4" />} label="Cancelados / Não compareceu" value={String(ind?.atendimentos_cancelados ?? 0)} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Conversão executado" value={
          ind && ind.faturamento_planejado > 0
            ? `${((ind.faturamento / ind.faturamento_planejado) * 100).toFixed(1)}%`
            : "—"
        } />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="font-serif">Faturamento por dia</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => brl(v).replace("R$", "").trim()} />
                  <Tooltip formatter={(v: any) => brl(Number(v))} labelFormatter={(l) => `Dia ${l}`} />
                  <Line type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif">Atendimentos por dia</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="atendimentos" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="font-serif">Top clientes</CardTitle></CardHeader>
          <CardContent>
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
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
                {ranking.map((r) => (
                  <TableRow key={r.nome}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right">{brl(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif">Serviços mais executados</CardTitle></CardHeader>
          <CardContent>
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
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                )}
                {servicos.map((s) => (
                  <TableRow key={s.nome}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-right">{s.qtd}</TableCell>
                    <TableCell className="text-right">{brl(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <RelatoriosAgendamentos />
    </div>
  );
}

function Kpi({ icon, label, value, sub, destaque }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; destaque?: boolean;
}) {
  return (
    <Card className={destaque ? "border-destructive/40" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}<Label className="text-xs">{label}</Label>
        </div>
        <div className={`text-xl md:text-2xl font-serif font-semibold mt-1 ${destaque ? "text-destructive" : ""}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
