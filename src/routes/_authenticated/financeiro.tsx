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
} from "lucide-react";
import { ReciboDialog } from "@/components/recibo-dialog";
import type { ReciboData } from "@/lib/recibo-pdf";
import { toast } from "sonner";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
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
} from "recharts";

type Pag = {
  id: string;
  valor_total: number;
  valor_pago: number;
  forma: string;
  status: string;
  vencimento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  cliente: { nome: string; telefone: string | null; whatsapp: string | null } | null;
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
  compra: {
    descricao: string | null;
    numero_documento: string | null;
    fornecedor: { nome: string; telefone: string | null; whatsapp: string | null } | null;
    categoria: { nome: string } | null;
  } | null;
};

type ReciboState = {
  data: ReciboData;
  telefone: string | null;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pago: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    parcial: "bg-amber-500/10 text-amber-700 border-amber-200",
    pendente: "bg-slate-500/10 text-slate-700 border-slate-200",
    atrasado: "bg-rose-500/10 text-rose-700 border-rose-200",
    cancelado: "bg-muted text-muted-foreground",
  };
  return map[s] || "bg-primary/10 text-primary border-primary/20";
}

function LancamentoManualDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [categoriaId, setCategoriaId] = useState<string>("none");
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

  const catsFiltradas = cats.filter((c: any) => c.tipo === tipo);

  const salvar = async () => {
    const v = Number(valor.replace(",", "."));
    if (!v || v <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      if (tipo === "receita") {
        // cria um pagamento avulso (sem atendimento) — precisa de cliente_id;
        // usamos o próprio usuário como cliente "sistema" não é ideal — então
        // pedimos pra registrar via módulo próprio. Simplificação: bloqueia.
        toast.info(
          "Receitas avulsas devem ser lançadas via Atendimento ou Pagamentos em aberto.",
        );
        setSaving(false);
        return;
      }
      // Despesa avulsa: cria compra + parcela única quitada
      const { data: forn } = await supabase
        .from("fornecedores")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!forn) {
        toast.error("Cadastre ao menos um fornecedor para lançar despesas.");
        setSaving(false);
        return;
      }
      const { data: compra, error: eC } = await supabase
        .from("compras")
        .insert({
          fornecedor_id: forn.id,
          descricao: descricao || "Lançamento avulso",
          categoria_id: categoriaId !== "none" ? categoriaId : null,
          data_compra: data,
          valor_total: v,
          forma_pagamento: "dinheiro",
          parcelas: 1,
          primeiro_vencimento: data,
        })
        .select("id")
        .single();
      if (eC) throw eC;
      await supabase.rpc("gerar_parcelas_compra", { _compra_id: compra.id });
      // marca parcela como paga
      await supabase
        .from("compras_parcelas")
        .update({
          valor_pago: v,
          data_pagamento: data,
          status: "pago",
          forma_pagamento: "dinheiro",
        })
        .eq("compra_id", compra.id);
      toast.success("Despesa lançada");
      setOpen(false);
      setDescricao("");
      setValor("");
      setCategoriaId("none");
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
      <DialogContent>
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
              Receita
            </Button>
            <Button
              type="button"
              variant={tipo === "despesa" ? "default" : "outline"}
              onClick={() => setTipo("despesa")}
            >
              Despesa
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Conta de luz"
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
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {catsFiltradas.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

function FinanceiroPage() {
  const qc = useQueryClient();
  const hoje = new Date();
  const [inicio, setInicio] = useState(() =>
    format(startOfMonth(hoje), "yyyy-MM-dd"),
  );
  const [fim, setFim] = useState(() => format(endOfMonth(hoje), "yyyy-MM-dd"));

  const setMes = (offset: number) => {
    const base = addMonths(parseISO(inicio), offset);
    setInicio(format(startOfMonth(base), "yyyy-MM-dd"));
    setFim(format(endOfMonth(base), "yyyy-MM-dd"));
  };

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
        contraparte: p.cliente?.nome || "Cliente",
        descricao:
          p.observacoes ||
          `Pagamento de serviços do spa · vencimento ${
            p.vencimento ? format(parseISO(p.vencimento), "dd/MM/yyyy") : "—"
          }`,
        valor: Number(p.valor_total),
        forma: p.forma,
        empresa: empresaInfo,
      },
      telefone: p.cliente?.whatsapp || p.cliente?.telefone || null,
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
        descricao:
          p.compra?.descricao ||
          p.compra?.numero_documento ||
          `Parcela ${p.numero}/${p.total_parcelas}`,
        valor: Number(p.valor),
        forma: p.forma_pagamento || null,
        categoria: p.compra?.categoria?.nome || null,
        empresa: empresaInfo,
      },
      telefone:
        p.compra?.fornecedor?.whatsapp || p.compra?.fornecedor?.telefone || null,
    });
  };

  const { data: pagamentos = [] } = useQuery<Pag[]>({
    queryKey: ["fin-pag", inicio, fim],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select(
          "id, valor_total, valor_pago, forma, status, vencimento, data_pagamento, observacoes, cliente:clientes(nome, telefone, whatsapp)",
        )
        .or(
          `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(vencimento.gte.${inicio},vencimento.lte.${fim})`,
        )
        .order("data_pagamento", { ascending: false, nullsFirst: false });
      return (data as any) || [];
    },
  });

  const { data: parcelas = [] } = useQuery<Parc[]>({
    queryKey: ["fin-parc", inicio, fim],
    queryFn: async () => {
      const { data } = await supabase
        .from("compras_parcelas")
        .select(
          `id, numero, total_parcelas, valor, valor_pago, vencimento, data_pagamento, status, forma_pagamento, observacoes,
           compra:compras(descricao, numero_documento,
             fornecedor:fornecedores(nome, telefone, whatsapp),
             categoria:categorias_financeiras(nome))`,
        )
        .or(
          `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(vencimento.gte.${inicio},vencimento.lte.${fim})`,
        )
        .order("vencimento", { ascending: false });
      return (data as any) || [];
    },
  });

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
    onSuccess: (p) => {
      toast.success("Parcela quitada");
      qc.invalidateQueries({ queryKey: ["fin-parc"] });
      abrirReciboDespesa({
        ...p,
        data_pagamento: format(new Date(), "yyyy-MM-dd"),
        status: "pago",
      });
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
    onSuccess: (p) => {
      toast.success("Recebimento registrado");
      qc.invalidateQueries({ queryKey: ["fin-pag"] });
      abrirReciboReceita({
        ...p,
        data_pagamento: format(new Date(), "yyyy-MM-dd"),
        status: "pago",
      });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const kpis = useMemo(() => {
    const entradas = pagamentos
      .filter((p) => p.data_pagamento && p.data_pagamento >= inicio && p.data_pagamento <= fim)
      .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
    const saidas = parcelas
      .filter((p) => p.data_pagamento && p.data_pagamento >= inicio && p.data_pagamento <= fim)
      .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
    const aReceber = pagamentos
      .filter((p) => p.status !== "pago" && p.status !== "cancelado")
      .reduce((a, p) => a + (Number(p.valor_total) - Number(p.valor_pago || 0)), 0);
    const aPagar = parcelas
      .filter((p) => p.status !== "pago" && p.status !== "cancelado")
      .reduce((a, p) => a + (Number(p.valor) - Number(p.valor_pago || 0)), 0);
    return { entradas, saidas, saldo: entradas - saidas, aReceber, aPagar };
  }, [pagamentos, parcelas, inicio, fim]);

  const chartData = useMemo(() => {
    const dias = eachDayOfInterval({ start: parseISO(inicio), end: parseISO(fim) });
    return dias.map((d) => {
      const entradas = pagamentos
        .filter((p) => p.data_pagamento && isSameDay(parseISO(p.data_pagamento), d))
        .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
      const saidas = parcelas
        .filter((p) => p.data_pagamento && isSameDay(parseISO(p.data_pagamento), d))
        .reduce((a, p) => a + Number(p.valor_pago || 0), 0);
      return {
        dia: format(d, "dd/MM"),
        Entradas: entradas,
        Saídas: saidas,
      };
    });
  }, [pagamentos, parcelas, inicio, fim]);

  const periodo = `${format(parseISO(inicio), "dd MMM", { locale: ptBR })} — ${format(
    parseISO(fim),
    "dd MMM yyyy",
    { locale: ptBR },
  )}`;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-semibold">Financeiro</h1>
          </div>
          <p className="text-sm text-muted-foreground lowercase">{periodo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMes(-1)}>
            ◀ Mês
          </Button>
          <Input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="w-[150px]"
          />
          <Button variant="outline" size="sm" onClick={() => setMes(1)}>
            Mês ▶
          </Button>
          <LancamentoManualDialog
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["fin-parc"] });
              qc.invalidateQueries({ queryKey: ["fin-pag"] });
            }}
          />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-t-2 border-t-emerald-500/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Entradas
            </div>
            <div className="text-xl md:text-2xl font-semibold mt-1 text-emerald-700">
              {brl(kpis.entradas)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-rose-500/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" /> Saídas
            </div>
            <div className="text-xl md:text-2xl font-semibold mt-1 text-rose-700">
              {brl(kpis.saidas)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-amber-400/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> Saldo
            </div>
            <div
              className={`text-xl md:text-2xl font-semibold mt-1 ${kpis.saldo >= 0 ? "text-foreground" : "text-rose-700"}`}
            >
              {brl(kpis.saldo)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> A receber
            </div>
            <div className="text-xl md:text-2xl font-semibold mt-1">{brl(kpis.aReceber)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> A pagar
            </div>
            <div className="text-xl md:text-2xl font-semibold mt-1">{brl(kpis.aPagar)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fluxo de caixa</CardTitle>
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
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="Entradas"
                  stroke="hsl(var(--primary))"
                  fill="url(#gE)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Saídas"
                  stroke="#e11d48"
                  fill="url(#gS)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="receitas">
        <TabsList>
          <TabsTrigger value="receitas">Receitas ({pagamentos.length})</TabsTrigger>
          <TabsTrigger value="despesas">Despesas ({parcelas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="receitas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Sem receitas no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagamentos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.cliente?.nome || "—"}</TableCell>
                        <TableCell>
                          {p.vencimento ? format(parseISO(p.vencimento), "dd/MM/yy") : "—"}
                        </TableCell>
                        <TableCell>
                          {p.data_pagamento
                            ? format(parseISO(p.data_pagamento), "dd/MM/yy")
                            : "—"}
                        </TableCell>
                        <TableCell className="capitalize">{p.forma}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(p.status)}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {brl(Number(p.valor_total))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.status !== "pago" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => marcarPagRecebido.mutate(p)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Receber
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirReciboReceita(p)}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" /> Recibo
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Sem despesas no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    parcelas.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-[220px] truncate">
                          {p.compra?.descricao || p.compra?.numero_documento || "—"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {p.compra?.fornecedor?.nome || "—"}
                        </TableCell>
                        <TableCell>
                          {p.compra?.categoria?.nome ? (
                            <Badge variant="outline">{p.compra.categoria.nome}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.numero}/{p.total_parcelas}
                        </TableCell>
                        <TableCell>{format(parseISO(p.vencimento), "dd/MM/yy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(p.status)}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {brl(Number(p.valor))}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status !== "pago" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => marcarParcelaPaga.mutate(p)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});
