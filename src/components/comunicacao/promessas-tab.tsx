import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { HandCoins, CalendarClock, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { listarPromessas, salvarPromessa } from "@/lib/comunicacao-central.functions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const STATUS = [
  { v: "aguardando", label: "Aguardando" },
  { v: "cumprida", label: "Cumprida" },
  { v: "parcialmente_cumprida", label: "Parcialmente cumprida" },
  { v: "vencida", label: "Vencida" },
  { v: "renegociada", label: "Renegociada" },
  { v: "cancelada", label: "Cancelada" },
] as const;

function tone(status: string, data: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  if (status === "cumprida") return "ok";
  if (status === "cancelada") return "neutro";
  if (status === "vencida" || (status === "aguardando" && data < hoje)) return "critico";
  if (status === "aguardando" && data === hoje) return "alerta";
  return "neutro";
}

export function PromessasTab({ podeEditar = true }: { podeEditar?: boolean }) {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarPromessas);
  const salvarFn = useServerFn(salvarPromessa);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todas");

  const q = useQuery({
    queryKey: ["comunicacao", "promessas"],
    queryFn: () => listarFn(),
    refetchInterval: 120_000,
  });

  const salvarM = useMutation({
    mutationFn: (p: any) => salvarFn({ data: p }),
    onSuccess: () => {
      toast.success("Promessa atualizada.");
      qc.invalidateQueries({ queryKey: ["comunicacao"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar."),
  });

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return ((q.data as any[]) ?? []).filter((p) => {
      const nome = String(p.clientes?.nome ?? "").toLowerCase();
      if (t && !nome.includes(t)) return false;
      if (filtro === "todas") return true;
      if (filtro === "abertas") return p.status === "aguardando";
      return p.status === filtro;
    });
  }, [q.data, busca, filtro]);

  const kpis = useMemo(() => {
    const l = ((q.data as any[]) ?? []);
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      abertas: l.filter((p) => p.status === "aguardando").length,
      hoje: l.filter((p) => p.status === "aguardando" && p.data_prometida === hoje).length,
      vencidas: l.filter(
        (p) => p.status === "vencida" || (p.status === "aguardando" && p.data_prometida < hoje),
      ).length,
      valorAberto: l
        .filter((p) => p.status === "aguardando")
        .reduce((a, p) => a + Number(p.valor_prometido ?? 0), 0),
    };
  }, [q.data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Promessas em aberto</p>
          <p className="text-2xl font-semibold mt-1">{kpis.abertas}</p>
        </Card>
        <Card className="p-4 border-amber-200 bg-amber-50/40">
          <p className="text-xs text-muted-foreground">Vencem hoje</p>
          <p className="text-2xl font-semibold mt-1">{kpis.hoje}</p>
        </Card>
        <Card className="p-4 border-rose-200 bg-rose-50/40">
          <p className="text-xs text-muted-foreground">Vencidas</p>
          <p className="text-2xl font-semibold mt-1">{kpis.vencidas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Valor prometido em aberto</p>
          <p className="text-2xl font-semibold mt-1">{brl(kpis.valorAberto)}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por tutor…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="abertas">Somente em aberto</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : linhas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <HandCoins className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Nenhuma promessa de pagamento registrada com esses filtros.
        </Card>
      ) : (
        <div className="space-y-2">
          {linhas.map((p: any) => {
            const t = tone(p.status, p.data_prometida);
            const borda =
              t === "critico" ? "border-rose-200" : t === "alerta" ? "border-amber-200"
                : t === "ok" ? "border-emerald-200" : "border-border";
            return (
              <Card key={p.id} className={`p-4 ${borda}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{p.clientes?.nome ?? "Cliente"}</p>
                      <Badge variant={t === "critico" ? "destructive" : "secondary"}>
                        {STATUS.find((s) => s.v === p.status)?.label ?? p.status}
                      </Badge>
                      {t === "critico" ? <AlertTriangle className="h-4 w-4 text-rose-500" /> : null}
                      {t === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(p.data_prometida + "T00:00:00").toLocaleDateString("pt-BR")}
                      <span>·</span>
                      <strong className="text-foreground">{brl(Number(p.valor_prometido))}</strong>
                      {Number(p.valor_recebido) > 0 ? (
                        <span>· recebido {brl(Number(p.valor_recebido))}</span>
                      ) : null}
                    </p>
                    {p.observacoes ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.observacoes}</p>
                    ) : null}
                  </div>

                  {podeEditar ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={p.status}
                        onValueChange={(v) =>
                          salvarM.mutate({
                            id: p.id,
                            clienteId: p.cliente_id,
                            cobrancaId: p.cobranca_id,
                            valorPrometido: Number(p.valor_prometido),
                            dataPrometida: p.data_prometida,
                            formaPagamento: p.forma_pagamento,
                            observacoes: p.observacoes,
                            status: v,
                            valorRecebido: Number(p.valor_recebido ?? 0),
                          })
                        }
                      >
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS.map((s) => (
                            <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={salvarM.isPending || p.status === "cumprida"}
                        onClick={() =>
                          salvarM.mutate({
                            id: p.id,
                            clienteId: p.cliente_id,
                            cobrancaId: p.cobranca_id,
                            valorPrometido: Number(p.valor_prometido),
                            dataPrometida: p.data_prometida,
                            formaPagamento: p.forma_pagamento,
                            observacoes: p.observacoes,
                            status: "cumprida",
                            valorRecebido: Number(p.valor_prometido),
                          })
                        }
                      >
                        Marcar como paga
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
