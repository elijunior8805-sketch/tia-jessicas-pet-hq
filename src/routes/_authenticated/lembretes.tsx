import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  CalendarDays,
  Cake,
  Sparkles,
  Send,
  X,
  RefreshCcw,
  Play,
  Loader2,
  Save,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLembretesConfig,
  salvarLembretesConfig,
  listarLembretes,
  getLembretesKPIs,
  marcarLembreteEnviado,
  cancelarLembrete,
  reenfileirarLembrete,
  gerarLembretesAgora,
  type LembreteRow,
  type LembreteConfig,
  type LembreteTipo,
} from "@/lib/lembretes.functions";
import {
  WhatsAppComposer,
  useWhatsAppComposer,
} from "@/components/whatsapp-composer";
import { normalizarTelefoneBR } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lembretes")({
  component: LembretesPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="mb-3 text-sm text-destructive">Erro: {error.message}</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  ),
  notFoundComponent: () => <p className="p-6">Não encontrado.</p>,
});

const TIPO_INFO: Record<
  LembreteTipo,
  { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }
> = {
  lembrete_24h: {
    label: "Lembrete 24h",
    icon: CalendarDays,
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  pos_atendimento: {
    label: "Pós-atendimento",
    icon: Sparkles,
    badge: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  },
  aniversario_pet: {
    label: "Aniversário do pet",
    icon: Cake,
    badge: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  aniversario_tutor: {
    label: "Aniversário do tutor",
    icon: Cake,
    badge: "bg-pink-500/15 text-pink-700 border-pink-500/30",
  },
  petversario: {
    label: "Petversário",
    icon: Cake,
    badge: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/30",
  },
  data_especial: {
    label: "Data especial",
    icon: Sparkles,
    badge: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  },
};

const STATUS_INFO: Record<string, { label: string; classe: string }> = {
  pendente: { label: "Pendente", classe: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  enviado: { label: "Enviado", classe: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  falhou: { label: "Falhou", classe: "bg-red-500/15 text-red-700 border-red-500/30" },
  cancelado: { label: "Cancelado", classe: "bg-muted text-muted-foreground border-border" },
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <Card className="card-premium">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg", tint)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LembretesPage() {
  const qc = useQueryClient();
  const composer = useWhatsAppComposer();

  const [status, setStatus] = useState<
    "pendente" | "enviado" | "falhou" | "cancelado" | "todos"
  >("pendente");
  const [tipo, setTipo] = useState<LembreteTipo | "todos">("todos");
  const [busca, setBusca] = useState("");

  const cfgFn = useServerFn(getLembretesConfig);
  const salvarCfgFn = useServerFn(salvarLembretesConfig);
  const listarFn = useServerFn(listarLembretes);
  const kpisFn = useServerFn(getLembretesKPIs);
  const marcarFn = useServerFn(marcarLembreteEnviado);
  const cancelarFn = useServerFn(cancelarLembrete);
  const reenfileirarFn = useServerFn(reenfileirarLembrete);
  const gerarFn = useServerFn(gerarLembretesAgora);

  const cfg = useQuery({ queryKey: ["lembretes-config"], queryFn: () => cfgFn() });
  const kpis = useQuery({
    queryKey: ["lembretes-kpis"],
    queryFn: () => kpisFn(),
    staleTime: 30_000,
  });
  const lista = useQuery({
    queryKey: ["lembretes-fila", status, tipo, busca],
    queryFn: () => listarFn({ data: { status, tipo, busca } }),
    staleTime: 15_000,
  });

  const [form, setForm] = useState<LembreteConfig | null>(null);
  // Hidrata form quando cfg carrega
  if (cfg.data && !form) setForm(cfg.data);

  const salvar = useMutation({
    mutationFn: async (v: LembreteConfig) => salvarCfgFn({ data: v }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["lembretes-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gerar = useMutation({
    mutationFn: async () => gerarFn(),
    onSuccess: (r) => {
      const total =
        Number(r?.lembrete_24h ?? 0) +
        Number(r?.pos_atendimento ?? 0) +
        Number(r?.aniversario_pet ?? 0) +
        Number(r?.aniversario_tutor ?? 0) +
        Number(r?.petversario ?? 0) +
        Number(r?.data_especial ?? 0);
      toast.success(
        total > 0
          ? `${total} lembrete(s) adicionados à fila`
          : "Nenhum lembrete novo — tudo em dia"
      );
      qc.invalidateQueries({ queryKey: ["lembretes-fila"] });
      qc.invalidateQueries({ queryKey: ["lembretes-kpis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarEnviado = useMutation({
    mutationFn: async (id: string) => marcarFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lembretes-fila"] });
      qc.invalidateQueries({ queryKey: ["lembretes-kpis"] });
    },
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => cancelarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lembrete cancelado");
      qc.invalidateQueries({ queryKey: ["lembretes-fila"] });
      qc.invalidateQueries({ queryKey: ["lembretes-kpis"] });
    },
  });

  const reenfileirar = useMutation({
    mutationFn: async (id: string) => reenfileirarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lembrete reenfileirado");
      qc.invalidateQueries({ queryKey: ["lembretes-fila"] });
    },
  });

  const abrirComposer = (row: LembreteRow) => {
    const tel = row.telefone ?? "";
    const norm = normalizarTelefoneBR(tel);
    if (!norm.ok) {
      toast.error(`${row.cliente_nome ?? "Cliente"} sem telefone válido`);
      return;
    }
    const tipoWa =
      row.tipo === "aniversario_pet"
        ? "aniversario_pet"
        : row.tipo === "aniversario_tutor"
        ? "parabens_cliente"
        : row.tipo === "petversario"
        ? "aniversario_pet"
        : row.tipo === "data_especial"
        ? "personalizada"
        : row.tipo === "pos_atendimento"
        ? "solicitacao_avaliacao"
        : "lembrete_atendimento";
    composer.open({
      tipo: tipoWa,
      destinatario: row.cliente_nome ?? "Cliente",
      telefone: norm.formatado,
      mensagem: row.mensagem,
      motivo: TIPO_INFO[row.tipo].label,
      cliente_id: row.cliente_id,
    });
  };

  const rows = lista.data ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">
            Automação de Lembretes
          </h1>
          <p className="text-sm text-muted-foreground">
            Lembretes 24h, pós-atendimento e aniversários do pet — gerados automaticamente todos os dias.
          </p>
        </div>
        <Button
          onClick={() => gerar.mutate()}
          disabled={gerar.isPending}
          className="gap-2"
        >
          {gerar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Gerar lembretes de hoje
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Pendentes"
          value={kpis.data?.pendentes ?? 0}
          icon={BellRing}
          tint="bg-amber-500/15 text-amber-700"
        />
        <KpiCard
          label="Próximas 24h"
          value={kpis.data?.proximas24h ?? 0}
          icon={CalendarDays}
          tint="bg-emerald-500/15 text-emerald-700"
        />
        <KpiCard
          label="Enviados"
          value={kpis.data?.enviados ?? 0}
          icon={Send}
          tint="bg-blue-500/15 text-blue-700"
        />
        <KpiCard
          label="Falhas"
          value={kpis.data?.falhas ?? 0}
          icon={X}
          tint="bg-red-500/15 text-red-700"
        />
      </div>

      <Tabs defaultValue="fila" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fila">Fila</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-4">
          <Card className="card-premium">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cliente ou pet"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={tipo} onValueChange={(v: string) => setTipo(v as LembreteTipo | "todos")}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="lembrete_24h">Lembrete 24h</SelectItem>
                  <SelectItem value="pos_atendimento">Pós-atendimento</SelectItem>
                  <SelectItem value="aniversario_pet">Aniversário do pet</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v: string) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="enviado">Enviados</SelectItem>
                  <SelectItem value="falhou">Falhas</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => lista.refetch()}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {lista.isLoading ? (
              <div className="grid place-items-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <Card className="card-premium">
                <CardContent className="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 opacity-50" />
                  <p>Nenhum lembrete nesta seleção.</p>
                  <p className="text-xs">
                    Use "Gerar lembretes de hoje" para forçar o processamento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              rows.map((r) => {
                const info = TIPO_INFO[r.tipo];
                const Icon = info.icon;
                const st = STATUS_INFO[r.status];
                return (
                  <Card key={r.id} className="card-premium">
                    <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-lg border",
                            info.badge
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {r.cliente_nome ?? "—"}
                            </span>
                            {r.pet_nome && (
                              <span className="text-sm text-muted-foreground">
                                • {r.pet_nome}
                              </span>
                            )}
                            <Badge variant="outline" className={info.badge}>
                              {info.label}
                            </Badge>
                            <Badge variant="outline" className={st.classe}>
                              {st.label}
                            </Badge>
                            {r.tentativas > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {r.tentativas} tentativa(s)
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                            {r.mensagem}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Envio agendado: {new Date(r.proximo_envio).toLocaleString("pt-BR")}
                            {r.telefone ? ` • ${r.telefone}` : " • sem telefone"}
                          </p>
                          {r.erro && (
                            <p className="text-xs text-red-600">Erro: {r.erro}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {r.status === "pendente" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                abrirComposer(r);
                                marcarEnviado.mutate(r.id);
                              }}
                              className="gap-1"
                            >
                              <Send className="h-4 w-4" /> Enviar agora
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelar.mutate(r.id)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                        {(r.status === "falhou" || r.status === "cancelado") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reenfileirar.mutate(r.id)}
                            className="gap-1"
                          >
                            <RefreshCcw className="h-4 w-4" /> Reenfileirar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          {!form ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <ConfigCard
                icon={CalendarDays}
                titulo="Lembrete 24h antes"
                descricao="Enviado 1 dia antes do horário agendado."
                ativo={form.lembrete_24h_ativo}
                onAtivo={(v) => setForm({ ...form, lembrete_24h_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Horário do envio</Label>
                    <Input
                      type="time"
                      value={form.lembrete_24h_hora.slice(0, 5)}
                      onChange={(e) =>
                        setForm({ ...form, lembrete_24h_hora: e.target.value + ":00" })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      rows={5}
                      value={form.lembrete_24h_template}
                      onChange={(e) =>
                        setForm({ ...form, lembrete_24h_template: e.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Variáveis: {"{{tutor}}"}, {"{{pet}}"}, {"{{data}}"}, {"{{hora}}"}
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Sparkles}
                titulo="Pós-atendimento"
                descricao="Solicita feedback horas depois do atendimento."
                ativo={form.pos_atendimento_ativo}
                onAtivo={(v) => setForm({ ...form, pos_atendimento_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Horas após encerrar</Label>
                    <Input
                      type="number"
                      min={1}
                      max={240}
                      value={form.pos_atendimento_horas}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pos_atendimento_horas: Number(e.target.value || 24),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      rows={5}
                      value={form.pos_atendimento_template}
                      onChange={(e) =>
                        setForm({ ...form, pos_atendimento_template: e.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Variáveis: {"{{tutor}}"}, {"{{pet}}"}
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Cake}
                titulo="Aniversário do pet"
                descricao="Parabeniza no dia do aniversário do pet."
                ativo={form.aniversario_pet_ativo}
                onAtivo={(v) => setForm({ ...form, aniversario_pet_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Horário do envio</Label>
                    <Input
                      type="time"
                      value={form.aniversario_hora.slice(0, 5)}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_hora: e.target.value + ":00" })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      rows={5}
                      value={form.aniversario_template}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_template: e.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Variáveis: {"{{tutor}}"}, {"{{pet}}"}
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <div className="lg:col-span-3 flex justify-end">
                <Button
                  onClick={() => form && salvar.mutate(form)}
                  disabled={salvar.isPending}
                  className="gap-2"
                >
                  {salvar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar configurações
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <WhatsAppComposer
        open={composer.state.open}
        onOpenChange={(v) => (v ? null : composer.close())}
        payload={composer.state.payload}
      />
    </div>
  );
}

function ConfigCard({
  icon: Icon,
  titulo,
  descricao,
  ativo,
  onAtivo,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao: string;
  ativo: boolean;
  onAtivo: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="card-premium">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{titulo}</CardTitle>
              <p className="text-xs text-muted-foreground">{descricao}</p>
            </div>
          </div>
          <Switch checked={ativo} onCheckedChange={onAtivo} />
        </div>
      </CardHeader>
      <CardContent className={cn(!ativo && "opacity-50 pointer-events-none")}>
        {children}
      </CardContent>
    </Card>
  );
}
