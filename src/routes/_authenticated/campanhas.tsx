import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Send,
  Trash2,
  Copy,
  Users,
  RefreshCcw,
  Search,
  Loader2,
  Filter,
  Sparkles,
  CheckCircle2,
  X,
  ChevronRight,
  PawPrint,
  Flame,
  Crown,
  Repeat,
  Scissors,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  listarCampanhas,
  obterCampanha,
  preverAudiencia,
  criarCampanha,
  excluirCampanha,
  duplicarCampanha,
  marcarDestinatarioEnviado,
  cancelarDestinatario,
  kpisCampanhas,
  type CampanhaFiltros,
  type CampanhaRow,
  type DestinatarioRow,
} from "@/lib/campanhas.functions";
import {
  JessiCampanhasProativasCopilot,
  MOTORES_ESTRATEGICOS,
  type MotorCampanha,
} from "@/components/campanhas/JessiCampanhasProativasCopilot";
import { normalizarTelefoneBR } from "@/lib/whatsapp";
import {
  WhatsAppComposer,
  useWhatsAppComposer,
  openWhatsAppComposerGlobal,
} from "@/components/whatsapp-composer";

export const Route = createFileRoute("/_authenticated/campanhas")({
  component: CampanhasPage,
});

const STATUS_BADGE: Record<CampanhaRow["status"], { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-foreground" },
  pronta: { label: "Pronta", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  em_envio: { label: "Em envio", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  concluida: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  cancelada: { label: "Cancelada", cls: "bg-red-500/15 text-red-700 border-red-500/30" },
};

function CampanhasPage() {
  const [busca, setBusca] = useState("");
  const [criarOpen, setCriarOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [pendingDestId, setPendingDestId] = useState<string | null>(null);
  const [motorAtivo, setMotorAtivo] = useState<MotorCampanha>(MOTORES_ESTRATEGICOS[0]);

  const listar = useServerFn(listarCampanhas);
  const kpisFn = useServerFn(kpisCampanhas);
  const excluirFn = useServerFn(excluirCampanha);
  const duplicarFn = useServerFn(duplicarCampanha);
  const marcarFn = useServerFn(marcarDestinatarioEnviado);

  const composer = useWhatsAppComposer();

  const lista = useQuery({
    queryKey: ["campanhas-lista"],
    queryFn: () => listar(),
    staleTime: 15_000,
  });
  const kpis = useQuery({
    queryKey: ["campanhas-kpis"],
    queryFn: () => kpisFn(),
    staleTime: 15_000,
  });

  // Clientes e Pets Ativos da Base para o Motor da Jessi
  const { data: clientesBase = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["campanhas-clientes-base"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select(`
          id, nome, raca, porte, foto_url,
          clientes:cliente_id(id, nome, whatsapp, telefone)
        `)
        .order("nome", { ascending: true })
        .limit(50);
      return data ?? [];
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Campanha excluída");
      lista.refetch();
      kpis.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const duplicar = useMutation({
    mutationFn: (id: string) => duplicarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cópia criada");
      lista.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const rows = useMemo(() => {
    const arr = lista.data ?? [];
    if (!busca.trim()) return arr;
    const q = busca.toLowerCase();
    return arr.filter((r) => r.nome.toLowerCase().includes(q));
  }, [lista.data, busca]);

  const totais = kpis.data;

  const enviarWhatsAppDireto = (pet: any) => {
    const fone = pet.clientes?.whatsapp || pet.clientes?.telefone || "";
    if (!fone) {
      toast.error(`${pet.clientes?.nome || "Cliente"} sem telefone ou WhatsApp cadastrado.`);
      return;
    }
    const tutorNome = pet.clientes?.nome?.split(" ")[0] || "Tutor";
    const petNome = pet.nome;

    const textoFormatado = motorAtivo.textoOferta
      .replace("{{pet}}", petNome)
      .replace("{{tutor}}", tutorNome);

    const chamadaFormatada = motorAtivo.chamadaAcao
      .replace("{{pet}}", petNome)
      .replace("{{tutor}}", tutorNome);

    const msgCompleta = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nAqui é da equipe do Spa de Pet Tia Jéssica!\n\n${textoFormatado}\n\n${chamadaFormatada} Te esperamos com muito carinho! ✨💚`;

    const cleanPhone = fone.replace(/\D/g, "");
    const ddiPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${ddiPhone}?text=${encodeURIComponent(msgCompleta)}`;
    window.open(url, "_blank");
  };

  const copiarMensagem = (pet: any) => {
    const tutorNome = pet.clientes?.nome?.split(" ")[0] || "Tutor";
    const petNome = pet.nome;

    const textoFormatado = motorAtivo.textoOferta
      .replace("{{pet}}", petNome)
      .replace("{{tutor}}", tutorNome);

    const chamadaFormatada = motorAtivo.chamadaAcao
      .replace("{{pet}}", petNome)
      .replace("{{tutor}}", tutorNome);

    const msgCompleta = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nAqui é da equipe do Spa de Pet Tia Jéssica!\n\n${textoFormatado}\n\n${chamadaFormatada} Te esperamos com muito carinho! ✨💚`;

    navigator.clipboard.writeText(msgCompleta);
    toast.success("Mensagem promocional copiada!");
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Campanhas & Vendas Segmentadas
          </h1>
          <p className="text-sm text-muted-foreground">
            Motores estratégicos de ofertas por perfil de cliente, com disparos de 1 clique no WhatsApp pela IA Jessi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { lista.refetch(); kpis.refetch(); }}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setCriarOpen(true)} className="bg-primary text-primary-foreground font-bold">
            <Plus className="h-4 w-4 mr-2" /> Nova Campanha
          </Button>
        </div>
      </div>

      {/* Copiloto de Campanhas Proativas da IA Jessi */}
      <JessiCampanhasProativasCopilot
        totalClientes={clientesBase.length || 18}
        motorAtivo={motorAtivo}
        onSelecionarMotor={setMotorAtivo}
      />

      <Tabs defaultValue="motores" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="motores" className="rounded-lg gap-2 text-xs font-semibold">
            <Flame className="h-3.5 w-3.5 text-[#C8A951]" />
            Disparos do Motor Ativo ({motorAtivo.titulo})
          </TabsTrigger>
          <TabsTrigger value="historico" className="rounded-lg gap-2 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" />
            Campanhas Salvas ({rows.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: DISPAROS DO MOTOR ATIVO */}
        <TabsContent value="motores" className="space-y-4">
          <Card className="card-premium">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{motorAtivo.titulo}</span>
                    <Badge className={`text-xs border ${motorAtivo.corTag}`}>
                      {motorAtivo.tag}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Público-Alvo: <strong className="text-foreground">{motorAtivo.publicoAlvo}</strong> · Impacto: <strong className="text-emerald-700">{motorAtivo.impactoNegocio}</strong>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Clique em "Enviar WhatsApp" para disparar a oferta diretamente ao tutor.
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {loadingClientes ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </div>
              ) : clientesBase.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum cliente cadastrado na base ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {clientesBase.map((pet: any) => {
                    const tutorNome = pet.clientes?.nome?.split(" ")[0] || "Tutor";
                    const petNome = pet.nome;
                    const textoFormatado = motorAtivo.textoOferta
                      .replace("{{pet}}", petNome)
                      .replace("{{tutor}}", tutorNome);

                    return (
                      <div
                        key={pet.id}
                        className="p-4 rounded-xl border bg-card hover:border-[#C8A951]/50 transition-all space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold overflow-hidden">
                              {pet.foto_url ? (
                                <img
                                  src={pet.foto_url}
                                  alt={pet.nome}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <PawPrint className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-display font-bold text-sm text-primary truncate">
                                  {pet.nome}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  ({pet.clientes?.nome})
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Raça: {pet.raca || "Não informada"} {pet.porte ? `· Porte: ${pet.porte}` : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Mensagem da Oferta */}
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {`Oi, ${tutorNome}! 🐾\n\n${textoFormatado}`}
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copiarMensagem(pet)}
                            className="h-8 text-xs gap-1"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => enviarWhatsAppDireto(pet)}
                            className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                          >
                            <Send className="h-3.5 w-3.5" /> Enviar WhatsApp
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: CAMPANHAS SALVAS */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {lista.isLoading ? "Carregando…" : `${rows.length} campanha(s) personalizada(s)`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lista.isLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma campanha personalizada criada ainda. Use os motores da Jessi acima ou clique em <strong>Nova Campanha</strong>.
                </div>
              ) : (
                <div className="grid gap-2">
                  {rows.map((c) => {
                    const badge = STATUS_BADGE[c.status];
                    const pct = c.total_destinatarios > 0
                      ? Math.round((c.total_enviados / c.total_destinatarios) * 100)
                      : 0;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{c.nome}</p>
                            <Badge variant="outline" className={cn("text-[10px]", badge.cls)}>
                              {badge.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.total_enviados}/{c.total_destinatarios} enviados · {pct}%
                            {c.total_falhas > 0 && ` · ${c.total_falhas} falha(s)`}
                            {c.descricao && ` · ${c.descricao}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicar.mutate(c.id)}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Excluir campanha "${c.nome}"?`)) excluir.mutate(c.id);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => setDetalheId(c.id)}>
                            Abrir <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CriarCampanhaDialog
        open={criarOpen}
        onOpenChange={setCriarOpen}
        onCreated={(id) => {
          setCriarOpen(false);
          lista.refetch();
          kpis.refetch();
          setDetalheId(id);
        }}
      />

      <DetalheCampanhaDialog
        campanhaId={detalheId}
        onClose={() => { setDetalheId(null); lista.refetch(); kpis.refetch(); }}
        onEnviar={(dest) => {
          const norm = normalizarTelefoneBR(dest.telefone ?? "");
          if (!norm.ok) {
            toast.error(`${dest.cliente_nome ?? "Cliente"} sem telefone válido`);
            return;
          }
          setPendingDestId(dest.id);
          openWhatsAppComposerGlobal({
            tipo: "personalizada",
            destinatario: dest.cliente_nome ?? "Cliente",
            telefone: norm.e164,
            mensagem: dest.mensagem_renderizada,
            motivo: `Campanha`,
            cliente_id: dest.cliente_id,
          });
        }}
      />

      <WhatsAppComposer
        open={composer.state.open}
        onOpenChange={(v) => (v ? null : composer.close())}
        payload={composer.state.payload}
        onSent={async () => {
          if (pendingDestId) {
            try {
              await marcarFn({ data: { destinatario_id: pendingDestId } });
              lista.refetch();
              kpis.refetch();
            } catch (e: any) {
              toast.error(e?.message ?? "Erro ao marcar como enviado");
            }
            setPendingDestId(null);
          }
        }}
      />
    </div>
  );
}


function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="card-premium">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="text-2xl md:text-3xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Criar Campanha ----------

function CriarCampanhaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState<"filtros" | "mensagem">("filtros");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [mensagem, setMensagem] = useState(
    "Olá {{tutor}}! Aqui é o Spa da Tia Jéssica 🐾\n\nEstamos com uma novidade especial pro {{pet}}: [descreva a promoção]. Posso te ajudar a agendar?"
  );
  const [filtros, setFiltros] = useState<CampanhaFiltros>({
    portes: [],
    cidade: "",
    min_dias_ultimo_atend: null,
    max_dias_ultimo_atend: null,
    aniversariante_mes_pet: false,
    so_sem_agendamento_futuro: false,
    apenas_ativos: true,
  });

  const preverFn = useServerFn(preverAudiencia);
  const criarFn = useServerFn(criarCampanha);

  const portesQ = useQuery({
    queryKey: ["portes-lista-campanha"],
    queryFn: async () =>
      (await supabase.from("portes").select("nome").eq("ativo", true).order("ordem")).data ?? [],
    staleTime: 300_000,
    enabled: open,
  });

  const preview = useMutation({
    mutationFn: () => preverFn({ data: { filtros } }),
  });

  const criar = useMutation({
    mutationFn: () =>
      criarFn({
        data: {
          nome: nome.trim(),
          descricao: descricao.trim(),
          filtros,
          mensagem: mensagem.trim(),
        },
      }),
    onSuccess: ({ id }) => {
      toast.success("Campanha criada");
      onCreated(id);
      // reset
      setStep("filtros");
      setNome("");
      setDescricao("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const togglePorte = (p: string) => {
    const cur = filtros.portes ?? [];
    setFiltros({ ...filtros, portes: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova campanha segmentada</DialogTitle>
          <DialogDescription>
            Defina o público-alvo e a mensagem. Os disparos são feitos pelo WhatsApp Web, um a um.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={step} onValueChange={(v) => setStep(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="filtros">
              <Filter className="h-4 w-4 mr-2" /> 1. Filtros
            </TabsTrigger>
            <TabsTrigger value="mensagem">
              <Sparkles className="h-4 w-4 mr-2" /> 2. Mensagem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="filtros" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">Portes</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(portesQ.data ?? []).map((p) => {
                  const active = (filtros.portes ?? []).includes(p.nome);
                  return (
                    <button
                      key={p.nome}
                      type="button"
                      onClick={() => togglePorte(p.nome)}
                      className={cn(
                        "px-3 py-1 rounded-full border text-xs",
                        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                      )}
                    >
                      {p.nome}
                    </button>
                  );
                })}
                {(portesQ.data ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhum porte cadastrado</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cidade contém</Label>
                <Input
                  value={filtros.cidade ?? ""}
                  onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })}
                  placeholder="Ex: Salvador"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm px-2 py-2">
                  <Checkbox
                    checked={!!filtros.aniversariante_mes_pet}
                    onCheckedChange={(v) => setFiltros({ ...filtros, aniversariante_mes_pet: Boolean(v) })}
                  />
                  Pet aniversariante do mês
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sem visita há pelo menos (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={filtros.min_dias_ultimo_atend ?? ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      min_dias_ultimo_atend: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 30"
                />
              </div>
              <div>
                <Label className="text-xs">No máximo (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={filtros.max_dias_ultimo_atend ?? ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      max_dias_ultimo_atend: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 120"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!filtros.so_sem_agendamento_futuro}
                onCheckedChange={(v) => setFiltros({ ...filtros, so_sem_agendamento_futuro: Boolean(v) })}
              />
              Apenas sem agendamento futuro
            </label>

            <Separator />

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => preview.mutate()}
                disabled={preview.isPending}
              >
                {preview.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Prever audiência
              </Button>
              {preview.data && (
                <span className="text-sm">
                  <strong>{preview.data.total}</strong> pet(s) elegíveis
                </span>
              )}
            </div>

            {preview.data && preview.data.preview.length > 0 && (
              <div className="rounded-md border p-2 max-h-40 overflow-y-auto space-y-1">
                {preview.data.preview.map((p) => (
                  <div key={p.pet_id} className="text-xs flex items-center gap-2">
                    <span className="font-medium">{p.pet_nome}</span>
                    <span className="text-muted-foreground">— {p.cliente_nome}</span>
                  </div>
                ))}
                {preview.data.total > preview.data.preview.length && (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    e mais {preview.data.total - preview.data.preview.length}…
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setStep("mensagem")}>Próximo</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="mensagem" className="space-y-3 mt-4">
            <div>
              <Label className="text-xs">Nome da campanha</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promoção de outubro" />
            </div>
            <div>
              <Label className="text-xs">Descrição interna (opcional)</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">
                Mensagem (use <code>{"{{tutor}}"}</code> e <code>{"{{pet}}"}</code>)
              </Label>
              <Textarea
                rows={7}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                A mensagem é renderizada por destinatário no momento em que a campanha é criada.
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep("filtros")}>Voltar</Button>
              <Button
                onClick={() => criar.mutate()}
                disabled={criar.isPending || !nome.trim() || !mensagem.trim()}
              >
                {criar.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Criar campanha
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Detalhe (destinatários + envio) ----------

function DetalheCampanhaDialog({
  campanhaId,
  onClose,
  onEnviar,
}: {
  campanhaId: string | null;
  onClose: () => void;
  onEnviar: (dest: DestinatarioRow) => void;
}) {
  const obter = useServerFn(obterCampanha);
  const marcar = useServerFn(marcarDestinatarioEnviado);
  const cancelar = useServerFn(cancelarDestinatario);

  const q = useQuery({
    queryKey: ["campanha", campanhaId],
    queryFn: () => obter({ data: { id: campanhaId! } }),
    enabled: !!campanhaId,
  });

  const marcarM = useMutation({
    mutationFn: (id: string) => marcar({ data: { destinatario_id: id } }),
    onSuccess: () => q.refetch(),
  });

  const cancelarM = useMutation({
    mutationFn: (id: string) => cancelar({ data: { destinatario_id: id } }),
    onSuccess: () => q.refetch(),
  });

  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendente" | "enviado" | "falhou" | "cancelado">("todos");

  const dests = q.data?.destinatarios ?? [];
  const filtered = dests.filter((d) => filtroStatus === "todos" || d.status === filtroStatus);

  const camp = q.data?.campanha;
  const pct = camp && camp.total_destinatarios > 0
    ? Math.round((camp.total_enviados / camp.total_destinatarios) * 100)
    : 0;

  return (
    <Dialog open={!!campanhaId} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {camp?.nome ?? "Campanha"}
          </DialogTitle>
          <DialogDescription>
            {camp && (
              <>
                {camp.total_enviados}/{camp.total_destinatarios} enviados · {pct}%
                {camp.total_falhas > 0 && ` · ${camp.total_falhas} falha(s)`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          {(["todos", "pendente", "enviado", "falhou", "cancelado"] as const).map((s) => (
            <Badge
              key={s}
              variant={filtroStatus === s ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setFiltroStatus(s)}
            >
              {s === "todos" ? "Todos" : s}
            </Badge>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {q.isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum destinatário nesse filtro.
            </div>
          ) : (
            filtered.map((d) => (
              <div
                key={d.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border bg-card",
                  d.status === "enviado" && "border-emerald-500/40 bg-emerald-500/5",
                  d.status === "falhou" && "border-red-500/40 bg-red-500/5",
                  d.status === "cancelado" && "opacity-60"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {d.pet_nome} <span className="text-muted-foreground">— {d.cliente_nome}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.telefone ?? "sem telefone"} · {d.status}
                    {d.enviado_em && ` · ${new Date(d.enviado_em).toLocaleString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {d.status === "pendente" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => cancelarM.mutate(d.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => onEnviar(d)}>
                        <Send className="h-4 w-4 md:mr-1" />
                        <span className="hidden md:inline">Enviar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => marcarM.mutate(d.id)}
                        title="Marcar como enviado manualmente"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {d.status === "enviado" && (
                    <Badge variant="secondary" className="text-[10px]">
                      Enviado
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
