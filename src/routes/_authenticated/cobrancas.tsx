import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeFinanceiro } from "@/lib/use-realtime-financeiro";
import {
  listarCobrancas,
  kpisCobrancas,
  historicoCobranca,
  registrarEnvio,
  registrarPromessa,
  alterarStatusCobranca,
  pausarCobranca,
  marcarPagamento,
  quitarCobrancaComReativacao,
  registrarRespostaCliente,
  sugerirMensagemCobranca,
  obterConfigCobranca,
  salvarConfigCobranca,
  salvarTemplateCobranca,
  filaDoDia as FILA_FN,
  funilCobrancas as FUNIL_FN,
  excluirCobranca,
  restaurarCobranca,
  listarCobrancasArquivadas,
  type CobrancaArquivadaDTO,
  type CobrancaDTO,
  type CobrancaStatus,
} from "@/lib/cobrancas.functions";
import {
  filaPriorizada,
  type FilaItemDTO
} from "@/lib/cobrancas.functions";
import { CobrancaPainelLateral } from "@/components/cobrancas/CobrancaPainelLateral";
import { JessiAutoRecoveryHero } from "@/components/cobrancas/JessiAutoRecoveryHero";
import { DisparoLoteInteligenteDialog } from "@/components/cobrancas/DisparoLoteInteligenteDialog";
import { MesaNegociacaoDialog } from "@/components/cobrancas/MesaNegociacaoDialog";
import {
  ReativacaoPosQuitacaoDialog,
  type ReativacaoDados,
} from "@/components/cobrancas/ReativacaoPosQuitacaoDialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  HandCoins,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  MessageCircle,
  Sparkles,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  Archive,
  RotateCcw,
  Zap,
  CheckSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppComposer, useWhatsAppComposer, openWhatsAppComposerGlobal } from "@/components/whatsapp-composer";

export const Route = createFileRoute("/_authenticated/cobrancas")({
  component: CobrancasPage,
});

const STATUS_LABEL: Record<CobrancaStatus, string> = {
  a_vencer: "A vencer",
  vencido: "Vencido",
  enviada: "Enviada",
  respondeu: "Respondeu",
  promessa: "Promessa",
  pago_parcial: "Pago parcial",
  pago: "Pago",
  negociado: "Negociado",
  sem_retorno: "Sem retorno",
  pausada: "Pausada",
};

const STATUS_CLASS: Record<CobrancaStatus, string> = {
  a_vencer: "bg-amber-100 text-amber-900 border-amber-200",
  vencido: "bg-rose-100 text-rose-900 border-rose-200",
  enviada: "bg-sky-100 text-sky-900 border-sky-200",
  respondeu: "bg-indigo-100 text-indigo-900 border-indigo-200",
  promessa: "bg-violet-100 text-violet-900 border-violet-200",
  pago_parcial: "bg-teal-100 text-teal-900 border-teal-200",
  pago: "bg-emerald-100 text-emerald-900 border-emerald-200",
  negociado: "bg-blue-100 text-blue-900 border-blue-200",
  sem_retorno: "bg-zinc-200 text-zinc-800 border-zinc-300",
  pausada: "bg-neutral-200 text-neutral-800 border-neutral-300",
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("pt-BR");
}

