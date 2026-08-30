import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles, Send, MessageCircle, History, Loader2, Copy, Wand2,
  BellRing, ThumbsUp, ThumbsDown, ShieldAlert, FileText, Plus, Trash2, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppComposer, useWhatsAppComposer } from "@/components/whatsapp-composer";
import {
  TIPO_MENSAGEM, TIPO_LABEL, type TipoMensagem,
  gerarMensagemIA,
  listarTemplates, salvarTemplate, excluirTemplate,
  gerarSugestoesProativas, listarSugestoes, atualizarStatusSugestao, feedbackSugestao,
  listarHistoricoMensagens,
} from "@/lib/comunicacao-advanced.functions";
import { 
  gerar3AbordagensIA, 
  listarThreads, 
  obterDossieConversa, 
  registrarRespostaCliente 
} from "@/lib/comunicacao-central.functions";

import { VisaoGeralTab } from "@/components/comunicacao/visao-geral-tab";
import { FilaProativaTab } from "@/components/comunicacao/fila-proativa-tab";
import { IaConfigTab } from "@/components/comunicacao/ia-config-tab";
import { ComporTab } from "@/components/comunicacao/compor-tab";
import { useMyAccess } from "@/hooks/use-my-permissions";
import { LayoutDashboard, ListChecks, Settings2, HandCoins } from "lucide-react";
import { PromessasTab } from "@/components/comunicacao/promessas-tab";
import { ChatThreadsCol } from "@/components/comunicacao/chat-threads-col";
import { ChatTimelineCol } from "@/components/comunicacao/chat-timeline-col";
import { ChatContextCol } from "@/components/comunicacao/chat-context-col";



export const Route = createFileRoute("/_authenticated/comunicacao")({
  component: ComunicacaoPage,
});

type Cliente = { id: string; nome: string; whatsapp: string | null; tom_preferido: string | null; opt_out_comunicacao: boolean };
type Pet = { id: string; nome: string; cliente_id: string };

function primeiroNome(v: string | null | undefined) {
  return (v ?? "").trim().split(/\s+/)[0] ?? "";
}

