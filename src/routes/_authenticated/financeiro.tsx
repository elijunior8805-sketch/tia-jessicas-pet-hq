import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Clock,
  CheckCircle2,
  Plus,
  FileText,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Coins,
  X,
  FlaskConical,
  Trash2,
  SlidersHorizontal,
  Filter,
  MoreHorizontal,
  Info,
} from "lucide-react";
import { ReciboDialog } from "@/components/recibo-dialog";
import type { ReciboData } from "@/lib/recibo-pdf";
import { generateFinanceiroPDF } from "@/lib/financeiro-pdf";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addDays,
  subDays,
  differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ============================================================
 * Tipos e utilitários
 * ============================================================ */

type Pag = {
  id: string;
  atendimento_id: string | null;
  valor_total: number;
  valor_pago: number;
  forma: string;
  status: string;
  vencimento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  descricao: string | null;
  categoria_receita: string | null;
  is_teste: boolean;
  cliente: { nome: string; telefone: string | null; whatsapp: string | null } | null;
  atendimento: { data_inicio: string | null; pet: { nome: string } | null } | null;
};

type Parc = {
  id: string;
  numero: number;
  total_parcelas: number;
  valor: number;
  valor_pago: number;
  vencimento: string;
  data_pagamento: string | null;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  is_teste: boolean;
  compra: {
    descricao: string | null;
    numero_documento: string | null;
    is_teste?: boolean;
    fornecedor: { id: string; nome: string; telefone: string | null; whatsapp: string | null } | null;
    categoria: { id: string; nome: string } | null;
    centro_custo: { nome: string } | null;
  } | null;
};

type ReciboState = {
  data: ReciboData;
  telefone: string | null;
  referenciaId: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

const FORMA_META: Record<string, { label: string; color: string; bg: string; text: string }> = {
  dinheiro: { label: "Dinheiro", color: "#168055", bg: "bg-emerald-50", text: "text-emerald-700" },
  pix: { label: "Pix", color: "#1F4C5C", bg: "bg-cyan-50", text: "text-cyan-800" },
  credito: { label: "Crédito", color: "#C99845", bg: "bg-amber-50", text: "text-amber-700" },
  debito: { label: "Débito", color: "#7d9b76", bg: "bg-lime-50", text: "text-lime-800" },
  outras: { label: "Outras", color: "#8b7355", bg: "bg-stone-50", text: "text-stone-700" },
  pendente: { label: "Pendente", color: "#94a3b8", bg: "bg-slate-50", text: "text-slate-700" },
};

const CATEGORIA_RECEITA_OPTS = [
  { value: "venda_produto", label: "Venda de Produto" },
  { value: "taxa_adicional", label: "Taxa Adicional" },
  { value: "reembolso", label: "Reembolso Recebido" },
  { value: "comissao", label: "Comissão" },
  { value: "aporte", label: "Aporte do Proprietário" },
  { value: "ajuste", label: "Ajuste Financeiro" },
  { value: "outros", label: "Outros" },
];

function statusBadgeCls(s: string) {
  const map: Record<string, string> = {
    pago: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
    parcial: "bg-amber-500/10 text-amber-800 border-amber-300",
    pendente: "bg-slate-500/10 text-slate-700 border-slate-300",
    atrasado: "bg-rose-500/10 text-rose-700 border-rose-300",
    cancelado: "bg-muted text-muted-foreground border-transparent",
  };
  return map[s] || "bg-primary/10 text-primary border-primary/20";
}

/* ============================================================
 * Preset de período
 * ============================================================ */

type Preset = "hoje" | "ontem" | "semana" | "mes" | "personalizado";

function computePreset(preset: Preset, hoje = new Date()): { de: string; ate: string } {
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "hoje":
      return { de: fmt(hoje), ate: fmt(hoje) };
    case "ontem": {
      const y = subDays(hoje, 1);
      return { de: fmt(y), ate: fmt(y) };
    }
    case "semana":
      return {
        de: fmt(startOfWeek(hoje, { weekStartsOn: 1 })),
        ate: fmt(endOfWeek(hoje, { weekStartsOn: 1 })),
      };
    case "mes":
      return { de: fmt(startOfMonth(hoje)), ate: fmt(endOfMonth(hoje)) };
    default:
      return { de: fmt(startOfMonth(hoje)), ate: fmt(endOfMonth(hoje)) };
  }
}

/* ============================================================
 * Dialog: Novo lançamento (Receita avulsa OU Despesa)
 * ============================================================ */

function LancamentoManualDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"receita" | "despesa">("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [forma, setForma] = useState<string>("dinheiro");
  const [categoriaReceita, setCategoriaReceita] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("none");
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [categoriaDespesaId, setCategoriaDespesaId] = useState<string>("none");
  const [centroCustoId, setCentroCustoId] = useState<string>("none");
  const [vencimento, setVencimento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusDespesa, setStatusDespesa] = useState<"pago" | "pendente">("pago");
  const [saving, setSaving] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["cats-fin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: open,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-fin-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome")
        .limit(500);
      return data || [];
    },
    enabled: open && tipo === "receita",
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-fin-select"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("id, nome").order("nome");
      return data || [];
    },
    enabled: open && tipo === "despesa",
  });

  const { data: centros = [] } = useQuery({
    queryKey: ["centros-custo-fin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: open && tipo === "despesa",
  });

  const catsDespesa = (cats as any[]).filter((c) => c.tipo === "despesa");

  const salvar = async () => {
    const v = Number(valor.replace(",", "."));
    if (!v || v <= 0) return toast.error("Informe um valor válido");
    setSaving(true);
    try {
      if (tipo === "receita") {
        if (!categoriaReceita) {
          toast.error("Selecione a categoria da receita");
          setSaving(false);
          return;
        }
        const payload: any = {
          valor_total: v,
          valor_pago: v,
          forma,
          status: "pago",
          data_pagamento: data,
          vencimento: data,
          descricao: descricao || null,
          categoria_receita: categoriaReceita,
          cliente_id: clienteId !== "none" ? clienteId : null,
          observacoes: null,
        };
        const { error } = await supabase.from("pagamentos").insert(payload);
        if (error) throw error;
        toast.success("Receita registrada");
      } else {
        if (!fornecedorId) {
          toast.error("Selecione um fornecedor");
          setSaving(false);
          return;
        }
        const { data: compra, error: eC } = await supabase
          .from("compras")
          .insert({
            fornecedor_id: fornecedorId,
            descricao: descricao || "Lançamento avulso",
            categoria_id: categoriaDespesaId !== "none" ? categoriaDespesaId : null,
            centro_custo_id: centroCustoId !== "none" ? centroCustoId : null,
            data_compra: data,
            valor_total: v,
            forma_pagamento: forma as any,
            parcelas: 1,
            primeiro_vencimento: vencimento,
          })
          .select("id")
          .single();
        if (eC) throw eC;
        await supabase.rpc("gerar_parcelas_compra", { _compra_id: compra.id });
        if (statusDespesa === "pago") {
          await supabase
            .from("compras_parcelas")
            .update({
              valor_pago: v,
              data_pagamento: data,
              status: "pago",
              forma_pagamento: forma as any,
            })
            .eq("compra_id", compra.id);
        }
        toast.success("Despesa lançada");
      }
      setOpen(false);
      setDescricao("");
      setValor("");
      setCategoriaReceita("");
      setClienteId("none");
      setFornecedorId("");
      setCategoriaDespesaId("none");
      setCentroCustoId("none");
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={tipo === "receita" ? "default" : "outline"}
              onClick={() => setTipo("receita")}
            >
              <ArrowUpRight className="h-4 w-4 mr-1" /> Receita
            </Button>
            <Button
              type="button"
              variant={tipo === "despesa" ? "default" : "outline"}
              onClick={() => setTipo("despesa")}
            >
              <ArrowDownRight className="h-4 w-4 mr-1" /> Despesa
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={tipo === "receita" ? "Ex: Venda de shampoo" : "Ex: Conta de luz"}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>{tipo === "receita" ? "Data do pagamento" : "Data da compra"}</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="outras">Outras</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "receita" ? (
            <>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={categoriaReceita} onValueChange={setCategoriaReceita}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIA_RECEITA_OPTS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(categoriaReceita === "aporte" || categoriaReceita === "ajuste") && (
                  <p className="text-xs text-muted-foreground">
                    Aportes e ajustes aparecem separadamente e não somam ao faturamento de serviços.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {(clientes as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(fornecedores as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={categoriaDespesaId} onValueChange={setCategoriaDespesaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {catsDespesa.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro de custo</Label>
                  <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem centro</SelectItem>
                      {(centros as any[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusDespesa} onValueChange={(v: any) => setStatusDespesa(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Painel dedicado a dados de teste
 * ============================================================ */

function TesteToolbar({ onChange }: { onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  const seed = async () => {
    setBusy(true);
    try {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const linhas: Array<{ forma: string; valor: number; label: string; categoria: string }> = [
        { forma: "dinheiro", valor: 100, label: "TESTE Dinheiro", categoria: "venda_produto" },
        { forma: "pix", valor: 200, label: "TESTE Pix", categoria: "venda_produto" },
        { forma: "credito", valor: 300, label: "TESTE Crédito", categoria: "venda_produto" },
        { forma: "debito", valor: 150, label: "TESTE Débito", categoria: "venda_produto" },
        { forma: "outras", valor: 50, label: "TESTE Outras receitas", categoria: "outros" },
      ];
      const payload: any[] = linhas.map((l) => ({
        valor_total: l.valor,
        valor_pago: l.valor,
        forma: l.forma,
        status: "pago",
        data_pagamento: hoje,
        vencimento: hoje,
        descricao: l.label,
        categoria_receita: l.categoria,
        is_teste: true,
      }));
      // Pendente
      payload.push({
        valor_total: 400,
        valor_pago: 0,
        forma: "pendente",
        status: "pendente",
        vencimento: hoje,
        descricao: "TESTE Pendente",
        categoria_receita: "outros",
        is_teste: true,
      });
      // Parcial
      payload.push({
        valor_total: 500,
        valor_pago: 200,
        forma: "pix",
        status: "parcial",
        data_pagamento: hoje,
        vencimento: hoje,
        descricao: "TESTE Parcial",
        categoria_receita: "outros",
        is_teste: true,
      });
      // Cancelado
      payload.push({
        valor_total: 999,
        valor_pago: 0,
        forma: "pix",
        status: "cancelado",
        vencimento: hoje,
        descricao: "TESTE Cancelado",
        categoria_receita: "outros",
        is_teste: true,
      });
      const { error: e1 } = await supabase.from("pagamentos").insert(payload);
      if (e1) throw e1;

      // Despesa: precisa fornecedor
      const { data: forn } = await supabase.from("fornecedores").select("id").limit(1).maybeSingle();
      if (forn?.id) {
        const { data: compra, error: eC } = await supabase
          .from("compras")
          .insert({
            fornecedor_id: forn.id,
            descricao: "TESTE Despesa",
            data_compra: hoje,
            valor_total: 120,
            forma_pagamento: "dinheiro",
            parcelas: 1,
            primeiro_vencimento: hoje,
            is_teste: true,
          } as any)
          .select("id")
          .single();
        if (eC) throw eC;
        await supabase.rpc("gerar_parcelas_compra", { _compra_id: compra.id });
        await supabase
          .from("compras_parcelas")
          .update({
            valor_pago: 120,
            data_pagamento: hoje,
            status: "pago",
            forma_pagamento: "dinheiro",
            is_teste: true,
          } as any)
          .eq("compra_id", compra.id);
      } else {
        toast.info("Cadastre um fornecedor para incluir a despesa de teste.");
      }

      toast.success("Dados de teste criados");
      onChange();
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar dados de teste");
    } finally {
      setBusy(false);
    }
  };

  const limpar = async () => {
    if (!confirm("Remover todos os lançamentos marcados como TESTE?")) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("limpar_dados_teste_financeiro");
      if (error) throw error;
      toast.success(
        `Removidos: ${(data as any)?.pagamentos_removidos ?? 0} receitas / ${(data as any)?.compras_removidas ?? 0} despesas`,
      );
      onChange();
    } catch (e: any) {
      toast.error(e.message || "Falha ao limpar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={seed} disabled={busy}>
        <FlaskConical className="h-4 w-4 mr-1" /> Criar dados de teste
      </Button>
      <Button size="sm" variant="outline" onClick={limpar} disabled={busy}>
        <Trash2 className="h-4 w-4 mr-1" /> Limpar dados de teste
      </Button>
    </div>
  );
}

/* ============================================================
 * Página principal
 * ============================================================ */

function FinanceiroPage() {
  const qc = useQueryClient();
  const hoje = new Date();

  // Filtros
  const [preset, setPreset] = useState<Preset>("mes");
  const initialRange = computePreset("mes", hoje);
  const [inicio, setInicio] = useState(initialRange.de);
  const [fim, setFim] = useState(initialRange.ate);
  const [fFormas, setFFormas] = useState<string[]>([]); // vazio = todas
  const [fBloco, setFBloco] = useState<"todos" | "entradas" | "saidas">("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fCategoria, setFCategoria] = useState<string>("todas"); // categoria_receita
  const [fCliente, setFCliente] = useState<string>("todos");
  const [incluirTeste, setIncluirTeste] = useState<boolean>(true);

  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "personalizado") {
      const r = computePreset(p, hoje);
      setInicio(r.de);
      setFim(r.ate);
    }
  };

  const limparFiltros = () => {
    aplicarPreset("mes");
    setFFormas([]);
    setFBloco("todos");
    setFStatus("todos");
    setFCategoria("todas");
    setFCliente("todos");
  };

  const toggleForma = (f: string) => {
    setFFormas((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const filtrosAtivos = useMemo(() => {
    const arr: { label: string; onRemove: () => void }[] = [];
    if (fBloco !== "todos") arr.push({ label: fBloco === "entradas" ? "Entradas" : "Saídas", onRemove: () => setFBloco("todos") });
    fFormas.forEach((f) => arr.push({ label: `Forma: ${FORMA_META[f]?.label ?? f}`, onRemove: () => toggleForma(f) }));
    if (fStatus !== "todos") arr.push({ label: `Status: ${fStatus}`, onRemove: () => setFStatus("todos") });
    if (fCategoria !== "todas") {
      const lbl = CATEGORIA_RECEITA_OPTS.find((x) => x.value === fCategoria)?.label ?? fCategoria;
      arr.push({ label: `Categoria: ${lbl}`, onRemove: () => setFCategoria("todas") });
    }
    if (fCliente !== "todos") arr.push({ label: "Cliente selecionado", onRemove: () => setFCliente("todos") });
    return arr;
  }, [fBloco, fFormas, fStatus, fCategoria, fCliente]);

  const [recibo, setRecibo] = useState<ReciboState | null>(null);

  const { data: empresa } = useQuery({
    queryKey: ["empresa-config-fin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_config")
        .select("nome_fantasia, cnpj, telefone, endereco")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const empresaInfo = {
    nome: empresa?.nome_fantasia ?? "Spa de Pet Tia Jéssica",
    cnpj: empresa?.cnpj ?? null,
    telefone: empresa?.telefone ?? null,
    endereco: empresa?.endereco ?? null,
  };

  const abrirReciboReceita = (p: Pag) => {
    const numero = `RC-${format(new Date(), "yyyyMMdd")}-${p.id.slice(0, 6)}`;
    setRecibo({
      data: {
        tipo: "receita",
        numero,
        data: p.data_pagamento || format(new Date(), "yyyy-MM-dd"),
        contraparte: p.cliente?.nome || p.descricao || "Cliente",
        descricao:
          p.descricao ||
          p.observacoes ||
          `Pagamento de serviços do spa · vencimento ${p.vencimento ? format(parseISO(p.vencimento), "dd/MM/yyyy") : "—"}`,
        valor: Number(p.valor_total),
        forma: p.forma,
        empresa: empresaInfo,
      },
      telefone: p.cliente?.whatsapp || p.cliente?.telefone || null,
      referenciaId: p.id,
    });
  };

  const abrirReciboDespesa = (p: Parc) => {
    const numero = `CP-${format(new Date(), "yyyyMMdd")}-${p.id.slice(0, 6)}`;
    setRecibo({
      data: {
        tipo: "despesa",
        numero,
        data: p.data_pagamento || format(new Date(), "yyyy-MM-dd"),
        contraparte: p.compra?.fornecedor?.nome || "Fornecedor",
        descricao: p.compra?.descricao || p.compra?.numero_documento || `Parcela ${p.numero}/${p.total_parcelas}`,
        valor: Number(p.valor),
        forma: p.forma_pagamento || null,
        categoria: p.compra?.categoria?.nome || null,
        empresa: empresaInfo,
      },
      telefone: p.compra?.fornecedor?.whatsapp || p.compra?.fornecedor?.telefone || null,
      referenciaId: p.id,
    });
  };

  // Períodos: atual e anterior (mesmo tamanho)
  const dias = Math.max(1, differenceInDays(parseISO(fim), parseISO(inicio)) + 1);
  const inicioAnt = format(subDays(parseISO(inicio), dias), "yyyy-MM-dd");
  const fimAnt = format(subDays(parseISO(inicio), 1), "yyyy-MM-dd");

  // Query: pagamentos do período + do período anterior
  const { data: pagamentos = [] } = useQuery<Pag[]>({
    queryKey: ["fin-pag", inicio, fim, incluirTeste],
    queryFn: async () => {
      let q = supabase
        .from("pagamentos")
        .select(
          "id, atendimento_id, valor_total, valor_pago, forma, status, vencimento, data_pagamento, observacoes, descricao, categoria_receita, is_teste, cliente:clientes(nome, telefone, whatsapp), atendimento:atendimentos(data_inicio, pet:pets(nome))",
        )
        .or(
          `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(vencimento.gte.${inicio},vencimento.lte.${fim})`,
        )
        .order("data_pagamento", { ascending: false, nullsFirst: false });
      if (!incluirTeste) q = q.eq("is_teste", false);
      const { data } = await q;
      return (data as any) || [];
    },
  });

  const { data: pagAnt = [] } = useQuery<Pag[]>({
    queryKey: ["fin-pag-ant", inicioAnt, fimAnt, incluirTeste],
    queryFn: async () => {
      let q = supabase
        .from("pagamentos")
        .select("id, valor_pago, forma, data_pagamento, is_teste, status")
        .gte("data_pagamento", inicioAnt)
        .lte("data_pagamento", fimAnt);
      if (!incluirTeste) q = q.eq("is_teste", false);
      const { data } = await q;
      return (data as any) || [];
    },
  });

  const { data: parcelas = [] } = useQuery<Parc[]>({
    queryKey: ["fin-parc", inicio, fim, incluirTeste],
    queryFn: async () => {
      let q = supabase
        .from("compras_parcelas")
        .select(
          `id, numero, total_parcelas, valor, valor_pago, vencimento, data_pagamento, status, forma_pagamento, observacoes, is_teste,
           compra:compras(descricao, numero_documento, is_teste,
             fornecedor:fornecedores(id, nome, telefone, whatsapp),
             categoria:categorias_financeiras(id, nome),
             centro_custo:centros_custo(nome))`,
        )
        .or(
          `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(vencimento.gte.${inicio},vencimento.lte.${fim})`,
        )
        .order("vencimento", { ascending: false });
      if (!incluirTeste) q = q.eq("is_teste", false);
      const { data } = await q;
      return (data as any) || [];
    },
  });

  // Faturamento por competência (data_inicio do atendimento)
  const { data: faturamentoCompetencia = 0 } = useQuery<number>({
    queryKey: ["fin-fat-competencia", inicio, fim],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("valor_planejado, valor_executado, encerrado_em, data_inicio")
        .gte("data_inicio", `${inicio}T00:00:00.000Z`)
        .lte("data_inicio", `${fim}T23:59:59.999Z`);
      const rows = (data as any[]) || [];
      return rows.reduce((s, r) => {
        const exec = Number(r.valor_executado ?? 0);
        const plan = Number(r.valor_planejado ?? 0);
        return s + (exec > 0 ? exec : plan);
      }, 0);
    },
  });

  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    pagamentos.forEach((p) => {
      if (p.cliente && (p as any).cliente?.nome) {
        // cliente_id não vem no select; usamos nome como fallback simples
        map.set(p.cliente.nome, p.cliente.nome);
      }
    });
    return Array.from(map.keys()).sort();
  }, [pagamentos]);

  // Filtragem cliente-lado
  const receitasFiltradas = useMemo(() => {
    return pagamentos.filter((p) => {
      if (fBloco === "saidas") return false;
      if (p.status === "cancelado" && fStatus !== "cancelado" && fStatus !== "todos") return false;
      if (fFormas.length > 0 && !fFormas.includes(p.forma)) return false;
      if (fStatus !== "todos" && p.status !== fStatus) return false;
      if (fCategoria !== "todas" && p.categoria_receita !== fCategoria) return false;
      if (fCliente !== "todos" && p.cliente?.nome !== fCliente) return false;
      return true;
    });
  }, [pagamentos, fBloco, fFormas, fStatus, fCategoria, fCliente]);

  const despesasFiltradas = useMemo(() => {
    return parcelas.filter((p) => {
      if (fBloco === "entradas") return false;
      if (fFormas.length > 0 && !fFormas.includes(p.forma_pagamento ?? "pendente")) return false;
      if (fStatus !== "todos" && p.status !== fStatus) return false;
      return true;
    });
  }, [parcelas, fBloco, fFormas, fStatus]);

  // ============ KPIs ============
  const hojeStr = format(new Date(), "yyyy-MM-dd");

  const kpis = useMemo(() => {
    // Considera recebidos = data_pagamento no período E status pago/parcial (valor_pago real)
    const recebidosRows = receitasFiltradas.filter(
      (p) =>
        p.data_pagamento &&
        p.data_pagamento >= inicio &&
        p.data_pagamento <= fim &&
        p.status !== "cancelado",
    );
    const totalRecebido = recebidosRows.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // "Serviço" recebido para ticket médio (exclui aportes/ajustes)
    const recServico = recebidosRows.filter((p) => p.categoria_receita === "servico");
    const ticketMedio = recServico.length ? recServico.reduce((s, p) => s + Number(p.valor_pago || 0), 0) / recServico.length : 0;

    // Aportes / Ajustes separados
    const aportesAjustes = recebidosRows
      .filter((p) => p.categoria_receita === "aporte" || p.categoria_receita === "ajuste")
      .reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // A receber (saldo em aberto no período pelo vencimento)
    const emAberto = pagamentos.filter((p) => p.status !== "pago" && p.status !== "cancelado");
    const totalAReceber = emAberto.reduce((s, p) => s + (Number(p.valor_total) - Number(p.valor_pago || 0)), 0);
    const totalVencidos = emAberto
      .filter((p) => p.vencimento && p.vencimento < hojeStr)
      .reduce((s, p) => s + (Number(p.valor_total) - Number(p.valor_pago || 0)), 0);
    const qtdPendentes = emAberto.length;

    // Despesas pagas no período
    const despesasPagas = despesasFiltradas
      .filter((p) => p.data_pagamento && p.data_pagamento >= inicio && p.data_pagamento <= fim && p.status !== "cancelado")
      .reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // Receita bruta por competência
    const receitaBruta = Number(faturamentoCompetencia);

    // Lucro estimado: receita competência - despesas pagas
    const lucroEstimado = receitaBruta - despesasPagas;
    const saldoPeriodo = totalRecebido - despesasPagas;

    return {
      receitaBruta,
      totalRecebido,
      totalAReceber,
      despesas: despesasPagas,
      vencidos: totalVencidos,
      lucroEstimado,
      saldoPeriodo,
      ticketMedio,
      qtdPendentes,
      aportesAjustes,
    };
  }, [receitasFiltradas, despesasFiltradas, pagamentos, faturamentoCompetencia, inicio, fim, hojeStr]);

  // Recebimentos por forma (do período atual)
  const porForma = useMemo(() => {
    const formas = ["dinheiro", "pix", "credito", "debito", "outras"];
    const rows = receitasFiltradas.filter(
      (p) => p.data_pagamento && p.data_pagamento >= inicio && p.data_pagamento <= fim && p.status !== "cancelado",
    );
    const total = rows.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    return formas.map((f) => {
      const filtroForma = rows.filter((p) => p.forma === f);
      const valor = filtroForma.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
      const qtd = filtroForma.length;
      const anteriorRows = (pagAnt as any[]).filter((p) => p.forma === f && p.status !== "cancelado");
      const anterior = anteriorRows.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
      const delta = anterior > 0 ? (valor - anterior) / anterior : valor > 0 ? 1 : 0;
      return {
        forma: f,
        label: FORMA_META[f]?.label ?? f,
        color: FORMA_META[f]?.color ?? "#94a3b8",
        valor,
        qtd,
        pct: total > 0 ? valor / total : 0,
        ticket: qtd > 0 ? valor / qtd : 0,
        anterior,
        delta,
      };
    });
  }, [receitasFiltradas, pagAnt, inicio, fim]);

  // Série diária (entradas x saídas)
  const chartData = useMemo(() => {
    const start = parseISO(inicio);
    const end = parseISO(fim);
    if (differenceInDays(end, start) > 92) {
      // acima de 3 meses, agrega semanalmente
      const total: { dia: string; Entradas: number; Saídas: number }[] = [];
      let cursor = start;
      while (cursor <= end) {
        const w = addDays(cursor, 7);
        const entradas = receitasFiltradas
          .filter(
            (p) =>
              p.data_pagamento &&
              parseISO(p.data_pagamento) >= cursor &&
              parseISO(p.data_pagamento) < w &&
              p.status !== "cancelado",
          )
          .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
        const saidas = despesasFiltradas
          .filter(
            (p) =>
              p.data_pagamento &&
              parseISO(p.data_pagamento) >= cursor &&
              parseISO(p.data_pagamento) < w &&
              p.status !== "cancelado",
          )
          .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
        total.push({ dia: format(cursor, "dd/MM"), Entradas: entradas, Saídas: saidas });
        cursor = w;
      }
      return total;
    }
    return eachDayOfInterval({ start, end }).map((d) => {
      const entradas = receitasFiltradas
        .filter((p) => p.data_pagamento && isSameDay(parseISO(p.data_pagamento), d) && p.status !== "cancelado")
        .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
      const saidas = despesasFiltradas
        .filter((p) => p.data_pagamento && isSameDay(parseISO(p.data_pagamento), d) && p.status !== "cancelado")
        .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
      return { dia: format(d, "dd/MM"), Entradas: entradas, Saídas: saidas };
    });
  }, [receitasFiltradas, despesasFiltradas, inicio, fim]);

  // Mutações
  const marcarParcelaPaga = useMutation({
    mutationFn: async (p: Parc) => {
      const { error } = await supabase
        .from("compras_parcelas")
        .update({
          valor_pago: p.valor,
          data_pagamento: format(new Date(), "yyyy-MM-dd"),
          status: "pago",
        })
        .eq("id", p.id);
      if (error) throw error;
      return p;
    },
    onSuccess: () => {
      toast.success("Parcela quitada");
      qc.invalidateQueries({ queryKey: ["fin-parc"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const marcarPagRecebido = useMutation({
    mutationFn: async (p: Pag) => {
      const { error } = await supabase
        .from("pagamentos")
        .update({
          valor_pago: p.valor_total,
          data_pagamento: format(new Date(), "yyyy-MM-dd"),
          status: "pago",
        })
        .eq("id", p.id);
      if (error) throw error;
      return p;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado");
      qc.invalidateQueries({ queryKey: ["fin-pag"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const cancelarPag = useMutation({
    mutationFn: async (p: Pag) => {
      const { error } = await supabase.from("pagamentos").update({ status: "cancelado" }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento cancelado");
      qc.invalidateQueries({ queryKey: ["fin-pag"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["fin-pag"] });
    qc.invalidateQueries({ queryKey: ["fin-parc"] });
    qc.invalidateQueries({ queryKey: ["fin-fat-competencia"] });
    qc.invalidateQueries({ queryKey: ["fin-pag-ant"] });
  };

  const periodoLabel = `${format(parseISO(inicio), "dd MMM", { locale: ptBR })} — ${format(parseISO(fim), "dd MMM yyyy", { locale: ptBR })}`;

  const exportarPDF = () => {
    try {
      const entradas = receitasFiltradas.map((p) => ({
        data: p.data_pagamento,
        vencimento: p.vencimento,
        cliente: p.cliente?.nome || p.descricao || "—",
        descricao:
          p.descricao ||
          p.observacoes ||
          (p.atendimento?.pet?.nome ? `Atendimento · ${p.atendimento.pet.nome}` : "Recebimento"),
        forma: FORMA_META[p.forma]?.label ?? p.forma,
        status: p.status,
        valor: Number(p.valor_total || 0),
        valor_pago: Number(p.valor_pago || 0),
      }));
      const saidas = despesasFiltradas.map((p) => ({
        data: p.data_pagamento,
        vencimento: p.vencimento,
        fornecedor: p.compra?.fornecedor?.nome || "—",
        descricao:
          p.compra?.descricao ||
          p.compra?.numero_documento ||
          `Parcela ${p.numero}/${p.total_parcelas}`,
        categoria: p.compra?.categoria?.nome ?? null,
        forma: p.forma_pagamento ? (FORMA_META[p.forma_pagamento]?.label ?? p.forma_pagamento) : "—",
        status: p.status,
        valor: Number(p.valor || 0),
        valor_pago: Number(p.valor_pago || 0),
      }));
      generateFinanceiroPDF({
        empresa: empresaInfo,
        periodo: { de: inicio, ate: fim },
        filtrosAtivos: filtrosAtivos.map((f) => f.label),
        kpis: kpis,
        porForma: porForma.map((r) => ({ label: r.label, valor: r.valor, qtd: r.qtd, pct: r.pct })),
        entradas,
        saidas,
      });
      toast.success("Relatório PDF gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-[hsl(var(--background))] min-h-screen">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-semibold">Financeiro</h1>
          </div>
          <p className="text-sm text-muted-foreground lowercase">{periodoLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportarPDF} className="gap-2">
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
          <TesteToolbar onChange={refreshAll} />
          <LancamentoManualDialog onCreated={refreshAll} />
        </div>
      </header>

      {/* Filtros */}
      <Card className="border-primary/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["hoje", "ontem", "semana", "mes", "personalizado"] as Preset[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "default" : "outline"}
                onClick={() => aplicarPreset(p)}
              >
                {p === "hoje" && "Hoje"}
                {p === "ontem" && "Ontem"}
                {p === "semana" && "Semana"}
                {p === "mes" && "Mês"}
                {p === "personalizado" && "Personalizado"}
              </Button>
            ))}
            <Input
              type="date"
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value);
                setPreset("personalizado");
              }}
              className="w-[150px]"
            />
            <span className="text-muted-foreground text-sm">até</span>
            <Input
              type="date"
              value={fim}
              onChange={(e) => {
                setFim(e.target.value);
                setPreset("personalizado");
              }}
              className="w-[150px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(["todos", "entradas", "saidas"] as const).map((b) => (
                <Button
                  key={b}
                  size="sm"
                  variant={fBloco === b ? "default" : "outline"}
                  onClick={() => setFBloco(b)}
                >
                  {b === "todos" ? "Todos" : b === "entradas" ? "Entradas" : "Saídas"}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {Object.entries(FORMA_META)
                .filter(([k]) => k !== "pendente")
                .map(([k, m]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={fFormas.includes(k) ? "default" : "outline"}
                    onClick={() => toggleForma(k)}
                    className="capitalize"
                    style={fFormas.includes(k) ? { backgroundColor: m.color, borderColor: m.color } : undefined}
                  >
                    {m.label}
                  </Button>
                ))}
            </div>

            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Status: todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="parcial">Pago parcialmente</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Vencido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={fCategoria} onValueChange={setFCategoria}>
              <SelectTrigger className="w-[190px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Categoria: todas</SelectItem>
                <SelectItem value="servico">Serviço</SelectItem>
                {CATEGORIA_RECEITA_OPTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cliente: todos</SelectItem>
                {clientesUnicos.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <input
                type="checkbox"
                checked={incluirTeste}
                onChange={(e) => setIncluirTeste(e.target.checked)}
              />
              Incluir teste
            </label>

            <Button size="sm" variant="ghost" onClick={limparFiltros} className="ml-auto">
              <X className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          </div>

          {filtrosAtivos.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-primary/10">
              <span className="text-xs text-muted-foreground self-center mr-1">Filtros ativos:</span>
              {filtrosAtivos.map((f, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={f.onRemove}
                >
                  {f.label} <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Receita bruta" value={brl(kpis.receitaBruta)} icon={<TrendingUp className="h-4 w-4" />} accent="emerald" hint="Competência" />
        <KpiCard label="Total recebido" value={brl(kpis.totalRecebido)} icon={<ArrowUpRight className="h-4 w-4" />} accent="emerald" />
        <KpiCard label="A receber" value={brl(kpis.totalAReceber)} icon={<Clock className="h-4 w-4" />} accent="amber" />
        <KpiCard label="Despesas" value={brl(kpis.despesas)} icon={<ArrowDownRight className="h-4 w-4" />} accent="rose" />
        <KpiCard label="Valores vencidos" value={brl(kpis.vencidos)} icon={<AlertTriangle className="h-4 w-4" />} accent="rose" />
        <KpiCard label="Lucro estimado" value={brl(kpis.lucroEstimado)} icon={<Coins className="h-4 w-4" />} accent={kpis.lucroEstimado >= 0 ? "emerald" : "rose"} hint="Receita − Despesas" />
        <KpiCard label="Saldo do período" value={brl(kpis.saldoPeriodo)} icon={<Scale className="h-4 w-4" />} accent={kpis.saldoPeriodo >= 0 ? "primary" : "rose"} hint="Recebido − Despesas" />
        <KpiCard label="Ticket médio" value={brl(kpis.ticketMedio)} icon={<Receipt className="h-4 w-4" />} accent="primary" hint="Serviços" />
        <KpiCard label="Pagamentos pendentes" value={String(kpis.qtdPendentes)} icon={<Clock className="h-4 w-4" />} accent="slate" />
        <KpiCard label="Aportes/ajustes" value={brl(kpis.aportesAjustes)} icon={<Wallet className="h-4 w-4" />} accent="violet" hint="Não somam ao faturamento" />
      </div>

      {/* Recebimentos por forma */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recebimentos por forma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porForma.filter((r) => r.valor > 0)}
                    dataKey="valor"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {porForma.filter((r) => r.valor > 0).map((r) => (
                      <Cell key={r.forma} fill={r.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Soma: <span className="font-semibold">{brl(porForma.reduce((s, r) => s + r.valor, 0))}</span>
              {" "}· {porForma.reduce((s, r) => s + r.qtd, 0)} pagamentos
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalhamento por forma</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">% receita</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                  <TableHead className="text-right">vs anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porForma.map((r) => (
                  <TableRow key={r.forma}>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: r.color + "22", color: r.color }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                        {r.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{brl(r.valor)}</TableCell>
                    <TableCell className="text-right">{pct(r.pct)}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right font-mono">{brl(r.ticket)}</TableCell>
                    <TableCell
                      className={`text-right font-mono ${r.delta > 0 ? "text-emerald-700" : r.delta < 0 ? "text-rose-700" : "text-muted-foreground"}`}
                    >
                      {r.anterior === 0 && r.valor === 0
                        ? "—"
                        : (r.delta > 0 ? "+" : "") + pct(r.delta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico fluxo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução de receitas e despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c2410c" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#c2410c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="Entradas" stroke="hsl(var(--primary))" fill="url(#gE)" strokeWidth={2} />
                <Area type="monotone" dataKey="Saídas" stroke="#c2410c" fill="url(#gS)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Entradas / Saídas */}
      <Tabs defaultValue="entradas">
        <TabsList>
          <TabsTrigger value="entradas">Entradas ({receitasFiltradas.length})</TabsTrigger>
          <TabsTrigger value="saidas">Saídas ({despesasFiltradas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entradas">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receitasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Sem entradas com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receitasFiltradas.map((p) => {
                      const meta = FORMA_META[p.forma] ?? FORMA_META.pendente;
                      const cat =
                        p.categoria_receita === "servico"
                          ? "Serviço"
                          : CATEGORIA_RECEITA_OPTS.find((x) => x.value === p.categoria_receita)?.label ?? "—";
                      return (
                        <TableRow key={p.id} className={p.is_teste ? "bg-amber-50/40" : ""}>
                          <TableCell className="text-xs">
                            {p.data_pagamento
                              ? format(parseISO(p.data_pagamento), "dd/MM/yy")
                              : p.vencimento
                                ? format(parseISO(p.vencimento), "dd/MM/yy")
                                : "—"}
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate">
                            {p.is_teste && (
                              <Badge variant="outline" className="mr-1 text-[10px] border-amber-400 text-amber-700">
                                TESTE
                              </Badge>
                            )}
                            {p.descricao ||
                              p.atendimento?.pet?.nome ||
                              p.observacoes ||
                              (p.atendimento_id ? "Atendimento" : "Lançamento avulso")}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate">{p.cliente?.nome || "—"}</TableCell>
                          <TableCell className="text-xs">{cat}</TableCell>
                          <TableCell>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                              style={{ backgroundColor: meta.color + "22", color: meta.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadgeCls(p.status)}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {p.status === "parcial" ? (
                              <span>
                                {brl(Number(p.valor_pago))}{" "}
                                <span className="text-muted-foreground">/ {brl(Number(p.valor_total))}</span>
                              </span>
                            ) : (
                              brl(Number(p.valor_total))
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {p.status !== "pago" && p.status !== "cancelado" ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => marcarPagRecebido.mutate(p)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Receber
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm("Cancelar este pagamento?")) cancelarPag.mutate(p);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : p.status === "pago" ? (
                                <Button size="sm" variant="ghost" onClick={() => abrirReciboReceita(p)}>
                                  <FileText className="h-3.5 w-3.5 mr-1" /> Recibo
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saidas">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                        Sem saídas com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    despesasFiltradas.map((p) => {
                      const meta = FORMA_META[p.forma_pagamento ?? "pendente"] ?? FORMA_META.pendente;
                      return (
                        <TableRow key={p.id} className={p.is_teste ? "bg-amber-50/40" : ""}>
                          <TableCell className="text-xs">
                            {p.data_pagamento ? format(parseISO(p.data_pagamento), "dd/MM/yy") : "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {p.is_teste && (
                              <Badge variant="outline" className="mr-1 text-[10px] border-amber-400 text-amber-700">
                                TESTE
                              </Badge>
                            )}
                            {p.compra?.descricao || p.compra?.numero_documento || `Parcela ${p.numero}/${p.total_parcelas}`}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate">{p.compra?.fornecedor?.nome || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {p.compra?.categoria?.nome ? (
                              <Badge variant="outline">{p.compra.categoria.nome}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.compra?.centro_custo?.nome ?? "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                              style={{ backgroundColor: meta.color + "22", color: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{format(parseISO(p.vencimento), "dd/MM/yy")}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadgeCls(p.status)}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{brl(Number(p.valor))}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {p.status !== "pago" ? (
                                <Button size="sm" variant="outline" onClick={() => marcarParcelaPaga.mutate(p)}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pagar
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => abrirReciboDespesa(p)}>
                                  <FileText className="h-3.5 w-3.5 mr-1" /> Comprovante
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {recibo && (
        <ReciboDialog
          open={!!recibo}
          onOpenChange={(v) => !v && setRecibo(null)}
          data={recibo.data}
          telefone={recibo.telefone}
          referenciaId={recibo.referenciaId}
        />
      )}
    </div>
  );
}

/* ============================================================
 * KpiCard
 * ============================================================ */

function KpiCard({
  label,
  value,
  icon,
  accent = "primary",
  hint,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: "primary" | "emerald" | "rose" | "amber" | "slate" | "violet";
  hint?: string;
}) {
  const border: Record<string, string> = {
    primary: "border-t-primary/60",
    emerald: "border-t-emerald-500/60",
    rose: "border-t-rose-500/60",
    amber: "border-t-amber-500/60",
    slate: "border-t-slate-400/60",
    violet: "border-t-violet-500/60",
  };
  const text: Record<string, string> = {
    primary: "text-foreground",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
    slate: "text-foreground",
    violet: "text-violet-700",
  };
  return (
    <Card className={`border-t-2 ${border[accent]} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          {icon} {label}
        </div>
        <div className={`text-xl md:text-2xl font-semibold mt-1 ${text[accent]}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});
