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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    "bg-amber-500/10 text-amber-700 border-amber-500/30",
  respondida: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  resolvida: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  sem_mensagens: "bg-muted text-muted-foreground border-border",
};

function InboxPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroConversa>("todas");
  const [selecionado, setSelecionado] = useState<string | null>(null);

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

  const aguardandoOrdenadas = useMemo(() => {
    if (!threads.data) return [] as ThreadDTO[];
    return [...threads.data]
      .filter((t) => t.status_conversa === "aguardando_resposta")
      .sort((a, b) => (a.ultima_em_in ?? "").localeCompare(b.ultima_em_in ?? ""));
  }, [threads.data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <InboxIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Mensagens</h1>
              <p className="text-sm text-muted-foreground">
                Registre respostas do WhatsApp Web e mantenha o histórico por cliente. Envio automático depende da integração externa.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={threads.isFetching || kpis.isFetching}
            onClick={async () => {
              await Promise.all([threads.refetch(), kpis.refetch()]);
              toast.success("Conversas atualizadas");
            }}
          >
            {threads.isFetching || kpis.isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </header>

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

        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] gap-4">
          {/* Threads list */}
          <Card
            className={cn(
              "card-premium overflow-hidden",
              selecionado && "hidden md:block"
            )}
          >
            <CardHeader className="pb-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, pet ou texto…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroConversa)}>
                <TabsList className="grid grid-cols-3 w-full h-auto">
                  <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
                  <TabsTrigger value="aguardando" className="text-xs">Aguardando</TabsTrigger>
                  <TabsTrigger value="resolvidas" className="text-xs">Resolvidas</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-400px)] min-h-[420px]">
                {threads.isLoading && (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    Carregando…
                  </div>
                )}
                {threads.data && threads.data.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhuma conversa no filtro atual.
                  </div>
                )}
                <ul className="divide-y">
                  {threads.data?.map((t) => (
                    <li key={t.cliente_id}>
                      <button
                        onClick={() => setSelecionado(t.cliente_id)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                          selecionado === t.cliente_id && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">
                                {t.cliente_nome}
                              </span>
                              {t.pet_primeiro_nome && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                  <PawPrint className="h-3 w-3" />
                                  {t.pet_primeiro_nome}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">
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
                              "h-5 px-1.5 text-[10px]",
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

          {/* Thread view */}
          <Card
            className={cn(
              "card-premium overflow-hidden",
              !selecionado && "hidden md:block"
            )}
          >
            {selecionado ? (
              <ThreadView
                clienteId={selecionado}
                thread={thread}
                atendentes={atendentes.data ?? []}
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
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border bg-card transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
        active && "ring-2 ring-primary shadow-md"
      )}
    >
      <div className="p-4 flex items-center gap-3">
        <div className={cn("rounded-lg border p-2", tones[tone])}>{icon}</div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
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
    <div className="h-[calc(100vh-360px)] min-h-[420px] flex flex-col p-6">
      <div className="text-center pb-4 border-b">
        <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Selecione uma conversa para ver o histórico
        </p>
      </div>
      {aguardando.length > 0 && (
        <div className="flex-1 mt-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-amber-600" />
            Aguardando resposta há mais tempo
          </div>
          <ScrollArea className="flex-1 -mx-2 px-2">
            <ul className="space-y-1">
              {aguardando.slice(0, 12).map((t) => (
                <li key={t.cliente_id}>
                  <button
                    onClick={() => onSelect(t.cliente_id)}
                    className="w-full text-left px-3 py-2 rounded-lg border hover:bg-muted/60 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {t.cliente_nome}
                          {t.pet_primeiro_nome && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              · {t.pet_primeiro_nome}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.ultima_mensagem}
                        </div>
                      </div>
                      <span className="text-[11px] text-amber-700 whitespace-nowrap">
                        {timeAgo(t.ultima_em_in ?? t.ultima_em)}
                      </span>
                    </div>
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
  onBack,
  onChange,
}: {
  clienteId: string;
  thread: ThreadDTO | undefined;
  atendentes: { id: string; nome: string | null; email: string | null; avatar_url: string | null }[];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const envioMut = useMutation({
    mutationFn: (corpo: string) =>
      envioFn({ data: { cliente_id: clienteId, corpo } }),
    onSuccess: () => {
      setTexto("");
      toast.success("Envio registrado. Conversa marcada como respondida.");
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
      toast.success("Nota interna adicionada.");
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

  function sugerirComIA() {
    const petNome = detalhe.data?.pets?.[0]?.nome ?? "";
    const params = new URLSearchParams({
      cliente_id: clienteId,
      ...(petNome ? { pet_nome: petNome } : {}),
      voltar_para: "inbox",
    });
    navigate({ to: `/comunicacao?${params.toString()}` as any });
  }

  function abrirWa() {
    const tel = normalizarTelefoneBR(
      detalhe.data?.cliente?.whatsapp ?? detalhe.data?.cliente?.telefone
    );
    if (!tel.ok) {
      toast.error(tel.motivo);
      return;
    }
    abrirWhatsApp(montarWaUrl(tel.e164, ""));
  }

  // Trazer texto sugerido pela aba Comunicação de volta para o campo
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `sugestao_inbox:${clienteId}`;
      const stash = window.sessionStorage.getItem(key);
      if (stash) {
        setTexto(stash);
        setModo("envio");
        window.sessionStorage.removeItem(key);
        toast.info("Sugestão da IA carregada no campo abaixo.");
      }
    } catch {}
  }, [clienteId]);

  const cli = detalhe.data?.cliente;
  const pets = detalhe.data?.pets ?? [];
  const prox = detalhe.data?.proximo_agendamento as any;
  const estado = detalhe.data?.estado as any;
  const mensagens = detalhe.data?.mensagens ?? [];
  const status = thread?.status_conversa ?? "sem_mensagens";

  return (
    <div className="flex flex-col h-[calc(100vh-360px)] min-h-[560px]">
      <CardHeader className="border-b space-y-3 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate flex items-center gap-2">
              {cli?.nome ?? "Cliente"}
              <Badge
                variant="outline"
                className={cn("text-[10px]", STATUS_TONE[status])}
              >
                {STATUS_LABEL[status]}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate">
              {pets.length > 0 && (
                <>
                  <PawPrint className="inline h-3 w-3 mr-1" />
                  {pets.map((p: any) => p.nome).join(", ")} ·{" "}
                </>
              )}
              {cli?.whatsapp
                ? formatarTelefoneBR(cli.whatsapp)
                : cli?.telefone
                ? formatarTelefoneBR(cli.telefone)
                : "Sem WhatsApp"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={abrirWa}>
            <ExternalLink className="h-4 w-4 mr-2" /> WhatsApp
          </Button>
        </div>

        {/* Contexto do cliente */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Próximo agendamento
            </div>
            <div className="font-medium flex items-center gap-1 mt-0.5">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              {prox ? (
                <>
                  {new Date(prox.data).toLocaleDateString("pt-BR")} · {String(prox.hora).slice(0, 5)}
                  {prox.pets?.nome ? ` · ${prox.pets.nome}` : ""}
                </>
              ) : (
                <span className="text-muted-foreground font-normal">Nenhum</span>
              )}
            </div>
          </div>
          <Link
            to="/clientes/$id"
            params={{ id: clienteId }}
            className="rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/60 transition"
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Cadastro
            </div>
            <div className="font-medium flex items-center gap-1 mt-0.5">
              <FileText className="h-3.5 w-3.5" /> Abrir ficha do cliente
            </div>
          </Link>
          {pets[0] ? (
            <Link
              to="/pets/$petId/historico"
              params={{ petId: pets[0].id }}
              className="rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/60 transition"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Histórico
              </div>
              <div className="font-medium flex items-center gap-1 mt-0.5">
                <HistoryIcon className="h-3.5 w-3.5" /> Atendimentos de {pets[0].nome}
              </div>
            </Link>
          ) : (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground">
              <div className="text-[10px] uppercase tracking-wide">Histórico</div>
              <div className="mt-0.5">Sem pets cadastrados</div>
            </div>
          )}
        </div>

        {/* Ações da conversa */}
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <UsersIcon className="h-3.5 w-3.5 mr-1.5" />
                {thread?.responsavel_nome
                  ? `Resp.: ${thread.responsavel_nome.split(" ")[0]}`
                  : "Atribuir responsável"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
              <DropdownMenuLabel>Atribuir a…</DropdownMenuLabel>
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

          {status === "resolvida" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolvidaMut.mutate(false)}
              disabled={resolvidaMut.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reabrir
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolvidaMut.mutate(true)}
              disabled={resolvidaMut.isPending}
              className="text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/10"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Marcar resolvida
            </Button>
          )}

          {estado?.resolvida_em && (
            <span className="text-[11px] text-muted-foreground">
              Resolvida em{" "}
              {new Date(estado.resolvida_em).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4">
        {detalhe.isLoading && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Carregando…
          </div>
        )}
        {mensagens.length === 0 && !detalhe.isLoading && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Ainda sem mensagens registradas para este cliente.
          </div>
        )}
        <div className="space-y-2">
          {mensagens.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              onDelete={() => excluirMut.mutate(m.id)}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t bg-muted/30 p-3 space-y-2">
        <Tabs value={modo} onValueChange={(v) => setModo(v as any)}>
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="envio" className="text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Registrar envio
            </TabsTrigger>
            <TabsTrigger value="nota" className="text-xs">
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Nota interna
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder={
              modo === "envio"
                ? "Cole ou digite o que você enviou pelo WhatsApp Web…"
                : "Anote uma observação interna sobre este cliente…"
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submeter();
              }
            }}
          />
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              onClick={submeter}
              disabled={
                !texto.trim() || envioMut.isPending || notaMut.isPending
              }
              size="sm"
            >
              <Send className="h-4 w-4 mr-1.5" /> Registrar
            </Button>
            {modo === "envio" && (
              <Button
                variant="outline"
                size="sm"
                onClick={sugerirComIA}
                type="button"
              >
                <Sparkles className="h-4 w-4 mr-1.5" /> Sugerir com IA
              </Button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Registrar envio</strong> é uma confirmação manual do que você já
          enviou pelo WhatsApp Web — não dispara mensagem automática. Quando a
          WhatsApp Business API estiver integrada, este formulário passará a
          enviar direto do sistema.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  onDelete,
}: {
  m: MensagemDTO;
  onDelete: () => void;
}) {
  const isNota = m.tags?.includes("nota_interna");
  const alignRight = m.direcao === "out" && !isNota;
  const isSistema = m.canal === "sistema" || isNota;

  if (isSistema) {
    return (
      <div className="flex justify-center my-2">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 max-w-[85%] text-xs">
          <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
            <StickyNote className="h-3 w-3" /> Nota interna
          </div>
          <p className="whitespace-pre-wrap text-foreground">{m.corpo}</p>
          <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
            <span>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
            <button
              onClick={onDelete}
              className="opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
              title="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex group", alignRight ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          alignRight
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.corpo}</p>
        <div
          className={cn(
            "flex items-center gap-2 mt-1 text-[10px] justify-end",
            alignRight ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          <span>
            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {m.tags?.[0] && m.tags[0] !== "nota_interna" && m.tags[0] !== "registro_manual" && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] border-current/30"
            >
              {m.tags[0].replace(/_/g, " ")}
            </Badge>
          )}
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            title="Excluir"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
