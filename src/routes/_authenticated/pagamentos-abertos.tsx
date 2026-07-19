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
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);

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
    const fone = p.cliente_whatsapp.replace(/\D/g, "");
    const petTxt = p.pet_nome ? ` referente ao atendimento do ${p.pet_nome}` : "";
    const vencTxt = p.vencimento
      ? ` com vencimento em ${new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}`
      : "";
    const atrasoTxt = p.dias_atraso > 0 ? ` (em atraso há ${p.dias_atraso} dia(s))` : "";
    const msg =
      `Olá, ${p.cliente_nome}! Passando para lembrar do pagamento de ${brl(p.saldo)}${petTxt}${vencTxt}${atrasoTxt}. ` +
      `Se já efetuou o pagamento, por favor desconsidere. Obrigada! 🐾`;
    const url = `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    registrarMut.mutate({ pagamentoId: p.id, observacao: "Link WhatsApp aberto" });
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
