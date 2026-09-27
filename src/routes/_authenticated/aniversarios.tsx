import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
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
  Gift,
  Camera,
  Tag,
  Search,
  Calendar,
  HeartHandshake,
  CheckCircle2,
  Wand2,
  Smile,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  listarPetsSemAniversario,
  salvarNascimentoPet,
  gerarMensagemAniversarioIA,
  carregarDatasComemorativasPadrao,
  type DataComemorativa,
  type AniversarianteItem,
  type PetSemAniversarioDTO,
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

const PERIODOS = [
  { label: "Hoje", dias: 0 },
  { label: "Próximos 7 dias", dias: 7 },
  { label: "15 dias", dias: 15 },
  { label: "30 dias", dias: 30 },
  { label: "60 dias", dias: 60 },
  { label: "90 dias", dias: 90 },
];

type TipoMimo = "mimo_hidratacao" | "ensaio_fotos" | "combo_festa" | "parabens_carinhoso";

export default function AniversariosPage() {
  const qc = useQueryClient();
  const composer = useWhatsAppComposer();

  const [diasFiltro, setDiasFiltro] = useState<number>(60);
  const [buscaSemData, setBuscaSemData] = useState("");
  const [datasInput, setDatasInput] = useState<Record<string, string>>({});
  const [mimoSelecionado, setMimoSelecionado] = useState<Record<string, TipoMimo>>({});
  const [gerandoIA, setGerandoIA] = useState<Record<string, boolean>>({});

  const cfgFn = useServerFn(getLembretesConfig);
  const salvarCfgFn = useServerFn(salvarLembretesConfig);
  const listarDatasFn = useServerFn(listarDatasComemorativas);
  const salvarDataFn = useServerFn(salvarDataComemorativa);
  const excluirDataFn = useServerFn(excluirDataComemorativa);
  const proximosFn = useServerFn(proximosAniversariantes);
  const listarSemDataFn = useServerFn(listarPetsSemAniversario);
  const salvarNascFn = useServerFn(salvarNascimentoPet);
  const gerarMsgFn = useServerFn(gerarMensagemAniversarioIA);
  const carregarPadraoFn = useServerFn(carregarDatasComemorativasPadrao);

  const cfg = useQuery({ queryKey: ["lembretes-config"], queryFn: () => cfgFn() });
  const datas = useQuery({
    queryKey: ["datas-comemorativas"],
    queryFn: () => listarDatasFn(),
  });
  const proximos = useQuery({
    queryKey: ["proximos-aniversariantes", diasFiltro],
    queryFn: () => proximosFn({ data: { dias: diasFiltro } }),
    staleTime: 60_000,
  });
  const petsSemData = useQuery({
    queryKey: ["pets-sem-aniversario"],
    queryFn: () => listarSemDataFn(),
    staleTime: 60_000,
  });

  const [form, setForm] = useState<LembreteConfig | null>(null);
  if (cfg.data && !form) setForm(cfg.data);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgData, setDlgData] = useState<Partial<DataComemorativa>>({});

  const salvarCfg = useMutation({
    mutationFn: async (v: LembreteConfig) => salvarCfgFn({ data: v }),
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
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
      toast.success("Data comemorativa salva com sucesso!");
      setDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["datas-comemorativas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => excluirDataFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Data comemorativa removida!");
      qc.invalidateQueries({ queryKey: ["datas-comemorativas"] });
    },
  });

  const carregarPadraoMut = useMutation({
    mutationFn: async () => carregarPadraoFn(),
    onSuccess: (res) => {
      toast.success(`${res.inseridos} datas comemorativas oficiais do mercado Pet carregadas!`);
      qc.invalidateQueries({ queryKey: ["datas-comemorativas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarNascMut = useMutation({
    mutationFn: async ({ pet_id, nascimento }: { pet_id: string; nascimento: string }) =>
      salvarNascFn({ data: { pet_id, nascimento } }),
    onSuccess: () => {
      toast.success("Data de nascimento salva! O pet agora aparece nos aniversários.");
      qc.invalidateQueries({ queryKey: ["pets-sem-aniversario"] });
      qc.invalidateQueries({ queryKey: ["proximos-aniversariantes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirNovo() {
    setDlgData({
      nome: "",
      dia: 1,
      mes: 1,
      template: "Olá, {{tutor}}! Uma mensagem especial da equipe do Spa de Pet Tia Jéssica. 🐾✨",
      ativo: true,
    });
    setDlgOpen(true);
  }

  function abrirEditar(d: DataComemorativa) {
    setDlgData(d);
    setDlgOpen(true);
  }

  async function handleParabenizarComIA(item: AniversarianteItem) {
    if (!item.telefone) {
      toast.error(`${item.quem} está sem WhatsApp cadastrado.`);
      return;
    }
    const norm = normalizarTelefoneBR(item.telefone);
    if (!norm.ok) {
      toast.error("Telefone inválido.");
      return;
    }

    const tipoMimo = mimoSelecionado[item.id] || "mimo_hidratacao";
    setGerandoIA((prev) => ({ ...prev, [item.id]: true }));

    try {
      let mensagemTexto = "";
      if (item.kind === "pet") {
        const res = await gerarMsgFn({
          data: {
            tipoMimo,
            tutorNome: item.quem,
            petNome: item.nome,
            idadeAnos: item.idadeAnos,
          },
        });
        mensagemTexto = res.mensagem;
      } else {
        mensagemTexto = renderTemplate("parabens_cliente", { tutor: item.quem, pet: item.nome });
      }

      composer.open({
        tipo: item.kind === "pet" ? "aniversario_pet" : "parabens_cliente",
        destinatario: item.quem,
        telefone: norm.formatado,
        mensagem: mensagemTexto,
        motivo: item.kind === "pet" ? `Aniversário do pet ${item.nome}` : `Aniversário do tutor ${item.quem}`,
        cliente_id: item.cliente_id,
      });
    } catch (err: any) {
      toast.error("Erro ao gerar mensagem: " + err.message);
    } finally {
      setGerandoIA((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  function handlePedirDataWhatsApp(pet: PetSemAniversarioDTO) {
    if (!pet.telefone) {
      toast.error(`Tutor(a) ${pet.cliente_nome} sem WhatsApp.`);
      return;
    }
    const norm = normalizarTelefoneBR(pet.telefone);
    if (!norm.ok) {
      toast.error("Telefone inválido.");
      return;
    }
    const primeiroNome = pet.cliente_nome.split(" ")[0] || "Tutor";
    const msg = `Oi, ${primeiroNome}! Tudo bem? 🐾\n\nAqui é da equipe do Spa de Pet Tia Jéssica! Estamos atualizando o nosso calendário de mimos e comemorações exclusivas. ✨\n\nEm qual dia e mês o(a) ${pet.pet_nome} faz aniversário? Queremos deixar anotado para preparar um presente super especial no dia dele(a)! 🎂🎈`;

    composer.open({
      tipo: "aniversario_pet",
      destinatario: pet.cliente_nome,
      telefone: norm.formatado,
      mensagem: msg,
      motivo: `Descobrir aniversário do pet ${pet.pet_nome}`,
      cliente_id: pet.cliente_id,
    });
  }

  const petsSemDataFiltrados = useMemo(() => {
    if (!petsSemData.data) return [];
    if (!buscaSemData.trim()) return petsSemData.data;
    const q = buscaSemData.toLowerCase();
    return petsSemData.data.filter(
      (p) =>
        p.pet_nome.toLowerCase().includes(q) ||
        p.cliente_nome.toLowerCase().includes(q) ||
        (p.pet_raca && p.pet_raca.toLowerCase().includes(q))
    );
  }, [petsSemData.data, buscaSemData]);

  const stats = useMemo(() => {
    const list = proximos.data ?? [];
    const petsCount = list.filter((i) => i.kind === "pet").length;
    const tutoresCount = list.filter((i) => i.kind === "tutor").length;
    return { total: list.length, pets: petsCount, tutores: tutoresCount };
  }, [proximos.data]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold md:text-3xl tracking-tight flex items-center gap-2">
              <PartyPopper className="h-7 w-7 text-pink-500 animate-pulse" />
              Aniversários & Encantamento
            </h1>
            <Badge variant="secondary" className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-pink-600 border-pink-200">
              <Sparkles className="h-3 w-3 mr-1 text-pink-500" /> Inteligência com Mimos
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fidelize clientes, comemore aniversários de pets e tutores com mimos inteligentes e aumente o faturamento com datas comemorativas.
          </p>
        </div>
      </div>

      <Tabs defaultValue="proximos" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto h-auto p-1 bg-muted/60">
          <TabsTrigger value="proximos" className="py-2.5 gap-2">
            <Cake className="h-4 w-4 text-pink-500" />
            <span>Próximos Aniversários</span>
            {stats.total > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-pink-500/15 text-pink-700">
                {stats.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="descobrir" className="py-2.5 gap-2">
            <Search className="h-4 w-4 text-amber-500" />
            <span>Descobrir Datas</span>
            {petsSemData.data && petsSemData.data.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-amber-500/15 text-amber-700">
                {petsSemData.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="datas" className="py-2.5 gap-2">
            <PartyPopper className="h-4 w-4 text-rose-500" />
            <span>Datas Comemorativas</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="py-2.5 gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>Automação & IA</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Próximos Aniversários */}
        <TabsContent value="proximos" className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filtrar período:</span>
              {PERIODOS.map((p) => (
                <Button
                  key={p.dias}
                  size="sm"
                  variant={diasFiltro === p.dias ? "default" : "outline"}
                  onClick={() => setDiasFiltro(p.dias)}
                  className={cn(
                    "text-xs h-8 px-3 rounded-full transition-all",
                    diasFiltro === p.dias
                      ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm"
                      : "hover:bg-muted"
                  )}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{stats.pets} {stats.pets === 1 ? "pet" : "pets"}</span>
              <span>•</span>
              <span>{stats.tutores} {stats.tutores === 1 ? "tutor" : "tutores"}</span>
            </div>
          </div>

          {proximos.isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-pink-500 mb-2" />
              <p className="text-sm">Buscando aniversariantes cadastrados...</p>
            </div>
          ) : (proximos.data ?? []).length === 0 ? (
            <Card className="border-dashed border-2 bg-gradient-to-b from-muted/30 to-card">
              <CardContent className="grid place-items-center gap-3 py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                  <CalendarHeart className="h-8 w-8" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-semibold text-base">Nenhum aniversário nos próximos {diasFiltro} dias</h3>
                  <p className="text-sm text-muted-foreground">
                    Ainda não há datas registradas nesse intervalo. Use a aba <strong>"Descobrir Datas"</strong> para perguntar aos tutores no WhatsApp com 1 clique e enriquecer os cadastros!
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 mt-2 border-pink-200 text-pink-600 hover:bg-pink-50"
                  onClick={() => {
                    const el = document.querySelector('[value="descobrir"]') as HTMLElement;
                    if (el) el.click();
                  }}
                >
                  <Search className="h-4 w-4" /> Ir para Descobrir Datas dos Pets
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(proximos.data ?? []).map((it) => {
                const isHoje = it.diasParaAniversario <= 0;
                const isAmanha = it.diasParaAniversario === 1;
                const mimo = mimoSelecionado[it.id] || "mimo_hidratacao";
                const isGerando = gerandoIA[it.id] || false;

                return (
                  <Card
                    key={`${it.kind}-${it.id}`}
                    className={cn(
                      "transition-all duration-200 hover:shadow-md border",
                      isHoje
                        ? "border-pink-400/60 bg-gradient-to-br from-pink-50/70 via-white to-rose-50/50 shadow-sm ring-1 ring-pink-300"
                        : "border-border/70 hover:border-pink-200"
                    )}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {it.foto_url ? (
                            <img
                              src={it.foto_url}
                              alt={it.nome}
                              className="h-12 w-12 rounded-full object-cover border-2 border-pink-200 shadow-sm"
                            />
                          ) : (
                            <div
                              className={cn(
                                "grid h-12 w-12 place-items-center rounded-full border shadow-sm",
                                it.kind === "pet"
                                  ? "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-200"
                                  : "bg-pink-500/15 text-pink-700 border-pink-200"
                              )}
                            >
                              <Cake className="h-6 w-6" />
                            </div>
                          )}

                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-base text-foreground">{it.nome}</span>
                              <Badge
                                variant={it.kind === "pet" ? "default" : "secondary"}
                                className={cn(
                                  "text-[10px] h-5 px-1.5 font-medium",
                                  it.kind === "pet" ? "bg-fuchsia-600" : "bg-purple-100 text-purple-700"
                                )}
                              >
                                {it.kind === "pet" ? "🐾 Pet" : "👤 Tutor"}
                              </Badge>
                              {it.idadeAnos !== null && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-pink-200 text-pink-700 font-semibold bg-pink-50/50">
                                  {it.idadeAnos === 1 ? "1 aninho" : `${it.idadeAnos} anos`}
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-0.5">
                              {it.kind === "pet" ? (
                                <>Tutor: <span className="font-medium text-foreground">{it.quem}</span>{it.raca ? ` • ${it.raca}` : ""}</>
                              ) : (
                                "Cliente VIP do Spa"
                              )}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs px-2 py-1 font-semibold whitespace-nowrap",
                            isHoje
                              ? "bg-pink-500 text-white animate-pulse"
                              : isAmanha
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {isHoje ? "🎂 É HOJE!" : isAmanha ? "Amanhã" : `em ${it.diasParaAniversario} dias (${it.etiqueta})`}
                        </Badge>
                      </div>

                      {/* Gift / AI Action Section for Pets */}
                      {it.kind === "pet" && (
                        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                              <Gift className="h-3.5 w-3.5 text-pink-500" />
                              Mimo / Oferta de Encantamento:
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMimoSelecionado((prev) => ({ ...prev, [it.id]: "mimo_hidratacao" }))}
                              className={cn(
                                "flex items-center gap-1.5 p-1.5 rounded text-[11px] font-medium border text-left transition-all",
                                mimo === "mimo_hidratacao"
                                  ? "bg-pink-100/70 border-pink-300 text-pink-800 shadow-xs"
                                  : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Sparkles className="h-3 w-3 text-pink-500 shrink-0" />
                              <span className="truncate">Hidratação Cortesia</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMimoSelecionado((prev) => ({ ...prev, [it.id]: "ensaio_fotos" }))}
                              className={cn(
                                "flex items-center gap-1.5 p-1.5 rounded text-[11px] font-medium border text-left transition-all",
                                mimo === "ensaio_fotos"
                                  ? "bg-purple-100/70 border-purple-300 text-purple-800 shadow-xs"
                                  : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Camera className="h-3 w-3 text-purple-500 shrink-0" />
                              <span className="truncate">Mini Ensaio Temático</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMimoSelecionado((prev) => ({ ...prev, [it.id]: "combo_festa" }))}
                              className={cn(
                                "flex items-center gap-1.5 p-1.5 rounded text-[11px] font-medium border text-left transition-all",
                                mimo === "combo_festa"
                                  ? "bg-amber-100/70 border-amber-300 text-amber-800 shadow-xs"
                                  : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Tag className="h-3 w-3 text-amber-500 shrink-0" />
                              <span className="truncate">20% Off Combo Festa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setMimoSelecionado((prev) => ({ ...prev, [it.id]: "parabens_carinhoso" }))}
                              className={cn(
                                "flex items-center gap-1.5 p-1.5 rounded text-[11px] font-medium border text-left transition-all",
                                mimo === "parabens_carinhoso"
                                  ? "bg-blue-100/70 border-blue-300 text-blue-800 shadow-xs"
                                  : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Smile className="h-3 w-3 text-blue-500 shrink-0" />
                              <span className="truncate">Parabéns Afetuoso</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Footer */}
                      <div className="flex items-center justify-between pt-1 gap-2 border-t border-border/40">
                        <div className="text-[11px] text-muted-foreground">
                          {it.telefone ? (
                            <span className="text-emerald-700 font-mono">WhatsApp: {it.telefone}</span>
                          ) : (
                            <span className="text-destructive">Sem WhatsApp cadastrado</span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleParabenizarComIA(it)}
                          disabled={!it.telefone || isGerando}
                          className="gap-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-sm"
                        >
                          {isGerando ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                          Gerar & Parabenizar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Descobrir Datas (Pets sem nascimento) */}
        <TabsContent value="descobrir" className="space-y-4">
          <Card className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/80">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                    Campanha de Descoberta de Aniversários
                  </h3>
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 max-w-2xl">
                  Pergunte o aniversário do pet para o tutor no WhatsApp com 1 clique. Assim que ele responder, digite a data abaixo e salve. O pet entrará automaticamente no calendário inteligente de mimos!
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pet ou tutor..."
                    value={buscaSemData}
                    onChange={(e) => setBuscaSemData(e.target.value)}
                    className="pl-8 text-xs bg-card"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {petsSemData.isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-2" />
              <p className="text-sm">Carregando pets sem data cadastrada...</p>
            </div>
          ) : petsSemDataFiltrados.length === 0 ? (
            <Card className="border-dashed py-12 text-center text-muted-foreground">
              <CardContent className="space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <h4 className="font-medium text-foreground">Todos os pets estão com aniversário cadastrado!</h4>
                <p className="text-xs">Excelente trabalho! Nenhum pet ativo sem data foi encontrado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {petsSemDataFiltrados.map((pet) => {
                const dataVal = datasInput[pet.pet_id] || "";
                return (
                  <Card key={pet.pet_id} className="border hover:border-amber-300 transition-all bg-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {pet.pet_foto_url ? (
                            <img
                              src={pet.pet_foto_url}
                              alt={pet.pet_nome}
                              className="h-10 w-10 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                              {pet.pet_nome.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4 className="font-semibold text-sm leading-none">{pet.pet_nome}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              Tutor: <span className="font-medium text-foreground">{pet.cliente_nome}</span>
                            </p>
                            {pet.pet_raca && (
                              <Badge variant="outline" className="text-[10px] mt-1 px-1.5 h-4">
                                {pet.pet_raca}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePedirDataWhatsApp(pet)}
                          disabled={!pet.telefone}
                          className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          title="Perguntar data no WhatsApp"
                        >
                          <Send className="h-3 w-3" /> Perguntar
                        </Button>
                      </div>

                      {/* Quick Save Date */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Data Nasc.</Label>
                          <Input
                            type="date"
                            value={dataVal}
                            onChange={(e) =>
                              setDatasInput((prev) => ({ ...prev, [pet.pet_id]: e.target.value }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!dataVal) {
                              toast.error("Selecione a data de nascimento primeiro.");
                              return;
                            }
                            salvarNascMut.mutate({ pet_id: pet.pet_id, nascimento: dataVal });
                          }}
                          disabled={!dataVal || salvarNascMut.isPending}
                          className="mt-4 h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Datas Comemorativas */}
        <TabsContent value="datas" className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card p-4 rounded-xl border">
            <div>
              <h3 className="font-semibold text-sm">Calendário Promocional do Pet Spa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mensagens automáticas para fidelização e campanhas comemorativas de vendas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => carregarPadraoMut.mutate()}
                disabled={carregarPadraoMut.isPending}
                className="gap-1.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                {carregarPadraoMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                )}
                Carregar Datas Oficiais do Mercado Pet
              </Button>
              <Button size="sm" onClick={abrirNovo} className="gap-1.5 text-xs bg-pink-600 hover:bg-pink-700 text-white">
                <Plus className="h-3.5 w-3.5" /> Nova Data
              </Button>
            </div>
          </div>

          {datas.isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
            </div>
          ) : (datas.data ?? []).length === 0 ? (
            <Card className="border-dashed py-12 text-center text-muted-foreground">
              <CardContent className="space-y-3">
                <PartyPopper className="h-10 w-10 text-rose-400 mx-auto" />
                <div>
                  <h4 className="font-medium text-foreground">Nenhuma data comemorativa cadastrada</h4>
                  <p className="text-xs text-muted-foreground">
                    Clique no botão acima para carregar as principais datas oficiais (Dia do Cão, Natal Pet, Dia do Gato, etc.)
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => carregarPadraoMut.mutate()}
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                >
                  <Sparkles className="h-4 w-4" /> Carregar Datas Padrão Agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(datas.data ?? []).map((d) => (
                <Card key={d.id} className="border hover:border-pink-300 transition-all bg-card">
                  <CardContent className="p-4 flex flex-col justify-between gap-3 h-full">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                            <PartyPopper className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm leading-snug">{d.nome}</h4>
                            <Badge variant="outline" className="text-[10px] bg-pink-50 text-pink-700 border-pink-200">
                              {String(d.dia).padStart(2, "0")} de {MESES_LABEL[d.mes - 1]}
                            </Badge>
                          </div>
                        </div>

                        <Badge
                          variant={d.ativo ? "default" : "secondary"}
                          className={cn("text-[10px]", d.ativo ? "bg-emerald-600" : "opacity-60")}
                        >
                          {d.ativo ? "Ativa" : "Pausada"}
                        </Badge>
                      </div>

                      <div className="p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                        {d.template}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs gap-1" onClick={() => abrirEditar(d)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 gap-1"
                        onClick={() => {
                          if (confirm(`Remover "${d.nome}"?`)) excluir.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Configurações */}
        <TabsContent value="config" className="space-y-4">
          {!form ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <ConfigCard
                icon={Cake}
                titulo="Aniversário do Tutor"
                descricao="Envia parabéns afetuoso com lembrança do Spa no dia."
                ativo={form.aniversario_tutor_ativo}
                onAtivo={(v) => setForm({ ...form, aniversario_tutor_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Mensagem Padrão</Label>
                    <Textarea
                      rows={5}
                      value={form.aniversario_tutor_template}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_tutor_template: e.target.value })
                      }
                      className="text-xs"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Variáveis disponíveis: {"{{tutor}}"}, {"{{pet}}"}
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Cake}
                titulo="Petversário (Pet)"
                descricao="Parabéns com mimos especiais no aniversário do pet."
                ativo={form.petversario_ativo}
                onAtivo={(v) => setForm({ ...form, petversario_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Mensagem Padrão</Label>
                    <Textarea
                      rows={5}
                      value={form.petversario_template}
                      onChange={(e) =>
                        setForm({ ...form, petversario_template: e.target.value })
                      }
                      className="text-xs"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Variáveis disponíveis: {"{{tutor}}"}, {"{{pet}}"}
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Sparkles}
                titulo="Disparos Automáticos"
                descricao="Horário de envio das mensagens automáticas de datas."
                ativo={form.datas_especiais_ativo}
                onAtivo={(v) => setForm({ ...form, datas_especiais_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Horário do envio diário</Label>
                    <Input
                      type="time"
                      value={form.aniversario_hora.slice(0, 5)}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_hora: e.target.value + ":00" })
                      }
                      className="text-xs"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Todas as mensagens agendadas para o dia são disparadas neste horário.
                    </p>
                  </div>
                </div>
              </ConfigCard>

              <div className="lg:col-span-3 flex justify-end">
                <Button
                  onClick={() => form && salvarCfg.mutate(form)}
                  disabled={salvarCfg.isPending}
                  className="gap-2 bg-pink-600 hover:bg-pink-700 text-white"
                >
                  {salvarCfg.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Nova/Editar Data Comemorativa */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dlgData.id ? "Editar Data Comemorativa" : "Nova Data Comemorativa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Evento</Label>
              <Input
                value={dlgData.nome ?? ""}
                onChange={(e) => setDlgData({ ...dlgData, nome: e.target.value })}
                placeholder="Ex.: Dia Mundial dos Animais"
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
                  onChange={(e) => setDlgData({ ...dlgData, dia: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Mês</Label>
                <Select
                  value={String(dlgData.mes ?? 1)}
                  onValueChange={(v) => setDlgData({ ...dlgData, mes: Number(v) })}
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
              <Label className="text-xs">Mensagem de Felicitação / Oferta</Label>
              <Textarea
                rows={5}
                value={dlgData.template ?? ""}
                onChange={(e) => setDlgData({ ...dlgData, template: e.target.value })}
                placeholder="Ex.: Olá, {{tutor}}! Em comemoração ao dia especial do {{pet}}..."
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Variáveis: {"{{tutor}}"}, {"{{pet}}"}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={dlgData.ativo ?? true}
                onCheckedChange={(v) => setDlgData({ ...dlgData, ativo: v })}
              />
              <Label className="text-xs">Data ativa para disparo automático</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvarData.mutate()}
              disabled={salvarData.isPending}
              className="gap-2 bg-pink-600 hover:bg-pink-700 text-white"
            >
              {salvarData.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Data
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
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-pink-500/10 text-pink-600">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{titulo}</CardTitle>
              <CardDescription className="text-xs">{descricao}</CardDescription>
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
