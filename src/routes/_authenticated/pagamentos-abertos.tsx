import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarPagamentosAbertos,
  registrarContatoCobranca,
  registrarContatoCobrancaLote,
  type PagamentoAbertoDTO,
  type CobrancaLoteItem,
} from "@/lib/pagamentos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, Calendar, CheckCircle2, ExternalLink, MessageCircle, Search, TrendingDown, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppComposer, useWhatsAppComposer } from "@/components/whatsapp-composer";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { abrirWhatsApp } from "@/lib/whatsapp";




export const Route = createFileRoute("/_authenticated/pagamentos-abertos")({
  component: PagamentosAbertosPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusBadge(status: string, diasAtraso: number) {
  if (diasAtraso > 0) {
    return <Badge variant="destructive">Atrasado {diasAtraso}d</Badge>;
  }
  if (diasAtraso === 0) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Vence hoje</Badge>;
  if (status === "parcial") return <Badge variant="secondary">Parcial</Badge>;
  return <Badge variant="outline">A vencer</Badge>;
}

function PagamentosAbertosPage() {
  const listar = useServerFn(listarPagamentosAbertos);
  const registrar = useServerFn(registrarContatoCobranca);
  const registrarLote = useServerFn(registrarContatoCobrancaLote);
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteAberto, setLoteAberto] = useState(false);
  const [loteResultado, setLoteResultado] = useState<CobrancaLoteItem[] | null>(null);
  const composer = useWhatsAppComposer();


  const query = useQuery({
    queryKey: ["pagamentos-abertos", { somenteAtrasados }],
    queryFn: () => listar({ data: { somenteAtrasados, limit: 200 } }),
  });

  const registrarMut = useMutation({
    mutationFn: (vars: { pagamentoId: string; observacao?: string }) =>
      registrar({ data: { pagamentoId: vars.pagamentoId, canal: "whatsapp", observacao: vars.observacao } }),
    onSuccess: () => {
      toast.success("Contato registrado");
      qc.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar"),
  });

  const loteMut = useMutation({
    mutationFn: (ids: string[]) => registrarLote({ data: { pagamentoIds: ids } }),
    onSuccess: (r) => {
      setLoteResultado(r.resultados);
      toast.success(`${r.totalOk} cobrança(s) registrada(s)${r.totalFalha ? `, ${r.totalFalha} falha(s)` : ""}`);
      setSelecionados(new Set());
      qc.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na cobrança em lote"),
  });

  const itens = query.data?.itens ?? [];
  const resumo = query.data?.resumo;


  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        i.cliente_nome.toLowerCase().includes(q) ||
        (i.pet_nome ?? "").toLowerCase().includes(q),
    );
  }, [itens, busca]);

  function abrirWhats(p: PagamentoAbertoDTO) {
    if (!p.cliente_whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    const dataAt = (p as any).data_atendimento
      ? new Date((p as any).data_atendimento + "T00:00:00").toLocaleDateString("pt-BR")
      : "";
    const venc = p.vencimento
      ? new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
      : "";
    const tipo = p.dias_atraso > 0 ? "cobranca_vencida" : "lembrete_pagamento";
    const mensagem = renderTemplate(tipo, {
      tutor: p.cliente_nome,
      pet: p.pet_nome ?? "seu pet",
      valor: p.saldo.toFixed(2).replace(".", ","),
      data: dataAt,
      vencimento: venc,
      pix: (p as any).pix_chave ?? null,
    });
    composer.open({
      tipo,
      destinatario: p.cliente_nome,
      telefone: p.cliente_whatsapp,
      mensagem,
      motivo: p.dias_atraso > 0 ? `Cobrança de valor vencido (${p.dias_atraso}d)` : "Lembrete de pagamento",
      pagamento_id: p.id,
      cliente_id: (p as any).cliente_id ?? null,
    });
  }


  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight">
            Pagamentos em Aberto
          </h1>
          <p className="text-muted-foreground text-sm">
            Contas a receber com destaque para atrasos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={somenteAtrasados ? "default" : "outline"}
            onClick={() => setSomenteAtrasados((v) => !v)}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            {somenteAtrasados ? "Mostrando atrasados" : "Somente atrasados"}
          </Button>
          <Button
            disabled={selecionados.size === 0 || loteMut.isPending}
            onClick={() => {
              setLoteAberto(true);
              setLoteResultado(null);
              loteMut.mutate(Array.from(selecionados));
            }}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Cobrar selecionados ({selecionados.size})
          </Button>
        </div>

      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Wallet className="w-4 h-4" />} label="Total em aberto"
          value={brl(resumo?.total_aberto ?? 0)} sub={`${resumo?.qtd_aberto ?? 0} parcelas`} />
        <KpiCard icon={<TrendingDown className="w-4 h-4 text-destructive" />} label="Total atrasado"
          value={brl(resumo?.total_atrasado ?? 0)} sub={`${resumo?.qtd_atrasado ?? 0} parcelas`} destaque />
        <KpiCard icon={<Calendar className="w-4 h-4" />} label="Vencem hoje"
          value={String(resumo?.vence_hoje ?? 0)} sub="parcelas" />
        <KpiCard icon={<Calendar className="w-4 h-4" />} label="Próx. 7 dias"
          value={String(resumo?.vence_7d ?? 0)} sub="parcelas" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
            <CardTitle className="text-lg">Parcelas</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ou pet"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando…</div>
          ) : query.isError ? (
            <div className="py-10 text-center text-destructive">
              Não foi possível carregar. <Button variant="link" onClick={() => query.refetch()}>Tentar novamente</Button>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Nenhuma parcela em aberto. 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filtrados.length > 0 &&
                          filtrados.every((p) => selecionados.has(p.id))
                        }
                        onCheckedChange={(v) => {
                          const next = new Set(selecionados);
                          if (v) filtrados.forEach((p) => next.add(p.id));
                          else filtrados.forEach((p) => next.delete(p.id));
                          setSelecionados(next);
                        }}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Cliente / Pet</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((p) => (
                    <TableRow key={p.id} className={p.dias_atraso > 0 ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selecionados.has(p.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selecionados);
                            if (v) next.add(p.id);
                            else next.delete(p.id);
                            setSelecionados(next);
                          }}
                          aria-label={`Selecionar ${p.cliente_nome}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.cliente_nome}</div>
                        {p.pet_nome && (
                          <div className="text-xs text-muted-foreground">🐾 {p.pet_nome}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        {p.vencimento
                          ? new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(p.status, p.dias_atraso)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {brl(p.saldo)}
                        {p.valor_pago > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">
                            pago {brl(p.valor_pago)} de {brl(p.valor_total)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!p.cliente_whatsapp || registrarMut.isPending}
                          onClick={() => abrirWhats(p)}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Cobrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={loteAberto} onOpenChange={setLoteAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Cobrança em lote</DialogTitle>
            <DialogDescription>
              {loteMut.isPending
                ? "Registrando cobranças no servidor…"
                : loteResultado
                  ? `${loteResultado.filter((r) => r.registrado).length} registrada(s) · abra o WhatsApp para cada cliente.`
                  : "Aguarde…"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {(loteResultado ?? []).map((r) => (
              <div
                key={r.pagamentoId}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  r.registrado ? "bg-card" : "bg-destructive/5 border-destructive/30"
                }`}
              >
                {r.registrado ? (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.cliente_nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.pet_nome ? `${r.pet_nome} · ` : ""}
                    {brl(r.saldo)}
                    {r.dias_atraso > 0 ? ` · atraso ${r.dias_atraso}d` : ""}
                    {r.motivo ? ` · ${r.motivo}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!r.wa_url || !r.registrado}
                  onClick={() => r.wa_url && abrirWhatsApp(r.wa_url)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> WhatsApp
                </Button>
              </div>
            ))}
            {loteMut.isPending && (
              <div className="text-center text-muted-foreground py-6">Processando…</div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={!loteResultado || loteResultado.every((r) => !r.wa_url || !r.registrado)}
              onClick={() => {
                let i = 0;
                (loteResultado ?? [])
                  .filter((r) => r.registrado && r.wa_url)
                  .forEach((r) => {
                    setTimeout(() => abrirWhatsApp(r.wa_url!), i * 400);
                    i++;
                  });
              }}
            >
              Abrir todos os WhatsApp
            </Button>
            <Button onClick={() => setLoteAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppComposer
        open={composer.state.open}
        onOpenChange={composer.setOpen}
        payload={composer.state.payload}
        onSent={() => qc.invalidateQueries({ queryKey: ["pagamentos-abertos"] })}
      />
    </div>
  );
}



function KpiCard({
  icon, label, value, sub, destaque,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-destructive/40" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <Label className="text-xs">{label}</Label>
        </div>
        <div className={`text-2xl font-serif font-semibold mt-1 ${destaque ? "text-destructive" : ""}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