function CobrancasPage() {
  const qc = useQueryClient();
  const listar = useServerFn(listarCobrancas);
  const kpis = useServerFn(kpisCobrancas);
  const filaFn = useServerFn(filaPriorizada);
  const excluirFn = useServerFn(excluirCobranca);
  const quitarReativarFn = useServerFn(quitarCobrancaComReativacao);

  const [filtro, setFiltro] = useState<{
    status: string[];
    clienteNome: string;
    atrasoFaixa: "todos" | "0_3" | "4_7" | "8_15" | "15p";
  }>({ status: [], clienteNome: "", atrasoFaixa: "todos" });

  const qKpis = useQuery({ queryKey: ["cobrancas", "kpis"], queryFn: () => kpis() });
  const qFila = useQuery({ queryKey: ["cobrancas", "fila-priorizada"], queryFn: () => filaFn() });
  const qLista = useQuery({
    queryKey: ["cobrancas", "lista", filtro],
    queryFn: () =>
      listar({
        data: {
          status: filtro.status.length ? filtro.status : undefined,
          clienteNome: filtro.clienteNome || null,
          atrasoFaixa: filtro.atrasoFaixa,
        },
      }),
  });

  // Realtime
  useRealtimeFinanceiro(["cobrancas"]);

  // Estados de Modais 2.0
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<CobrancaDTO | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  // Disparo em Lote
  const [showDisparoLote, setShowDisparoLote] = useState(false);
  const [disparoLoteIds, setDisparoLoteIds] = useState<string[] | undefined>(undefined);

  // Mesa de Negociação
  const [negociacaoCobranca, setNegociacaoCobranca] = useState<CobrancaDTO | FilaItemDTO | null>(null);

  // Reativação Pós-Quitação
  const [reativacaoDados, setReativacaoDados] = useState<ReativacaoDados | null>(null);
  const [showReativacao, setShowReativacao] = useState(false);

  // Multi-seleção em Lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const composer = useWhatsAppComposer();

  const handleToggleSelect = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFila = () => {
    const filaIds = (qFila.data ?? []).map((it) => it.id);
    if (selecionados.size === filaIds.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filaIds));
    }
  };

  const handleQuitarComReativacao = async (cobrancaId: string) => {
    try {
      const res = await quitarReativarFn({
        data: { cobrancaId },
      });
      toast.success("Pagamento quitado com sucesso!");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      qc.invalidateQueries({ queryKey: ["fin-pag"] });
      qc.invalidateQueries({ queryKey: ["fin-unified-metrics"] });

      if (res && res.ok) {
        setReativacaoDados(res);
        setShowReativacao(true);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao quitar pagamento");
    }
  };

  const handleQuitarSelecionados = async () => {
    if (selecionados.size === 0) return;
    const count = selecionados.size;
    let lastRes: any = null;

    toast.loading(`Quitando ${count} cobranças selecionadas...`, { id: "quitar-lote" });
    try {
      for (const id of Array.from(selecionados)) {
        lastRes = await quitarReativarFn({ data: { cobrancaId: id } });
      }
      toast.success(`${count} cobranças quitadas com sucesso!`, { id: "quitar-lote" });
      setSelecionados(new Set());
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      qc.invalidateQueries({ queryKey: ["fin-pag"] });
      qc.invalidateQueries({ queryKey: ["fin-unified-metrics"] });

      if (lastRes && lastRes.ok) {
        setReativacaoDados(lastRes);
        setShowReativacao(true);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao quitar lote", { id: "quitar-lote" });
    }
  };

  const handleExcluirSelecionados = async () => {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Mover ${selecionados.size} cobranças para a lixeira?`)) return;

    try {
      for (const id of Array.from(selecionados)) {
        await excluirFn({ data: { cobrancaId: id } });
      }
      toast.success(`${selecionados.size} cobranças enviadas para a lixeira`);
      setSelecionados(new Set());
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao excluir selecionados");
    }
  };

  const totalFila = (qFila.data ?? []).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 pb-24">
      {/* Header com Navegação */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Central de Cobrança & Recuperação 2.0</h1>
            <p className="text-sm text-muted-foreground">
              Régua autônoma de recuperação, negociação com IA e reativação de clientes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            Régua e Templates
          </Button>
        </div>
      </header>

      {/* Hero Autônomo da Jessi 2.0 */}
      <JessiAutoRecoveryHero
        kpis={qKpis.data}
        totalFila={totalFila}
        onExecutarRegua={() => {
          setDisparoLoteIds(undefined);
          setShowDisparoLote(true);
        }}
        onRefresh={async () => {
          await Promise.all([qKpis.refetch(), qLista.refetch(), qFila.refetch()]);
          toast.success("Dados de cobrança e pagamentos reconciliados com sucesso!");
        }}
        isRefreshing={qKpis.isFetching || qLista.isFetching || qFila.isFetching}
      />

      {/* Grid de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Total em atraso"
          value={qKpis.data ? brl(qKpis.data.total_atraso) : "—"}
          hint={qKpis.data ? `${qKpis.data.qtd_inadimplentes} clientes` : ""}
          tone="rose"
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Vence hoje"
          value={qKpis.data ? String(qKpis.data.vence_hoje) : "—"}
          tone="amber"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Atraso > 7 dias"
          value={qKpis.data ? brl(qKpis.data.atraso_maior_7d) : "—"}
          tone="violet"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Recuperado no mês"
          value={qKpis.data ? brl(qKpis.data.recuperado_mes) : "—"}
          hint={
            qKpis.data ? `${Math.round(qKpis.data.taxa_recuperacao * 100)}% de recuperação` : ""
          }
          tone="emerald"
        />
      </div>

      {/* Abas Principais */}
      <Tabs defaultValue="fila" className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="fila" className="gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Fila do Dia
            {totalFila > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                {totalFila}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="todas">Todas as Cobranças</TabsTrigger>
          <TabsTrigger value="funil">Funil de Recuperação</TabsTrigger>
          <TabsTrigger value="lixeira" className="gap-1.5">
            <Archive className="h-3.5 w-3.5" />
            Lixeira
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fila">
          <FilaDoDiaTab
            onSelect={(c) => setSelecionadaId(c.id)}
            selecionados={selecionados}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllFila}
            onAbrirNegociacao={(c) => setNegociacaoCobranca(c)}
            onQuitar={(c) => handleQuitarComReativacao(c.id)}
          />
        </TabsContent>

        <TabsContent value="todas">
          <TodasCobrancasTab
            filtro={filtro}
            setFiltro={setFiltro}
            onSelect={(c) => setSelecionadaId(c.id)}
            selecionados={selecionados}
            onToggleSelect={handleToggleSelect}
            onAbrirNegociacao={(c) => setNegociacaoCobranca(c)}
            onQuitar={(c) => handleQuitarComReativacao(c.id)}
          />
        </TabsContent>

        <TabsContent value="funil">
          <FunilTab />
        </TabsContent>

        <TabsContent value="lixeira">
          <LixeiraTab />
        </TabsContent>
      </Tabs>

      {/* Barra Flutuante de Seleção em Lote */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gradient-to-r from-[#123328] via-[#1a4a3b] to-[#123328] text-white px-5 py-3 rounded-2xl shadow-2xl border border-[#C8A951]/60 backdrop-blur-lg animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 font-semibold text-xs text-[#F1E5C4]">
            <CheckSquare className="h-4 w-4 text-[#C8A951]" />
            <span>{selecionados.size} selecionados</span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          <Button
            size="sm"
            onClick={() => {
              setDisparoLoteIds(Array.from(selecionados));
              setShowDisparoLote(true);
            }}
            className="bg-[#C8A951] hover:bg-[#d8bb66] text-[#123328] font-bold text-xs h-8 gap-1.5 shadow-md"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Disparar IA ({selecionados.size})
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleQuitarSelecionados}
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400/40 text-xs h-8 gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Quitar Lote
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleExcluirSelecionados}
            className="text-rose-300 hover:text-white hover:bg-rose-900/40 text-xs h-8 gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Lixeira
          </Button>

          <button
            onClick={() => setSelecionados(new Set())}
            className="p-1 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors ml-1"
            title="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modais do Sistema 2.0 */}
      <DisparoLoteInteligenteDialog
        open={showDisparoLote}
        onOpenChange={setShowDisparoLote}
        cobrancaIds={disparoLoteIds}
        onFinish={() => {
          setSelecionados(new Set());
          qc.invalidateQueries({ queryKey: ["cobrancas"] });
        }}
      />

      <MesaNegociacaoDialog
        open={!!negociacaoCobranca}
        onOpenChange={(open) => !open && setNegociacaoCobranca(null)}
        cobranca={negociacaoCobranca}
        onQuitarSuccess={(res) => {
          setNegociacaoCobranca(null);
          setReativacaoDados(res);
          setShowReativacao(true);
        }}
      />

      <ReativacaoPosQuitacaoDialog
        open={showReativacao}
        onOpenChange={setShowReativacao}
        dados={reativacaoDados}
      />

      {selecionadaId && (
        <CobrancaPainelLateral
          cobrancaId={selecionadaId}
          onClose={() => setSelecionadaId(null)}
        />
      )}

      {selecionada && (
        <CobrancaDialog
          cobranca={selecionada}
          onClose={() => setSelecionada(null)}
        />
      )}

      {showConfig && <ConfigDialog onClose={() => setShowConfig(false)} />}
      
      <WhatsAppComposer
        open={composer.state.open}
        onOpenChange={composer.setOpen}
        payload={composer.state.payload}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "rose" | "amber" | "violet" | "emerald";
}) {
  const toneMap: Record<string, string> = {
    rose: "before:bg-rose-500",
    amber: "before:bg-amber-500",
    violet: "before:bg-violet-500",
    emerald: "before:bg-emerald-500",
  };
  return (
    <Card
      className={`relative overflow-hidden before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${toneMap[tone]} shadow-xs`}
    >
      <CardContent className="pt-4 pb-4 pl-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-2xl font-display font-bold">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-0.5">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// Fila do Dia — Kanban Inteligente 2.0 com Multi-Seleção e Ações
// ===================================================================
function FilaDoDiaTab({
  onSelect,
  selecionados,
  onToggleSelect,
  onSelectAll,
  onAbrirNegociacao,
  onQuitar,
}: {
  onSelect: (c: CobrancaDTO) => void;
  selecionados: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onAbrirNegociacao: (c: FilaItemDTO) => void;
  onQuitar: (c: FilaItemDTO) => void;
}) {
  const filaFn = useServerFn(filaPriorizada);
  const excluirFn = useServerFn(excluirCobranca);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["cobrancas", "fila-priorizada"],
    queryFn: () => filaFn(),
    refetchInterval: 60_000,
  });

  const excluirMut = useMutation({
    mutationFn: async (cobrancaId: string) => {
      return excluirFn({ data: { cobrancaId } });
    },
    onSuccess: () => {
      toast.success("Cobrança movida para lixeira");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      q.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao mover para lixeira"),
  });

  const [buscaFila, setBuscaFila] = useState("");

  const items = useMemo(() => {
    const raw = q.data ?? [];
    if (!buscaFila.trim()) return raw;
    const s = buscaFila.toLowerCase().trim();
    return raw.filter(
      (it) =>
        it.cliente_nome?.toLowerCase().includes(s) ||
        it.pet_nome?.toLowerCase().includes(s) ||
        it.prioridade_justificativa?.toLowerCase().includes(s)
    );
  }, [q.data, buscaFila]);

  const prioridadesOrdem = ["Crítica", "Alta", "Média", "Baixa"];

  const grupos = useMemo(() => {
    const map: Record<string, FilaItemDTO[]> = {
      Crítica: [],
      Alta: [],
      Média: [],
      Baixa: [],
    };

    items.forEach((it) => {
      let label = "Média";
      if (it.prioridade === "critica") label = "Crítica";
      else if (it.prioridade === "alta") label = "Alta";
      else if (it.prioridade === "baixa") label = "Baixa";
      map[label].push(it);
    });

    return map;
  }, [items]);

  const totalGeral = items.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0);

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
          <p className="text-sm">Organizando a fila de cobrança inteligente...</p>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0 && !buscaFila) {
    return (
      <Card className="border-emerald-800/20 bg-emerald-500/5">
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
          <p className="font-display font-semibold text-foreground text-base">Tudo em dia!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhuma cobrança pendente para a fila de hoje. Bom trabalho!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Resumo, Busca e Seleção Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onSelectAll}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {selecionados.size === items.length ? "Desmarcar Todos" : "Selecionar Todos"}
          </Button>

          <div className="text-xs text-muted-foreground hidden sm:block">
            Total: <strong className="text-foreground">{items.length} cobranças</strong>
          </div>
          <span className="text-muted-foreground/40 hidden sm:inline">•</span>
          <div className="text-xs text-muted-foreground">
            Volume:{" "}
            <strong className="text-rose-600 font-bold">
              {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Input
            placeholder="Filtrar por cliente ou pet..."
            value={buscaFila}
            onChange={(e) => setBuscaFila(e.target.value)}
            className="h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Grid de Colunas Kanban Responsivas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {prioridadesOrdem.map((label) => {
          const rows = grupos[label] || [];
          if (rows.length === 0 && buscaFila) return null;

          const totalColuna = rows.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0);

          const colStyles = {
            Crítica: {
              headerBg: "bg-rose-500/10 border-rose-200 text-rose-900 dark:text-rose-200",
              badge: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200",
              dot: "bg-rose-500",
            },
            Alta: {
              headerBg: "bg-amber-500/10 border-amber-200 text-amber-900 dark:text-amber-200",
              badge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200",
              dot: "bg-amber-500",
            },
            Média: {
              headerBg: "bg-emerald-500/10 border-emerald-200 text-emerald-900 dark:text-emerald-200",
              badge: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200",
              dot: "bg-emerald-600",
            },
            Baixa: {
              headerBg: "bg-zinc-500/10 border-zinc-200 text-zinc-800 dark:text-zinc-200",
              badge: "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300",
              dot: "bg-zinc-400",
            },
          }[label]!;

          return (
            <div
              key={label}
              className="rounded-2xl border bg-card/60 backdrop-blur-xs shadow-xs flex flex-col overflow-hidden"
            >
              {/* Cabeçalho da Coluna */}
              <div className={`p-3.5 border-b flex items-center justify-between ${colStyles.headerBg}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${colStyles.dot}`} />
                  <span className="font-display font-bold text-sm">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs font-bold ${colStyles.badge}`}>
                    {rows.length}
                  </Badge>
                </div>
              </div>

              {/* Sub-header com valor acumulado */}
              <div className="px-3.5 py-1.5 bg-muted/20 border-b text-[11px] text-muted-foreground flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-foreground">
                  {totalColuna.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>

              {/* Lista de Cards da Coluna */}
              <div className="p-2.5 space-y-2.5 max-h-[580px] overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground italic">
                    Nenhuma cobrança nesta categoria
                  </div>
                ) : (
                  rows.map((c) => {
                    const isChecked = selecionados.has(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => onSelect(c as any)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 group relative ${
                          isChecked
                            ? "border-[#C8A951] bg-[#C8A951]/10 shadow-sm"
                            : "border-border/80 bg-background hover:border-[#C8A951] hover:shadow-md"
                        }`}
                      >
                        {/* Linha 1: Checkbox + Score + Nome + Valor */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => onToggleSelect(c.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="data-[state=checked]:bg-[#C8A951] data-[state=checked]:border-[#C8A951]"
                            />

                            <span
                              className={`h-5 min-w-[22px] px-1 rounded text-[10px] font-bold flex items-center justify-center border ${colStyles.badge}`}
                              title={`Score: ${c.score}`}
                            >
                              {c.score}
                            </span>
                            <div className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                              {c.cliente_nome}
                            </div>
                          </div>

                          <span className="font-bold text-xs text-rose-600 whitespace-nowrap">
                            {Number(c.saldo).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </div>

                        {/* Linha 2: Pet + Dias de Atraso */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <span className="truncate flex items-center gap-1 font-medium text-foreground/80">
                            🐾 {c.pet_nome || "Pet"}
                          </span>
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 whitespace-nowrap">
                            {c.dias_atraso}d atraso
                          </span>
                        </div>

                        {c.prioridade_justificativa && (
                          <p className="text-[10px] text-muted-foreground/90 truncate leading-tight">
                            {c.prioridade_justificativa}
                          </p>
                        )}

                        {/* Ações Rápidas do Card 2.0 */}
                        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/40">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                            title="Mover para lixeira"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Enviar cobrança de ${c.cliente_nome} para a lixeira?`)) {
                                await excluirMut.mutateAsync(c.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] text-primary border-primary/30 hover:bg-primary/10"
                            title="Simular acordo ou promessa"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAbrirNegociacao(c);
                            }}
                          >
                            <HandCoins className="h-3 w-3 mr-1 text-[#C8A951]" />
                            Negociar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 font-semibold"
                            title="Quitar e reativar pet"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuitar(c);
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Quitar
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===================================================================
// Todas as Cobranças Tab com Seleção e Ações Rápidas
// ===================================================================
function TodasCobrancasTab({
  filtro,
  setFiltro,
  onSelect,
  selecionados,
  onToggleSelect,
  onAbrirNegociacao,
  onQuitar,
}: {
  filtro: any;
  setFiltro: React.Dispatch<React.SetStateAction<any>>;
  onSelect: (c: CobrancaDTO) => void;
  selecionados: Set<string>;
  onToggleSelect: (id: string) => void;
  onAbrirNegociacao: (c: any) => void;
  onQuitar: (c: any) => void;
}) {
  const listar = useServerFn(listarCobrancas);
  const qLista = useQuery({
    queryKey: ["cobrancas", "lista", filtro],
    queryFn: () =>
      listar({
        data: {
          status: filtro.status.length ? filtro.status : undefined,
          clienteNome: filtro.clienteNome || null,
          atrasoFaixa: filtro.atrasoFaixa,
        },
      }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Buscar cliente ou pet</Label>
            <Input
              placeholder="Nome do tutor ou pet..."
              value={filtro.clienteNome}
              onChange={(e) => setFiltro((f: any) => ({ ...f, clienteNome: e.target.value }))}
            />
          </div>
          <div className="w-40">
            <Label className="text-xs">Faixa de Atraso</Label>
            <Select
              value={filtro.atrasoFaixa}
              onValueChange={(v) => setFiltro((f: any) => ({ ...f, atrasoFaixa: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os atrasos</SelectItem>
                <SelectItem value="0_3">0-3 dias</SelectItem>
                <SelectItem value="4_7">4-7 dias</SelectItem>
                <SelectItem value="8_15">8-15 dias</SelectItem>
                <SelectItem value="15p">15+ dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              ["a_vencer", "vencido", "enviada", "promessa", "pago"] as CobrancaStatus[]
            ).map((s) => {
              const on = filtro.status.includes(s);
              return (
                <button
                  key={s}
                  onClick={() =>
                    setFiltro((f: any) => ({
                      ...f,
                      status: on ? f.status.filter((x: any) => x !== s) : [...f.status, s],
                    }))
                  }
                  className={`text-xs rounded-full px-3 py-1 border transition-all ${
                    on
                      ? STATUS_CLASS[s]
                      : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {qLista.isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
            <p className="text-xs">Carregando carteira de cobranças...</p>
          </div>
        ) : (qLista.data ?? []).length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma cobrança encontrada para os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2.5 pr-2 w-8">
                    <span className="sr-only">Seleção</span>
                  </th>
                  <th className="py-2.5 pr-3">Cliente / Pet</th>
                  <th className="py-2.5 pr-3">Vencimento</th>
                  <th className="py-2.5 pr-3">Atraso</th>
                  <th className="py-2.5 pr-3">Valor</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3">Último Contato</th>
                  <th className="py-2.5 pr-3 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {(qLista.data ?? []).map((c) => {
                  const isChecked = selecionados.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b hover:bg-muted/40 cursor-pointer transition-colors ${
                        isChecked ? "bg-[#C8A951]/10" : ""
                      }`}
                      onClick={() => onSelect(c)}
                    >
                      <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onToggleSelect(c.id)}
                          className="data-[state=checked]:bg-[#C8A951] data-[state=checked]:border-[#C8A951]"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-xs text-foreground">{c.cliente_nome}</div>
                        <div className="text-[11px] text-muted-foreground">
                          🐾 {c.pet_nome ?? "Pet"} • {fmtDate(c.data_atendimento)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{fmtDate(c.vencimento)}</td>
                      <td className="py-2.5 pr-3 text-xs">
                        {c.dias_atraso > 0 ? (
                          <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            {c.dias_atraso}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-xs text-foreground">
                        {brl(c.saldo)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_CLASS[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {c.ultima_cobranca_em
                          ? new Date(c.ultima_cobranca_em).toLocaleDateString("pt-BR")
                          : "—"}
                        {c.tentativas > 0 ? ` • ${c.tentativas}x` : ""}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => onAbrirNegociacao(c)}
                          >
                            <HandCoins className="h-3 w-3 mr-1 text-[#C8A951]" /> Negociar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 font-semibold"
                            onClick={() => onQuitar(c)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Quitar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// Funil de Recuperação
// ===================================================================
function FunilTab() {
  const funilFn = useServerFn(FUNIL_FN);
  const q = useQuery({ queryKey: ["cobrancas", "funil"], queryFn: () => funilFn() });

  if (q.isLoading || !q.data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
          <p className="text-xs">Carregando funil de recuperação...</p>
        </CardContent>
      </Card>
    );
  }

  const d = q.data;
  const etapas = [
    { label: "Pendências no Mês", value: d.criadas, valor: d.valor_criado, taxa: 1 },
    { label: "Contatados pela IA", value: d.enviadas, taxa: d.taxa_envio },
    { label: "Responderam / Abriram", value: d.responderam, taxa: d.taxa_resposta },
    { label: "Promessa / Acordo Feito", value: d.prometeram },
    { label: "Recuperados & Quitados", value: d.pagaram, valor: d.valor_recuperado, taxa: d.taxa_pagamento },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.value));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display font-bold">
          Funil de Recuperação de Receita — Mês Atual
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Acompanhe a eficiência da régua inteligente e a taxa de conversão em cada etapa.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {etapas.map((e) => (
          <div key={e.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-foreground">{e.label}</span>
              <span className="font-bold text-foreground">
                {e.value} tutores
                {e.valor != null ? ` • ${brl(e.valor)}` : ""}
                {e.taxa != null && e.label !== "Pendências no Mês"
                  ? ` • ${Math.round(e.taxa * 100)}%`
                  : ""}
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#123328] via-primary to-[#C8A951] transition-all"
                style={{ width: `${Math.max(5, (e.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// Lixeira — Cobranças Arquivadas com Restauração
// ===================================================================
function LixeiraTab() {
  const qc = useQueryClient();
  const listarArq = useServerFn(listarCobrancasArquivadas);
  const restaurar = useServerFn(restaurarCobranca);

  const q = useQuery({
    queryKey: ["cobrancas", "arquivadas"],
    queryFn: () => listarArq(),
  });

  const restaurarMut = useMutation({
    mutationFn: (id: string) => restaurar({ data: { cobrancaId: id } }),
    onSuccess: () => {
      toast.success("Cobrança restaurada com sucesso!");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao restaurar"),
  });

  const itens = (q.data ?? []) as CobrancaArquivadaDTO[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 font-display">
          <Archive className="h-4 w-4 text-[#C8A951]" />
          Lixeira de Cobranças
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nenhum dado é apagado definitivamente. Tudo que você mover para a lixeira fica preservado aqui e pode ser restaurado a qualquer momento.
        </p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando lixeira...
          </div>
        ) : itens.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            A lixeira está vazia.
          </div>
        ) : (
          <ul className="space-y-2">
            {itens.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground truncate">{c.cliente_nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {brl(c.saldo)} • venc. {fmtDate(c.vencimento)}
                    {c.pet_nome ? ` • 🐾 ${c.pet_nome}` : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Excluída em {fmtDate(c.arquivada_em)}
                    {c.arquivada_por_nome ? ` por ${c.arquivada_por_nome}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs font-semibold gap-1"
                  onClick={() => restaurarMut.mutate(c.id)}
                  disabled={restaurarMut.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// CobrancaDialog (Detalhe e Mensagem Rápida)
// ===================================================================
function CobrancaDialog({
  cobranca,
  onClose,
}: {
  cobranca: CobrancaDTO;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const historico = useServerFn(historicoCobranca);
  const enviar = useServerFn(registrarEnvio);
  const promessa = useServerFn(registrarPromessa);
  const status = useServerFn(alterarStatusCobranca);
  const pausar = useServerFn(pausarCobranca);
  const pagar = useServerFn(marcarPagamento);
  const sugerir = useServerFn(sugerirMensagemCobranca);
  const excluir = useServerFn(excluirCobranca);

  const qHist = useQuery({
    queryKey: ["cobrancas", "historico", cobranca.id],
    queryFn: () => historico({ data: { cobrancaId: cobranca.id } }),
  });

  const [mensagem, setMensagem] = useState("");
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [promessaData, setPromessaData] = useState("");

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cobrancas"] });
  };

  const abrirWhats = () => {
    if (!cobranca.cliente_whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    openWhatsAppComposerGlobal({
      tipo: "cobranca_vencida",
      destinatario: cobranca.cliente_nome ?? "",
      telefone: cobranca.cliente_whatsapp,
      mensagem,
      motivo: "Cobrança",
      cliente_id: cobranca.cliente_id ?? null,
      cobranca_id: cobranca.id,
    });
  };

  const registrarEnviado = useMutation({
    mutationFn: () =>
      enviar({ data: { cobrancaId: cobranca.id, mensagem, canal: "whatsapp" } }),
    onSuccess: () => {
      toast.success("Envio registrado no histórico");
      invalidar();
      qHist.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const excluirMut = useMutation({
    mutationFn: async () => {
      if (!window.confirm(`Enviar cobrança de ${cobranca.cliente_nome} para a lixeira?`)) return null;
      return excluir({ data: { cobrancaId: cobranca.id } });
    },
    onSuccess: (r) => {
      if (!r) return;
      toast.success("Cobrança enviada para a lixeira");
      invalidar();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const gerarIA = async (
    intencao: "cobranca" | "lembrete" | "agradecimento" | "negociacao",
  ) => {
    setCarregandoIa(true);
    try {
      const r = await sugerir({ data: { cobrancaId: cobranca.id, intencao } });
      setMensagem(r.mensagem);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na IA");
    } finally {
      setCarregandoIa(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <HandCoins className="h-4 w-4 text-[#C8A951]" />
            Cobrança — {cobranca.cliente_nome}
          </DialogTitle>
          <DialogDescription>
            🐾 {cobranca.pet_nome ?? "—"} • Atendimento em {fmtDate(cobranca.data_atendimento)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Info label="Saldo" value={brl(cobranca.saldo)} />
          <Info label="Vencimento" value={fmtDate(cobranca.vencimento)} />
          <Info
            label="Atraso"
            value={cobranca.dias_atraso > 0 ? `${cobranca.dias_atraso}d` : "—"}
          />
          <Info
            label="Status"
            value={
              <Badge variant="outline" className={STATUS_CLASS[cobranca.status]}>
                {STATUS_LABEL[cobranca.status]}
              </Badge>
            }
          />
        </div>

        <Tabs defaultValue="mensagem">
          <TabsList>
            <TabsTrigger value="mensagem">Mensagem</TabsTrigger>
            <TabsTrigger value="acoes">Ações</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="mensagem" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => gerarIA("lembrete")}
                disabled={carregandoIa}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Lembrete gentil
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => gerarIA("cobranca")}
                disabled={carregandoIa}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Cobrança cordial
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => gerarIA("negociacao")}
                disabled={carregandoIa}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Proposta de acordo
              </Button>
            </div>

            <Textarea
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite a mensagem ou gere com a IA acima..."
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                onClick={abrirWhats}
                disabled={!mensagem.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <MessageCircle className="h-4 w-4 mr-1" /> Abrir no WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => registrarEnviado.mutate()}
                disabled={!mensagem.trim() || registrarEnviado.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como enviado
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="acoes" className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Promessa de pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    type="date"
                    value={promessaData}
                    onChange={(e) => setPromessaData(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!promessaData) return;
                      await promessa({
                        data: { cobrancaId: cobranca.id, data: promessaData },
                      });
                      toast.success("Promessa registrada");
                      invalidar();
                      qHist.refetch();
                    }}
                  >
                    Salvar promessa
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Status & Pausa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Select
                    defaultValue={cobranca.status}
                    onValueChange={async (v) => {
                      await status({
                        data: { cobrancaId: cobranca.id, status: v as CobrancaStatus },
                      });
                      toast.success("Status atualizado");
                      invalidar();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as CobrancaStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico">
            {qHist.isLoading ? (
              <div className="py-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : (qHist.data ?? []).length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Ainda sem eventos registrados.
              </div>
            ) : (
              <ul className="space-y-2">
                {(qHist.data ?? []).map((e: any) => (
                  <li key={e.id} className="border rounded-md p-2 text-sm">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {e.tipo} {e.canal ? `• ${e.canal}` : ""}
                      </span>
                      <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {e.payload?.mensagem && (
                      <div className="mt-1 whitespace-pre-wrap">{e.payload.mensagem}</div>
                    )}
                    {e.payload?.data && (
                      <div className="mt-1">Promessa para {fmtDate(e.payload.data)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between gap-2">
          <Button
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => excluirMut.mutate()}
            disabled={excluirMut.isPending}
          >
            {excluirMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Excluir
          </Button>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

// ===================================================================
// Configuração da Régua
// ===================================================================
function ConfigDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const obter = useServerFn(obterConfigCobranca);
  const salvar = useServerFn(salvarConfigCobranca);

  const q = useQuery({ queryKey: ["cobrancas", "config"], queryFn: () => obter() });
  const cfg = q.data?.config as any;

  const [modo, setModo] = useState<"manual" | "auto" | "pausado">("manual");
  const [naoRepetir, setNaoRepetir] = useState(true);
  const [pixChave, setPixChave] = useState("");
  const [pixTipo, setPixTipo] = useState("celular");

  useMemo(() => {
    if (cfg) {
      setModo(cfg.modo);
      setNaoRepetir(!!cfg.nao_repetir_no_dia);
      setPixChave(cfg.pix_chave ?? "");
      setPixTipo(cfg.pix_tipo ?? "celular");
    }
  }, [cfg]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Régua de Cobrança e Configurações</DialogTitle>
          <DialogDescription>
            Configure o modo de disparo e a chave PIX padrão utilizada nas mensagens da IA.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Modo de Operação</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (com aprovação e revisão)</SelectItem>
                  <SelectItem value="auto">Automático Assistido</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chave PIX para Cobrança</Label>
              <Input
                placeholder="Chave PIX (e-mail, telefone, CPF ou aleatória)"
                value={pixChave}
                onChange={(e) => setPixChave(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>Não repetir contato no mesmo dia</Label>
              <Switch checked={naoRepetir} onCheckedChange={setNaoRepetir} />
            </div>
          </div>
        )}

        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              await salvar({
                data: {
                  modo,
                  nao_repetir_no_dia: naoRepetir,
                  pix_chave: pixChave,
                  pix_tipo: pixTipo,
                },
              });
              toast.success("Configurações salvas");
              qc.invalidateQueries({ queryKey: ["cobrancas"] });
              onClose();
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
