import { createFileRoute } from "@tanstack/react-router";
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
  User,
  Bell,
  MailOpen,
  Clock,
  StickyNote,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  listarThreads,
  getThread,
  marcarLidas,
  registrarMensagemRecebida,
  registrarNotaInterna,
  excluirMensagem,
  inboxKPIs,
  type ThreadDTO,
  type MensagemDTO,
} from "@/lib/inbox.functions";
import {
  formatarTelefoneBR,
  normalizarTelefoneBR,
  montarWaUrl,
  abrirWhatsApp,
} from "@/lib/whatsapp";

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

function InboxPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "nao_lidas">("todas");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const listarFn = useServerFn(listarThreads);
  const kpisFn = useServerFn(inboxKPIs);

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

  const thread: ThreadDTO | undefined = useMemo(
    () => threads.data?.find((t) => t.cliente_id === selecionado),
    [threads.data, selecionado]
  );

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
                Inbox unificada por cliente. Envie pelo WhatsApp Web e registre respostas manualmente.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              threads.refetch();
              kpis.refetch();
            }}
          >
            <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            icon={<Bell className="h-4 w-4" />}
            label="Não lidas"
            value={kpis.data?.nao_lidas ?? 0}
            tone="amber"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Aguardando resposta"
            value={kpis.data?.aguardando_resposta ?? 0}
            tone="blue"
          />
          <KpiCard
            icon={<MailOpen className="h-4 w-4" />}
            label="Mensagens hoje"
            value={kpis.data?.hoje ?? 0}
            tone="emerald"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4">
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
                  placeholder="Buscar cliente…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="todas">Todas</TabsTrigger>
                  <TabsTrigger value="nao_lidas">
                    Não lidas
                    {(kpis.data?.nao_lidas ?? 0) > 0 && (
                      <Badge className="ml-2 h-5 px-1.5" variant="destructive">
                        {kpis.data?.nao_lidas}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-360px)] min-h-[420px]">
                {threads.isLoading && (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    Carregando…
                  </div>
                )}
                {threads.data && threads.data.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhuma conversa ainda. Ao enviar uma mensagem pelo WhatsApp
                    (agenda, cobranças, atendimento) ela aparece aqui.
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {t.cliente_nome}
                              </span>
                              {t.nao_lidas > 0 && (
                                <Badge variant="destructive" className="h-5 px-1.5 shrink-0">
                                  {t.nao_lidas}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {t.ultima_direcao === "in" ? "" : "Você: "}
                              {t.ultima_mensagem ?? "—"}
                            </p>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {timeAgo(t.ultima_em)}
                          </span>
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
                onBack={() => setSelecionado(null)}
                onChange={() => {
                  qc.invalidateQueries({ queryKey: ["inbox-threads"] });
                  qc.invalidateQueries({ queryKey: ["inbox-kpis"] });
                }}
              />
            ) : (
              <div className="h-[calc(100vh-320px)] min-h-[420px] flex items-center justify-center text-center p-8">
                <div>
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Selecione uma conversa para ver o histórico
                  </p>
                </div>
              </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald";
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };
  return (
    <Card className="card-premium">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-lg border p-2", tones[tone])}>{icon}</div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ThreadView({
  clienteId,
  thread,
  onBack,
  onChange,
}: {
  clienteId: string;
  thread: ThreadDTO | undefined;
  onBack: () => void;
  onChange: () => void;
}) {
  const getFn = useServerFn(getThread);
  const marcarFn = useServerFn(marcarLidas);
  const receberFn = useServerFn(registrarMensagemRecebida);
  const notaFn = useServerFn(registrarNotaInterna);
  const excluirFn = useServerFn(excluirMensagem);

  const detalhe = useQuery({
    queryKey: ["inbox-thread", clienteId],
    queryFn: () => getFn({ data: { cliente_id: clienteId } }),
    refetchInterval: 15_000,
  });

  const [modo, setModo] = useState<"recebida" | "nota">("recebida");
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

  const receberMut = useMutation({
    mutationFn: (corpo: string) =>
      receberFn({ data: { cliente_id: clienteId, corpo, canal: "whatsapp" } }),
    onSuccess: () => {
      setTexto("");
      toast.success("Resposta do cliente registrada.");
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

  function submeter() {
    const corpo = texto.trim();
    if (!corpo) return;
    if (modo === "recebida") receberMut.mutate(corpo);
    else notaMut.mutate(corpo);
  }

  function abrirWa() {
    const tel = normalizarTelefoneBR(detalhe.data?.cliente?.telefone);
    if (!tel.ok) {
      toast.error(tel.motivo);
      return;
    }
    abrirWhatsApp(montarWaUrl(tel.e164, ""));
  }

  const cli = detalhe.data?.cliente;
  const mensagens = detalhe.data?.mensagens ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-320px)] min-h-[520px]">
      <CardHeader className="border-b flex-row items-center gap-3 space-y-0 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base truncate">
            {cli?.nome ?? "Cliente"}
          </CardTitle>
          <p className="text-xs text-muted-foreground truncate">
            {cli?.telefone ? formatarTelefoneBR(cli.telefone) : "Sem telefone"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={abrirWa}>
          <ExternalLink className="h-4 w-4 mr-2" /> WhatsApp
        </Button>
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
            <TabsTrigger value="recebida" className="text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Resposta recebida
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
              modo === "recebida"
                ? "Cole ou digite o que o cliente respondeu no WhatsApp…"
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
          <Button
            onClick={submeter}
            disabled={
              !texto.trim() || receberMut.isPending || notaMut.isPending
            }
            className="shrink-0"
          >
            <Send className="h-4 w-4 mr-2" /> Registrar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Envios pelo WhatsApp Web (agenda, cobranças, atendimento) são
          registrados automaticamente. Use esta caixa apenas para o que o
          cliente respondeu ou notas internas.
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
          <span>{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          {m.tags?.[0] && m.tags[0] !== "nota_interna" && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] border-current/30">
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
