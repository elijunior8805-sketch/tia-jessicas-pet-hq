import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, KpiCard, StatusBadge, Toolbar, EmptyState } from "@/components/page-shell";
import { Package, Plus, Search, AlertTriangle, TrendingUp, TrendingDown, Settings2, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { JessiEstoqueCopilot } from "@/components/estoque/JessiEstoqueCopilot";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: EstoquePage,
});

type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  quantidade: number;
  estoque_minimo: number;
  custo_medio: number;
  fornecedor_id: string | null;
  ativo: boolean;
};

type Fornecedor = { id: string; nome: string };

function EstoquePage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [apenasBaixos, setApenasBaixos] = useState(false);
  const [dialogProduto, setDialogProduto] = useState<Produto | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [movProduto, setMovProduto] = useState<Produto | null>(null);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_estoque")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const categorias = useMemo(() => {
    const s = new Set<string>();
    produtos.forEach((p) => p.categoria && s.add(p.categoria));
    return Array.from(s).sort();
  }, [produtos]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return produtos.filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q) && !(p.categoria || "").toLowerCase().includes(q)) return false;
      if (filtroCategoria !== "todas" && p.categoria !== filtroCategoria) return false;
      if (apenasBaixos && Number(p.quantidade) > Number(p.estoque_minimo)) return false;
      return true;
    });
  }, [produtos, busca, filtroCategoria, apenasBaixos]);

  const kpis = useMemo(() => {
    const total = produtos.length;
    const baixos = produtos.filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;
    const zerados = produtos.filter((p) => Number(p.quantidade) <= 0).length;
    const valor = produtos.reduce((acc, p) => acc + Number(p.quantidade) * Number(p.custo_medio), 0);
    return { total, baixos, zerados, valor };
  }, [produtos]);

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos_estoque").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto arquivado");
      qc.invalidateQueries({ queryKey: ["produtos-estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Estoque"
        description="Produtos, saldos e alertas de reposição."
        icon={Package}
        actions={
          <Button onClick={() => setNovoOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        }
      />

      {/* Copiloto de Inteligência e Reposição de Estoque da Jessi */}
      <JessiEstoqueCopilot
        produtos={produtos}
        onFiltrarCriticos={() => setApenasBaixos(true)}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Produtos ativos" value={kpis.total} icon={Package} accent="forest" />
        <KpiCard
          label="Abaixo do mínimo"
          value={kpis.baixos}
          icon={AlertTriangle}
          accent={kpis.baixos > 0 ? "terracotta" : "sage"}
          hint={kpis.baixos > 0 ? "Reposição necessária" : "Tudo em ordem"}
        />
        <KpiCard label="Zerados" value={kpis.zerados} icon={TrendingDown} accent="terracotta" />
        <KpiCard
          label="Valor em estoque"
          value={kpis.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          icon={TrendingUp}
          accent="gold"
        />
      </div>

      <Toolbar>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto ou categoria..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={apenasBaixos ? "default" : "outline"}
          onClick={() => setApenasBaixos((v) => !v)}
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          {apenasBaixos ? "Mostrando baixos" : "Só baixos"}
        </Button>
      </Toolbar>

      {isLoading ? (
        <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description={produtos.length === 0 ? "Cadastre o primeiro produto para começar a controlar o estoque." : "Ajuste os filtros ou cadastre um novo produto."}
          action={
            <Button onClick={() => setNovoOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          }
        />
      ) : (
        <div className="card-premium overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-right px-4 py-3">Saldo</th>
                  <th className="text-right px-4 py-3">Mínimo</th>
                  <th className="text-right px-4 py-3">Custo médio</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const q = Number(p.quantidade);
                  const min = Number(p.estoque_minimo);
                  const status: { tone: "danger" | "warning" | "success"; label: string } =
                    q <= 0
                      ? { tone: "danger", label: "Zerado" }
                      : q <= min
                        ? { tone: "warning", label: "Repor" }
                        : { tone: "success", label: "OK" };
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.categoria || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {q.toLocaleString("pt-BR")} {p.unidade}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {min.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {Number(p.custo_medio).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setMovProduto(p)} title="Movimentar">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDialogProduto(p)} title="Editar">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirm(`Arquivar "${p.nome}"?`) && excluir.mutate(p.id)}
                            title="Arquivar"
                          >
                            <Trash2 className="h-4 w-4 text-[var(--color-terracotta)]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {filtrados.map((p) => {
              const q = Number(p.quantidade);
              const min = Number(p.estoque_minimo);
              const status: { tone: "danger" | "warning" | "success"; label: string } =
                q <= 0 ? { tone: "danger", label: "Zerado" } : q <= min ? { tone: "warning", label: "Repor" } : { tone: "success", label: "OK" };
              return (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">{p.categoria || "Sem categoria"}</div>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Saldo</div>
                      <div className="tabular-nums font-medium">{q.toLocaleString("pt-BR")} {p.unidade}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Mínimo</div>
                      <div className="tabular-nums">{min.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Custo</div>
                      <div className="tabular-nums">
                        {Number(p.custo_medio).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setMovProduto(p)}>
                      <Settings2 className="h-4 w-4 mr-1" /> Movimentar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialogProduto(p)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ProdutoDialog
        open={novoOpen || !!dialogProduto}
        produto={dialogProduto}
        fornecedores={fornecedores}
        onClose={() => {
          setNovoOpen(false);
          setDialogProduto(null);
        }}
      />
      <MovimentoDialog produto={movProduto} onClose={() => setMovProduto(null)} />
    </PageShell>
  );
}

function ProdutoDialog({
  open,
  produto,
  fornecedores,
  onClose,
}: {
  open: boolean;
  produto: Produto | null;
  fornecedores: Fornecedor[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Produto>>({});

  useMemo(() => {
    if (open) {
      setForm(
        produto ?? {
          nome: "",
          categoria: "",
          unidade: "un",
          quantidade: 0,
          estoque_minimo: 0,
          custo_medio: 0,
          fornecedor_id: null,
        },
      );
    }
  }, [open, produto]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: (form.nome || "").trim(),
        categoria: form.categoria || null,
        unidade: form.unidade || "un",
        quantidade: Number(form.quantidade) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
        custo_medio: Number(form.custo_medio) || 0,
        fornecedor_id: form.fornecedor_id || null,
      };
      if (!payload.nome) throw new Error("Informe o nome do produto");
      if (produto?.id) {
        const { error } = await supabase.from("produtos_estoque").update(payload).eq("id", produto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos_estoque").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(produto ? "Produto atualizado" : "Produto criado");
      qc.invalidateQueries({ queryKey: ["produtos-estoque"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Input
                value={form.categoria || ""}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ex.: Shampoo, Higiene"
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input
                value={form.unidade || "un"}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                placeholder="un, ml, kg"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Saldo</Label>
              <Input
                type="number"
                step="0.001"
                value={form.quantidade ?? 0}
                onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                disabled={!!produto}
              />
            </div>
            <div>
              <Label>Mínimo</Label>
              <Input
                type="number"
                step="0.001"
                value={form.estoque_minimo ?? 0}
                onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Custo médio</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custo_medio ?? 0}
                onChange={(e) => setForm({ ...form, custo_medio: Number(e.target.value) })}
              />
            </div>
          </div>
          {produto && (
            <p className="text-xs text-muted-foreground">
              Para alterar o saldo, use "Movimentar" (entrada, saída ou ajuste) para manter o histórico.
            </p>
          )}
          <div>
            <Label>Fornecedor</Label>
            <Select
              value={form.fornecedor_id || "nenhum"}
              onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "nenhum" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovimentoDialog({ produto, onClose }: { produto: Produto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [custo, setCusto] = useState<number>(0);
  const [obs, setObs] = useState("");

  const registrar = useMutation({
    mutationFn: async () => {
      if (!produto) throw new Error("Produto inválido");
      const qtd = Number(quantidade);
      if (!qtd || qtd <= 0) throw new Error("Informe uma quantidade maior que zero");

      const saldoAtual = Number(produto.quantidade);
      let novoSaldo = saldoAtual;
      let novoCusto = Number(produto.custo_medio);

      if (tipo === "entrada") {
        novoSaldo = saldoAtual + qtd;
        if (custo > 0) {
          // Custo médio ponderado
          const totalAtual = saldoAtual * novoCusto;
          const totalEntrada = qtd * custo;
          novoCusto = novoSaldo > 0 ? (totalAtual + totalEntrada) / novoSaldo : custo;
        }
      } else if (tipo === "saida") {
        novoSaldo = saldoAtual - qtd;
        if (novoSaldo < 0) throw new Error("Saldo insuficiente");
      } else {
        novoSaldo = qtd; // ajuste = saldo real
      }

      const { error: e1 } = await supabase.from("movimentos_estoque").insert({
        produto_id: produto.id,
        tipo,
        quantidade: tipo === "ajuste" ? qtd - saldoAtual : qtd,
        custo_unitario: custo || null,
        observacoes: obs || null,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("produtos_estoque")
        .update({ quantidade: novoSaldo, custo_medio: novoCusto })
        .eq("id", produto.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Movimento registrado");
      qc.invalidateQueries({ queryKey: ["produtos-estoque"] });
      setQuantidade(0);
      setCusto(0);
      setObs("");
      setTipo("entrada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!produto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar estoque</DialogTitle>
        </DialogHeader>
        {produto && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 border border-border p-3">
              <div className="font-medium">{produto.nome}</div>
              <div className="text-xs text-muted-foreground">
                Saldo atual: <span className="tabular-nums font-medium text-foreground">{Number(produto.quantidade).toLocaleString("pt-BR")} {produto.unidade}</span>
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "entrada" | "saida" | "ajuste")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste de inventário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tipo === "ajuste" ? "Saldo real" : "Quantidade"}</Label>
                <Input type="number" step="0.001" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
              </div>
              {tipo === "entrada" && (
                <div>
                  <Label>Custo unitário</Label>
                  <Input type="number" step="0.01" value={custo} onChange={(e) => setCusto(Number(e.target.value))} />
                </div>
              )}
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Motivo, NF, lote..." />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => registrar.mutate()} disabled={registrar.isPending}>
            {registrar.isPending ? "Registrando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
