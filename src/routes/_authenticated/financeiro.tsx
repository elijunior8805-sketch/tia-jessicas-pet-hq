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
  atendimento: {
    data_inicio: string | null;
    encerrado_em?: string | null;
    finalizado?: boolean | null;
    valor_executado?: number | null;
    taxa_leva_traz?: number | null;
    desconto?: number | null;
    pet: { nome: string } | null;
  } | null;
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

const valorTotalReceita = (p: Pag) => {
  const atendimento = p.atendimento as any;

  // Quando a receita veio de um atendimento finalizado, o Financeiro deve usar
  // a mesma base do card de Faturamento: valor realizado + Leva e Traz - desconto.
  // Isso evita divergência quando o pagamento foi criado antes de ajustes no atendimento.
  if (atendimento?.finalizado === true && Number(atendimento?.valor_executado ?? 0) > 0) {
    return Math.max(
      0,
      Number(atendimento.valor_executado ?? 0) +
        Number(atendimento.taxa_leva_traz ?? 0) -
        Number(atendimento.desconto ?? 0),
    );
  }

  return Number(p.valor_total || 0);
};

const saldoReceita = (p: Pag) => Math.max(0, valorTotalReceita(p) - Number(p.valor_pago || 0));

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

type Preset = "hoje" | "ontem" | "semana" | "mes" | "30dias" | "personalizado";

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
    case "30dias":
      return { de: fmt(subDays(hoje, 29)), ate: fmt(hoje) };
    default:
      return { de: fmt(subDays(hoje, 29)), ate: fmt(hoje) };
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
  const [incluirTeste, setIncluirTeste] = useState<boolean>(import.meta.env.DEV);
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const IS_DEV = import.meta.env.DEV;

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

  const abrirReciboReceita = async (p: Pag) => {
    const numero = `RC-${format(new Date(), "yyyyMMdd")}-${p.id.slice(0, 6)}`;

    // Busca detalhes do atendimento (check-in etc.) sob demanda
    let atendimentoInfo: ReciboData["atendimento"] = null;
    if (p.atendimento_id) {
      const { data: at } = await supabase
        .from("atendimentos")
        .select(
          "data_inicio, servicos_executados, servicos_planejados, observacoes_checkin, observacoes_internas, comportamentos, usou_focinheira, precisou_pausa, alergia_observada, recomendacoes, proxima_visita, profissional_id, pet:pets(nome)",
        )
        .eq("id", p.atendimento_id)
        .maybeSingle();


      if (at) {
        const src =
          Array.isArray(at.servicos_executados) &&
          at.servicos_executados.length > 0
            ? at.servicos_executados
            : Array.isArray(at.servicos_planejados)
              ? at.servicos_planejados
              : [];
        const servicos = (src as Array<Record<string, unknown>>)
          .map((s) => (s?.nome as string) || "")
          .filter(Boolean);
        atendimentoInfo = {
          data: at.data_inicio ?? null,
          pet: at.pet?.nome ?? null,
          servicos,
          profissional: "Jéssica Xavier",

          checkin_obs: at.observacoes_checkin ?? null,
          observacoes_internas: at.observacoes_internas ?? null,
          comportamentos: (at.comportamentos as string[] | null) ?? null,
          usou_focinheira: at.usou_focinheira ?? null,
          precisou_pausa: at.precisou_pausa ?? null,
          alergia_observada: at.alergia_observada ?? null,
          recomendacoes: at.recomendacoes ?? null,
          proxima_visita: at.proxima_visita ?? null,
        };
      }
    }

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
        valor: valorTotalReceita(p),
        forma: p.forma,
        petNome: p.atendimento?.pet?.nome ?? null,
        empresa: empresaInfo,
        atendimento: atendimentoInfo,
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
          "id, atendimento_id, valor_total, valor_pago, forma, status, vencimento, data_pagamento, observacoes, descricao, categoria_receita, is_teste, cliente:clientes(nome, telefone, whatsapp), atendimento:atendimentos(data_inicio, encerrado_em, finalizado, valor_executado, taxa_leva_traz, desconto, pet:pets(nome))",
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

  // Faturamento por competência — mesma regra do Painel Principal:
  // apenas atendimentos EFETIVAMENTE encerrados (finalizado=true,
  // encerrado_em preenchido e valor_executado > 0). Valor planejado
  // de atendimentos abertos NÃO entra no faturamento.
  // Considera o período por encerrado_em (fallback data_inicio).
  const { data: faturamentoCompetencia = 0 } = useQuery<number>({
    queryKey: ["fin-fat-competencia", inicio, fim],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const shiftDay = (iso: string, delta: number) => {
        const d = new Date(`${iso}T12:00:00`);
        d.setDate(d.getDate() + delta);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const iniWide = shiftDay(inicio, -1);
      const fimWide = shiftDay(fim, 1);
      const toLocalDay = (v: any): string => {
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v).slice(0, 10);
        return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      };
      const { data } = await supabase
        .from("atendimentos")
        .select("valor_executado, taxa_leva_traz, desconto, encerrado_em, data_inicio, finalizado")
        .or(
          `and(data_inicio.gte.${iniWide}T00:00:00.000Z,data_inicio.lte.${fimWide}T23:59:59.999Z),and(encerrado_em.gte.${iniWide}T00:00:00.000Z,encerrado_em.lte.${fimWide}T23:59:59.999Z)`,
        );
      const rows = (data as any[]) || [];
      return rows.reduce((s, r) => {
        const exec = Number(r.valor_executado ?? 0);
        if (!(exec > 0 && !!r.encerrado_em && r.finalizado === true)) return s;
        const ref = toLocalDay(r.encerrado_em ?? r.data_inicio);
        if (ref < inicio || ref > fim) return s;
        return s + Math.max(0, exec + Number(r.taxa_leva_traz ?? 0) - Number(r.desconto ?? 0));
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

    // "Serviço" recebido para ticket médio (exclui aportes/ajustes; apenas com valor_pago > 0)
    const recServico = recebidosRows.filter((p) => p.categoria_receita === "servico" && Number(p.valor_pago || 0) > 0);
    const ticketMedio = recServico.length ? recServico.reduce((s, p) => s + Number(p.valor_pago || 0), 0) / recServico.length : 0;

    // Aportes / Ajustes separados
    const aportesAjustes = recebidosRows
      .filter((p) => p.categoria_receita === "aporte" || p.categoria_receita === "ajuste")
      .reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    // A receber (saldo em aberto com vencimento no período — exclui aportes/ajustes)
    const emAberto = receitasFiltradas.filter((p) => {
      if (p.status === "pago" || p.status === "cancelado") return false;
      if (p.categoria_receita === "aporte" || p.categoria_receita === "ajuste") return false;
      if (!p.vencimento) return false;
      if (p.vencimento < inicio || p.vencimento > fim) return false;
      const saldo = saldoReceita(p);
      return saldo > 0.005;
    });
    const totalAReceber = emAberto.reduce((s, p) => s + saldoReceita(p), 0);
    const totalVencidos = emAberto
      .filter((p) => p.vencimento && p.vencimento < hojeStr)
      .reduce((s, p) => s + saldoReceita(p), 0);
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
          valor_pago: valorTotalReceita(p),
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
        valor: valorTotalReceita(p),
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
    <TooltipProvider delayDuration={200}>
    <div className="min-h-screen bg-[color:var(--color-background)]">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">

        {/* ============ Cabeçalho ============ */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight md:text-3xl">
                Financeiro
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">{periodoLabel}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={exportarPDF} className="gap-2 rounded-xl">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar PDF</span>
            </Button>
            <LancamentoManualDialog onCreated={refreshAll} />
          </div>
        </header>

        {/* Toolbar de teste (apenas em DEV) */}
        {IS_DEV && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-50/60 px-3 py-2">
            <FlaskConical className="h-4 w-4 text-amber-700" />
            <span className="text-xs text-amber-800">Ferramentas de teste (visíveis somente em desenvolvimento)</span>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={incluirTeste}
                  onChange={(e) => setIncluirTeste(e.target.checked)}
                />
                Incluir teste
              </label>
              <TesteToolbar onChange={refreshAll} />
            </div>
          </div>
        )}

        {/* ============ Filtros ============ */}
        <section className="card-premium overflow-hidden">
          <div className="flex flex-col gap-3 p-4">
            {/* Presets + range */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-muted p-1">
                {(["hoje", "ontem", "semana", "mes", "personalizado"] as Preset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => aplicarPreset(p)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      preset === p
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p === "hoje" && "Hoje"}
                    {p === "ontem" && "Ontem"}
                    {p === "semana" && "Semana"}
                    {p === "mes" && "Mês"}
                    {p === "personalizado" && "Personalizado"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={inicio}
                  onChange={(e) => { setInicio(e.target.value); setPreset("personalizado"); }}
                  className="h-9 w-[145px] rounded-xl"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={fim}
                  onChange={(e) => { setFim(e.target.value); setPreset("personalizado"); }}
                  className="h-9 w-[145px] rounded-xl"
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="inline-flex rounded-xl bg-muted p-1">
                  {(["todos", "entradas", "saidas"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setFBloco(b)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                        fBloco === b
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {b === "todos" ? "Todos" : b === "entradas" ? "Entradas" : "Saídas"}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMoreFilters((v) => !v)}
                  className="gap-2 rounded-xl"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Mais filtros</span>
                  {filtrosAtivos.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                      {filtrosAtivos.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* Filtros avançados */}
            {showMoreFilters && (
              <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
                  <Select
                    value={fFormas.length === 1 ? fFormas[0] : fFormas.length === 0 ? "todas" : "multi"}
                    onValueChange={(v) => setFFormas(v === "todas" ? [] : [v])}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as formas</SelectItem>
                      {Object.entries(FORMA_META)
                        .filter(([k]) => k !== "pendente")
                        .map(([k, m]) => (
                          <SelectItem key={k} value={k}>
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                              {m.label}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</Label>
                  <Select value={fStatus} onValueChange={setFStatus}>
                    <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="parcial">Pago parcialmente</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="atrasado">Vencido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Categoria</Label>
                  <Select value={fCategoria} onValueChange={setFCategoria}>
                    <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                      {CATEGORIA_RECEITA_OPTS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</Label>
                  <Select value={fCliente} onValueChange={setFCliente}>
                    <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {clientesUnicos.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={limparFiltros} className="rounded-xl">
                    <X className="h-4 w-4 mr-1" /> Limpar filtros
                  </Button>
                </div>
              </div>
            )}

            {filtrosAtivos.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t border-border pt-2">
                <span className="mr-1 self-center text-xs text-muted-foreground">
                  <Filter className="inline h-3 w-3 mr-1" />
                  Ativos:
                </span>
                {filtrosAtivos.map((f, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer rounded-full border-primary/20 bg-primary/5 hover:bg-primary/10"
                    onClick={f.onRemove}
                  >
                    {f.label} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============ KPIs — Linha 1 (destaque) ============ */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroKpi
            label="Receita bruta"
            value={brl(kpis.receitaBruta)}
            hint="Faturamento por competência"
            tooltip="Soma dos atendimentos do período (valor executado ou planejado)."
            accent="emerald"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <HeroKpi
            label="Total recebido"
            value={brl(kpis.totalRecebido)}
            hint="Caixa efetivo no período"
            tooltip="Soma dos pagamentos com data de pagamento dentro do período."
            accent="primary"
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
          <HeroKpi
            label="Despesas"
            value={brl(kpis.despesas)}
            hint="Parcelas pagas no período"
            tooltip="Soma das parcelas de compras quitadas no período."
            accent="terracotta"
            icon={<ArrowDownRight className="h-4 w-4" />}
          />
          <HeroKpi
            label="Lucro estimado"
            value={brl(kpis.lucroEstimado)}
            hint="Receita bruta − Despesas"
            tooltip="Receita por competência menos despesas pagas no período."
            accent={kpis.lucroEstimado >= 0 ? "gold" : "terracotta"}
            icon={<Coins className="h-4 w-4" />}
          />
        </section>

        {/* ============ KPIs — Linha 2 ============ */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniKpi
            label="Saldo do período"
            value={brl(kpis.saldoPeriodo)}
            icon={<Scale className="h-3.5 w-3.5" />}
            tone={kpis.saldoPeriodo >= 0 ? "positive" : "negative"}
            tooltip="Recebido − Despesas do período."
          />
          <MiniKpi
            label="A receber"
            value={brl(kpis.totalAReceber)}
            icon={<Clock className="h-3.5 w-3.5" />}
            tone="neutral"
            tooltip="Saldo em aberto (pendentes + parciais)."
          />
          <MiniKpi
            label="Vencidos"
            value={brl(kpis.vencidos)}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            tone="negative"
            tooltip="Parcelas em aberto com vencimento anterior a hoje."
          />
          <MiniKpi
            label="Ticket médio"
            value={brl(kpis.ticketMedio)}
            icon={<Receipt className="h-3.5 w-3.5" />}
            tone="neutral"
            tooltip="Média dos recebimentos de serviços no período."
          />
          <MiniKpi
            label="Pendentes"
            value={String(kpis.qtdPendentes)}
            icon={<Clock className="h-3.5 w-3.5" />}
            tone="neutral"
            tooltip="Quantidade de pagamentos em aberto."
          />
          <MiniKpi
            label="Aportes/ajustes"
            value={brl(kpis.aportesAjustes)}
            icon={<Wallet className="h-3.5 w-3.5" />}
            tone="neutral"
            tooltip="Não somam ao faturamento de serviços."
          />
        </section>

        {/* ============ Recebimentos por forma de pagamento ============ */}
        <section className="card-premium overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">Recebimentos por forma de pagamento</h2>
              <p className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{brl(porForma.reduce((s, r) => s + r.valor, 0))}</span>
                {" · "}{porForma.reduce((s, r) => s + r.qtd, 0)} pagamentos
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-[1fr_1.4fr]">
            {/* Rosca */}
            <div className="min-h-[240px]">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={porForma.filter((r) => r.valor > 0)}
                    dataKey="valor"
                    nameKey="label"
                    innerRadius={62}
                    outerRadius={100}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {porForma.filter((r) => r.valor > 0).map((r) => (
                      <Cell key={r.forma} fill={r.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--color-border)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cards por forma */}
            <div className="grid gap-2 sm:grid-cols-2">
              {porForma.map((r) => (
                <div
                  key={r.forma}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg"
                    style={{ background: `${r.color}22`, border: `1px solid ${r.color}55` }}
                  >
                    <div className="grid h-full w-full place-items-center">
                      <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{pct(r.pct)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{brl(r.valor)}</span>
                      <span className="text-[11px] text-muted-foreground">{r.qtd} pgto</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Evolução ============ */}
        <section className="card-premium overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-display text-lg font-semibold">Evolução de receitas e despesas</h2>
            <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-emerald)]" /> Entradas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-terracotta)]" /> Saídas
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="h-56 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-emerald)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-emerald)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="dia" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--color-border)" }}
                  />
                  <Area type="monotone" dataKey="Entradas" stroke="var(--color-emerald)" fill="url(#gE)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="Saídas" stroke="var(--color-terracotta)" fill="url(#gS)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ============ Lançamentos ============ */}
        <section className="card-premium overflow-hidden">
          <Tabs defaultValue="entradas">
            <div className="flex items-center justify-between border-b border-border px-4 pt-4">
              <TabsList className="bg-muted">
                <TabsTrigger value="entradas" className="rounded-lg">
                  Entradas <Badge variant="secondary" className="ml-2">{receitasFiltradas.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="saidas" className="rounded-lg">
                  Saídas <Badge variant="secondary" className="ml-2">{despesasFiltradas.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="entradas" className="mt-0">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receitasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          Sem entradas com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      receitasFiltradas.map((p) => {
                        const meta = FORMA_META[p.forma] ?? FORMA_META.pendente;
                        const totalReceita = valorTotalReceita(p);
                        const cat =
                          p.categoria_receita === "servico"
                            ? "Serviço"
                            : CATEGORIA_RECEITA_OPTS.find((x) => x.value === p.categoria_receita)?.label ?? "—";
                        return (
                          <TableRow key={p.id} className={cn("border-border", p.is_teste && "bg-amber-50/40")}>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.data_pagamento
                                ? format(parseISO(p.data_pagamento), "dd/MM/yy")
                                : p.vencimento
                                  ? format(parseISO(p.vencimento), "dd/MM/yy")
                                  : "—"}
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate">
                              {p.is_teste && (
                                <Badge variant="outline" className="mr-1 border-amber-400 text-[10px] text-amber-700">
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
                              <FormaChip meta={meta} />
                            </TableCell>
                            <TableCell>
                              <StatusChip status={p.status} />
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {p.status === "parcial" ? (
                                <span>
                                  {brl(Number(p.valor_pago))}{" "}
                                  <span className="text-xs text-muted-foreground">/ {brl(totalReceita)}</span>
                                </span>
                              ) : (
                                brl(totalReceita)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {p.status !== "pago" && p.status !== "cancelado" && (
                                    <>
                                      <DropdownMenuItem onClick={() => marcarPagRecebido.mutate(p)}>
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como recebido
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => { if (confirm("Cancelar este pagamento?")) cancelarPag.mutate(p); }}
                                      >
                                        <X className="mr-2 h-4 w-4" /> Cancelar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {p.status === "pago" && (
                                    <DropdownMenuItem onClick={() => abrirReciboReceita(p)}>
                                      <FileText className="mr-2 h-4 w-4" /> Emitir recibo
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-2 p-3 md:hidden">
                {receitasFiltradas.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Sem entradas com os filtros atuais.
                  </p>
                ) : (
                  receitasFiltradas.map((p) => {
                    const meta = FORMA_META[p.forma] ?? FORMA_META.pendente;
                    const totalReceita = valorTotalReceita(p);
                    return (
                      <div key={p.id} className={cn("rounded-xl border border-border bg-card p-3", p.is_teste && "bg-amber-50/40")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {p.descricao || p.atendimento?.pet?.nome || p.cliente?.nome || "Lançamento"}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground truncate">
                              {p.cliente?.nome ?? "—"}
                              {" · "}
                              {p.data_pagamento ? format(parseISO(p.data_pagamento), "dd/MM/yy") : "—"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm font-semibold">{brl(totalReceita)}</div>
                            <StatusChip status={p.status} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <FormaChip meta={meta} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {p.status !== "pago" && p.status !== "cancelado" && (
                                <>
                                  <DropdownMenuItem onClick={() => marcarPagRecebido.mutate(p)}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Receber
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => { if (confirm("Cancelar este pagamento?")) cancelarPag.mutate(p); }}
                                  >
                                    <X className="mr-2 h-4 w-4" /> Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}
                              {p.status === "pago" && (
                                <DropdownMenuItem onClick={() => abrirReciboReceita(p)}>
                                  <FileText className="mr-2 h-4 w-4" /> Recibo
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="saidas" className="mt-0">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                          Sem saídas com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      despesasFiltradas.map((p) => {
                        const meta = FORMA_META[p.forma_pagamento ?? "pendente"] ?? FORMA_META.pendente;
                        return (
                          <TableRow key={p.id} className={cn("border-border", p.is_teste && "bg-amber-50/40")}>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.data_pagamento ? format(parseISO(p.data_pagamento), "dd/MM/yy") : "—"}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate">
                              {p.is_teste && (
                                <Badge variant="outline" className="mr-1 border-amber-400 text-[10px] text-amber-700">
                                  TESTE
                                </Badge>
                              )}
                              {p.compra?.descricao || p.compra?.numero_documento || `Parcela ${p.numero}/${p.total_parcelas}`}
                            </TableCell>
                            <TableCell className="max-w-[140px] truncate">{p.compra?.fornecedor?.nome || "—"}</TableCell>
                            <TableCell className="text-xs">
                              {p.compra?.categoria?.nome ? (
                                <Badge variant="outline" className="rounded-full">{p.compra.categoria.nome}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <FormaChip meta={meta} />
                            </TableCell>
                            <TableCell className="text-xs">{format(parseISO(p.vencimento), "dd/MM/yy")}</TableCell>
                            <TableCell>
                              <StatusChip status={p.status} />
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{brl(Number(p.valor))}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {p.status !== "pago" ? (
                                    <DropdownMenuItem onClick={() => marcarParcelaPaga.mutate(p)}>
                                      <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como pago
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => abrirReciboDespesa(p)}>
                                      <FileText className="mr-2 h-4 w-4" /> Comprovante
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-2 p-3 md:hidden">
                {despesasFiltradas.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Sem saídas com os filtros atuais.
                  </p>
                ) : (
                  despesasFiltradas.map((p) => {
                    const meta = FORMA_META[p.forma_pagamento ?? "pendente"] ?? FORMA_META.pendente;
                    return (
                      <div key={p.id} className={cn("rounded-xl border border-border bg-card p-3", p.is_teste && "bg-amber-50/40")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {p.compra?.descricao || `Parcela ${p.numero}/${p.total_parcelas}`}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {p.compra?.fornecedor?.nome ?? "—"}
                              {" · Venc: "}{format(parseISO(p.vencimento), "dd/MM/yy")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm font-semibold">{brl(Number(p.valor))}</div>
                            <StatusChip status={p.status} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <FormaChip meta={meta} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {p.status !== "pago" ? (
                                <DropdownMenuItem onClick={() => marcarParcelaPaga.mutate(p)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Pagar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => abrirReciboDespesa(p)}>
                                  <FileText className="mr-2 h-4 w-4" /> Comprovante
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

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
    </div>
    </TooltipProvider>
  );
}

/* ============================================================
 * Componentes visuais
 * ============================================================ */

function HeroKpi({
  label,
  value,
  hint,
  tooltip,
  accent,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
  accent: "primary" | "emerald" | "terracotta" | "gold" | "petrol";
  icon?: React.ReactNode;
}) {
  const accentMap: Record<string, { bg: string; text: string; ring: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/15" },
    emerald: { bg: "bg-[color:var(--color-emerald)]/10", text: "text-[color:var(--color-emerald)]", ring: "ring-[color:var(--color-emerald)]/15" },
    terracotta: { bg: "bg-[color:var(--color-terracotta)]/10", text: "text-[color:var(--color-terracotta)]", ring: "ring-[color:var(--color-terracotta)]/15" },
    gold: { bg: "bg-[color:var(--color-gold)]/15", text: "text-[color:var(--color-gold-foreground)]", ring: "ring-[color:var(--color-gold)]/25" },
    petrol: { bg: "bg-[color:var(--color-petrol)]/10", text: "text-[color:var(--color-petrol)]", ring: "ring-[color:var(--color-petrol)]/15" },
  };
  const a = accentMap[accent];
  return (
    <div className="card-premium card-hover p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className={cn("grid h-9 w-9 place-items-center rounded-xl ring-1", a.bg, a.ring)}>
          <span className={a.text}>{icon}</span>
        </div>
        {tooltip && (
          <UITooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
          </UITooltip>
        )}
      </div>
      <div className="mt-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("mt-1 font-display text-2xl font-semibold md:text-3xl", a.text)}>{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  icon,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone: "positive" | "negative" | "neutral";
  tooltip?: string;
}) {
  const toneCls =
    tone === "positive"
      ? "text-[color:var(--color-emerald)]"
      : tone === "negative"
        ? "text-[color:var(--color-terracotta)]"
        : "text-foreground";
  return (
    <div className="card-premium p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
        {tooltip && (
          <UITooltip>
            <TooltipTrigger asChild>
              <button type="button" className="ml-auto text-muted-foreground/50 hover:text-muted-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
          </UITooltip>
        )}
      </div>
      <div className={cn("mt-1 font-mono text-base font-semibold md:text-lg", toneCls)}>{value}</div>
    </div>
  );
}

function FormaChip({ meta }: { meta: { label: string; color: string } }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: meta.color + "1f", color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Pago", cls: "bg-[color:var(--color-emerald)]/12 text-[color:var(--color-emerald)] border-[color:var(--color-emerald)]/25" },
    parcial: { label: "Parcial", cls: "bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold-foreground)] border-[color:var(--color-gold)]/30" },
    pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground border-border" },
    atrasado: { label: "Vencido", cls: "bg-[color:var(--color-terracotta)]/12 text-[color:var(--color-terracotta)] border-[color:var(--color-terracotta)]/25" },
    cancelado: { label: "Cancelado", cls: "bg-muted/50 text-muted-foreground border-transparent" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

/* ============================================================
 * (KpiCard antigo — mantido para compat, não usado)
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
  return (
    <Card className={`border-t-2 ${border[accent]} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          {icon} {label}
        </div>
        <div className="text-xl md:text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}


export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});
