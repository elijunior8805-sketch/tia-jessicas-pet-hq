import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, KpiCard, Toolbar, EmptyState, StatusBadge } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Spa de Pet Tia Jéssica" },
      { name: "description", content: "Compras, fornecedores e parcelas a pagar." },
    ],
  }),
  component: ComprasPage,
});

type FormaPagamento = "pix" | "credito" | "debito" | "dinheiro" | "pendente" | "outras";
type ParcelaStatus = "pendente" | "pago" | "parcial" | "atrasado" | "cancelado";

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function addMonths(dateStr: string, months: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m - 1) + months, d);
  // se dia estourou o mês (ex.: 31 -> mês curto), JS já ajusta
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function toneForStatus(s: ParcelaStatus) {
  if (s === "pago") return "success";
  if (s === "atrasado") return "danger";
  if (s === "parcial") return "warning";
  if (s === "cancelado") return "muted";
  return "warning";
}

function ComprasPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "abertas" | "quitadas">("todas");
  const [novoOpen, setNovoOpen] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("*, fornecedores(nome), compras_parcelas(*)")
        .order("data_compra", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores", "ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-financeiras", "despesa"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []).filter((c) => c.tipo !== "receita");
    },
  });

  const { data: centros = [] } = useQuery({
    queryKey: ["centros-custo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (compras as any[]).filter((c) => {
      if (q) {
        const hay = `${c.fornecedores?.nome ?? ""} ${c.descricao ?? ""} ${c.numero_documento ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const parcs = (c.compras_parcelas ?? []) as any[];
      const abertas = parcs.some((p) => p.status !== "pago" && p.status !== "cancelado");
      if (filtroStatus === "abertas" && !abertas) return false;
      if (filtroStatus === "quitadas" && abertas) return false;
      return true;
    });
  }, [compras, busca, filtroStatus]);

  const kpis = useMemo(() => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    let mes = 0;
    let aVencer = 0;
    let atrasado = 0;
    const hoje = new Date().toISOString().slice(0, 10);
    for (const c of compras as any[]) {
      if ((c.data_compra ?? "") >= inicioMes) mes += Number(c.valor_total || 0);
      for (const p of (c.compras_parcelas ?? []) as any[]) {
        if (p.status === "pago" || p.status === "cancelado") continue;
        const restante = Math.max(0, Number(p.valor || 0) - Number(p.valor_pago || 0));
        if ((p.vencimento ?? "") < hoje) atrasado += restante;
        else aVencer += restante;
      }
    }
    return { mes, aVencer, atrasado };
  }, [compras]);

  const pagarParcela = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase
        .from("compras_parcelas")
        .update({
          status: "pago",
          valor_pago: p.valor,
          data_pagamento: new Date().toISOString().slice(0, 10),
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      toast.success("Parcela quitada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao quitar parcela"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("compras_parcelas").delete().eq("compra_id", id);
      const { error } = await supabase.from("compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      toast.success("Compra excluída.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir"),
  });

  return (
    <PageShell>
      <PageHeader
        title="Compras"
        description="Compras de insumos, fornecedores e controle de parcelas a pagar."
        icon={ShoppingCart}
        actions={
          <Button onClick={() => setNovoOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova compra
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Compras no mês" value={brl(kpis.mes)} icon={CircleDollarSign} accent="forest" />
        <KpiCard label="A vencer" value={brl(kpis.aVencer)} icon={CalendarDays} accent="gold" />
        <KpiCard label="Atrasadas" value={brl(kpis.atrasado)} icon={AlertTriangle} accent="terracotta" />
      </div>

      <Toolbar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por fornecedor, descrição ou documento…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="abertas">Com pendências</SelectItem>
            <SelectItem value="quitadas">Quitadas</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando compras…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma compra registrada"
          description="Registre a primeira compra para acompanhar o financeiro e as parcelas a pagar."
          action={
            <Button onClick={() => setNovoOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Registrar compra
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((c: any) => {
            const parcs = (c.compras_parcelas ?? []) as any[];
            const pagas = parcs.filter((p) => p.status === "pago").length;
            const totalPagas = parcs.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
            const isOpen = expandido === c.id;
            const status: ParcelaStatus =
              pagas === parcs.length && parcs.length > 0
                ? "pago"
                : parcs.some((p) => p.vencimento < new Date().toISOString().slice(0, 10) && p.status !== "pago")
                  ? "atrasado"
                  : "pendente";
            return (
              <Card key={c.id} className="overflow-hidden">
                <button
                  className="w-full text-left p-3 sm:p-4 flex items-start gap-3 hover:bg-muted/40"
                  onClick={() => setExpandido(isOpen ? null : c.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-primary truncate">
                        {c.fornecedores?.nome ?? "Sem fornecedor"}
                      </span>
                      <StatusBadge tone={toneForStatus(status)}>{status}</StatusBadge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.descricao ?? c.numero_documento ?? "Sem descrição"} · {fmtDate(c.data_compra)}
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">{brl(Number(c.valor_total))}</span>
                      <span className="text-muted-foreground">
                        {" "}· {parcs.length} {parcs.length === 1 ? "parcela" : "parcelas"} ({pagas} pagas · {brl(totalPagas)})
                      </span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-muted/20 p-3 sm:p-4 space-y-2">
                    {parcs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem parcelas.</p>
                    ) : (
                      <div className="space-y-2">
                        {parcs
                          .sort((a, b) => a.numero - b.numero)
                          .map((p) => {
                            const atrasada =
                              p.status !== "pago" &&
                              p.status !== "cancelado" &&
                              p.vencimento < new Date().toISOString().slice(0, 10);
                            const tone: ParcelaStatus = atrasada ? "atrasado" : (p.status as ParcelaStatus);
                            return (
                              <div
                                key={p.id}
                                className="flex flex-wrap items-center justify-between gap-2 bg-background rounded-lg border border-border p-2.5"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {p.numero}/{p.total_parcelas}
                                  </span>
                                  <StatusBadge tone={toneForStatus(tone)}>{tone}</StatusBadge>
                                  <span className="text-sm">venc. {fmtDate(p.vencimento)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium">{brl(Number(p.valor))}</span>
                                  {p.status !== "pago" && p.status !== "cancelado" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1"
                                      onClick={() => pagarParcela.mutate(p)}
                                      disabled={pagarParcela.isPending}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Quitar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Excluir esta compra e todas as parcelas?")) excluir.mutate(c.id);
                        }}
                      >
                        Excluir compra
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <NovaCompraDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        fornecedores={fornecedores as any}
        categorias={categorias as any}
        centros={centros as any}
        onCriado={() => qc.invalidateQueries({ queryKey: ["compras"] })}
      />
    </PageShell>
  );
}

function NovaCompraDialog({
  open,
  onOpenChange,
  fornecedores,
  categorias,
  centros,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedores: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
  onCriado: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [dataCompra, setDataCompra] = useState(() => new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [valorTotal, setValorTotal] = useState<string>("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [parcelas, setParcelas] = useState<number>(1);
  const [primeiroVenc, setPrimeiroVenc] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroId, setCentroId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  function reset() {
    setFornecedorId("");
    setDescricao("");
    setNumeroDoc("");
    setValorTotal("");
    setForma("pix");
    setParcelas(1);
    setPrimeiroVenc(new Date().toISOString().slice(0, 10));
    setCategoriaId("");
    setCentroId("");
    setObservacoes("");
  }

  async function salvar() {
    const valor = Number(valorTotal.replace(",", "."));
    if (!fornecedorId) return toast.error("Selecione o fornecedor.");
    if (!valor || valor <= 0) return toast.error("Informe um valor total válido.");
    if (parcelas < 1) return toast.error("Número de parcelas inválido.");
    setSalvando(true);
    try {
      const { data: compra, error } = await supabase
        .from("compras")
        .insert({
          fornecedor_id: fornecedorId,
          data_compra: dataCompra,
          descricao: descricao || null,
          numero_documento: numeroDoc || null,
          valor_total: valor,
          forma_pagamento: forma,
          parcelas,
          primeiro_vencimento: primeiroVenc,
          categoria_id: categoriaId || null,
          centro_custo_id: centroId || null,
          observacoes: observacoes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // gera parcelas iguais (última recebe o resto para bater o total)
      const base = Math.floor((valor / parcelas) * 100) / 100;
      const rows = Array.from({ length: parcelas }).map((_, i) => {
        const valorParcela = i === parcelas - 1 ? Number((valor - base * (parcelas - 1)).toFixed(2)) : base;
        return {
          compra_id: compra.id,
          numero: i + 1,
          total_parcelas: parcelas,
          valor: valorParcela,
          vencimento: addMonths(primeiroVenc, i),
          status: "pendente" as ParcelaStatus,
        };
      });
      const { error: errP } = await supabase.from("compras_parcelas").insert(rows);
      if (errP) throw errP;

      toast.success("Compra registrada.");
      onCriado();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar compra");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Nova compra
          </DialogTitle>
          <DialogDescription>
            Registre uma compra e gere automaticamente as parcelas a pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Fornecedor *</Label>
            {fornecedores.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Cadastre um fornecedor primeiro em <b>Fornecedores</b>.
              </p>
            ) : (
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label>Data da compra *</Label>
            <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
          </div>
          <div>
            <Label>Nº documento / NF</Label>
            <Input value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="NF-1234" />
          </div>

          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Shampoo hipoalergênico 5L" />
          </div>

          <div>
            <Label>Valor total *</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="outras">Outras</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Parcelas *</Label>
            <Input
              type="number"
              min={1}
              max={36}
              value={parcelas}
              onChange={(e) => setParcelas(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
            />
          </div>
          <div>
            <Label>Primeiro vencimento *</Label>
            <Input type="date" value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} />
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Centro de custo</Label>
            <Select value={centroId} onValueChange={setCentroId}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Registrar compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
