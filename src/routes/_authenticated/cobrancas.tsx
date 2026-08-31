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
  registrarRespostaCliente,
  sugerirMensagemCobranca,
  obterConfigCobranca,
  salvarConfigCobranca,
  salvarTemplateCobranca,
  renderTemplate,
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
  obterDossieCobrancaAvancada as obterDossieCobranca,
  registrarPromessaAvancada,
  type FilaItemDTO
} from "@/lib/cobrancas.functions";
import { CobrancaPainelLateral } from "@/components/cobrancas/CobrancaPainelLateral";
import { JessiCobrancasPanel } from "@/components/cobrancas/JessiCobrancasPanel";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Inbox,
  Trash2,
  Archive,
  RotateCcw,
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
  const listar = useServerFn(listarCobrancas);
  const kpis = useServerFn(kpisCobrancas);

  const [filtro, setFiltro] = useState<{
    status: string[];
    clienteNome: string;
    atrasoFaixa: "todos" | "0_3" | "4_7" | "8_15" | "15p";
  }>({ status: [], clienteNome: "", atrasoFaixa: "todos" });

  const qKpis = useQuery({ queryKey: ["cobrancas", "kpis"], queryFn: () => kpis() });
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

  // Ativa a sincronização em tempo real para KPIs e listas
  useRealtimeFinanceiro(["cobrancas"]);

  const [selecionada, setSelecionada] = useState<CobrancaDTO | null>(null);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const composer = useWhatsAppComposer();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl">Central de Cobrança</h1>
            <p className="text-sm text-muted-foreground">
              Recuperação de receita com régua de contato, IA e histórico completo.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowConfig(true)}>
          Régua e templates
        </Button>
      </header>

      {/* Painel Inteligente da Jessi */}
      <JessiCobrancasPanel
        kpis={qKpis.data}
        onFiltrarAtraso7d={() => setFiltro((f) => ({ ...f, atrasoFaixa: "8_15" }))}
        onFiltrarVenceHoje={() => setFiltro((f) => ({ ...f, status: ["a_vencer"] }))}
        onRefresh={async () => {
          await Promise.all([qKpis.refetch(), qLista.refetch()]);
          toast.success("Dados de cobrança atualizados");
        }}
        isRefreshing={qKpis.isFetching || qLista.isFetching}
      />

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

      <Tabs defaultValue="fila" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fila">Fila do Dia</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="funil">Funil de recuperação</TabsTrigger>
          <TabsTrigger value="lixeira">
            <Archive className="h-3.5 w-3.5 mr-1" />
            Lixeira
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lixeira">
          <LixeiraTab />
        </TabsContent>

        <TabsContent value="fila">
          <FilaDoDiaTab onSelect={(c) => setSelecionadaId(c.id)} />
        </TabsContent>

        <TabsContent value="funil">
          <FunilTab />
        </TabsContent>

        <TabsContent value="todas">

      <Card>

        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Buscar cliente</Label>
              <Input
                placeholder="Nome do tutor"
                value={filtro.clienteNome}
                onChange={(e) => setFiltro((f) => ({ ...f, clienteNome: e.target.value }))}
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">Atraso</Label>
              <Select
                value={filtro.atrasoFaixa}
                onValueChange={(v) => setFiltro((f) => ({ ...f, atrasoFaixa: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
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
                      setFiltro((f) => ({
                        ...f,
                        status: on ? f.status.filter((x) => x !== s) : [...f.status, s],
                      }))
                    }
                    className={`text-xs rounded-full px-3 py-1 border ${on ? STATUS_CLASS[s] : "bg-background border-border text-muted-foreground"}`}
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
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (qLista.data ?? []).length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhuma cobrança para os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Cliente / Pet</th>
                    <th className="py-2 pr-3">Vencimento</th>
                    <th className="py-2 pr-3">Atraso</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Última tentativa</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(qLista.data ?? []).map((c) => (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-muted/40 cursor-pointer"
                      onClick={() => setSelecionadaId(c.id)}
                    >
                      <td className="py-2 pr-3">
                        <div className="font-medium">{c.cliente_nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.pet_nome ?? "—"} • {fmtDate(c.data_atendimento)}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{fmtDate(c.vencimento)}</td>
                      <td className="py-2 pr-3">
                        {c.dias_atraso > 0 ? (
                          <span className="text-rose-700 font-medium">{c.dias_atraso}d</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium">{brl(c.saldo)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={STATUS_CLASS[c.status]}>
                          {STATUS_LABEL[c.status]}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {c.ultima_cobranca_em
                          ? new Date(c.ultima_cobranca_em).toLocaleDateString("pt-BR")
                          : "—"}
                        {c.tentativas > 0 ? ` • ${c.tentativas}x` : ""}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelecionadaId(c.id);
                          }}
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>



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
      className={`relative overflow-hidden before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${toneMap[tone]}`}
    >
      <CardContent className="pt-4 pb-4 pl-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-2xl font-display">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

// ===================================================================
// Detalhe da cobrança
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
  const registrarResposta = useServerFn(registrarRespostaCliente);
  const excluir = useServerFn(excluirCobranca);

  const qHist = useQuery({
    queryKey: ["cobrancas", "historico", cobranca.id],
    queryFn: () => historico({ data: { cobrancaId: cobranca.id } }),
  });

  const [mensagem, setMensagem] = useState("");
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [promessaData, setPromessaData] = useState("");

  // Resposta recebida do cliente
  const [respostaTexto, setRespostaTexto] = useState("");
  const [respostaIntencao, setRespostaIntencao] = useState<
    "auto" | "pagou" | "promessa" | "negociar" | "contestou" | "sem_intencao"
  >("auto");
  const [respostaData, setRespostaData] = useState("");
  const [respostaValor, setRespostaValor] = useState<string>("");
  const [salvandoResp, setSalvandoResp] = useState(false);

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
      if (
        !window.confirm(
          `Enviar para a lixeira a cobrança de ${cobranca.cliente_nome}?\n\nEla sai das listas e dos totais, mas fica guardada na aba "Lixeira" e pode ser restaurada a qualquer momento — inclusive pelo celular.`,
        )
      ) {
        return null;
      }
      return excluir({ data: { cobrancaId: cobranca.id } });
    },
    onSuccess: (r) => {
      if (!r) return;
      toast.success("Cobrança enviada para a lixeira", {
        description: 'Para trazer de volta, abra a aba "Lixeira".',
      });
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
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-gold" />
            Cobrança — {cobranca.cliente_nome}
          </DialogTitle>
          <DialogDescription>
            {cobranca.pet_nome ?? "—"} • Atendimento em {fmtDate(cobranca.data_atendimento)}
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
                <Sparkles className="h-3 w-3 mr-1" /> Negociação
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => gerarIA("agradecimento")}
                disabled={carregandoIa}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Agradecimento
              </Button>
            </div>
            <Textarea
              rows={6}
              placeholder="Redija ou peça uma sugestão à IA…"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => registrarEnviado.mutate()}
                disabled={!mensagem.trim() || registrarEnviado.isPending}
              >
                Apenas registrar
              </Button>
              <Button
                onClick={() => {
                  abrirWhats();
                  registrarEnviado.mutate();
                }}
                disabled={!mensagem.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4 mr-1" /> Enviar no WhatsApp
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="acoes" className="space-y-4">
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-primary" />
                  Registrar resposta recebida do cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={3}
                  placeholder="Cole aqui a mensagem que o cliente enviou pelo WhatsApp…"
                  value={respostaTexto}
                  onChange={(e) => setRespostaTexto(e.target.value)}
                />
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Interpretar como</Label>
                    <Select
                      value={respostaIntencao}
                      onValueChange={(v: any) => setRespostaIntencao(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Detectar automaticamente</SelectItem>
                        <SelectItem value="pagou">Pagou</SelectItem>
                        <SelectItem value="promessa">Prometeu pagar</SelectItem>
                        <SelectItem value="negociar">Quer negociar</SelectItem>
                        <SelectItem value="contestou">Contestou a cobrança</SelectItem>
                        <SelectItem value="sem_intencao">Só respondeu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data da promessa (opcional)</Label>
                    <Input
                      type="date"
                      value={respostaData}
                      onChange={(e) => setRespostaData(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor pago (opcional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={cobranca.saldo.toFixed(2)}
                      value={respostaValor}
                      onChange={(e) => setRespostaValor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={salvandoResp || respostaTexto.trim().length === 0}
                    onClick={async () => {
                      setSalvandoResp(true);
                      try {
                        const r = await registrarResposta({
                          data: {
                            cobrancaId: cobranca.id,
                            texto: respostaTexto.trim(),
                            intencao: respostaIntencao,
                            promessaData: respostaData || null,
                            valorPago: respostaValor
                              ? Number(respostaValor)
                              : null,
                            canal: "whatsapp",
                          },
                        });
                        const label =
                          {
                            pagou: "pagamento",
                            promessa: `promessa${
                              r.promessaData
                                ? " para " +
                                  new Date(r.promessaData + "T00:00:00").toLocaleDateString(
                                    "pt-BR",
                                  )
                                : ""
                            }`,
                            negociar: "negociação",
                            contestou: "contestação (pausada para revisão)",
                            sem_intencao: "resposta",
                          }[r.intencao] ?? "resposta";
                        toast.success(`Resposta registrada: ${label}`);
                        setRespostaTexto("");
                        setRespostaData("");
                        setRespostaValor("");
                        setRespostaIntencao("auto");
                        invalidar();
                        qHist.refetch();
                      } catch (e: any) {
                        toast.error(e?.message ?? "Falha ao registrar");
                      } finally {
                        setSalvandoResp(false);
                      }
                    }}
                  >
                    {salvandoResp ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Inbox className="h-4 w-4 mr-1" />
                    )}
                    Analisar e registrar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O sistema detecta intenção (pagamento, promessa, negociação, contestação),
                  atualiza o status e a promessa de pagamento, e grava tudo no histórico.
                </p>
              </CardContent>
            </Card>

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
                    <CalendarClock className="h-4 w-4 mr-1" /> Registrar promessa
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Marcar pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={async () => {
                      await pagar({
                        data: {
                          cobrancaId: cobranca.id,
                          valor: cobranca.saldo,
                          integral: true,
                        },
                      });
                      toast.success("Pagamento integral registrado");
                      invalidar();
                      qHist.refetch();
                      onClose();
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Recebi integral
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Status</CardTitle>
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

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pausa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cobranca.pausada ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await pausar({
                          data: { cobrancaId: cobranca.id, pausar: false },
                        });
                        invalidar();
                        toast.success("Cobrança retomada");
                      }}
                    >
                      <PlayCircle className="h-4 w-4 mr-1" /> Retomar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await pausar({
                          data: {
                            cobrancaId: cobranca.id,
                            pausar: true,
                            motivo: "Pausada pelo operador",
                          },
                        });
                        invalidar();
                        toast.success("Cobrança pausada");
                      }}
                    >
                      <PauseCircle className="h-4 w-4 mr-1" /> Pausar
                    </Button>
                  )}
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
                    {e.payload?.status && (
                      <div className="mt-1">Novo status: {e.payload.status}</div>
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
            Excluir (vai para a lixeira)
          </Button>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================
// Lixeira — cobranças arquivadas, com restauração em 1 toque
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
      toast.success("Cobrança restaurada");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao restaurar"),
  });

  const itens = (q.data ?? []) as CobrancaArquivadaDTO[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Archive className="h-4 w-4" />
          Lixeira de cobranças
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nada é apagado de verdade. Tudo que você excluir fica aqui, com histórico
          preservado, e volta para a lista com um toque em “Restaurar”.
        </p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : itens.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            A lixeira está vazia.
          </div>
        ) : (
          <ul className="space-y-2">
            {itens.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.cliente_nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {brl(c.saldo)} • venc. {fmtDate(c.vencimento)}
                    {c.pet_nome ? ` • ${c.pet_nome}` : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Excluída em {fmtDate(c.arquivada_em)}
                    {c.arquivada_por_nome ? ` por ${c.arquivada_por_nome}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => restaurarMut.mutate(c.id)}
                  disabled={restaurarMut.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

// ===================================================================
// Configuração
// ===================================================================
function ConfigDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const obter = useServerFn(obterConfigCobranca);
  const salvar = useServerFn(salvarConfigCobranca);
  const salvarTpl = useServerFn(salvarTemplateCobranca);

  const q = useQuery({ queryKey: ["cobrancas", "config"], queryFn: () => obter() });

  const cfg = q.data?.config as any;
  const tpls = q.data?.templates ?? [];

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

  const [tplEdit, setTplEdit] = useState<any | null>(null);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Régua de cobrança e templates</DialogTitle>
          <DialogDescription>
            Configure o modo de disparo, chave Pix e os textos usados em cada gatilho.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Modo</Label>
                <Select value={modo} onValueChange={(v) => setModo(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (com aprovação)</SelectItem>
                    <SelectItem value="auto">Automático</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  No modo manual, o sistema apenas destaca clientes elegíveis. O envio final é sempre pelo operador via WhatsApp.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Não repetir no mesmo dia</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={naoRepetir} onCheckedChange={setNaoRepetir} />
                  <span className="text-sm text-muted-foreground">
                    Evita disparar mais de uma cobrança para o mesmo cliente no mesmo dia.
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={pixTipo} onValueChange={setPixTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celular">Celular</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="cpf">CPF/CNPJ</SelectItem>
                    <SelectItem value="aleatoria">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex justify-end">
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
                    toast.success("Régua atualizada");
                    qc.invalidateQueries({ queryKey: ["cobrancas", "config"] });
                  }}
                >
                  Salvar régua
                </Button>
              </div>
            </section>

            <section>
              <h3 className="font-medium mb-2">Templates por gatilho</h3>
              <div className="grid md:grid-cols-2 gap-2">
                {tpls.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setTplEdit(t)}
                    className={`text-left border rounded-md p-3 hover:bg-muted/50 ${t.ativo ? "" : "opacity-60"}`}
                  >
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.gatilho}
                    </div>
                    <div className="font-medium">{t.titulo}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {t.corpo}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>

        {tplEdit && (
          <TemplateEditor
            template={tplEdit}
            onClose={() => setTplEdit(null)}
            onSaved={() => {
              setTplEdit(null);
              qc.invalidateQueries({ queryKey: ["cobrancas", "config"] });
            }}
            salvarTpl={salvarTpl}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
  salvarTpl,
}: {
  template: any;
  onClose: () => void;
  onSaved: () => void;
  salvarTpl: any;
}) {
  const [titulo, setTitulo] = useState(template.titulo);
  const [corpo, setCorpo] = useState(template.corpo);
  const [ativo, setAtivo] = useState(!!template.ativo);

  const preview = useMemo(
    () =>
      renderTemplate(corpo, {
        cliente: "Maria",
        pet: "Thor",
        valor: "R$ 90,00",
        vencimento: "15/07",
        pix: "(11) 99999-9999",
      }),
    [corpo],
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar template — {template.gatilho}</DialogTitle>
          <DialogDescription>
            Use variáveis: <code>{"{{cliente}}"}</code>, <code>{"{{pet}}"}</code>,{" "}
            <code>{"{{valor}}"}</code>, <code>{"{{vencimento}}"}</code>,{" "}
            <code>{"{{pix}}"}</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea rows={6} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <span className="text-sm">Ativo</span>
          </div>
          <div className="rounded-md border bg-emerald-50 p-3 text-sm whitespace-pre-wrap">
            <div className="text-xs uppercase tracking-wide text-emerald-800 mb-1">
              Prévia
            </div>
            {preview}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              await salvarTpl({
                data: { id: template.id, titulo, corpo, ativo },
              });
              toast.success("Template salvo");
              onSaved();
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================
// Fila do Dia — cobranças priorizadas por score
// ===================================================================
function FilaDoDiaTab({ onSelect }: { onSelect: (c: CobrancaDTO) => void }) {
  const filaFn = useServerFn(filaPriorizada);
  const q = useQuery({
    queryKey: ["cobrancas", "fila-priorizada"],
    queryFn: () => filaFn(),
    refetchInterval: 60_000,
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
      {/* Barra de Resumo e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            Total na Fila: <strong className="text-foreground">{items.length} cobranças</strong>
          </div>
          <span className="text-muted-foreground/40">•</span>
          <div className="text-xs text-muted-foreground">
            Volume a Recuperar:{" "}
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
              headerBg: "bg-rose-500/10 border-rose-200 text-rose-900",
              badge: "bg-rose-100 text-rose-900 border-rose-300",
              dot: "bg-rose-500",
            },
            Alta: {
              headerBg: "bg-amber-500/10 border-amber-200 text-amber-900",
              badge: "bg-amber-100 text-amber-900 border-amber-300",
              dot: "bg-amber-500",
            },
            Média: {
              headerBg: "bg-emerald-500/10 border-emerald-200 text-emerald-900",
              badge: "bg-emerald-100 text-emerald-900 border-emerald-300",
              dot: "bg-emerald-600",
            },
            Baixa: {
              headerBg: "bg-zinc-500/10 border-zinc-200 text-zinc-800",
              badge: "bg-zinc-100 text-zinc-800 border-zinc-300",
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
                  rows.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => onSelect(c as any)}
                      className="p-3 rounded-xl border border-border/80 bg-background hover:border-[#C8A951] hover:shadow-md transition-all cursor-pointer space-y-2 group"
                    >
                      {/* Linha 1: Score + Nome + Valor */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-6 min-w-[24px] px-1.5 rounded-md text-[11px] font-bold flex items-center justify-center border shadow-2xs ${colStyles.badge}`}
                            title={`Score de cobrança: ${c.score}`}
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

                      {/* Linha 2: Pet + Dias de Atraso + Motivo */}
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
                    </div>
                  ))
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
// Funil de recuperação — mês corrente
// ===================================================================
function FunilTab() {
  const funilFn = useServerFn(FUNIL_FN);
  const q = useQuery({ queryKey: ["cobrancas", "funil"], queryFn: () => funilFn() });

  if (q.isLoading || !q.data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const d = q.data;
  const etapas = [
    { label: "Criadas no mês", value: d.criadas, valor: d.valor_criado, taxa: 1 },
    { label: "Enviadas", value: d.enviadas, taxa: d.taxa_envio },
    { label: "Responderam", value: d.responderam, taxa: d.taxa_resposta },
    { label: "Prometeram pagar", value: d.prometeram },
    { label: "Pagaram", value: d.pagaram, valor: d.valor_recuperado, taxa: d.taxa_pagamento },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.value));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Funil de recuperação — mês corrente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {etapas.map((e) => (
            <div key={e.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium">
                  {e.value}
                  {e.valor != null ? ` • ${brl(e.valor)}` : ""}
                  {e.taxa != null && e.label !== "Criadas no mês"
                    ? ` • ${Math.round(e.taxa * 100)}%`
                    : ""}
                </span>
              </div>
              <div className="h-2 mt-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(e.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


