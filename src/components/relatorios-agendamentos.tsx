import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarAgendamentos,
  salvarAgendamento,
  excluirAgendamento,
  listarExecucoes,
  marcarExecucaoEnviada,
  gerarExecucoesAgora,
  KPIS_DISPONIVEIS,
  type AgendamentoDTO,
  type KpiId,
} from "@/lib/relatorios-agendamentos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarClock, CheckCircle2, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Destinatario = { nome: string; whatsapp: string };

const empty = (): {
  id?: string; nome: string; hora_envio: string; destinatarios: Destinatario[]; ativo: boolean;
  kpis: KpiId[]; titulo_mensagem: string; rodape_mensagem: string;
} => ({
  nome: "", hora_envio: "08:00",
  destinatarios: [{ nome: "", whatsapp: "" }],
  ativo: true,
  kpis: ["faturamento", "atendimentos", "ticket", "clientes", "leva_traz", "a_receber"],
  titulo_mensagem: "",
  rodape_mensagem: "",
});

export function RelatoriosAgendamentos() {
  const qc = useQueryClient();
  const listar = useServerFn(listarAgendamentos);
  const salvar = useServerFn(salvarAgendamento);
  const excluir = useServerFn(excluirAgendamento);
  const listarEx = useServerFn(listarExecucoes);
  const marcar = useServerFn(marcarExecucaoEnviada);
  const gerar = useServerFn(gerarExecucoesAgora);

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(empty());

  const qAg = useQuery({ queryKey: ["rel-agendamentos"], queryFn: () => listar() });
  const qPend = useQuery({
    queryKey: ["rel-execucoes", "pend"],
    queryFn: () => listarEx({ data: { apenasPendentes: true, limit: 100 } }),
  });
  const qHist = useQuery({
    queryKey: ["rel-execucoes", "hist"],
    queryFn: () => listarEx({ data: { apenasPendentes: false, limit: 100 } }),
  });

  const mSalvar = useMutation({
    mutationFn: (d: typeof form) => salvar({ data: d }),
    onSuccess: () => {
      toast.success("Agendamento salvo");
      setAberto(false);
      setForm(empty());
      qc.invalidateQueries({ queryKey: ["rel-agendamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });
  const mExcluir = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Agendamento excluído");
      qc.invalidateQueries({ queryKey: ["rel-agendamentos"] });
    },
  });
  const mMarcar = useMutation({
    mutationFn: (id: string) => marcar({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rel-execucoes"] });
    },
  });
  const mGerar = useMutation({
    mutationFn: () => gerar(),
    onSuccess: (r: any) => {
      toast.success(`${r?.total ?? 0} envio(s) preparado(s)`);
      qc.invalidateQueries({ queryKey: ["rel-execucoes"] });
      qc.invalidateQueries({ queryKey: ["rel-agendamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar"),
  });

  const editar = (a: AgendamentoDTO) => {
    setForm({
      id: a.id,
      nome: a.nome,
      hora_envio: a.hora_envio.slice(0, 5),
      destinatarios: a.destinatarios.length ? a.destinatarios : [{ nome: "", whatsapp: "" }],
      ativo: a.ativo,
      kpis: (a.kpis && a.kpis.length ? a.kpis : ["faturamento", "atendimentos", "ticket", "clientes", "leva_traz", "a_receber"]) as KpiId[],
      titulo_mensagem: a.titulo_mensagem ?? "",
      rodape_mensagem: a.rodape_mensagem ?? "",
    });
    setAberto(true);
  };

  const submit = () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const dests = form.destinatarios
      .map((d) => ({ nome: d.nome.trim(), whatsapp: d.whatsapp.replace(/\D/g, "") }))
      .filter((d) => d.nome && d.whatsapp);
    if (!dests.length) return toast.error("Adicione ao menos um destinatário");
    if (!form.kpis.length) return toast.error("Selecione ao menos um KPI");
    mSalvar.mutate({
      ...form,
      destinatarios: dests,
      titulo_mensagem: form.titulo_mensagem.trim() || null,
      rodape_mensagem: form.rodape_mensagem.trim() || null,
    } as any);
  };

  const toggleKpi = (id: KpiId) => {
    setForm((f) => ({
      ...f,
      kpis: f.kpis.includes(id) ? f.kpis.filter((k) => k !== id) : [...f.kpis, id],
    }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="font-serif flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Envio automático por WhatsApp
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            O sistema gera o resumo diário no horário definido; você clica para disparar o WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mGerar.mutate()} disabled={mGerar.isPending}>
            <RefreshCw className={`w-4 h-4 mr-1 ${mGerar.isPending ? "animate-spin" : ""}`} />
            Gerar agora
          </Button>
          <Dialog open={aberto} onOpenChange={(o) => { setAberto(o); if (!o) setForm(empty()); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
                <DialogDescription>
                  Envio diário do resumo com dados do dia anterior.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Nome</Label>
                    <Input maxLength={80} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Resumo diário" />
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Input type="time" value={form.hora_envio} onChange={(e) => setForm({ ...form, hora_envio: e.target.value })} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Destinatários</Label>
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, destinatarios: [...form.destinatarios, { nome: "", whatsapp: "" }] })}>
                      <Plus className="w-3 h-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {form.destinatarios.map((d, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input placeholder="Nome" value={d.nome} onChange={(e) => {
                          const arr = [...form.destinatarios]; arr[i] = { ...arr[i], nome: e.target.value };
                          setForm({ ...form, destinatarios: arr });
                        }} />
                        <Input placeholder="WhatsApp (só números)" value={d.whatsapp} onChange={(e) => {
                          const arr = [...form.destinatarios]; arr[i] = { ...arr[i], whatsapp: e.target.value.replace(/\D/g, "") };
                          setForm({ ...form, destinatarios: arr });
                        }} />
                        <Button size="icon" variant="ghost" onClick={() => {
                          const arr = form.destinatarios.filter((_, j) => j !== i);
                          setForm({ ...form, destinatarios: arr.length ? arr : [{ nome: "", whatsapp: "" }] });
                        }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <Label>KPIs na mensagem</Label>
                  <p className="text-xs text-muted-foreground">
                    Escolha quais indicadores aparecem no resumo enviado por WhatsApp.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {KPIS_DISPONIVEIS.map((k) => {
                      const on = form.kpis.includes(k.id);
                      return (
                        <label
                          key={k.id}
                          className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox checked={on} onCheckedChange={() => toggleKpi(k.id)} />
                          <span className="text-sm">{k.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {form.kpis.length} selecionado(s)
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div>
                    <Label>Título da mensagem (opcional)</Label>
                    <Input
                      maxLength={120}
                      value={form.titulo_mensagem}
                      onChange={(e) => setForm({ ...form, titulo_mensagem: e.target.value })}
                      placeholder="Ex.: Spa da Tia Jéssica — Resumo do dia"
                    />
                  </div>
                  <div>
                    <Label>Rodapé (opcional)</Label>
                    <Textarea
                      maxLength={300}
                      rows={2}
                      value={form.rodape_mensagem}
                      onChange={(e) => setForm({ ...form, rodape_mensagem: e.target.value })}
                      placeholder="Ex.: Qualquer dúvida, estou à disposição. 🐾"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t pt-3">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={mSalvar.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="agendamentos">
          <TabsList>
            <TabsTrigger value="agendamentos">Agendamentos ({qAg.data?.itens.length ?? 0})</TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes ({qPend.data?.itens.length ?? 0})</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="agendamentos" className="space-y-2 mt-3">
            {(qAg.data?.itens ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhum agendamento ainda.</div>
            )}
            {(qAg.data?.itens ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.nome}</span>
                    <Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativo" : "Pausado"}</Badge>
                    <Badge variant="outline">{a.hora_envio.slice(0, 5)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.destinatarios.length} destinatário(s)
                    {a.ultima_execucao ? ` · última execução ${new Date(a.ultima_execucao + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => editar(a)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm(`Excluir "${a.nome}"?`)) mExcluir.mutate(a.id);
                  }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="pendentes" className="space-y-2 mt-3">
            {(qPend.data?.itens ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhum envio pendente. Clique em "Gerar agora" para preparar o de hoje.
              </div>
            )}
            {(qPend.data?.itens ?? []).map((e) => (
              <div key={e.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.destinatario_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.agendamento_nome} · período {new Date(e.periodo_de + "T12:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => window.open(e.wa_url, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" onClick={() => mMarcar.mutate(e.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar enviado
                    </Button>
                  </div>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Prévia da mensagem</summary>
                  <pre className="whitespace-pre-wrap font-sans mt-1 p-2 bg-muted rounded">{e.mensagem}</pre>
                </details>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="historico" className="space-y-2 mt-3">
            {(qHist.data?.itens ?? []).filter((h) => h.enviado_em).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhum envio registrado ainda.</div>
            )}
            {(qHist.data?.itens ?? []).filter((h) => h.enviado_em).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{h.destinatario_nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.agendamento_nome} · período {new Date(h.periodo_de + "T12:00:00").toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  Enviado em<br />
                  {h.enviado_em ? new Date(h.enviado_em).toLocaleString("pt-BR") : "—"}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
