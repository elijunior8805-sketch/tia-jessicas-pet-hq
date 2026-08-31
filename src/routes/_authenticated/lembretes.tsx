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
  Heart,
  Clock,
  CheckCircle2,
  Gift,
  Phone,
  MessageCircle,
  Copy,
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
import { JessiLembretesCopilot } from "@/components/lembretes/JessiLembretesCopilot";
import { normalizarTelefoneBR, abrirWhatsApp } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lembretes")({
  component: LembretesPage,
});

function LembretesPage() {
  const qc = useQueryClient();
  const composer = useWhatsAppComposer();

  const hojeDate = new Date();
  const hojeStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(hojeDate);

  const amanhaDate = new Date(hojeDate);
  amanhaDate.setDate(amanhaDate.getDate() + 1);
  const amanhaStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(amanhaDate);

  const cfgFn = useServerFn(getLembretesConfig);
  const salvarCfgFn = useServerFn(salvarLembretesConfig);

  const cfg = useQuery({ queryKey: ["lembretes-config"], queryFn: () => cfgFn() });

  // 1. Agendamentos de Amanhã (Tempo Real)
  const { data: agendamentosAmanha = [], isLoading: loadingAmanha } = useQuery({
    queryKey: ["lembretes-agendamentos-amanha", amanhaStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("agendamentos")
        .select(`
          id, data, hora, status, leva_traz_modalidade,
          clientes:cliente_id(id, nome, whatsapp, telefone),
          pets:pet_id(id, nome, raca),
          servicos:servico_id(nome)
        `)
        .eq("data", amanhaStr)
        .neq("status", "cancelado")
        .order("hora", { ascending: true });
      return data ?? [];
    },
  });

  // 2. Pós-Atendimentos de Hoje (Tempo Real)
  const { data: atendimentosHoje = [], isLoading: loadingHoje } = useQuery({
    queryKey: ["lembretes-pos-hoje", hojeStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select(`
          id, data_inicio, finalizado,
          clientes:cliente_id(id, nome, whatsapp, telefone),
          pets:pet_id(id, nome, raca)
        `)
        .gte("data_inicio", `${hojeStr}T00:00:00`)
        .lte("data_inicio", `${hojeStr}T23:59:59`)
        .eq("finalizado", true);
      return data ?? [];
    },
  });

  // 3. Aniversariantes do Mês
  const { data: aniversariantes = [] } = useQuery({
    queryKey: ["lembretes-aniversarios-mes"],
    queryFn: async () => {
      const mesAtual = new Date().getMonth() + 1;
      const { data: pets } = await supabase
        .from("pets")
        .select("id, nome, raca, data_nascimento, cliente_id, clientes:cliente_id(id, nome, whatsapp, telefone)")
        .not("data_nascimento", "is", null)
        .limit(100);

      return (pets ?? []).filter((p: any) => {
        if (!p.data_nascimento) return false;
        const [_, m] = String(p.data_nascimento).split("-");
        return Number(m) === mesAtual;
      });
    },
  });

  const [form, setForm] = useState<LembreteConfig | null>(null);
  if (cfg.data && !form) setForm(cfg.data);

  const salvar = useMutation({
    mutationFn: async (v: LembreteConfig) => salvarCfgFn({ data: v }),
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      qc.invalidateQueries({ queryKey: ["lembretes-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviarWhatsAppDireto = (fone: string, texto: string) => {
    if (!fone) {
      toast.error("Tutor sem telefone ou WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = fone.replace(/\D/g, "");
    const ddiPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${ddiPhone}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">
            Automação de Lembretes & Comunicação
          </h1>
          <p className="text-sm text-muted-foreground">
            Lembretes de 24h, pós-atendimento e aniversários com disparos de 1 clique no WhatsApp.
          </p>
        </div>
      </div>

      {/* Copiloto da IA Jessi */}
      <JessiLembretesCopilot
        totalAmanha={agendamentosAmanha.length}
        totalPosHoje={atendimentosHoje.length}
        totalAniversariantes={aniversariantes.length}
      />

      <Tabs defaultValue="amanha" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="amanha" className="rounded-lg gap-2 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" />
            Lembretes de Amanhã ({agendamentosAmanha.length})
          </TabsTrigger>
          <TabsTrigger value="pos" className="rounded-lg gap-2 text-xs font-semibold">
            <Heart className="h-3.5 w-3.5" />
            Pós-Atendimento de Hoje ({atendimentosHoje.length})
          </TabsTrigger>
          <TabsTrigger value="aniversarios" className="rounded-lg gap-2 text-xs font-semibold">
            <Gift className="h-3.5 w-3.5" />
            Aniversariantes do Mês ({aniversariantes.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="rounded-lg gap-2 text-xs font-semibold">
            Configurações & Modelos
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: LEMBRETES DE AMANHÃ (24h) */}
        <TabsContent value="amanha" className="space-y-3">
          {loadingAmanha ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : agendamentosAmanha.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
                <CalendarDays className="h-8 w-8 opacity-40" />
                <p className="font-semibold text-foreground">Nenhum agendamento para amanhã ({amanhaStr}).</p>
                <p className="text-xs">Assim que houver novos horários agendados, eles aparecerão aqui com lembretes prontos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agendamentosAmanha.map((ag: any) => {
                const tutorNome = ag.clientes?.nome?.split(" ")[0] || "Tutor";
                const petNome = ag.pets?.nome || "seu pet";
                const servicoNome = ag.servicos?.nome || "Banho & Tosa";
                const fone = ag.clientes?.whatsapp || ag.clientes?.telefone || "";

                const msgLembrete = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nPassando para confirmar o agendamento do ${petNome} no Spa de Pet Tia Jéssica amanhã (${amanhaStr}) às ${ag.hora?.slice(0, 5)} (${servicoNome}).\n\nTudo certo por aí? Te esperamos com muito carinho! ✨💚`;

                return (
                  <Card key={ag.id} className="card-premium p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🐾 {ag.pets?.nome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({ag.clientes?.nome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Horário: <span className="font-semibold text-foreground">{ag.hora?.slice(0, 5)}</span> · {servicoNome}
                        </div>
                      </div>
                      <Badge className="bg-emerald-600/15 text-emerald-800 border-emerald-300 text-[10px]">
                        {ag.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">
                      {msgLembrete}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(msgLembrete);
                          toast.success("Mensagem copiada!");
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(fone, msgLembrete)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar WhatsApp
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: PÓS-ATENDIMENTO (HOJE) */}
        <TabsContent value="pos" className="space-y-3">
          {loadingHoje ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : atendimentosHoje.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
                <Heart className="h-8 w-8 opacity-40" />
                <p className="font-semibold text-foreground">Nenhum atendimento finalizado hoje ({hojeStr}) ainda.</p>
                <p className="text-xs">Assim que um atendimento for concluído, o lembrete de carinho pós-banho será gerado aqui.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {atendimentosHoje.map((at: any) => {
                const tutorNome = at.clientes?.nome?.split(" ")[0] || "Tutor";
                const petNome = at.pets?.nome || "seu pet";
                const fone = at.clientes?.whatsapp || at.clientes?.telefone || "";

                const msgPos = `Oi, ${tutorNome}! 🐾 Aqui é da equipe do Spa de Pet Tia Jéssica!\n\nEsperamos que o ${petNome} tenha amado o dia de spa e esteja super cheiroso(a) e relaxado(a) em casa! Se precisar de qualquer orientação sobre a pelagem ou cuidados, estamos sempre à disposição. Obrigado pelo carinho e confiança! ✨💚`;

                return (
                  <Card key={at.id} className="card-premium p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🐾 {at.pets?.nome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({at.clientes?.nome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Status: <span className="font-semibold text-emerald-700">Atendimento Concluído</span>
                        </div>
                      </div>
                      <Badge className="bg-blue-600/15 text-blue-800 border-blue-300 text-[10px]">
                        Pós-Atendimento
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">
                      {msgPos}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(msgPos);
                          toast.success("Mensagem copiada!");
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(fone, msgPos)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar Carinho
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 3: ANIVERSARIANTES DO MÊS */}
        <TabsContent value="aniversarios" className="space-y-3">
          {aniversariantes.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
                <Gift className="h-8 w-8 opacity-40" />
                <p className="font-semibold text-foreground">Nenhum pet aniversariante registrado neste mês.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aniversariantes.map((pet: any) => {
                const tutorNome = pet.clientes?.nome?.split(" ")[0] || "Tutor";
                const petNome = pet.nome;
                const fone = pet.clientes?.whatsapp || pet.clientes?.telefone || "";

                const msgParabens = `Parabéns, ${tutorNome}! 🎉🐾 Hoje é dia de celebrar a vida do ${petNome}!\n\nToda a equipe do Spa de Pet Tia Jéssica deseja muita saúde, petiscos e momentos felizes para esse aumigo tão especial! Que tal trazer ele(a) para um banho comemorativo com direito a muito mimo? 🎂✨💚`;

                return (
                  <Card key={pet.id} className="card-premium p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🎂 {pet.nome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({pet.clientes?.nome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Data de Nascimento: <span className="font-semibold text-foreground">{pet.data_nascimento}</span>
                        </div>
                      </div>
                      <Badge className="bg-pink-600/15 text-pink-800 border-pink-300 text-[10px]">
                        Aniversariante
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">
                      {msgParabens}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(msgParabens);
                          toast.success("Mensagem copiada!");
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(fone, msgParabens)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar Parabéns
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 4: CONFIGURAÇÕES E MODELOS */}
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
                    <Label className="text-xs">Mensagem Padrão</Label>
                    <Textarea
                      rows={5}
                      value={form.lembrete_24h_template}
                      onChange={(e) =>
                        setForm({ ...form, lembrete_24h_template: e.target.value })
                      }
                    />
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
                    <Label className="text-xs">Mensagem Padrão</Label>
                    <Textarea
                      rows={5}
                      value={form.pos_atendimento_template}
                      onChange={(e) =>
                        setForm({ ...form, pos_atendimento_template: e.target.value })
                      }
                    />
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
                    <Label className="text-xs">Mensagem Padrão</Label>
                    <Textarea
                      rows={5}
                      value={form.aniversario_template}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_template: e.target.value })
                      }
                    />
                  </div>
                </div>
              </ConfigCard>

              <div className="lg:col-span-3 flex justify-end">
                <Button
                  onClick={() => form && salvar.mutate(form)}
                  disabled={salvar.isPending}
                  className="gap-2 bg-primary text-primary-foreground font-bold"
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

