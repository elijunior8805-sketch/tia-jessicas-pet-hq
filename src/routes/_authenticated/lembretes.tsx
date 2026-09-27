import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Cake,
  Sparkles,
  Send,
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
  Repeat,
  Crown,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Sparkle,
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
  type LembreteConfig,
} from "@/lib/lembretes.functions";
import {
  WhatsAppComposer,
  useWhatsAppComposer,
} from "@/components/whatsapp-composer";
import { JessiLembretesCopilot } from "@/components/lembretes/JessiLembretesCopilot";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lembretes")({
  component: LembretesPage,
});

function LembretesPage() {
  const qc = useQueryClient();
  const composer = useWhatsAppComposer();
  const [activeTab, setActiveTab] = useState<string>("ciclo");
  const [busca, setBusca] = useState<string>("");
  const [variacaoIndex, setVariacaoIndex] = useState<Record<string, number>>({});

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

  // 1. CICLO DE RETORNO PREDITIVO (Pets no prazo de banho sem agendamento futuro)
  const { data: cicloRetorno = [], isLoading: loadingCiclo } = useQuery({
    queryKey: ["lembretes-ciclo-retorno", hojeStr],
    queryFn: async () => {
      // 1.1 Tenta buscar da view otimizada pets_reativacao
      const { data: viewData, error: viewErr } = await supabase
        .from("pets_reativacao")
        .select("cliente_id, cliente_nome, cliente_telefone, cliente_whatsapp, pet_id, pet_nome, dias_inativo, faixa, ticket_medio, ultimo_atendimento_em")
        .gte("dias_inativo", 12)
        .order("dias_inativo", { ascending: true })
        .limit(40);

      // 1.2 Busca agendamentos futuros para não sugerir quem já agendou
      const { data: agsFuturos } = await supabase
        .from("agendamentos")
        .select("pet_id, cliente_id")
        .gte("data", hojeStr)
        .neq("status", "cancelado");

      const petsComAgendamento = new Set((agsFuturos || []).map((a) => a.pet_id));

      if (viewData && viewData.length > 0) {
        return viewData
          .filter((item) => !petsComAgendamento.has(item.pet_id))
          .map((item) => ({
            petId: item.pet_id,
            petNome: item.pet_nome || "Pet",
            clienteId: item.cliente_id,
            clienteNome: item.cliente_nome || "Tutor",
            telefone: item.cliente_whatsapp || item.cliente_telefone || "",
            diasInativo: Number(item.dias_inativo) || 15,
            ticketMedio: Number(item.ticket_medio) || 85,
            ultimoAtendimento: item.ultimo_atendimento_em,
            faixa: item.faixa || "15_dias",
          }));
      }

      // Fallback: Busca via tabela de atendimentos finalizados
      const { data: atendimentos } = await supabase
        .from("atendimentos")
        .select(`
          id, data_inicio, valor_total,
          clientes:cliente_id(id, nome, whatsapp, telefone),
          pets:pet_id(id, nome, raca)
        `)
        .eq("finalizado", true)
        .order("data_inicio", { ascending: false })
        .limit(100);

      const mapPets = new Map<string, any>();
      (atendimentos || []).forEach((at: any) => {
        const petId = at.pets?.id;
        if (petId && !petsComAgendamento.has(petId) && !mapPets.has(petId)) {
          const dInicio = new Date(at.data_inicio);
          const diffDias = Math.floor((hojeDate.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDias >= 12) {
            mapPets.set(petId, {
              petId,
              petNome: at.pets?.nome || "Pet",
              clienteId: at.clientes?.id,
              clienteNome: at.clientes?.nome || "Tutor",
              telefone: at.clientes?.whatsapp || at.clientes?.telefone || "",
              diasInativo: diffDias,
              ticketMedio: Number(at.valor_total) || 85,
              ultimoAtendimento: at.data_inicio,
              faixa: diffDias <= 21 ? "15_dias" : diffDias <= 35 ? "30_dias" : "sumido",
            });
          }
        }
      });

      return Array.from(mapPets.values());
    },
  });

  // 2. AGENDAMENTOS DE AMANHÃ (Confirmação 24h & Leva e Traz)
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

  // 3. PÓS-ATENDIMENTO DE HOJE (Encanto & Pré-Agendamento)
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

  // 4. CLUBINHO — CRÉDITOS ATIVOS (Contratos com saldo disponível)
  const { data: clubinhoAtivo = [], isLoading: loadingClubinho } = useQuery({
    queryKey: ["lembretes-clubinho-ativo", hojeStr],
    queryFn: async () => {
      const { data: contratos } = await supabase
        .from("programas_contratados")
        .select(`
          id, cliente_id, pet_id, nome_snapshot, data_de_validade, status_do_programa,
          clientes:cliente_id(id, nome, whatsapp, telefone),
          pets:pet_id(id, nome, raca)
        `)
        .eq("status_do_programa", "ativo")
        .gte("data_de_validade", hojeStr);

      const ids = (contratos || []).map((c: any) => c.id);
      if (!ids.length) return [];

      const { data: movs } = await supabase
        .from("programas_creditos_movimentacoes")
        .select("programa_contratado_id, tipo, quantidade")
        .in("programa_contratado_id", ids);

      return (contratos || []).map((c: any) => {
        const movsC = (movs || []).filter((m: any) => m.programa_contratado_id === c.id);
        const contratados = movsC.filter((m: any) => m.tipo === "credito_criado" || m.tipo === "credito_inicial").reduce((acc, m) => acc + (m.quantidade || 0), 0);
        const consumidos = movsC.filter((m: any) => m.tipo === "credito_consumido" || m.tipo === "debito").reduce((acc, m) => acc + (m.quantidade || 0), 0);
        const estornados = movsC.filter((m: any) => m.tipo === "credito_estornado").reduce((acc, m) => acc + (m.quantidade || 0), 0);
        const saldo = Math.max(0, (contratados || 4) - consumidos + estornados);

        const dataValidade = c.data_de_validade;
        const diffDias = Math.ceil((new Date(`${dataValidade}T23:59:59`).getTime() - hojeDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          tutorNome: c.clientes?.nome || "Tutor",
          petNome: c.pets?.nome || "Pet",
          raca: c.pets?.raca || "Padrão",
          telefone: c.clientes?.whatsapp || c.clientes?.telefone || "",
          programaNome: c.nome_snapshot || "Plano Clubinho",
          saldoCreditos: saldo > 0 ? saldo : 1,
          validade: dataValidade,
          diasRestantes: diffDias,
        };
      }).filter((item) => item.saldoCreditos > 0);
    },
  });

  // 5. ANIVERSARIANTES DO MÊS
  const { data: aniversariantes = [], isLoading: loadingAniversarios } = useQuery({
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

  // Cálculo do Potencial Financeiro de Retorno
  const potencialFaturamento = useMemo(() => {
    return cicloRetorno.reduce((acc, curr) => acc + (curr.ticketMedio || 85), 0);
  }, [cicloRetorno]);

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

  const reRollMensagem = (id: string) => {
    setVariacaoIndex((prev) => ({
      ...prev,
      [id]: ((prev[id] || 0) + 1) % 3,
    }));
    toast.info("Variação da mensagem atualizada com IA Jessi ✨");
  };

  // Filtros aplicados em tempo real por busca
  const cicloFiltrado = useMemo(() => {
    if (!busca) return cicloRetorno;
    const b = busca.toLowerCase();
    return cicloRetorno.filter(
      (c) => c.petNome.toLowerCase().includes(b) || c.clienteNome.toLowerCase().includes(b)
    );
  }, [cicloRetorno, busca]);

  const agendamentosFiltrados = useMemo(() => {
    if (!busca) return agendamentosAmanha;
    const b = busca.toLowerCase();
    return agendamentosAmanha.filter((a: any) =>
      (a.pets?.nome || "").toLowerCase().includes(b) || (a.clientes?.nome || "").toLowerCase().includes(b)
    );
  }, [agendamentosAmanha, busca]);

  const clubinhoFiltrado = useMemo(() => {
    if (!busca) return clubinhoAtivo;
    const b = busca.toLowerCase();
    return clubinhoAtivo.filter(
      (c) => c.petNome.toLowerCase().includes(b) || c.tutorNome.toLowerCase().includes(b)
    );
  }, [clubinhoAtivo, busca]);

  const aniversariantesFiltrados = useMemo(() => {
    if (!busca) return aniversariantes;
    const b = busca.toLowerCase();
    return aniversariantes.filter((p: any) =>
      (p.nome || "").toLowerCase().includes(b) || (p.clientes?.nome || "").toLowerCase().includes(b)
    );
  }, [aniversariantes, busca]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Automação de Lembretes & Retorno</span>
            <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-300/40 text-xs font-semibold">
              IA Jessi Integrada
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Disparos com 1 clique no WhatsApp: ciclo de banho, confirmações 24h, pós-atendimento e saldo do Clubinho.
          </p>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pet ou tutor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-background border-border/80"
          />
        </div>
      </div>

      {/* Copiloto Executivo Jessi com Métricas de Retorno */}
      <JessiLembretesCopilot
        totalCicloRetorno={cicloRetorno.length}
        potencialFaturamento={potencialFaturamento}
        totalAmanha={agendamentosAmanha.length}
        totalPosHoje={atendimentosHoje.length}
        totalClubinho={clubinhoAtivo.length}
        totalAniversariantes={aniversariantes.length}
        onSelectTab={(t) => setActiveTab(t)}
      />

      {/* Abas Estratégicas de Lembretes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-xl flex flex-wrap h-auto gap-1 border border-border/40">
          <TabsTrigger value="ciclo" className="rounded-lg gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
            <Repeat className="h-3.5 w-3.5 text-emerald-600" />
            Ciclo de Retorno ({cicloRetorno.length})
          </TabsTrigger>

          <TabsTrigger value="amanha" className="rounded-lg gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            Véspera 24h ({agendamentosAmanha.length})
          </TabsTrigger>

          <TabsTrigger value="pos" className="rounded-lg gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
            <Heart className="h-3.5 w-3.5 text-[#C8A951]" />
            Pós-Atendimento ({atendimentosHoje.length})
          </TabsTrigger>

          <TabsTrigger value="clubinho" className="rounded-lg gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
            <Crown className="h-3.5 w-3.5 text-purple-600" />
            Créditos Clubinho ({clubinhoAtivo.length})
          </TabsTrigger>

          <TabsTrigger value="aniversarios" className="rounded-lg gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
            <Gift className="h-3.5 w-3.5 text-pink-600" />
            Aniversariantes ({aniversariantes.length})
          </TabsTrigger>

          <TabsTrigger value="config" className="rounded-lg gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
            Configurações & Modelos
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* ABA 1: CICLO DE RETORNO (RESGATE DE BANHO PERIÓDICO)     */}
        {/* ======================================================== */}
        <TabsContent value="ciclo" className="space-y-4">
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-foreground/90">
                <strong>Oportunidade Ativa de Faturamento:</strong> Estes pets estão no prazo ideal de banho (12+ dias ausentes) e <strong>não possuem agendamento futuro</strong>.
              </p>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold text-[11px] shrink-0">
              {cicloFiltrado.length} Pets Disponíveis
            </Badge>
          </div>

          {loadingCiclo ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
              <span className="text-xs mt-2">Analisando histórico de banhos dos pets...</span>
            </div>
          ) : cicloFiltrado.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-14 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 opacity-60" />
                <p className="font-semibold text-foreground text-sm">Fidelização em Dia!</p>
                <p className="text-xs max-w-md">
                  Nenhum pet com ciclo de banho em atraso sem agendamento futuro no momento. Todos os seus clientes estão com visitas recentes ou já marcadas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {cicloFiltrado.map((item) => {
                const tutorPrimNome = item.clienteNome?.split(" ")[0] || "Tutor";
                const vIdx = variacaoIndex[item.petId] || 0;

                // 3 Variações Geradas por IA (Evita repetição no WhatsApp)
                const variacoes = [
                  `Oi, ${tutorPrimNome}! 🐾 Tudo bem por aí?\n\nPassando para lembrar que já faz ${item.diasInativo} dias do último banho cheiroso do ${item.petNome}! A pelagem dele já deve estar pedindo aquele cuidado especial da Tia Jéssica. ✨\n\nTemos vagas nesta semana! Quer que eu separe o melhor horário para ele? 💚`,
                  `Olá, ${tutorPrimNome}! ✨ Como está o ${item.petNome}?\n\nNotamos que já se passaram ${item.diasInativo} dias desde o último dia de spa dele! Para manter o pelo macio, hidratado e sem nós, que tal garantir o horário dele desta semana?\n\nPosso reservar para você? 🐾🐶`,
                  `Oi, ${tutorPrimNome}! 🐶 Saudades do ${item.petNome} por aqui!\n\nJá faz ${item.diasInativo} dias que ele esteve no Spa de Pet Tia Jéssica. Vamos agendar o banho dele para ele ficar bem relaxado e perfumado para o fim de semana? Me avisa qual dia prefere! 🛁✨`,
                ];

                const msgAtual = variacoes[vIdx];

                return (
                  <Card key={item.petId} className="card-premium p-4 space-y-3 hover:border-emerald-500/50 transition-all">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🐾 {item.petNome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({item.clienteNome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            Ausente há {item.diasInativo} dias
                          </span>
                          <span>•</span>
                          <span>Ticket estimado: R$ {item.ticketMedio.toFixed(2)}</span>
                        </div>
                      </div>
                      <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 text-[10px]">
                        Ciclo de Retorno
                      </Badge>
                    </div>

                    <div className="relative">
                      <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl whitespace-pre-wrap leading-relaxed border border-border/40 font-mono text-[11.5px]">
                        {msgAtual}
                      </p>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => reRollMensagem(item.petId)}
                        className="absolute bottom-2 right-2 h-6 text-[10px] gap-1 bg-background/80 hover:bg-background border border-border/60 text-primary shadow-xs"
                      >
                        <Sparkles className="h-3 w-3 text-[#C8A951]" />
                        Variação {vIdx + 1}/3
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(msgAtual);
                          toast.success("Mensagem copiada para a área de transferência!");
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(item.telefone, msgAtual)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5 shadow-xs"
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

        {/* ======================================================== */}
        {/* ABA 2: LEMBRETES DE VÉSPERA (24H ANTES)                   */}
        {/* ======================================================== */}
        <TabsContent value="amanha" className="space-y-4">
          <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <p className="text-foreground/90">
                <strong>Confirmação de Grade (24h de Antecedência):</strong> Confirme os horários agendados para amanhã ({amanhaStr}) e evite no-show ou atrasos na recepção.
              </p>
            </div>
            <Badge className="bg-blue-600 text-white font-bold text-[11px] shrink-0">
              {agendamentosFiltrados.length} Agendados
            </Badge>
          </div>

          {loadingAmanha ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <span className="text-xs mt-2">Carregando agendamentos de amanhã...</span>
            </div>
          ) : agendamentosFiltrados.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-14 text-center text-muted-foreground">
                <CalendarDays className="h-10 w-10 text-blue-600 opacity-60" />
                <p className="font-semibold text-foreground text-sm">Grade Livre para Amanhã ({amanhaStr})</p>
                <p className="text-xs max-w-md">
                  Nenhum atendimento marcado para amanhã ainda. Aproveite a aba <strong>Ciclo de Retorno</strong> para convidar tutores e preencher a grade!
                </p>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("ciclo")}
                  className="mt-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 font-bold"
                >
                  <Repeat className="h-3.5 w-3.5" /> Ver Pets Prontos para Retorno
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {agendamentosFiltrados.map((ag: any) => {
                const tutorNome = ag.clientes?.nome?.split(" ")[0] || "Tutor";
                const petNome = ag.pets?.nome || "seu pet";
                const servicoNome = ag.servicos?.nome || "Banho & Tosa";
                const fone = ag.clientes?.whatsapp || ag.clientes?.telefone || "";
                const levaTraz = ag.leva_traz_modalidade && ag.leva_traz_modalidade !== "nao_utilizar";
                const horaFmt = ag.hora ? String(ag.hora).slice(0, 5) : "--:--";

                const msgLembrete = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nPassando para confirmar o agendamento do ${petNome} no Spa de Pet Tia Jéssica amanhã (${amanhaStr}) às ${horaFmt} (${servicoNome})${levaTraz ? " com transporte Leva & Traz 🚐" : ""}.\n\nTudo certo por aí? Te esperamos com muito carinho! ✨💚`;

                return (
                  <Card key={ag.id} className="card-premium p-4 space-y-3 hover:border-blue-500/50 transition-all">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🐾 {ag.pets?.nome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({ag.clientes?.nome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          Horário: <span className="font-semibold text-foreground">{horaFmt}</span> · {servicoNome}
                          {levaTraz && <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[9px] py-0">Leva & Traz 🚐</Badge>}
                        </div>
                      </div>
                      <Badge className="bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-300 text-[10px]">
                        {ag.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl whitespace-pre-wrap leading-relaxed border border-border/40 font-mono text-[11.5px]">
                      {msgLembrete}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(msgLembrete);
                          toast.success("Mensagem de confirmação copiada!");
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(fone, msgLembrete)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5 shadow-xs"
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

        {/* ======================================================== */}
        {/* ABA 3: PÓS-ATENDIMENTO & PRÉ-AGENDAMENTO DA PRÓXIMA VISITA*/}
        {/* ======================================================== */}
        <TabsContent value="pos" className="space-y-4">
          <div className="flex items-center justify-between bg-[#C8A951]/10 border border-[#C8A951]/20 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <Heart className="h-4 w-4 text-[#C8A951] shrink-0" />
              <p className="text-foreground/90">
                <strong>Encanto & Retenção Imediata:</strong> Envie mensagem de carinho pós-banho e já convide o tutor para deixar o próximo horário pré-agendado.
              </p>
            </div>
            <Badge className="bg-[#C8A951] text-white font-bold text-[11px] shrink-0">
              {atendimentosHoje.length} Concluídos Hoje
            </Badge>
          </div>

          {loadingHoje ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-[#C8A951]" />
            </div>
          ) : atendimentosHoje.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-14 text-center text-muted-foreground">
                <Heart className="h-10 w-10 text-[#C8A951] opacity-60" />
                <p className="font-semibold text-foreground text-sm">Nenhum atendimento finalizado hoje ({hojeStr}) ainda.</p>
                <p className="text-xs max-w-md">
                  Assim que um banho ou tosa for concluído na bancada, o lembrete de carinho pós-atendimento será gerado aqui automaticamente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {atendimentosHoje.map((at: any) => {
                const tutorNome = at.clientes?.nome?.split(" ")[0] || "Tutor";
                const petNome = at.pets?.nome || "seu pet";
                const fone = at.clientes?.whatsapp || at.clientes?.telefone || "";

                const msgPos = `Oi, ${tutorNome}! 🐾 Aqui é da equipe do Spa de Pet Tia Jéssica!\n\nEsperamos que o ${petNome} tenha amado o dia de spa e esteja super cheiroso(a) e relaxado(a) em casa! ✨\n\n💡 Dica da Tia Jéssica: Para manter o pelo sempre soltinho e sem nós, já quer deixar o próximo banho dele pré-agendado para daqui a 15 dias? Me avisa que já garanto a vaga! Obrigado pelo carinho e confiança! 💚🐶`;

                return (
                  <Card key={at.id} className="card-premium p-4 space-y-3 hover:border-[#C8A951]/50 transition-all">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🐾 {at.pets?.nome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({at.clientes?.nome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Status: <span className="font-semibold text-emerald-700 dark:text-emerald-400">Atendimento Concluído Hoje</span>
                        </div>
                      </div>
                      <Badge className="bg-amber-600/15 text-amber-800 dark:text-amber-300 border-amber-300 text-[10px]">
                        Pós-Banho
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl whitespace-pre-wrap leading-relaxed border border-border/40 font-mono text-[11.5px]">
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
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5 shadow-xs"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar Carinho & Reagendar
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 4: CLUBINHO — LEMBRETES DE CRÉDITOS ATIVOS           */}
        {/* ======================================================== */}
        <TabsContent value="clubinho" className="space-y-4">
          <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <p className="text-foreground/90">
                <strong>Assinantes do Clubinho:</strong> Lembre os tutores que possuem créditos de banho ativos para utilizarem dentro da vigência do plano.
              </p>
            </div>
            <Badge className="bg-purple-600 text-white font-bold text-[11px] shrink-0">
              {clubinhoFiltrado.length} Contratos Ativos
            </Badge>
          </div>

          {loadingClubinho ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
            </div>
          ) : clubinhoFiltrado.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-14 text-center text-muted-foreground">
                <Crown className="h-10 w-10 text-purple-600 opacity-60" />
                <p className="font-semibold text-foreground text-sm">Nenhum crédito do Clubinho pendente de lembrete.</p>
                <p className="text-xs">Todos os assinantes estão com seus planos em dia e agendados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {clubinhoFiltrado.map((item) => {
                const tutorNome = item.tutorNome.split(" ")[0] || "Tutor";
                const validadeFmt = new Date(`${item.validade}T12:00:00`).toLocaleDateString("pt-BR");

                const msgClubinho = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nPassando para te lembrar que o ${item.petNome} ainda tem ${item.saldoCreditos} crédito(s) de banho disponível(is) no plano ${item.programaNome} (válido até ${validadeFmt})!\n\nVamos garantir o banho dele desta semana para aproveitar o plano? Me avisa o melhor dia e horário para eu reservar! ✨💚`;

                return (
                  <Card key={item.id} className="card-premium p-4 space-y-3 hover:border-purple-500/50 transition-all">
                    <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div>
                        <div className="font-display font-bold text-sm text-primary flex items-center gap-1.5">
                          <span>🐾 {item.petNome}</span>
                          <span className="text-xs text-muted-foreground font-normal">({item.tutorNome})</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span className="font-semibold text-purple-700 dark:text-purple-300">
                            {item.saldoCreditos} crédito(s) restantes
                          </span>
                          <span>•</span>
                          <span>Vence em {item.diasRestantes} dias ({validadeFmt})</span>
                        </div>
                      </div>
                      <Badge className="bg-purple-600/15 text-purple-800 dark:text-purple-300 border-purple-300 text-[10px]">
                        {item.programaNome}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl whitespace-pre-wrap leading-relaxed border border-border/40 font-mono text-[11.5px]">
                      {msgClubinho}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(msgClubinho);
                          toast.success("Mensagem copiada!");
                        }}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(item.telefone, msgClubinho)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5 shadow-xs"
                      >
                        <Send className="h-3.5 w-3.5" /> Lembrar no WhatsApp
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 5: ANIVERSARIANTES DO MÊS (COM MIMO DE COMEMORAÇÃO)  */}
        {/* ======================================================== */}
        <TabsContent value="aniversarios" className="space-y-4">
          <div className="flex items-center justify-between bg-pink-500/10 border border-pink-500/20 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <Gift className="h-4 w-4 text-pink-600 dark:text-pink-400 shrink-0" />
              <p className="text-foreground/90">
                <strong>Aniversariantes do Mês:</strong> Parabenize os pets e ofereça um banho comemorativo especial com brinde de parabéns.
              </p>
            </div>
            <Badge className="bg-pink-600 text-white font-bold text-[11px] shrink-0">
              {aniversariantesFiltrados.length} Aniversariantes
            </Badge>
          </div>

          {loadingAniversarios ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-pink-600" />
            </div>
          ) : aniversariantesFiltrados.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="grid place-items-center gap-2 py-14 text-center text-muted-foreground">
                <Gift className="h-10 w-10 text-pink-600 opacity-60" />
                <p className="font-semibold text-foreground text-sm">Nenhum pet aniversariante registrado neste mês.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {aniversariantesFiltrados.map((pet: any) => {
                const tutorNome = pet.clientes?.nome?.split(" ")[0] || "Tutor";
                const petNome = pet.nome;
                const fone = pet.clientes?.whatsapp || pet.clientes?.telefone || "";

                const msgParabens = `Parabéns, ${tutorNome}! 🎉🐾 Este mês é de muita festa para celebrar a vida do querido(a) ${petNome}!\n\nToda a equipe do Spa de Pet Tia Jéssica deseja muita saúde, petiscos e momentos felizes para esse aumigo tão especial! 🎂✨\n\nQue tal trazer ele(a) para um banho de aniversário com direito a um mimo especial da Tia Jéssica? Me avisa para agendarmos! 💚🐶`;

                return (
                  <Card key={pet.id} className="card-premium p-4 space-y-3 hover:border-pink-500/50 transition-all">
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
                      <Badge className="bg-pink-600/15 text-pink-800 dark:text-pink-300 border-pink-300 text-[10px]">
                        Aniversariante
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl whitespace-pre-wrap leading-relaxed border border-border/40 font-mono text-[11.5px]">
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
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5 shadow-xs"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar Parabéns no WhatsApp
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 6: CONFIGURAÇÕES & MODELOS DE MENSAGENS              */}
        {/* ======================================================== */}
        <TabsContent value="config" className="space-y-4">
          {!form ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
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
                    <Label className="text-xs font-semibold">Horário Padrão de Envio</Label>
                    <Input
                      type="time"
                      value={form.lembrete_24h_hora.slice(0, 5)}
                      onChange={(e) =>
                        setForm({ ...form, lembrete_24h_hora: e.target.value + ":00" })
                      }
                      className="h-9 text-xs rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Modelo de Mensagem (Véspera)</Label>
                    <Textarea
                      rows={5}
                      value={form.lembrete_24h_template}
                      onChange={(e) =>
                        setForm({ ...form, lembrete_24h_template: e.target.value })
                      }
                      className="text-xs rounded-lg mt-1"
                    />
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Sparkles}
                titulo="Pós-atendimento"
                descricao="Solicita feedback e convida para pré-agendamento."
                ativo={form.pos_atendimento_ativo}
                onAtivo={(v) => setForm({ ...form, pos_atendimento_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Horas após encerrar o banho</Label>
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
                      className="h-9 text-xs rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Modelo de Mensagem (Pós-Banho)</Label>
                    <Textarea
                      rows={5}
                      value={form.pos_atendimento_template}
                      onChange={(e) =>
                        setForm({ ...form, pos_atendimento_template: e.target.value })
                      }
                      className="text-xs rounded-lg mt-1"
                    />
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard
                icon={Cake}
                titulo="Aniversário do pet"
                descricao="Parabeniza no mês/dia de aniversário com mimo."
                ativo={form.aniversario_pet_ativo}
                onAtivo={(v) => setForm({ ...form, aniversario_pet_ativo: v })}
              >
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Horário de Disparo</Label>
                    <Input
                      type="time"
                      value={form.aniversario_hora.slice(0, 5)}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_hora: e.target.value + ":00" })
                      }
                      className="h-9 text-xs rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Modelo de Mensagem (Parabéns)</Label>
                    <Textarea
                      rows={5}
                      value={form.aniversario_template}
                      onChange={(e) =>
                        setForm({ ...form, aniversario_template: e.target.value })
                      }
                      className="text-xs rounded-lg mt-1"
                    />
                  </div>
                </div>
              </ConfigCard>

              <div className="lg:col-span-3 flex justify-end">
                <Button
                  onClick={() => form && salvar.mutate(form)}
                  disabled={salvar.isPending}
                  className="gap-2 bg-primary text-primary-foreground font-bold shadow-sm"
                >
                  {salvar.isPending ? (
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
