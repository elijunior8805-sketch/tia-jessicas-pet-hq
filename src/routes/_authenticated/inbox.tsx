import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Inbox as InboxIcon,
  MessageSquare,
  Search,
  Send,
  RefreshCcw,
  ArrowLeft,
  Bell,
  MailOpen,
  Clock,
  StickyNote,
  Trash2,
  ExternalLink,
  Sparkles,
  UserCheck,
  CheckCircle2,
  RotateCcw,
  FileText,
  CalendarClock,
  History as HistoryIcon,
  PawPrint,
  Users as UsersIcon,
  Loader2,
  Copy,
  DollarSign,
  Crown,
  Heart,
  CalendarPlus,
  AlertCircle,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  listarThreads,
  getThread,
  marcarLidas,
  registrarEnvioManual,
  registrarNotaInterna,
  excluirMensagem,
  inboxKPIs,
  atribuirResponsavel,
  marcarResolvida,
  listarAtendentes,
  type ThreadDTO,
  type MensagemDTO,
  type ThreadStatus,
} from "@/lib/inbox.functions";
import {
  formatarTelefoneBR,
  normalizarTelefoneBR,
  montarWaUrl,
  abrirWhatsApp,
} from "@/lib/whatsapp";
import { JessiInboxPanel } from "@/components/inbox/JessiInboxPanel";

type FiltroConversa =
  | "todas"
  | "nao_lidas"
  | "aguardando"
  | "hoje"
  | "minhas"
  | "resolvidas";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const dias = Math.floor(diff / 86400);
  if (dias < 7) return `${dias}d`;
  return d.toLocaleDateString("pt-BR");
}

function iniciais(nome: string | null | undefined) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

const STATUS_LABEL: Record<ThreadStatus, string> = {
  aguardando_resposta: "Aguardando resposta",
  respondida: "Respondida",
  resolvida: "Resolvida",
  sem_mensagens: "Sem mensagens",
};

const STATUS_TONE: Record<ThreadStatus, string> = {
  aguardando_resposta:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  respondida: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  resolvida: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  sem_mensagens: "bg-muted text-muted-foreground border-border",
};

function InboxPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroConversa>("todas");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [textoParaChat, setTextoParaChat] = useState<string | null>(null);

  const listarFn = useServerFn(listarThreads);
  const kpisFn = useServerFn(inboxKPIs);
  const atendentesFn = useServerFn(listarAtendentes);

  const threads = useQuery({
    queryKey: ["inbox-threads", filtro, busca],
    queryFn: () => listarFn({ data: { busca, filtro } }),
    refetchInterval: 20_000,
  });
  const kpis = useQuery({
    queryKey: ["inbox-kpis"],
    queryFn: () => kpisFn(),
    refetchInterval: 30_000,
  });
  const atendentes = useQuery({
    queryKey: ["inbox-atendentes"],
    queryFn: () => atendentesFn(),
    staleTime: 5 * 60_000,
  });

  const thread: ThreadDTO | undefined = useMemo(
    () => threads.data?.find((t) => t.cliente_id === selecionado),
    [threads.data, selecionado]
  );

  const clienteSelecionadoObj = useMemo(() => {
    if (!thread) return null;
    return {
      id: thread.cliente_id,
      nome: thread.cliente_nome,
      pets: thread.pet_primeiro_nome ? [{ id: "pet_foco", nome: thread.pet_primeiro_nome }] : [],
    };
  }, [thread]);

  const aguardandoOrdenadas = useMemo(() => {
    if (!threads.data) return [] as ThreadDTO[];
    return [...threads.data]
      .filter((t) => t.status_conversa === "aguardando_resposta")
      .sort((a, b) => (a.ultima_em_in ?? "").localeCompare(b.ultima_em_in ?? ""));
  }, [threads.data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-12">
      <div className="mx-auto max-w-[1440px] px-4 py-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <InboxIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Central de Mensagens & Atendimento</span>
                <Badge className="bg-[#C8A951]/20 text-[#C8A951] border-[#C8A951]/40 text-xs">
                  IA Jessi
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Atendimento consultivo, histórico do cliente, controle de créditos do Clubinho e integração WhatsApp.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={threads.isFetching || kpis.isFetching}
            onClick={async () => {
              await Promise.all([threads.refetch(), kpis.refetch()]);
              toast.success("Conversas atualizadas!");
            }}
            className="rounded-xl shadow-xs text-xs font-semibold"
          >
            {threads.isFetching || kpis.isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </header>

        {/* Copiloto Interativo da Jessi com Contexto do Cliente */}
        <JessiInboxPanel
          kpis={kpis.data}
          clienteSelecionado={clienteSelecionadoObj}
          onInserirNoChat={(texto) => setTextoParaChat(texto)}
          onFiltrarAguardando={() => setFiltro("aguardando")}
          onFiltrarNaoLidas={() => setFiltro("nao_lidas")}
          onRefresh={async () => {
            await Promise.all([threads.refetch(), kpis.refetch()]);
          }}
          isRefreshing={threads.isFetching || kpis.isFetching}
        />

        {/* KPIs de Atendimento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Bell className="h-4 w-4" />}
            label="Não lidas"
            value={kpis.data?.nao_lidas ?? 0}
            tone="amber"
            active={filtro === "nao_lidas"}
            onClick={() => setFiltro("nao_lidas")}
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Aguardando resposta"
            value={kpis.data?.aguardando_resposta ?? 0}
            tone="blue"
            active={filtro === "aguardando"}
            onClick={() => setFiltro("aguardando")}
          />
          <KpiCard
            icon={<MailOpen className="h-4 w-4" />}
            label="Mensagens hoje"
            value={kpis.data?.hoje ?? 0}
            tone="emerald"
            active={filtro === "hoje"}
            onClick={() => setFiltro("hoje")}
          />
          <KpiCard
            icon={<UserCheck className="h-4 w-4" />}
            label="Minhas conversas"
            value={kpis.data?.minhas ?? 0}
            tone="violet"
            active={filtro === "minhas"}
            onClick={() => setFiltro("minhas")}
          />
        </div>

        {/* Layout Principal: Lista de Contatos + Painel 360° com Chat e Dossiê */}
        <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4">
          {/* Coluna 1: Lista de Conversas / Clientes */}
          <Card
            className={cn(
              "card-premium overflow-hidden border-border/70",
              selecionado && "hidden md:block"
            )}
          >
            <CardHeader className="pb-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, pet ou mensagem..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 text-xs rounded-xl h-9"
                />
              </div>
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroConversa)}>
                <TabsList className="grid grid-cols-3 w-full h-auto p-1 bg-muted/60 rounded-xl">
                  <TabsTrigger value="todas" className="text-xs font-semibold rounded-lg">Todas</TabsTrigger>
                  <TabsTrigger value="aguardando" className="text-xs font-semibold rounded-lg">Aguardando</TabsTrigger>
                  <TabsTrigger value="resolvidas" className="text-xs font-semibold rounded-lg">Resolvidas</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-440px)] min-h-[460px]">
                {threads.isLoading && (
                  <div className="p-8 text-sm text-muted-foreground text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Carregando conversas...
                  </div>
                )}
                {threads.data && threads.data.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhuma conversa no filtro selecionado.
                  </div>
                )}
                <ul className="divide-y divide-border/40">
                  {threads.data?.map((t) => (
                    <li key={t.cliente_id}>
                      <button
                        onClick={() => setSelecionado(t.cliente_id)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-all",
                          selecionado === t.cliente_id && "bg-primary/10 border-l-4 border-l-primary"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm truncate text-foreground">
                                {t.cliente_nome}
                              </span>
                              {t.pet_primeiro_nome && (
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.2 rounded-md">
                                  <PawPrint className="h-3 w-3" />
                                  {t.pet_primeiro_nome}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {timeAgo(t.ultima_em)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.ultima_direcao === "in" ? "" : "Você: "}
                          {t.ultima_mensagem ?? "—"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-1.5 text-[10px] font-medium",
                              STATUS_TONE[t.status_conversa]
                            )}
                          >
                            {STATUS_LABEL[t.status_conversa]}
                          </Badge>
                          {t.nao_lidas > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              {t.nao_lidas} nova{t.nao_lidas > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {t.responsavel_id && (
                            <div className="ml-auto flex items-center gap-1">
                              <Avatar className="h-5 w-5 border">
                                {t.responsavel_avatar && (
                                  <AvatarImage src={t.responsavel_avatar} />
                                )}
                                <AvatarFallback className="text-[9px]">
                                  {iniciais(t.responsavel_nome)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Coluna 2: Chat com Dossiê 360° do Cliente & Pet */}
          <Card
            className={cn(
              "card-premium overflow-hidden border-border/70",
              !selecionado && "hidden md:block"
            )}
          >
            {selecionado ? (
              <ThreadView
                clienteId={selecionado}
                thread={thread}
                atendentes={atendentes.data ?? []}
                textoInjetado={textoParaChat}
                onTextoInjetadoConsumido={() => setTextoParaChat(null)}
                onBack={() => setSelecionado(null)}
                onChange={() => {
                  qc.invalidateQueries({ queryKey: ["inbox-threads"] });
                  qc.invalidateQueries({ queryKey: ["inbox-kpis"] });
                }}
              />
            ) : (
              <EmptyState
                aguardando={aguardandoOrdenadas}
                onSelect={(id) => setSelecionado(id)}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald" | "violet";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border bg-card p-3.5 transition-all hover:shadow-md focus:outline-none",
        active && "ring-2 ring-primary shadow-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg border p-2", tones[tone])}>{icon}</div>
        <div>
          <div className="text-xl font-bold leading-none text-foreground">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
        </div>
      </div>
    </button>
  );
}

function EmptyState({
  aguardando,
  onSelect,
}: {
  aguardando: ThreadDTO[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-[calc(100vh-400px)] min-h-[460px] flex flex-col p-6">
      <div className="text-center pb-6 border-b border-border/40">
        <MessageSquare className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
        <h3 className="font-semibold text-sm text-foreground">Painel de Atendimento em Espera</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Selecione uma conversa ao lado para visualizar o Dossiê 360° do Pet, histórico de banhos e opções de resposta.
        </p>
      </div>
      {aguardando.length > 0 && (
        <div className="flex-1 mt-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="h-4 w-4" />
            Clientes aguardando resposta há mais tempo:
          </div>
          <ScrollArea className="flex-1 -mx-2 px-2">
            <ul className="space-y-1.5">
              {aguardando.slice(0, 10).map((t) => (
                <li key={t.cliente_id}>
                  <button
                    onClick={() => onSelect(t.cliente_id)}
                    className="w-full text-left p-3 rounded-xl border border-border/60 hover:bg-muted/60 transition flex items-center justify-between gap-3 bg-card"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">
                        {t.cliente_nome}
                        {t.pet_primeiro_nome && (
                          <span className="text-muted-foreground font-normal">
                            {" "}· 🐾 {t.pet_primeiro_nome}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {t.ultima_mensagem}
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {timeAgo(t.ultima_em_in ?? t.ultima_em)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function ThreadView({
  clienteId,
  thread,
  atendentes,
  textoInjetado,
  onTextoInjetadoConsumido,
  onBack,
  onChange,
}: {
  clienteId: string;
  thread: ThreadDTO | undefined;
  atendentes: { id: string; nome: string | null; email: string | null; avatar_url: string | null }[];
  textoInjetado?: string | null;
  onTextoInjetadoConsumido?: () => void;
  onBack: () => void;
  onChange: () => void;
}) {
  const navigate = useNavigate();
  const getFn = useServerFn(getThread);
  const marcarFn = useServerFn(marcarLidas);
  const envioFn = useServerFn(registrarEnvioManual);
  const notaFn = useServerFn(registrarNotaInterna);
  const excluirFn = useServerFn(excluirMensagem);
  const atribuirFn = useServerFn(atribuirResponsavel);
  const resolvidaFn = useServerFn(marcarResolvida);

  const detalhe = useQuery({
    queryKey: ["inbox-thread", clienteId],
    queryFn: () => getFn({ data: { cliente_id: clienteId } }),
    refetchInterval: 15_000,
  });

  const [modo, setModo] = useState<"envio" | "nota">("envio");
  const [texto, setTexto] = useState("");

  // Injeção de texto gerado pelo Copiloto Jessi
  useEffect(() => {
    if (textoInjetado) {
      setTexto(textoInjetado);
      setModo("envio");
      onTextoInjetadoConsumido?.();
    }
  }, [textoInjetado, onTextoInjetadoConsumido]);

  // Auto marcar como lidas ao abrir
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (thread && thread.nao_lidas > 0) {
        try {
          await marcarFn({ data: { cliente_id: clienteId } });
          if (!cancel) onChange();
        } catch {}
      }
    })();
    return () => {
      cancel = true;
    };
  }, [clienteId]);

  const envioMut = useMutation({
    mutationFn: (corpo: string) =>
      envioFn({ data: { cliente_id: clienteId, corpo } }),
    onSuccess: () => {
      setTexto("");
      toast.success("Envio registrado e conversa marcada como respondida!");
      detalhe.refetch();
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar."),
  });

  const notaMut = useMutation({
    mutationFn: (corpo: string) =>
      notaFn({ data: { cliente_id: clienteId, corpo } }),
    onSuccess: () => {
      setTexto("");
      toast.success("Nota interna adicionada à ficha!");
      detalhe.refetch();
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar."),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Mensagem removida.");
      detalhe.refetch();
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  const atribuirMut = useMutation({
    mutationFn: (responsavel_id: string | null) =>
      atribuirFn({ data: { cliente_id: clienteId, responsavel_id } }),
    onSuccess: () => {
      toast.success("Responsável atualizado.");
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atribuir."),
  });

  const resolvidaMut = useMutation({
    mutationFn: (resolvida: boolean) =>
      resolvidaFn({ data: { cliente_id: clienteId, resolvida } }),
    onSuccess: (_r, resolvida) => {
      toast.success(resolvida ? "Conversa marcada como resolvida." : "Conversa reaberta.");
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  function submeter() {
    const corpo = texto.trim();
    if (!corpo) return;
    if (modo === "envio") envioMut.mutate(corpo);
    else notaMut.mutate(corpo);
  }

  function abrirWa() {
    const tel = normalizarTelefoneBR(
      detalhe.data?.cliente?.whatsapp ?? detalhe.data?.cliente?.telefone
    );
    if (!tel.ok) {
      toast.error(tel.motivo);
      return;
    }
    abrirWhatsApp(montarWaUrl(tel.e164, texto || ""));
  }

  function copiarChavePix() {
    const nomeCli = detalhe.data?.cliente?.nome?.split(" ")[0] || "Cliente";
    const ultimoServico = (detalhe.data?.ultimo_atendimento as any)?.servicos?.nome || "Atendimento";
    const valor = Number((detalhe.data?.ultimo_atendimento as any)?.valor_total || 0).toFixed(2);
    
    const textoPix = `Olá, ${nomeCli}! 🐾 Seguem os dados para pagamento via Pix:\n\n🔑 Chave Pix: financeiro@spatiajessica.com.br (CNPJ / E-mail)\nFavorecido: Spa de Pet Tia Jéssica\n${Number(valor) > 0 ? `Valor: R$ ${valor} (${ultimoServico})\n\n` : "\n"}Assim que realizar a transferência, por favor nos envie o comprovante por aqui! ✨💚`;
    
    navigator.clipboard.writeText(textoPix);
    toast.success("Dados do Pix copiados com sucesso!");
  }

  const cli = detalhe.data?.cliente;
  const pets = detalhe.data?.pets ?? [];
  const prox = detalhe.data?.proximo_agendamento as any;
  const ultimo = detalhe.data?.ultimo_atendimento as any;
  const clubinho = (detalhe.data as any)?.programas_clubinho ?? [];
  const mensagens = detalhe.data?.mensagens ?? [];
  const status = thread?.status_conversa ?? "sem_mensagens";

  return (
    <div className="flex flex-col h-[calc(100vh-360px)] min-h-[580px]">
      {/* Header do Cliente com Barra de Ações Rápidas */}
      <CardHeader className="border-b space-y-3 py-3 bg-card/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate flex items-center gap-2">
                <span>{cli?.nome ?? "Cliente"}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-semibold", STATUS_TONE[status])}
                >
                  {STATUS_LABEL[status]}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {cli?.whatsapp
                  ? formatarTelefoneBR(cli.whatsapp)
                  : cli?.telefone
                  ? formatarTelefoneBR(cli.telefone)
                  : "Sem WhatsApp cadastrado"}
              </p>
            </div>
          </div>

          {/* Botões Rápidos */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copiarChavePix}
              className="h-8 text-xs gap-1.5 font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              title="Copiar dados do Pix para cobrança"
            >
              <DollarSign className="h-3.5 w-3.5" /> Chave Pix
            </Button>

            <Button
              size="sm"
              onClick={abrirWa}
              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5 shadow-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir no WhatsApp
            </Button>
          </div>
        </div>

        {/* Dossiê 360° do Cliente & Pet */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Card 1: Pets */}
          <div className="rounded-xl border bg-muted/30 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <PawPrint className="h-3 w-3 text-primary" /> Pets Vinculados
            </div>
            <div className="font-semibold text-foreground mt-0.5 truncate">
              {pets.length > 0 ? pets.map((p: any) => `${p.nome} (${p.raca || "SRD"})`).join(", ") : "Nenhum pet"}
            </div>
          </div>

          {/* Card 2: Clubinho */}
          <div className="rounded-xl border bg-purple-500/10 border-purple-500/20 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1">
              <Crown className="h-3 w-3" /> Clubinho / Plano
            </div>
            <div className="font-semibold text-foreground mt-0.5 truncate">
              {clubinho.length > 0 ? clubinho[0].nome_snapshot : "Sem plano ativo"}
            </div>
          </div>

          {/* Card 3: Última Visita */}
          <div className="rounded-xl border bg-muted/30 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <HistoryIcon className="h-3 w-3 text-blue-600" /> Última Visita
            </div>
            <div className="font-semibold text-foreground mt-0.5 truncate">
              {ultimo ? `${new Date(ultimo.data_inicio).toLocaleDateString("pt-BR")} (R$ ${Number(ultimo.valor_total || 0).toFixed(0)})` : "Sem histórico"}
            </div>
          </div>

          {/* Card 4: Próximo Horário */}
          <div className="rounded-xl border bg-muted/30 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <CalendarClock className="h-3 w-3 text-emerald-600" /> Próximo Agendamento
            </div>
            <div className="font-semibold text-foreground mt-0.5 truncate">
              {prox ? `${new Date(prox.data).toLocaleDateString("pt-BR")} às ${String(prox.hora).slice(0, 5)}` : "Nenhum marcado"}
            </div>
          </div>
        </div>

        {/* Linha de Atribuição e Resolução */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="h-7 text-xs text-muted-foreground">
                <UsersIcon className="h-3.5 w-3.5 mr-1" />
                {thread?.responsavel_nome
                  ? `Responsável: ${thread.responsavel_nome.split(" ")[0]}`
                  : "Atribuir atendente"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-auto">
              <DropdownMenuLabel>Atribuir a...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {atendentes.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onClick={() => atribuirMut.mutate(a.id)}
                >
                  <Avatar className="h-5 w-5 mr-2">
                    {a.avatar_url && <AvatarImage src={a.avatar_url} />}
                    <AvatarFallback className="text-[9px]">
                      {iniciais(a.nome)}
                    </AvatarFallback>
                  </Avatar>
                  {a.nome ?? a.email ?? "Sem nome"}
                </DropdownMenuItem>
              ))}
              {thread?.responsavel_id && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => atribuirMut.mutate(null)}>
                    Remover atribuição
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="xs"
            variant="ghost"
            onClick={() => resolvidaMut.mutate(status !== "resolvida")}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            {status === "resolvida" ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 mr-1 text-amber-600" /> Reabrir conversa
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Marcar resolvida
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Histórico da Conversa */}
      <ScrollArea className="flex-1 p-4">
        {detalhe.isLoading && (
          <div className="py-12 text-center text-muted-foreground text-xs">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Carregando mensagens...
          </div>
        )}
        {mensagens.length === 0 && !detalhe.isLoading && (
          <div className="py-12 text-center text-muted-foreground text-xs">
            Nenhuma mensagem registrada nesta conversa ainda.
          </div>
        )}
        <div className="space-y-3">
          {mensagens.map((m) => {
            const ehMinha = m.direcao === "out";
            const ehNota = m.tags?.includes("nota_interna");

            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs group relative",
                  ehNota
                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-950 dark:text-amber-100 self-center max-w-[95%]"
                    : ehMinha
                    ? "bg-primary text-primary-foreground self-end rounded-tr-xs"
                    : "bg-muted text-foreground self-start rounded-tl-xs"
                )}
              >
                {ehNota && (
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <StickyNote className="h-3 w-3" /> Nota Interna da Equipe
                  </span>
                )}
                <p className="whitespace-pre-wrap">{m.corpo}</p>
                <span
                  className={cn(
                    "text-[9px] mt-1 self-end font-mono",
                    ehMinha ? "text-primary-foreground/75" : "text-muted-foreground"
                  )}
                >
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Caixa de Composição e Envio */}
      <div className="p-3 border-t bg-card/70 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant={modo === "envio" ? "default" : "ghost"}
              onClick={() => setModo("envio")}
              className="h-7 text-xs rounded-lg font-semibold"
            >
              Resposta WhatsApp
            </Button>
            <Button
              size="xs"
              variant={modo === "nota" ? "secondary" : "ghost"}
              onClick={() => setModo("nota")}
              className="h-7 text-xs rounded-lg font-semibold"
            >
              <StickyNote className="h-3 w-3 mr-1" /> Nota Interna
            </Button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            placeholder={
              modo === "envio"
                ? `Escreva a resposta para ${cli?.nome || "o cliente"}... (ou use a Jessi acima para gerar)`
                : "Escreva uma anotação interna sobre o pet ou cliente..."
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submeter();
              }
            }}
            rows={2}
            className="text-xs resize-none rounded-xl bg-background"
          />
          <Button
            onClick={submeter}
            disabled={!texto.trim() || envioMut.isPending || notaMut.isPending}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold shrink-0 shadow-xs"
          >
            {envioMut.isPending || notaMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
