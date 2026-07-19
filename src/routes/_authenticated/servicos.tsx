import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package, Scissors, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/servicos")({
  component: ServicosPage,
});

type Porte = { id: string; nome: string; ordem: number };
type Servico = {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  duracao_min: number;
  ativo: boolean;
  is_combo: boolean;
  preco_a_partir: boolean;
};

const CATEGORIAS_SERVICO = [
  "Banhos",
  "Hidratação",
  "Tosas",
  "Acabamentos",
  "Cuidados com a pelagem",
] as const;

const ORDEM_CATEGORIA: Record<string, number> = {
  "Banhos": 1,
  "Hidratação": 2,
  "Tosas": 3,
  "Acabamentos": 4,
  "Cuidados com a pelagem": 5,
};
type Preco = { id: string; servico_id: string; porte_id: string; valor: number };
type ComboItem = { id: string; combo_id: string; servico_id: string; quantidade: number };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ServicosPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<"servicos" | "combos">("servicos");
  const [editing, setEditing] = useState<Servico | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openPrecos, setOpenPrecos] = useState<Servico | null>(null);
  const [openCombo, setOpenCombo] = useState<Servico | null>(null);

  const { data: portes = [] } = useQuery({
    queryKey: ["portes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("portes").select("id, nome, ordem").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Porte[];
    },
  });

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, nome, categoria, descricao, valor, duracao_min, ativo, is_combo, preco_a_partir")
        .order("nome");
      if (error) throw error;
      return data as Servico[];
    },
  });

  const { data: precos = [] } = useQuery({
    queryKey: ["servicos_precos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos_precos").select("*");
      if (error) throw error;
      return data as Preco[];
    },
  });

  const { data: comboItens = [] } = useQuery({
    queryKey: ["servicos_combo_itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos_combo_itens").select("*");
      if (error) throw error;
      return data as ComboItem[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return servicos.filter((s) => {
      if (tab === "combos" && !s.is_combo) return false;
      if (tab === "servicos" && s.is_combo) return false;
      if (!q) return true;
      return s.nome.toLowerCase().includes(q) || (s.categoria ?? "").toLowerCase().includes(q);
    });
  }, [servicos, tab, busca]);

  const upsertServico = useMutation({
    mutationFn: async (payload: Partial<Servico> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("servicos").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("servicos").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Serviço salvo");
      qc.invalidateQueries({ queryKey: ["servicos"] });
      setOpenForm(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerServico = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço excluído");
      qc.invalidateQueries({ queryKey: ["servicos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Serviços"
        description="Tabela de serviços, valores por porte e combos"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Novo {tab === "combos" ? "Combo" : "Serviço"}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "servicos" | "combos")} className="mb-4">
        <TabsList>
          <TabsTrigger value="servicos" className="gap-2">
            <Scissors className="h-4 w-4" /> Serviços
          </TabsTrigger>
          <TabsTrigger value="combos" className="gap-2">
            <Package className="h-4 w-4" /> Combos
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou categoria…"
            className="pl-9 h-10 rounded-full"
          />
        </div>

        <TabsContent value="servicos" className="mt-4">
          <ServicosList
            items={filtrados}
            portes={portes}
            precos={precos}
            loading={isLoading}
            onEdit={(s) => { setEditing(s); setOpenForm(true); }}
            onPrecos={(s) => setOpenPrecos(s)}
            onDelete={(id) => removerServico.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="combos" className="mt-4">
          <ServicosList
            items={filtrados}
            portes={portes}
            precos={precos}
            loading={isLoading}
            isCombo
            comboItens={comboItens}
            allServicos={servicos}
            onEdit={(s) => { setEditing(s); setOpenForm(true); }}
            onCombo={(s) => setOpenCombo(s)}
            onDelete={(id) => removerServico.mutate(id)}
          />
        </TabsContent>
      </Tabs>

      <ServicoFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        initial={editing}
        isCombo={tab === "combos"}
        onSubmit={(v) => upsertServico.mutate(v)}
        pending={upsertServico.isPending}
      />

      {openPrecos && (
        <PrecosDialog
          servico={openPrecos}
          portes={portes}
          precos={precos.filter((p) => p.servico_id === openPrecos.id)}
          onClose={() => setOpenPrecos(null)}
        />
      )}

      {openCombo && (
        <ComboItensDialog
          combo={openCombo}
          servicos={servicos.filter((s) => !s.is_combo && s.ativo)}
          itens={comboItens.filter((c) => c.combo_id === openCombo.id)}
          onClose={() => setOpenCombo(null)}
        />
      )}
    </PageShell>
  );
}

/* -------------------- LISTA -------------------- */
function ServicosList({
  items, portes, precos, loading, onEdit, onPrecos, onDelete, isCombo, comboItens, allServicos, onCombo,
}: {
  items: Servico[];
  portes: Porte[];
  precos: Preco[];
  loading: boolean;
  onEdit: (s: Servico) => void;
  onDelete: (id: string) => void;
  onPrecos?: (s: Servico) => void;
  isCombo?: boolean;
  comboItens?: ComboItem[];
  allServicos?: Servico[];
  onCombo?: (s: Servico) => void;
}) {
  if (loading) return <Card className="p-8 text-center text-muted-foreground">Carregando…</Card>;
  if (items.length === 0)
    return (
      <Card className="p-10 text-center">
        <p className="text-muted-foreground">Nenhum {isCombo ? "combo" : "serviço"} cadastrado.</p>
      </Card>
    );

  // Agrupar por categoria (somente para serviços; combos ficam em lista única)
  const grupos = isCombo
    ? [["Combos", items] as const]
    : (() => {
        const map = new Map<string, Servico[]>();
        for (const s of items) {
          const cat = s.categoria?.trim() || "Outros";
          if (!map.has(cat)) map.set(cat, []);
          map.get(cat)!.push(s);
        }
        return Array.from(map.entries()).sort((a, b) => {
          const oa = ORDEM_CATEGORIA[a[0]] ?? 99;
          const ob = ORDEM_CATEGORIA[b[0]] ?? 99;
          if (oa !== ob) return oa - ob;
          return a[0].localeCompare(b[0], "pt-BR");
        });
      })();

  return (
    <div className="flex flex-col gap-6">
      {grupos.map(([cat, arr]) => (
        <section key={cat} className="flex flex-col gap-3">
          {!isCombo && (
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">{cat}</h2>
              <span className="text-xs text-muted-foreground">{arr.length}</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {arr.map((s) => {
              const precosServico = precos.filter((p) => p.servico_id === s.id);
              const itensCombo = isCombo ? (comboItens ?? []).filter((c) => c.combo_id === s.id) : [];
              return (
                <Card key={s.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground truncate">{s.nome}</h3>
                        {!s.ativo && <Badge variant="secondary">Inativo</Badge>}
                      </div>
                      {s.categoria && <p className="text-xs text-muted-foreground mt-0.5">{s.categoria}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {s.preco_a_partir && (
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">a partir de</p>
                      )}
                      <p className="font-semibold text-primary">{brl(Number(s.valor))}</p>
                      {s.duracao_min ? (
                        <p className="text-xs text-muted-foreground">{s.duracao_min} min</p>
                      ) : null}
                    </div>
                  </div>

            {s.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{s.descricao}</p>}

            {!isCombo && precosServico.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {portes.map((p) => {
                  const pr = precosServico.find((x) => x.porte_id === p.id);
                  if (!pr) return null;
                  return (
                    <Badge key={p.id} variant="outline" className="text-[11px] font-normal">
                      {p.nome}: {brl(Number(pr.valor))}
                    </Badge>
                  );
                })}
              </div>
            )}

            {isCombo && (
              <div className="text-xs text-muted-foreground">
                {itensCombo.length === 0
                  ? "Nenhum serviço no combo"
                  : itensCombo
                      .map((c) => {
                        const nm = (allServicos ?? []).find((x) => x.id === c.servico_id)?.nome ?? "—";
                        return `${c.quantidade}× ${nm}`;
                      })
                      .join(" · ")}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {!isCombo && onPrecos && (
                <Button size="sm" variant="outline" onClick={() => onPrecos(s)}>
                  Preços por porte
                </Button>
              )}
              {isCombo && onCombo && (
                <Button size="sm" variant="outline" onClick={() => onCombo(s)}>
                  Itens do combo
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onEdit(s)} aria-label={`Editar ${s.nome}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" aria-label={`Excluir ${s.nome}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {s.nome}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Preços por porte e vínculos em combos serão removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(s.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* -------------------- FORM -------------------- */
function ServicoFormDialog({
  open, onOpenChange, initial, isCombo, onSubmit, pending,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial: Servico | null;
  isCombo: boolean;
  onSubmit: (v: Partial<Servico> & { id?: string }) => void;
  pending: boolean;
}) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("0");
  const [precoAPartir, setPrecoAPartir] = useState(false);
  const [duracao, setDuracao] = useState("");
  const [ativo, setAtivo] = useState(true);

  // sync when opening
  useMemo(() => {
    if (open) {
      setNome(initial?.nome ?? "");
      setCategoria(initial?.categoria ?? "");
      setDescricao(initial?.descricao ?? "");
      setValor(String(initial?.valor ?? 0));
      setPrecoAPartir(initial?.preco_a_partir ?? false);
      setDuracao(initial?.duracao_min ? String(initial.duracao_min) : "");
      setAtivo(initial?.ativo ?? true);
    }
  }, [open, initial]);

  const submit = () => {
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    onSubmit({
      id: initial?.id,
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      descricao: descricao.trim() || null,
      valor: Number(valor) || 0,
      preco_a_partir: precoAPartir,
      duracao_min: duracao ? Number(duracao) : 0,
      ativo,
      is_combo: initial?.is_combo ?? isCombo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar" : "Novo"} {(initial?.is_combo ?? isCombo) ? "combo" : "serviço"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="s-nome">Nome</Label>
            <Input id="s-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="s-cat">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger id="s-cat"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_SERVICO.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-dur">Duração (min)</Label>
              <Input id="s-dur" type="number" min={0} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-valor">Valor padrão (R$)</Label>
            <Input id="s-valor" type="number" step="0.01" min={0} value={valor} onChange={(e) => setValor(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Usado quando não houver preço específico por porte.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="s-partir" checked={precoAPartir} onCheckedChange={setPrecoAPartir} />
            <Label htmlFor="s-partir">Exibir como “a partir de”</Label>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-desc">Descrição</Label>
            <Textarea id="s-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="s-ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="s-ativo">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- PREÇOS POR PORTE -------------------- */
function PrecosDialog({
  servico, portes, precos, onClose,
}: {
  servico: Servico;
  portes: Porte[];
  precos: Preco[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    portes.forEach((p) => {
      const pr = precos.find((x) => x.porte_id === p.id);
      map[p.id] = pr ? String(pr.valor) : "";
    });
    return map;
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const upserts = portes
        .map((p) => ({
          servico_id: servico.id,
          porte_id: p.id,
          valor: rows[p.id] === "" ? null : Number(rows[p.id]),
        }))
        .filter((r) => r.valor !== null && !Number.isNaN(r.valor)) as {
          servico_id: string; porte_id: string; valor: number;
        }[];

      const toDelete = portes
        .filter((p) => rows[p.id] === "" || Number.isNaN(Number(rows[p.id])))
        .map((p) => p.id);

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("servicos_precos")
          .delete()
          .eq("servico_id", servico.id)
          .in("porte_id", toDelete);
        if (error) throw error;
      }
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("servicos_precos")
          .upsert(upserts, { onConflict: "servico_id,porte_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Preços atualizados");
      qc.invalidateQueries({ queryKey: ["servicos_precos"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preços por porte · {servico.nome}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {portes.map((p) => (
            <div key={p.id} className="grid grid-cols-[1fr_140px] items-center gap-3">
              <Label htmlFor={`pr-${p.id}`}>{p.nome}</Label>
              <Input
                id={`pr-${p.id}`}
                type="number"
                step="0.01"
                min={0}
                placeholder="—"
                value={rows[p.id] ?? ""}
                onChange={(e) => setRows((r) => ({ ...r, [p.id]: e.target.value }))}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Deixe em branco para usar o valor padrão do serviço.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar preços"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- ITENS DO COMBO -------------------- */
function ComboItensDialog({
  combo, servicos, itens, onClose,
}: {
  combo: Servico;
  servicos: Servico[];
  itens: ComboItem[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [novoId, setNovoId] = useState("");
  const [novoQtd, setNovoQtd] = useState("1");

  const disponiveis = servicos.filter((s) => !itens.some((it) => it.servico_id === s.id));

  const addItem = useMutation({
    mutationFn: async () => {
      if (!novoId) throw new Error("Selecione um serviço");
      const q = Math.max(1, Number(novoQtd) || 1);
      const { error } = await supabase
        .from("servicos_combo_itens")
        .insert({ combo_id: combo.id, servico_id: novoId, quantidade: q });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      qc.invalidateQueries({ queryKey: ["servicos_combo_itens"] });
      setNovoId("");
      setNovoQtd("1");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("servicos_combo_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos_combo_itens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Itens do combo · {combo.nome}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="border border-border/60 rounded-lg divide-y">
            {itens.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Nenhum item ainda.</div>
            )}
            {itens.map((it) => {
              const s = servicos.find((x) => x.id === it.servico_id);
              return (
                <div key={it.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s?.nome ?? "Serviço"}</p>
                    <p className="text-xs text-muted-foreground">Quantidade: {it.quantidade}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeItem.mutate(it.id)} aria-label="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[1fr_90px_auto] gap-2 items-end">
            <div className="grid gap-1.5">
              <Label>Adicionar serviço</Label>
              <Select value={novoId} onValueChange={setNovoId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {disponiveis.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qtd">Qtd</Label>
              <Input id="qtd" type="number" min={1} value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} />
            </div>
            <Button onClick={() => addItem.mutate()} disabled={addItem.isPending || !novoId}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