function ComunicacaoPage() {
  const qc = useQueryClient();
  const perms = useMyAccess();
  const [aba, setAba] = useState("visao");
  const [inboxClienteId, setInboxClienteId] = useState<string | null>(null);


  // -------- shared data --------
  const clientesQ = useQuery({
    queryKey: ["comunicacao", "clientes-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, whatsapp, tom_preferido, opt_out_comunicacao")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const petsQ = useQuery({
    queryKey: ["comunicacao", "pets-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, nome, cliente_id")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Pet[];
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Comunicação e IA"
        description="Fila proativa, templates, tom por cliente e histórico rastreável. A revisão humana é obrigatória antes de qualquer envio."
      />

      <Alert className="border-amber-200 bg-amber-50/50">
        <Zap className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-xs">
          Integração de envio: o disparo automático real depende da integração externa (Meta WhatsApp Business API, Twilio, Z-API etc.).
          Enquanto não configurada, o sistema abre o WhatsApp Web com a mensagem revisada para envio manual — o texto, o histórico e o consentimento continuam sendo registrados.
        </AlertDescription>
      </Alert>

      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao"><LayoutDashboard className="h-4 w-4 mr-2" /> Visão geral</TabsTrigger>
          <TabsTrigger value="inbox"><MessageCircle className="h-4 w-4 mr-2" /> Inbox Inteligente</TabsTrigger>
          <TabsTrigger value="fila"><ListChecks className="h-4 w-4 mr-2" /> Fila proativa</TabsTrigger>
          <TabsTrigger value="promessas"><HandCoins className="h-4 w-4 mr-2" /> Promessas</TabsTrigger>
          <TabsTrigger value="sugestoes"><Sparkles className="h-4 w-4 mr-2" /> Sugestões</TabsTrigger>
          <TabsTrigger value="compor"><Wand2 className="h-4 w-4 mr-2" /> Compor</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-4 w-4 mr-2" /> Templates</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" /> Histórico</TabsTrigger>
          <TabsTrigger value="config"><Settings2 className="h-4 w-4 mr-2" /> Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <VisaoGeralTab 
            onIrParaFila={() => setAba("fila")} 
            onIrParaInbox={(cid) => {
              if (cid) setInboxClienteId(cid);
              setAba("inbox");
            }}
            onIrParaPromessas={() => setAba("promessas")}
          />
        </TabsContent>
        <TabsContent value="inbox">
          <InboxTab initialClienteId={inboxClienteId} onClienteSelect={setInboxClienteId} />
        </TabsContent>


        <TabsContent value="fila"><FilaProativaTab /></TabsContent>
        <TabsContent value="promessas">
          <PromessasTab podeEditar={!!perms.data?.canManageUsers || !!perms.data?.isAdmin} />
        </TabsContent>

        <TabsContent value="sugestoes"><SugestoesTab /></TabsContent>

        <TabsContent value="compor">
          <ComporTab clientes={clientesQ.data ?? []} pets={petsQ.data ?? []} />
        </TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="historico">
          <HistoricoTab clientes={clientesQ.data ?? []} />
        </TabsContent>
        <TabsContent value="config">
          <IaConfigTab isAdmin={!!perms.data?.isAdmin} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function InboxInteligenteTab() {
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  return (
    <Card className="h-[calc(100vh-280px)] overflow-hidden rounded-2xl border-border/60 flex shadow-lg">
      <div className="w-80 shrink-0">
        <ChatThreadsCol 
          selectedId={selectedClienteId || undefined} 
          onSelectThread={setSelectedClienteId} 
        />
      </div>
      <div className="flex-1 flex min-w-0">
        {selectedClienteId ? (
          <>
            <div className="flex-1 min-w-0">
              <ChatTimelineCol clienteId={selectedClienteId} />
            </div>
            <div className="hidden xl:block">
              <ChatContextCol clienteId={selectedClienteId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <MessageCircle className="h-12 w-12 mb-4 opacity-10" />
            <p className="text-sm font-medium">Selecione uma conversa para começar</p>
            <p className="text-xs opacity-70">Busque por cliente, pet ou telefone na lista ao lado.</p>
          </div>
        )}
      </div>
    </Card>
  );
}



/* ============================================================
 * SUB-ABA: Sugestões proativas
 * ============================================================ */
function SugestoesTab() {
  const qc = useQueryClient();
  const gerar = useServerFn(gerarSugestoesProativas);
  const listar = useServerFn(listarSugestoes);
  const atualizar = useServerFn(atualizarStatusSugestao);
  const feedback = useServerFn(feedbackSugestao);
  const composer = useWhatsAppComposer();

  const sugQ = useQuery({
    queryKey: ["sugestoes-fila"],
    queryFn: async () => await listar(),
  });

  const gerarMut = useMutation({
    mutationFn: async () => await gerar(),
    onSuccess: (r) => {
      toast.success(`Fila atualizada — ${r.criadas} novas sugestões processadas.`);
      qc.invalidateQueries({ queryKey: ["sugestoes-fila"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar sugestões"),
  });

  const ignorar = useMutation({
    mutationFn: async (id: string) => await atualizar({ data: { id, status: "ignorada" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sugestoes-fila"] }),
  });

  const marcarEnviada = useMutation({
    mutationFn: async (id: string) => await atualizar({ data: { id, status: "enviada" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sugestoes-fila"] }),
  });

  const fb = useMutation({
    mutationFn: async (p: { id: string; feedback: "positivo" | "negativo" }) =>
      await feedback({ data: p }),
    onSuccess: () => {
      toast.success("Obrigado — sua avaliação vai afinar futuras sugestões.");
      qc.invalidateQueries({ queryKey: ["sugestoes-fila"] });
    },
  });

  function abrirComposer(s: any) {
    if (s.clientes?.opt_out_comunicacao) {
      toast.error("Este cliente optou por não receber comunicação.");
      return;
    }
    composer.open({
      tipo: s.tipo as any,
      destinatario: s.clientes?.nome ?? "Cliente",
      telefone: s.clientes?.whatsapp ?? "",
      mensagem: s.mensagem_sugerida ?? "",
      motivo: `Sugestão: ${s.motivo}`,
      cliente_id: s.cliente_id,
      atendimento_id: s.atendimento_id,
      cobranca_id: s.cobranca_id,
    });
    marcarEnviada.mutate(s.id);
  }

  const lista = sugQ.data ?? [];

  return (
    <>
      <Card className="p-4 sm:p-6 rounded-2xl border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-primary">Fila proativa</h2>
            <p className="text-xs text-muted-foreground">
              Sugestões geradas automaticamente a partir de agendamentos, atendimentos, aniversários, cobranças e clientes sem visita.
            </p>
          </div>
          <Button onClick={() => gerarMut.mutate()} disabled={gerarMut.isPending}>
            {gerarMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />}
            Atualizar fila agora
          </Button>
        </div>

        {sugQ.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : lista.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhuma sugestão pendente. Clique em <b>Atualizar fila</b> para varrer os eventos do sistema.
          </div>
        ) : (
          <ul className="space-y-3">
            {lista.map((s: any) => (
              <li key={s.id} className="rounded-xl border border-border/60 p-4 bg-card hover:border-primary/40 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium">{s.clientes?.nome ?? "—"}</span>
                      {s.pets?.nome && <span className="text-xs text-muted-foreground">· {s.pets.nome}</span>}
                      <Badge variant="secondary" className="text-[10px]">{TIPO_LABEL[s.tipo as TipoMensagem] ?? s.tipo}</Badge>
                      <Badge variant="outline" className="text-[10px]">Prioridade {s.prioridade}</Badge>
                      {s.clientes?.opt_out_comunicacao && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <ShieldAlert className="h-3 w-3" /> Opt-out
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.motivo}</div>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 text-sm whitespace-pre-wrap mb-3">
                  {s.mensagem_sugerida}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => abrirComposer(s)} disabled={s.clientes?.opt_out_comunicacao}>
                    <Send className="h-4 w-4 mr-1" /> Revisar e enviar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => ignorar.mutate(s.id)}>
                    Ignorar
                  </Button>
                  <div className="ml-auto flex gap-1">
                    <Button size="icon" variant={s.feedback === "positivo" ? "default" : "ghost"} className="h-8 w-8"
                      onClick={() => fb.mutate({ id: s.id, feedback: "positivo" })} title="Sugestão útil">
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant={s.feedback === "negativo" ? "destructive" : "ghost"} className="h-8 w-8"
                      onClick={() => fb.mutate({ id: s.id, feedback: "negativo" })} title="Sugestão ruim">
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <WhatsAppComposer open={composer.state.open} onOpenChange={composer.setOpen} payload={composer.state.payload} />
    </>
  );
}

/* ============================================================
 * SUB-ABA: Templates
 * ============================================================ */
function TemplatesTab() {
  const qc = useQueryClient();
  const listar = useServerFn(listarTemplates);
  const salvar = useServerFn(salvarTemplate);
  const excluir = useServerFn(excluirTemplate);

  const q = useQuery({ queryKey: ["templates-crud"], queryFn: async () => await listar() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ id: null, tipo: "confirmacao_agendamento", nome: "", corpo: "", descricao: "" });

  const salvarMut = useMutation({
    mutationFn: async () => await salvar({ data: {
      id: form.id ?? undefined, tipo: form.tipo, nome: form.nome, corpo: form.corpo, descricao: form.descricao || null,
    } }),
    onSuccess: () => {
      toast.success("Template salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["templates-crud"] });
      qc.invalidateQueries({ queryKey: ["templates-list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const excluirMut = useMutation({
    mutationFn: async (id: string) => await excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removido");
      qc.invalidateQueries({ queryKey: ["templates-crud"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  function novoTemplate() {
    setForm({ id: null, tipo: "confirmacao_agendamento", nome: "", corpo: "", descricao: "" });
    setOpen(true);
  }
  function editar(t: any) {
    setForm({ id: t.id, tipo: t.tipo, nome: t.nome, corpo: t.corpo, descricao: t.descricao ?? "" });
    setOpen(true);
  }

  const grupos = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of q.data ?? []) (map[t.tipo] ||= []).push(t);
    return map;
  }, [q.data]);

  return (
    <Card className="p-4 sm:p-6 rounded-2xl border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-primary">Biblioteca de templates</h2>
          <p className="text-xs text-muted-foreground">Variáveis suportadas: {"{tutor}"} {"{pet}"} {"{data}"} {"{hora}"} {"{valor}"}. Apenas Admin/Proprietário edita.</p>
        </div>
        <Button onClick={novoTemplate}><Plus className="h-4 w-4 mr-1" /> Novo template</Button>
      </div>

      {q.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-muted-foreground" /> : (
        <div className="space-y-6">
          {TIPO_MENSAGEM.filter((t) => grupos[t]?.length).map((t) => (
            <div key={t}>
              <h3 className="text-sm font-semibold text-primary mb-2">{TIPO_LABEL[t]}</h3>
              <ul className="grid gap-2 md:grid-cols-2">
                {grupos[t].map((tpl: any) => (
                  <li key={tpl.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{tpl.nome}</div>
                        {tpl.is_padrao && <Badge variant="outline" className="text-[10px] mt-1">Padrão do sistema</Badge>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editar(tpl)}>
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                        {!tpl.is_padrao && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => excluirMut.mutate(tpl.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{tpl.corpo}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>Use {"{tutor}"} {"{pet}"} {"{data}"} {"{hora}"} {"{valor}"} nos textos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f: any) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_MENSAGEM.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm((f: any) => ({ ...f, nome: e.target.value }))} maxLength={120} />
            </div>
            <div>
              <Label>Corpo</Label>
              <Textarea rows={6} value={form.corpo} onChange={(e) => setForm((f: any) => ({ ...f, corpo: e.target.value }))} maxLength={4000} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao} onChange={(e) => setForm((f: any) => ({ ...f, descricao: e.target.value }))} maxLength={200} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending || !form.nome || !form.corpo}>
              {salvarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================================================
 * SUB-ABA: Histórico
 * ============================================================ */
function HistoricoTab({ clientes }: { clientes: Cliente[] }) {
  const listar = useServerFn(listarHistoricoMensagens);
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const q = useQuery({
    queryKey: ["historico-msg", filtroCliente, filtroTipo, desde, ate],
    queryFn: async () => await listar({ data: {
      clienteId: filtroCliente || null,
      tipo: filtroTipo || null,
      autorId: null,
      desde: desde ? new Date(desde).toISOString() : null,
      ate: ate ? new Date(ate + "T23:59:59").toISOString() : null,
    } }),
  });

  return (
    <Card className="p-4 sm:p-6 rounded-2xl border-border/60">
      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <div>
          <Label className="text-xs">Cliente</Label>
          <Select value={filtroCliente || "__all"} onValueChange={(v) => setFiltroCliente(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={filtroTipo || "__all"} onValueChange={(v) => setFiltroTipo(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {TIPO_MENSAGEM.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      {q.isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-muted-foreground" />
      ) : (q.data ?? []).length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem no filtro selecionado.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {(q.data ?? []).map((m: any) => {
            const editada = m.mensagem_original && m.mensagem_original !== m.corpo;
            return (
              <li key={m.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium">{m.clientes?.nome ?? "—"}</span>
                  {m.tipo && <Badge variant="secondary" className="text-[10px]">{TIPO_LABEL[m.tipo as TipoMensagem] ?? m.tipo}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                  {editada && <Badge variant="outline" className="text-[10px]">Editada antes do envio</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Autor: {m.autor?.nome ?? m.autor?.email ?? m.autor_email ?? "—"}
                </div>
                <div className="text-sm whitespace-pre-wrap rounded-md bg-muted/30 p-2">{m.corpo}</div>
                {editada && (
                  <details className="mt-1">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer">Ver sugestão original</summary>
                    <div className="text-xs whitespace-pre-wrap rounded-md bg-amber-50 border border-amber-100 p-2 mt-1">{m.mensagem_original}</div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ============================================================
 * SUB-ABA: Inbox Inteligente (Central de Mensagens)
 * ============================================================ */
function InboxTab({ initialClienteId, onClienteSelect }: { initialClienteId: string | null, onClienteSelect: (id: string | null) => void }) {
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(initialClienteId);

  // Sincroniza estado interno se o pai mudar
  useMemo(() => {
    if (initialClienteId !== selectedClienteId) {
      setSelectedClienteId(initialClienteId);
    }
  }, [initialClienteId]);

  const handleSelect = (id: string) => {
    setSelectedClienteId(id);
    onClienteSelect(id);
  };


  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] border border-border/60 rounded-2xl overflow-hidden bg-background shadow-sm">
      <ChatThreadsCol 
        selectedId={selectedClienteId || undefined}
        onSelectThread={handleSelect}
      />

      
      <div className="flex-1 flex overflow-hidden">
        {selectedClienteId ? (
          <>
            <ChatTimelineCol clienteId={selectedClienteId} />
            <ChatContextCol clienteId={selectedClienteId} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-display font-semibold text-primary">Inbox Inteligente</h3>
            <p className="text-sm max-w-xs text-center mt-2">
              Selecione uma conversa ao lado para visualizar o histórico e compor respostas com IA.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

