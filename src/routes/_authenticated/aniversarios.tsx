import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Cake,
  Sparkles,
  PartyPopper,
  Save,
  Loader2,
  Plus,
  Send,
  Trash2,
  Pencil,
  CalendarHeart,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  type LembreteConfig,
} from "@/lib/lembretes.functions";
import {
  listarDatasComemorativas,
  salvarDataComemorativa,
  excluirDataComemorativa,
  proximosAniversariantes,
  type DataComemorativa,
} from "@/lib/aniversarios.functions";
import {
  WhatsAppComposer,
  useWhatsAppComposer,
} from "@/components/whatsapp-composer";
import { normalizarTelefoneBR } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/aniversarios")({
  component: AniversariosPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="mb-3 text-sm text-destructive">Erro: {error.message}</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  ),
  notFoundComponent: () => <p className="p-6">Não encontrado.</p>,
});

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function AniversariosPage() {
  const qc = useQueryClient();
  const composer = useWhatsAppComposer();

  const cfgFn = useServerFn(getLembretesConfig);
  const salvarCfgFn = useServerFn(salvarLembretesConfig);
  const listarDatasFn = useServerFn(listarDatasComemorativas);
  const salvarDataFn = useServerFn(salvarDataComemorativa);
  const excluirDataFn = useServerFn(excluirDataComemorativa);
  const proximosFn = useServerFn(proximosAniversariantes);

  const cfg = useQuery({ queryKey: ["lembretes-config"], queryFn: () => cfgFn() });
  const datas = useQuery({
    queryKey: ["datas-comemorativas"],
    queryFn: () => listarDatasFn(),
  });
  const proximos = useQuery({
    queryKey: ["proximos-aniversariantes"],
    queryFn: () => proximosFn({ data: { dias: 30 } }),
    staleTime: 60_000,
  });

  const [form, setForm] = useState<LembreteConfig | null>(null);
  if (cfg.data && !form) setForm(cfg.data);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgData, setDlgData] = useState<Partial<DataComemorativa>>({});

  const salvarCfg = useMutation({
    mutationFn: async (v: LembreteConfig) => salvarCfgFn({ data: v }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["lembretes-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarData = useMutation({
    mutationFn: async () =>
      salvarDataFn({
        data: {
          id: dlgData.id,
          nome: (dlgData.nome ?? "").trim(),
          dia: Number(dlgData.dia ?? 1),
          mes: Number(dlgData.mes ?? 1),
          template: (dlgData.template ?? "").trim(),
          ativo: dlgData.ativo ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Data salva");
      setDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["datas-comemorativas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => excluirDataFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Data removida");
      qc.invalidateQueries({ queryKey: ["datas-comemorativas"] });
    },
  });

  function abrirNovo() {
    setDlgData({
      nome: "",
      dia: 1,
      mes: 1,
      template: "Olá, {{tutor}}! Uma mensagem especial da equipe. 🐾",
      ativo: true,
    });
    setDlgOpen(true);
  }
  function abrirEditar(d: DataComemorativa) {
    setDlgData(d);
    setDlgOpen(true);
  }

  function enviarAgora(item: {
    kind: "pet" | "tutor";
    id: string;
    nome: string;
    quem: string;
    telefone: string | null;
    cliente_id: string;
  }) {
    if (!item.telefone) {
      toast.error(`${item.quem} sem telefone`);
      return;
    }
    const norm = normalizarTelefoneBR(item.telefone);
    if (!norm.ok) {
      toast.error("Telefone inválido");
      return;
    }
    const mensagem =
      item.kind === "pet"
        ? renderTemplate("aniversario_pet", { tutor: item.quem, pet: item.nome })
        : renderTemplate("parabens_cliente", { tutor: item.quem, pet: item.nome });
    composer.open({
      tipo: item.kind === "pet" ? "aniversario_pet" : "parabens_cliente",
      destinatario: item.quem,
      telefone: norm.formatado,
      mensagem,
      motivo:
        item.kind === "pet" ? "Aniversário do pet" : "Aniversário do tutor",
      cliente_id: item.cliente_id,
    });
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">
          Aniversários e datas especiais
        </h1>
        <p className="text-sm text-muted-foreground">
          Parabenize tutores e pets automaticamente e configure mensagens para datas
          comemorativas.
        </p>
      </div>

      <Tabs defaultValue="proximos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="proximos">Próximos 30 dias</TabsTrigger>
          <TabsTrigger value="datas">Datas comemorativas</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        {/* Próximos */}
        <TabsContent value="proximos" className="space-y-3">
          {proximos.isLoading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (proximos.data ?? []).length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
                <CalendarHeart className="h-8 w-8 opacity-50" />
                <p>Sem aniversariantes nos próximos 30 dias.</p>
              </CardContent>
            </Card>
          ) : (
            (proximos.data ?? []).map((it) => {
              const dt = new Date(it.data);
              const dias = Math.round(
                (dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const label =
                dias <= 0
                  ? "Hoje"
                  : dias === 1
                  ? "Amanhã"
                  : `em ${dias} dias`;
              return (
                <Card key={`${it.kind}-${it.id}`} className="card-premium">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-lg border",
                          it.kind === "pet"
                            ? "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/30"
                            : "bg-pink-500/15 text-pink-700 border-pink-500/30"
                        )}
                      >
                        <Cake className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{it.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {it.kind === "pet" ? "Pet" : "Tutor"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {it.etiqueta} · {label}
                          </Badge>
                        </div>
                        {it.kind === "pet" && (
                          <div className="text-xs text-muted-foreground">
                            Tutor: {it.quem}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {it.telefone ?? "sem telefone"}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => enviarAgora(it)}
                      className="gap-1"
                      disabled={!it.telefone}
                    >
                      <Send className="h-4 w-4" /> Parabenizar
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Datas comemorativas */}
        <TabsContent value="datas" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              As datas ativas são enviadas para todos os clientes com pet ativo e
              WhatsApp cadastrado, no horário definido em "Configuração".
            </p>
            <Button onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" /> Nova data
            </Button>
          </div>
          {datas.isLoading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            (datas.data ?? []).map((d) => (
              <Card key={d.id} className="card-premium">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg border bg-rose-500/15 text-rose-700 border-rose-500/30">
                      <PartyPopper className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{d.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {String(d.dia).padStart(2, "0")} de {MESES_LABEL[d.mes - 1]}
                        </Badge>
                        {!d.ativo && (
                          <Badge variant="secondary" className="text-xs">
                            desativada
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {d.template}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(d)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Remover "${d.nome}"?`)) excluir.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" className="space-y-4">
          {!form ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <ConfigCard
                icon={Cake}
                titulo="Aniversário do tutor"
                descricao="Envia parabéns para o tutor no dia do aniversário."
                ativo={form.aniversario_tutor_ativo}
                onAtivo={(v) => setForm({ ...form, aniversario_tutor_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      rows={5}
                      value={form.aniversario_tutor_template}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_tutor_template: e.target.value })
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
                titulo="Petversário"
                descricao="Aniversário do cadastro do pet (a partir do 1º ano)."
                ativo={form.petversario_ativo}
                onAtivo={(v) => setForm({ ...form, petversario_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      rows={5}
                      value={form.petversario_template}
                      onChange={(e) =>
                        setForm({ ...form, petversario_template: e.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Variáveis: {"{{tutor}}"}, {"{{pet}}"}
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Sparkles}
                titulo="Datas especiais"
                descricao="Habilita disparo automático das datas ativas."
                ativo={form.datas_especiais_ativo}
                onAtivo={(v) => setForm({ ...form, datas_especiais_ativo: v })}
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
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Mesmo horário usado para aniversários. Ajuste os textos na aba
                      "Datas comemorativas".
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <div className="lg:col-span-3 flex justify-end">
                <Button
                  onClick={() => form && salvarCfg.mutate(form)}
                  disabled={salvarCfg.isPending}
                  className="gap-2"
                >
                  {salvarCfg.isPending ? (
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

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dlgData.id ? "Editar data comemorativa" : "Nova data comemorativa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={dlgData.nome ?? ""}
                onChange={(e) =>
                  setDlgData({ ...dlgData, nome: e.target.value })
                }
                placeholder="Ex.: Dia do Cachorro"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dlgData.dia ?? 1}
                  onChange={(e) =>
                    setDlgData({ ...dlgData, dia: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Mês</Label>
                <Select
                  value={String(dlgData.mes ?? 1)}
                  onValueChange={(v) =>
                    setDlgData({ ...dlgData, mes: Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_LABEL.map((n, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                rows={5}
                value={dlgData.template ?? ""}
                onChange={(e) =>
                  setDlgData({ ...dlgData, template: e.target.value })
                }
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Variáveis: {"{{tutor}}"}, {"{{pet}}"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={dlgData.ativo ?? true}
                onCheckedChange={(v) => setDlgData({ ...dlgData, ativo: v })}
              />
              <Label className="text-xs">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvarData.mutate()}
              disabled={salvarData.isPending}
              className="gap-2"
            >
              {salvarData.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
