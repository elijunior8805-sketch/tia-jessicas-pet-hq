import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { carregarVerificacao } from "@/lib/verificacao.functions";
import { PageShell, PageHeader, SectionCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, RefreshCw, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verificacao")({
  component: VerificacaoPage,
  head: () => ({
    meta: [
      { title: "Verificação de totais — Spa de Pet Tia Jéssica" },
      { name: "description", content: "Compara automaticamente os totais entre Painel, Financeiro e Relatórios e destaca divergências." },
      { property: "og:title", content: "Verificação de totais — Spa de Pet Tia Jéssica" },
      { property: "og:description", content: "Central de conferência de indicadores entre as telas do ERP." },
    ],
  }),
});

const brl = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toLocalDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return toLocalDay(d);
}
function today() {
  return toLocalDay(new Date());
}

function VerificacaoPage() {
  const [de, setDe] = useState(firstOfMonth());
  const [ate, setAte] = useState(today());
  const carregar = useServerFn(carregarVerificacao);

  const query = useQuery({
    queryKey: ["verificacao", de, ate],
    queryFn: () => carregar({ data: { de, ate } }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const data = query.data;
  const divergentes = useMemo(
    () => (data?.divergencias ?? []).filter((d) => !d.ok),
    [data],
  );
  const tudoOk = data && divergentes.length === 0;

  const fmt = (metrica: string, v: number) =>
    metrica.startsWith("Atend") ? String(Math.round(v)) : brl(v);

  return (
    <PageShell>
      <PageHeader
        title="Verificação de totais"
        description="Comparação automática entre Painel, Financeiro e Relatórios. Destaca divergências acima de R$ 0,01."
        icon={ClipboardCheck}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${query.isFetching ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
        }
      />

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className="w-[160px]" />
          </div>
          <div className="ml-auto">
            {data && (
              tudoOk ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Tudo conferido
                </Badge>
              ) : (
                <Badge className="bg-[var(--color-terracota,#c1440e)] hover:bg-[var(--color-terracota,#c1440e)] text-white gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {divergentes.length} divergência(s)
                </Badge>
              )
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Resumo por fonte" description="Cada tela do sistema, com os mesmos filtros de período.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fonte</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Finalizados</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
              <TableHead className="text-right">Leva e Traz</TableHead>
              <TableHead className="text-right">Descontos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.fontes ?? []).map((f) => (
              <TableRow key={f.fonte}>
                <TableCell className="font-medium">{f.label}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(f.faturamento)}</TableCell>
                <TableCell className="text-right tabular-nums">{f.atendimentos_finalizados}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(f.ticket_medio)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(f.taxa_leva_traz)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(f.descontos)}</TableCell>
              </TableRow>
            ))}
            {!data && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {query.isFetching ? "Calculando…" : "Sem dados"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Comparação por métrica" description="Linhas em vermelho indicam divergência entre telas.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Métrica</TableHead>
              {(data?.fontes ?? []).map((f) => (
                <TableHead key={f.fonte} className="text-right">{f.label}</TableHead>
              ))}
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.divergencias ?? []).map((d) => {
              const labels = (data?.fontes ?? []).map((f) => f.label);
              return (
                <TableRow
                  key={d.metrica}
                  className={!d.ok ? "bg-[var(--color-terracota,#c1440e)]/10" : ""}
                >
                  <TableCell className="font-medium">{d.metrica}</TableCell>
                  {labels.map((l) => (
                    <TableCell key={l} className="text-right tabular-nums">
                      {fmt(d.metrica, d.valores[l] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmt(d.metrica, d.diferenca)}
                  </TableCell>
                  <TableCell className="text-right">
                    {d.ok ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">OK</Badge>
                    ) : (
                      <Badge className="bg-[var(--color-terracota,#c1440e)] hover:bg-[var(--color-terracota,#c1440e)] text-white">
                        Divergente
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Conferência por atendimento"
        description={`União dos atendimentos considerados pelas três fontes (${data?.atendimentos_conferencia.length ?? 0}).`}
      >
        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Executado</TableHead>
                <TableHead className="text-right">Leva e Traz</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.atendimentos_conferencia ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{r.dia}</TableCell>
                  <TableCell className="truncate max-w-[220px]">{r.cliente}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.valor_executado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.taxa_leva_traz)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.desconto)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(r.total)}</TableCell>
                </TableRow>
              ))}
              {data && data.atendimentos_conferencia.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Sem atendimentos executados no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </PageShell>
  );
}
