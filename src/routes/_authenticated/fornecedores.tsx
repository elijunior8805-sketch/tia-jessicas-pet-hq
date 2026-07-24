import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Package,
  MessageCircle,
  Edit,
  Power,
  Trash2,
  ShoppingCart,
  CircleDollarSign,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { abrirWhatsApp } from "@/lib/whatsapp";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Spa de Pet Tia Jéssica" },
      { name: "description", content: "Cadastro e histórico de compras por fornecedor." },
    ],
  }),
  component: FornecedoresPage,
});

type Fornecedor = {
  id: string;
  nome: string;
  razao_social: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  tipo_produto: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function waLink(phone: string | null) {
  const d = onlyDigits(phone || "");
  if (!d) return null;
  const full = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${full}`;
}

function FornecedoresPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Fornecedor[];
    },
  });

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return fornecedores.filter((f) => {
      if (somenteAtivos && !f.ativo) return false;
      if (!term) return true;
      return (
        f.nome.toLowerCase().includes(term) ||
        (f.razao_social || "").toLowerCase().includes(term) ||
        (f.cpf_cnpj || "").toLowerCase().includes(term) ||
        (f.tipo_produto || "").toLowerCase().includes(term) ||
        (f.telefone || "").includes(term) ||
        (f.whatsapp || "").includes(term)
      );
    });
  }, [fornecedores, busca, somenteAtivos]);

  const selected = fornecedores.find((f) => f.id === selectedId) || null;

  const { data: comprasFornecedor = [] } = useQuery({
    queryKey: ["fornecedor-compras", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("id, data_compra, descricao, valor_total, parcelas, forma_pagamento, status")
        .eq("fornecedor_id", selectedId!)
        .order("data_compra", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalGasto = useMemo(
    () => comprasFornecedor.reduce((acc: number, c: any) => acc + Number(c.valor_total || 0), 0),
    [comprasFornecedor],
  );

  const kpis = useMemo(() => {
    const ativos = fornecedores.filter((f) => f.ativo).length;
    const inativos = fornecedores.length - ativos;
    const tipos = new Set(fornecedores.map((f) => (f.tipo_produto || "").trim()).filter(Boolean)).size;
    return { total: fornecedores.length, ativos, inativos, tipos };
  }, [fornecedores]);

  const toggleAtivoMut = useMutation({
    mutationFn: async (f: Fornecedor) => {
      const { error } = await supabase
        .from("fornecedores")
        .update({ ativo: !f.ativo })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: (_, f) => {
      toast.success(f.ativo ? "Fornecedor desativado" : "Fornecedor reativado");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor excluído");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      setConfirmDeleteId(null);
      setSelectedId(null);
    },
    onError: (e: any) =>
      toast.error(
        e.message?.includes("foreign") || e.code === "23503"
          ? "Fornecedor possui compras vinculadas. Desative em vez de excluir."
          : e.message || "Falha ao excluir",
      ),
  });

  return (
    <PageShell>
      <PageHeader
        icon={Truck}
        title="Fornecedores"
        description="Cadastro completo e histórico de compras por fornecedor."
        actions={
          <Button
            className="btn-premium"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Novo fornecedor
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Building2} label="Total" value={String(kpis.total)} accent="petrol" />
        <KpiCard icon={Power} label="Ativos" value={String(kpis.ativos)} accent="emerald" />
        <KpiCard icon={Power} label="Inativos" value={String(kpis.inativos)} accent="sage" />
        <KpiCard icon={Package} label="Categorias" value={String(kpis.tipos)} accent="gold" />
      </div>

      <Toolbar>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ, tipo, telefone..."
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <input
            type="checkbox"
            checked={somenteAtivos}
            onChange={(e) => setSomenteAtivos(e.target.checked)}
          />
          Somente ativos
        </label>
      </Toolbar>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* Lista */}
        <Card className="card-premium p-2 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Nenhum fornecedor encontrado"
              description="Cadastre o primeiro fornecedor para começar."
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition hover:bg-muted/40 ${
                      selectedId === f.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {f.tipo_produto || "Sem categoria"}
                          {f.cpf_cnpj ? ` • ${f.cpf_cnpj}` : ""}
                        </div>
                      </div>
                      <StatusBadge tone={f.ativo ? "success" : "muted"}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </StatusBadge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Detalhe */}
        <Card className="card-premium p-5">
          {!selected ? (
            <EmptyState
              icon={Building2}
              title="Selecione um fornecedor"
              description="Clique em um item da lista para ver detalhes e histórico."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold">{selected.nome}</h2>
                  {selected.razao_social && (
                    <p className="text-sm text-muted-foreground">{selected.razao_social}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {waLink(selected.whatsapp || selected.telefone) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirWhatsApp(waLink(selected.whatsapp || selected.telefone)!)}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(selected);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAtivoMut.mutate(selected)}
                  >
                    <Power className="h-4 w-4 mr-1" />
                    {selected.ativo ? "Desativar" : "Reativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setConfirmDeleteId(selected.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <InfoRow icon={Building2} label="CPF/CNPJ" value={selected.cpf_cnpj} />
                <InfoRow icon={Package} label="Tipo de produto" value={selected.tipo_produto} />
                <InfoRow icon={Phone} label="Telefone" value={selected.telefone} />
                <InfoRow icon={MessageCircle} label="WhatsApp" value={selected.whatsapp} />
                <InfoRow icon={Mail} label="E-mail" value={selected.email} />
                <InfoRow icon={MapPin} label="Endereço" value={selected.endereco} />
              </div>

              {selected.observacoes && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {selected.observacoes}
                </div>
              )}

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Histórico de compras
                  </h3>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/compras">Ver em Compras →</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <KpiCard
                    icon={ShoppingCart}
                    label="Compras"
                    value={String(comprasFornecedor.length)}
                    accent="petrol"
                  />
                  <KpiCard
                    icon={CircleDollarSign}
                    label="Total gasto"
                    value={brl(totalGasto)}
                    accent="emerald"
                  />
                </div>

                {comprasFornecedor.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border/60">
                    {comprasFornecedor.map((c: any) => (
                      <li key={c.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {c.descricao || "Compra"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.data_compra
                              ? new Date(c.data_compra + "T00:00").toLocaleDateString("pt-BR")
                              : "—"}
                            {c.parcelas ? ` • ${c.parcelas}x` : ""}
                            {c.forma_pagamento ? ` • ${c.forma_pagamento}` : ""}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold">{brl(c.valor_total)}</div>
                          {c.status && (
                            <StatusBadge tone={c.status === "pago" ? "success" : "warning"}>
                              {c.status}
                            </StatusBadge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <FornecedorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fornecedor={editing}
        onSaved={(id) => {
          setDialogOpen(false);
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["fornecedores"] });
          if (id) setSelectedId(id);
        }}
      />

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se houver compras vinculadas, a exclusão será
              bloqueada — use "Desativar" nesse caso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && deleteMut.mutate(confirmDeleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

function FornecedorDialog({
  open,
  onOpenChange,
  fornecedor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor: Fornecedor | null;
  onSaved: (id?: string) => void;
}) {
  const isEdit = !!fornecedor;
  const [form, setForm] = useState<Partial<Fornecedor>>({});
  const [saving, setSaving] = useState(false);

  // Reset form when opening
  useMemo(() => {
    if (open) {
      setForm(
        fornecedor
          ? { ...fornecedor }
          : {
              nome: "",
              razao_social: "",
              cpf_cnpj: "",
              telefone: "",
              whatsapp: "",
              email: "",
              endereco: "",
              tipo_produto: "",
              observacoes: "",
              ativo: true,
            },
      );
    }
  }, [open, fornecedor]);

  async function submit() {
    if (!form.nome?.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome!.trim(),
        razao_social: form.razao_social || null,
        cpf_cnpj: form.cpf_cnpj || null,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        endereco: form.endereco || null,
        tipo_produto: form.tipo_produto || null,
        observacoes: form.observacoes || null,
        ativo: form.ativo ?? true,
      };
      if (isEdit && fornecedor) {
        const { error } = await supabase
          .from("fornecedores")
          .update(payload)
          .eq("id", fornecedor.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
        onSaved(fornecedor.id);
      } else {
        const { data, error } = await supabase
          .from("fornecedores")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Fornecedor cadastrado");
        onSaved(data?.id);
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof Fornecedor) => (e: any) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>
            Dados cadastrais e contato. O histórico de compras é montado a partir do módulo Compras.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Nome / Nome fantasia *</Label>
            <Input value={form.nome || ""} onChange={set("nome")} autoFocus />
          </div>
          <div>
            <Label>Razão social</Label>
            <Input value={form.razao_social || ""} onChange={set("razao_social")} />
          </div>
          <div>
            <Label>CPF / CNPJ</Label>
            <Input value={form.cpf_cnpj || ""} onChange={set("cpf_cnpj")} />
          </div>
          <div>
            <Label>Tipo de produto / Categoria</Label>
            <Input
              value={form.tipo_produto || ""}
              onChange={set("tipo_produto")}
              placeholder="Ex.: cosméticos, ração, equipamentos"
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email || ""} onChange={set("email")} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone || ""} onChange={set("telefone")} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp || ""} onChange={set("whatsapp")} />
          </div>
          <div className="md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.endereco || ""} onChange={set("endereco")} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.observacoes || ""}
              onChange={set("observacoes")}
              placeholder="Prazo médio, condições de pagamento, contato principal..."
            />
          </div>
          {isEdit && (
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo ?? true}
                onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))}
              />
              Fornecedor ativo
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="btn-premium" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
