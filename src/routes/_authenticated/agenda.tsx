import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { z } from "zod";
import {
  Calendar as CalendarIcon, Plus, Clock, User, PawPrint, MoreHorizontal,
  ChevronLeft, ChevronRight, MessageCircle, Send, Play, Pencil, Trash2, LogIn,
} from "lucide-react";
import { useMyProfile, displayName, initials } from "@/hooks/use-my-profile";
import { WhatsAppComposer, useWhatsAppComposer, openWhatsAppComposerGlobal } from "@/components/whatsapp-composer";


// ---------- WhatsApp helpers ----------

function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D+/g, "");
}
function waPhone(v: string | null | undefined) {
  const d = onlyDigits(v);
  if (!d) return "";
  // Adiciona DDI 55 (Brasil) se ausente
  if (d.length <= 11) return `55${d}`;
  return d;
}
function fmtDataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function waMessage(row: any, signer?: { name: string; initials: string }): string {
  const nomeCliente = row.clientes?.nome?.split(" ")[0] ?? "";
  const pet = row.pets?.nome ?? "seu pet";
  const servico = row.servicos?.nome ?? "atendimento";
  const hora = row.hora ? String(row.hora).slice(0, 5) : "";
  const data = row.data ? fmtDataBR(row.data) : "";
  const total = Number(row.valor_previsto ?? 0) + Number(row.taxa_leva_traz ?? 0);
  const valor = total > 0
    ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "";

  const signature = signer?.name
    ? `\n\nAtenciosamente,\n*${signer.name}* (${signer.initials})\nSpa de Pet Tia Jéssica`
    : "";

  switch (row.status) {
    case "agendado":
      return (
        `Olá${nomeCliente ? `, ${nomeCliente}` : ""}! 🐾\n\n` +
        `Aqui é do *Spa de Pet Tia Jéssica*. Confirmando o agendamento de *${pet}*:\n\n` +
        `• Serviço: ${servico}\n` +
        `• Data: ${data}\n` +
        `• Horário: ${hora}\n` +
        (valor ? `• Valor previsto: ${valor}\n` : "") +
        `\nPodemos confirmar sua presença? 💚` +
        signature
      );
    case "confirmado":
      return (
        `Oi${nomeCliente ? `, ${nomeCliente}` : ""}! ✨\n\n` +
        `Passando para *lembrar* do atendimento de *${pet}* no *Spa de Pet Tia Jéssica*:\n\n` +
        `• Serviço: ${servico}\n` +
        `• Data: ${data}\n` +
        `• Horário: ${hora}\n\n` +
        `Estamos ansiosas para receber vocês! 🐶💚` +
        signature
      );
    case "aguardando":
      return (
        `Oi${nomeCliente ? `, ${nomeCliente}` : ""}! 🕒\n\n` +
        `Estamos *aguardando a chegada* de *${pet}* para o ${servico} das ${hora}.\n` +
        `Está tudo certo? Qualquer imprevisto, é só nos avisar por aqui. 💚` +
        signature
      );
    case "finalizado":
      return (
        `Oi${nomeCliente ? `, ${nomeCliente}` : ""}! 💚\n\n` +
        `O atendimento de *${pet}* (${servico}) foi *finalizado com carinho* aqui no *Spa de Pet Tia Jéssica*.\n` +
        (valor ? `• Total: ${valor}\n` : "") +
        `\nVocê já pode buscá-lo(a) — e qualquer dúvida sobre o cuidado em casa é só chamar por aqui. 🐾` +
        signature
      );
    default:
      return (
        `Olá${nomeCliente ? `, ${nomeCliente}` : ""}! Sobre o atendimento de ${pet} em ${data} às ${hora}.` +
        signature
      );
  }
}
function openWhatsApp(row: any, signer?: { name: string; initials: string }) {
  const raw = row.clientes?.whatsapp;
  if (!raw) {
    toast.error("Cliente sem WhatsApp cadastrado");
    return;
  }
  openWhatsAppComposerGlobal({
    tipo: (row.status === "aguardando" || row.status === "em_atendimento") ? "aviso_atraso" : "confirmacao_agendamento",
    destinatario: row.clientes?.nome ?? "",
    telefone: raw,
    mensagem: waMessage(row, signer),
    motivo: `Agenda — ${row.status}`,
    cliente_id: row.cliente_id ?? null,
  });
}




export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
  validateSearch: (search: Record<string, unknown>) => ({
    cliente: typeof search.cliente === "string" ? search.cliente : undefined,
    pet: typeof search.pet === "string" ? search.pet : undefined,
  }),
});

type Status =
  | "agendado"
  | "confirmado"
  | "aguardando"
  | "em_atendimento"
  | "finalizado"
  | "cancelado"
  | "nao_compareceu";

const STATUS: { value: Status; label: string; tone: string }[] = [
  { value: "agendado",       label: "Agendado",         tone: "bg-muted text-foreground border" },
  { value: "confirmado",     label: "Confirmado",       tone: "bg-primary/10 text-primary border-primary/30" },
  { value: "aguardando",     label: "Aguardando",       tone: "bg-gold/15 text-gold-foreground border-gold/40" },
  { value: "em_atendimento", label: "Em atendimento",   tone: "bg-gold/25 text-primary border-gold/60 font-semibold" },
  { value: "finalizado",     label: "Finalizado",       tone: "bg-success/15 text-success border-success/40" },
  { value: "cancelado",      label: "Cancelado",        tone: "bg-muted text-muted-foreground line-through border" },
  { value: "nao_compareceu", label: "Não compareceu",   tone: "bg-destructive/10 text-destructive border-destructive/30" },
];

const statusMeta = (s: string) => STATUS.find((x) => x.value === s) ?? STATUS[0];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtDateLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}
const brl = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const HORARIOS_AGENDA = Array.from({ length: ((20 - 7) * 4) + 1 }, (_, i) => {
  const totalMinutos = (7 * 60) + (i * 15);
  const h = String(Math.floor(totalMinutos / 60)).padStart(2, "0");
  const m = String(totalMinutos % 60).padStart(2, "0");
  return `${h}:${m}`;
});

function normalizarHora(v: string | null | undefined) {
  const hora = String(v ?? "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(hora) ? hora : "09:00";
}

function TimeField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  const normalized = normalizarHora(value);
  const options = HORARIOS_AGENDA.includes(normalized)
    ? HORARIOS_AGENDA
    : [...HORARIOS_AGENDA, normalized].sort();

  return (
    <Select value={normalized} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10 bg-background">
        <SelectValue placeholder="Selecionar hora" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((h) => (
          <SelectItem key={h} value={h}>{h}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AgendaPage() {
  const search = Route.useSearch();
  const navigateSelf = useNavigate({ from: Route.fullPath });
  const composer = useWhatsAppComposer();
  const [date, setDate] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<"todos" | Status>("todos");
  const [openNew, setOpenNew] = useState(false);
  const [prefill, setPrefill] = useState<{ cliente?: string; pet?: string }>({});

  // Abrir dialog automaticamente quando vier ?cliente=&pet= na URL
  // Valida existência e vínculo pet→cliente antes de abrir.
  useEffect(() => {
    const cli = search.cliente;
    const pet = search.pet;
    if (!cli && !pet) return;

    let cancelled = false;
    (async () => {
      try {
        let clienteOk = true;
        if (cli) {
          const { data, error } = await supabase
            .from("clientes").select("id").eq("id", cli).maybeSingle();
          if (error) throw error;
          clienteOk = !!data;
          if (!clienteOk) {
            toast.error("Cliente não encontrado", {
              description: "O link aponta para um cliente que não existe mais.",
            });
          }
        }

        let petOk = true;
        let petClienteId: string | null = null;
        if (pet) {
          const { data, error } = await supabase
            .from("pets").select("id, cliente_id").eq("id", pet).maybeSingle();
          if (error) throw error;
          if (!data) {
            petOk = false;
            toast.error("Pet não encontrado", {
              description: "O link aponta para um pet que não existe mais.",
            });
          } else {
            petClienteId = data.cliente_id;
            if (cli && clienteOk && petClienteId !== cli) {
              petOk = false;
              toast.error("Pet não pertence a este cliente", {
                description: "O vínculo foi alterado. Selecione novamente.",
              });
            }
          }
        }

        if (cancelled) return;

        const nextPrefill: { cliente?: string; pet?: string } = {};
        if (cli && clienteOk) nextPrefill.cliente = cli;
        if (pet && petOk) nextPrefill.pet = pet;
        if (!nextPrefill.cliente && petOk && petClienteId) {
          nextPrefill.cliente = petClienteId;
        }

        setPrefill(nextPrefill);
        setOpenNew(true);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Tente novamente.";
        toast.error("Não foi possível validar o link", { description: msg });
      } finally {
        if (!cancelled) {
          navigateSelf({ search: {}, replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.cliente, search.pet]);
  const qc = useQueryClient();
  const { data: profile } = useMyProfile();
  const signer = { name: displayName(profile), initials: initials(profile) };



  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["agendamentos", date, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("agendamentos")
        .select(`
          id, data, hora, duracao_min, valor_previsto, taxa_leva_traz, observacoes, status,
          clientes(id, nome, whatsapp, vip),
          pets(id, nome, raca, porte),
          servicos(id, nome, valor, duracao_min),
          agendamento_servicos(id, servico_id, nome, valor_unit, duracao_min, ordem)
        `)
        .eq("data", date)
        .order("hora", { ascending: true });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    (agendamentos ?? []).forEach((a: any) => {
      map[a.status] = (map[a.status] ?? 0) + 1;
    });
    return map;
  }, [agendamentos]);

  const totalPrevisto = useMemo(
    () => (agendamentos ?? []).reduce(
      (s: number, a: any) => s + Number(a.valor_previsto ?? 0) + Number(a.taxa_leva_traz ?? 0),
      0,
    ),
    [agendamentos],
  );

  const navigate = useNavigate();
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const iniciarAtendimentoMut = useMutation({
    mutationFn: async (rowIn: any) => {
      // Se já existir atendimento vinculado, reutiliza
      const { data: existing } = await supabase.from("atendimentos")
        .select("id").eq("agendamento_id", rowIn.id).maybeSingle();
      if (existing?.id) return existing.id as string;

      // Busca versão fresca do agendamento e seus itens (evita usar cache desatualizado
      // após a edição de serviços)
      const { data: fresh, error: errFresh } = await supabase
        .from("agendamentos")
        .select(`
          id, cliente_id, pet_id, profissional_id, valor_previsto, taxa_leva_traz, observacoes,
          servicos(id, nome, valor, duracao_min),
          agendamento_servicos(id, servico_id, nome, valor_unit, duracao_min, ordem)
        `)
        .eq("id", rowIn.id)
        .single();
      if (errFresh) throw errFresh;
      const row: any = { ...rowIn, ...fresh };

      const itens = Array.isArray(row.agendamento_servicos) && row.agendamento_servicos.length > 0
        ? [...row.agendamento_servicos].sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : (row.servicos ? [{
            servico_id: row.servicos.id,
            nome: row.servicos.nome,
            valor_unit: Number(row.servicos.valor ?? row.valor_previsto ?? 0),
            duracao_min: row.servicos.duracao_min ?? null,
          }] : []);

      if (itens.length === 0) {
        throw new Error("Este agendamento não possui serviços. Edite os serviços antes de iniciar.");
      }

      const servicoSolicitado = itens.map((it: any) => ({
        servico_id: it.servico_id,
        nome: it.nome,
        categoria: null,
        quantidade: 1,
        valor_unit: Number(it.valor_unit ?? 0),
        valor_total: Number(it.valor_unit ?? 0),
        duracao_min: it.duracao_min ?? null,
      }));

      // Totais calculados a partir dos itens editados (fonte da verdade)
      const totalItens = servicoSolicitado.reduce((s, it) => s + Number(it.valor_total ?? 0), 0);
      const totalDuracao = itens.reduce((s: number, it: any) => s + Number(it.duracao_min ?? 0), 0);
      const taxa = Number(row.taxa_leva_traz ?? 0);
      const valorPlanejado = Number((totalItens + taxa).toFixed(2));

      // Sincroniza valor_previsto do agendamento se estiver divergente dos itens
      if (Math.abs(Number(row.valor_previsto ?? 0) - totalItens) > 0.001) {
        await supabase.from("agendamentos")
          .update({ valor_previsto: totalItens, duracao_min: totalDuracao > 0 ? totalDuracao : undefined })
          .eq("id", row.id);
      }

      const { data: novo, error } = await supabase.from("atendimentos").insert({
        agendamento_id: row.id,
        cliente_id: row.clientes?.id ?? row.cliente_id,
        pet_id: row.pets?.id ?? row.pet_id,
        profissional_id: row.profissional_id ?? null,
        data_inicio: new Date().toISOString(),
        servicos_solicitados: servicoSolicitado as any,
        servicos_planejados: servicoSolicitado as any,
        servicos_executados: [] as any,
        servicos_extras: [] as any,
        valor_planejado: valorPlanejado,
        valor_executado: 0,
        taxa_leva_traz: taxa,
        observacoes_checkin: row.observacoes ?? null,
        etapa_atual: 1,
        etapas_status: {} as any,
        finalizado: false,
      } as any).select("id").single();
      if (error) throw error;

      await supabase.from("agendamentos")
        .update({ status: "em_atendimento" })
        .eq("id", row.id);

      return novo.id as string;
    },

    onSuccess: (atendId) => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      navigate({ to: "/atendimentos/$atendId", params: { atendId } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao iniciar atendimento"),
  });

  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return agendamentos ?? [];
    return (agendamentos ?? []).filter((a: any) => {
      const bag = [
        a.clientes?.nome, a.pets?.nome, a.servicos?.nome,
        a.clientes?.whatsapp, a.pets?.raca, a.pets?.porte,
      ].filter(Boolean).join(" ").toLowerCase();
      return bag.includes(q);
    });
  }, [agendamentos, busca]);

  const proximo = useMemo(() => {
    const pend = (agendamentos ?? []).filter((a: any) =>
      !["finalizado","cancelado","nao_compareceu"].includes(a.status),
    );
    return pend[0];
  }, [agendamentos]);

  return (
    <PageShell>
      {/* Topo: busca + Novo Agendamento */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="relative">
          <Input
            placeholder="Buscar cliente, pet, serviço…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-12 rounded-full bg-card border-border/60 pl-11 shadow-sm"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <Button
          onClick={() => setOpenNew(true)}
          className="h-12 rounded-full gap-2 px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-elegant"
        >
          <Plus className="h-4 w-4" /> Novo Agendamento
        </Button>
      </div>

      <PageHeader
        title="Agenda"
        description={fmtDateLong(date)}
      />


      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        {/* Coluna principal */}
        <div className="min-w-0">
          {/* Barra de data */}
          <Card className="p-3 mb-4 rounded-2xl border-border/60 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} aria-label="Dia anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative">
                <CalendarIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-9 w-[180px]" />
              </div>
              <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))} aria-label="Próximo dia">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => setDate(todayISO())}>Hoje</Button>
            </div>
          </Card>

          {/* Filtros por status */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setStatusFilter("todos")}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                statusFilter === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
              }`}
            >
              Todos {agendamentos ? `(${agendamentos.length})` : ""}
            </button>
            {STATUS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${
                  statusFilter === s.value ? "ring-2 ring-primary/40 " : "hover:bg-accent "
                }${s.tone}`}
              >
                {s.label} {counts[s.value] ? `(${counts[s.value]})` : ""}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !filtrados || filtrados.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title={busca ? "Nenhum resultado para a busca" : "Nenhum agendamento neste dia"}
              description={busca ? "Tente outro termo ou limpe a busca." : "Clique em Novo Agendamento para começar."}
              action={<Button onClick={() => setOpenNew(true)} className="gap-2 rounded-full"><Plus className="h-4 w-4"/>Novo Agendamento</Button>}
            />
          ) : (
            <div className="grid gap-3">
              {filtrados.map((a: any) => (
                <AgendamentoRow
                  key={a.id}
                  row={a}
                  onChangeStatus={(status) => updateStatus.mutate({ id: a.id, status })}
                  onIniciar={() => iniciarAtendimentoMut.mutate(a)}
                  iniciando={iniciarAtendimentoMut.isPending}
                  signer={signer}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar resumo do dia */}
        <aside className="md:sticky md:top-4 space-y-4">
          <Card className="p-5 rounded-2xl border-border/60 shadow-sm bg-card">
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold text-primary">Resumo do dia</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Agendamentos</span>
                <span className="font-semibold">{agendamentos?.length ?? 0}</span>
              </div>
              <div className="flex justify-between items-baseline pb-3 border-b border-border/60">
                <span className="text-muted-foreground">Faturamento previsto</span>
                <span className="font-display text-primary font-semibold">{brl(totalPrevisto)}</span>
              </div>

              <div className="space-y-2 pt-1">
                {STATUS.filter((s) => counts[s.value]).map((s) => (
                  <div key={s.value} className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${s.tone}`}>
                      {s.label}
                    </span>
                    <span className="text-sm font-medium tabular-nums">{counts[s.value]}</span>
                  </div>
                ))}
                {Object.keys(counts).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sem agendamentos ainda.</p>
                )}
              </div>
            </div>
          </Card>

          {proximo && (
            <Card className="p-5 rounded-2xl border-border/60 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-semibold text-primary">Próximo atendimento</h3>
              </div>
              <div className="font-display text-3xl font-semibold text-primary leading-none">
                {proximo.hora ? String(proximo.hora).slice(0, 5) : "—"}
              </div>
              <div className="mt-2 text-sm">
                <div className="font-medium truncate">{proximo.pets?.nome ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {proximo.clientes?.nome ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-1">
                  {proximo.servicos?.nome ?? "—"}
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>

      <NovoAgendamentoDialog
        open={openNew}
        onOpenChange={(v) => { setOpenNew(v); if (!v) setPrefill({}); }}
        defaultDate={date}
        defaultClienteId={prefill.cliente}
        defaultPetId={prefill.pet}
      />
      <WhatsAppComposer
        open={composer.state.open}
        onOpenChange={composer.setOpen}
        payload={composer.state.payload}
      />
    </PageShell>
  );
}

function AgendamentoRow({
  row,
  onChangeStatus,
  onIniciar,
  iniciando,
  signer,
}: {
  row: any;
  onChangeStatus: (s: Status) => void;
  onIniciar: () => void;
  iniciando: boolean;
  signer: { name: string; initials: string };
}) {
  const qc = useQueryClient();
  const previewStorageKey = `wa-preview:finalizado:${row.id}`;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [editServicosOpen, setEditServicosOpen] = useState(false);
  const [reagendarOpen, setReagendarOpen] = useState(false);
  const [novaData, setNovaData] = useState<string>(row.data ?? "");
  const [novaHora, setNovaHora] = useState<string>(normalizarHora(row.hora));
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState("");
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);

  const podeEditarServicos = ["agendado", "confirmado", "aguardando"].includes(row.status);
  const podeReagendar = ["agendado", "confirmado", "aguardando"].includes(row.status);
  const podeCancelar = !["cancelado", "finalizado"].includes(row.status);
  const podeCheckIn = ["agendado", "confirmado"].includes(row.status);

  const reagendarMut = useMutation({
    mutationFn: async () => {
      if (!novaData || !novaHora) throw new Error("Informe data e hora");
      const { error } = await supabase
        .from("agendamentos")
        .update({ data: novaData, hora: novaHora, status: "agendado" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Agendamento reagendado");
      setReagendarOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reagendar"),
  });

  const cancelarMut = useMutation({
    mutationFn: async () => {
      const obsAntes: string = row.observacoes ?? "";
      const stamp = new Date().toLocaleString("pt-BR");
      const nota = motivoCancel.trim()
        ? `${obsAntes ? obsAntes + "\n" : ""}[Cancelado em ${stamp}] ${motivoCancel.trim()}`
        : obsAntes || null;
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelado", observacoes: nota })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Agendamento cancelado");
      setCancelarOpen(false);
      setMotivoCancel("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const excluirMut = useMutation({
    mutationFn: async () => {
      // Remove serviços vinculados (caso não haja cascade)
      await supabase.from("agendamento_servicos").delete().eq("agendamento_id", row.id);
      const { error } = await supabase.from("agendamentos").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Agendamento excluído");
      setExcluirOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const openFinalizadoPreview = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(previewStorageKey); } catch {}
    setPreviewText(saved ?? waMessage(row, signer));
    setPreviewOpen(true);
  };

  const updatePreviewText = (v: string) => {
    setPreviewText(v);
    try { localStorage.setItem(previewStorageKey, v); } catch {}
  };

  const resetPreviewText = () => {
    const def = waMessage(row, signer);
    setPreviewText(def);
    try { localStorage.removeItem(previewStorageKey); } catch {}
  };

  const meta = statusMeta(row.status);

  // Combina serviços da tabela N:N (preferida) ou cai no `servicos` (retrocompat)
  const itensServicos: Array<{ nome: string; valor_unit: number; duracao_min: number | null }> = useMemo(() => {
    const arr = Array.isArray(row.agendamento_servicos) ? row.agendamento_servicos : [];
    if (arr.length > 0) {
      return [...arr]
        .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .map((it: any) => ({
          nome: it.nome,
          valor_unit: Number(it.valor_unit ?? 0),
          duracao_min: it.duracao_min ?? null,
        }));
    }
    if (row.servicos) {
      return [{
        nome: row.servicos.nome,
        valor_unit: Number(row.servicos.valor ?? row.valor_previsto ?? 0),
        duracao_min: row.servicos.duracao_min ?? row.duracao_min ?? null,
      }];
    }
    return [];
  }, [row]);

  const totalItens = itensServicos.length;
  const valorServicos = itensServicos.reduce((s, it) => s + it.valor_unit, 0);
  // Se há itens na N:N usa a soma, senão respeita valor_previsto salvo
  const valorPrevisto = totalItens > 1 || (Array.isArray(row.agendamento_servicos) && row.agendamento_servicos.length > 0)
    ? valorServicos
    : Number(row.valor_previsto ?? valorServicos);
  const total = valorPrevisto + Number(row.taxa_leva_traz ?? 0);
  const duracaoTotal = itensServicos.reduce((s, it) => s + Number(it.duracao_min ?? 0), 0)
    || Number(row.duracao_min ?? row.servicos?.duracao_min ?? 0);

  // Label combinado: "Banho + Tosa +1"
  const servicosLabel = (() => {
    if (totalItens === 0) return "Serviço";
    const nomes = itensServicos.map((it) => it.nome);
    if (nomes.length === 1) return nomes[0];
    if (nomes.length === 2) return `${nomes[0]} + ${nomes[1]}`;
    return `${nomes[0]} + ${nomes[1]} +${nomes.length - 2}`;
  })();

  return (
    <Card className="p-4 hover:shadow-elegant transition">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 items-start">
        <div className="text-center min-w-[64px]">
          <div className="font-display text-2xl font-semibold text-primary leading-none">
            {row.hora ? String(row.hora).slice(0, 5) : "—"}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            {duracaoTotal || "—"} min
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] border ${meta.tone}`}>
              {meta.label}
            </span>
            {row.clientes?.vip && <Badge className="badge-gold text-[10px]">VIP</Badge>}
            <span
              className="font-display font-semibold text-primary truncate"
              title={itensServicos.map((it) => it.nome).join(" + ")}
            >
              {servicosLabel}
            </span>
            {totalItens > 1 && (
              <Badge variant="secondary" className="text-[10px]">
                {totalItens} serviços
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 min-w-0">
              <PawPrint className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {row.pets?.nome ?? "—"}
                {row.pets?.porte ? ` · ${row.pets.porte}` : ""}
                {row.pets?.raca ? ` · ${row.pets.raca}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-1 min-w-0">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{row.clientes?.nome ?? "—"}</span>
            </span>
            {row.clientes?.whatsapp && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                {row.clientes.whatsapp}
              </span>
            )}
          </div>
          {totalItens > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {itensServicos.map((it, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-primary/5 border border-primary/15 text-primary/90"
                  title={it.duracao_min ? `${it.duracao_min} min · ${brl(it.valor_unit)}` : brl(it.valor_unit)}
                >
                  {it.nome}
                </span>
              ))}
            </div>
          )}
          {row.observacoes && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{row.observacoes}</p>
          )}
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-primary">{brl(total)}</div>
            {totalItens > 1 && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {brl(valorServicos)} em serviços
              </div>
            )}
            {Number(row.taxa_leva_traz ?? 0) > 0 && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                inclui leva-e-traz {brl(row.taxa_leva_traz)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {podeEditarServicos && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setEditServicosOpen(true)}
                title="Editar serviços deste agendamento"
              >
                <Pencil className="h-3.5 w-3.5" />
                Serviços
              </Button>
            )}
            {["agendado","confirmado","aguardando","em_atendimento"].includes(row.status) && (
              <Button
                size="sm"
                className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={iniciando}
                onClick={onIniciar}
                title={row.status === "em_atendimento" ? "Retomar atendimento" : "Iniciar atendimento"}
              >
                <Play className="h-3.5 w-3.5" />
                {row.status === "em_atendimento" ? "Retomar" : "Iniciar atendimento"}
              </Button>
            )}
            {(row.status === "agendado" || row.status === "confirmado" || row.status === "aguardando" || row.status === "finalizado") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-success/40 text-success hover:bg-success/10"
                onClick={() => {
                  if (row.status === "finalizado") {
                    openFinalizadoPreview();
                  } else {
                    openWhatsApp(row, signer);
                  }
                }}
                title={
                  row.status === "agendado"
                    ? "Enviar confirmação por WhatsApp"
                    : row.status === "confirmado"
                    ? "Enviar lembrete por WhatsApp"
                    : row.status === "aguardando"
                    ? "Enviar mensagem de aguardando"
                    : "Enviar aviso de encerramento por WhatsApp"
                }
              >
                <Send className="h-3.5 w-3.5" />
                {row.status === "agendado"
                  ? "Confirmar"
                  : row.status === "confirmado"
                  ? "Lembrar"
                  : row.status === "aguardando"
                  ? "Cobrar"
                  : "Avisar encerramento"}
              </Button>

            )}
            {podeCheckIn && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-gold/50 text-gold-foreground hover:bg-gold/10"
                onClick={() => onChangeStatus("aguardando")}
                title="Registrar chegada do pet (check-in)"
              >
                <LogIn className="h-3.5 w-3.5" />
                Check-in
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Ações <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Ações rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditarOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar agendamento…
                </DropdownMenuItem>
                {podeReagendar && (
                  <DropdownMenuItem
                    onClick={() => {
                      setNovaData(row.data ?? "");
                      setNovaHora(normalizarHora(row.hora));
                      setReagendarOpen(true);
                    }}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-2" /> Reagendar…
                  </DropdownMenuItem>
                )}
                {podeCheckIn && (
                  <DropdownMenuItem onClick={() => onChangeStatus("aguardando")}>
                    <LogIn className="h-3.5 w-3.5 mr-2" /> Marcar check-in
                  </DropdownMenuItem>
                )}
                {row.status === "aguardando" && (
                  <DropdownMenuItem onClick={onIniciar} disabled={iniciando}>
                    <Play className="h-3.5 w-3.5 mr-2" /> Iniciar atendimento
                  </DropdownMenuItem>
                )}
                {podeCancelar && (
                  <DropdownMenuItem
                    onClick={() => setCancelarOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancelar agendamento
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setExcluirOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir definitivamente
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
                {STATUS.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    disabled={row.status === s.value}
                    onClick={() => onChangeStatus(s.value)}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prévia do aviso de encerramento</DialogTitle>
            <DialogDescription>
              Revise e ajuste a mensagem antes de abrir o WhatsApp de {row.clientes?.nome ?? "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-[#e5ddd5] p-3">
            <div className="ml-auto max-w-[85%] rounded-lg bg-[#dcf8c6] px-3 py-2 shadow-sm">
              <Textarea
                value={previewText}
                onChange={(e) => updatePreviewText(e.target.value)}
                rows={10}
                className="min-h-[180px] resize-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none focus-visible:ring-0 whitespace-pre-wrap"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={resetPreviewText}
            >
              Restaurar padrão
            </Button>
            <Button
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
              onClick={() => {
                const raw = row.clientes?.whatsapp;
                if (!raw) {
                  toast.error("Cliente sem WhatsApp cadastrado");
                  return;
                }
                openWhatsAppComposerGlobal({
                  tipo: "confirmacao_agendamento",
                  destinatario: row.clientes?.nome ?? "",
                  telefone: raw,
                  mensagem: previewText,
                  motivo: `Agenda — ${row.status}`,
                  cliente_id: row.cliente_id ?? null,
                });
                setPreviewOpen(false);
              }}

            >
              <Send className="h-4 w-4" /> Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditarServicosDialog
        open={editServicosOpen}
        onOpenChange={setEditServicosOpen}
        agendamento={row}
      />

      <NovoAgendamentoDialog
        open={editarOpen}
        onOpenChange={setEditarOpen}
        defaultDate={row.data}
        editId={row.id}
      />


      <Dialog open={reagendarOpen} onOpenChange={setReagendarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
            <DialogDescription>
              {row.pets?.nome ? `${row.pets.nome} · ` : ""}{row.clientes?.nome ?? ""} — escolha a nova data e horário.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nova data</Label>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </div>
            <div>
              <Label>Nova hora</Label>
              <TimeField value={novaHora} onChange={setNovaHora} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O status volta para <strong>Agendado</strong> após reagendar. Envie uma nova confirmação pelo WhatsApp em seguida.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagendarOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => reagendarMut.mutate()}
              disabled={reagendarMut.isPending || !novaData || !novaHora}
            >
              {reagendarMut.isPending ? "Salvando…" : "Confirmar reagendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar o agendamento de{" "}
              <strong>{row.pets?.nome ?? "pet"}</strong> às{" "}
              <strong>{row.hora ? String(row.hora).slice(0, 5) : "—"}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={3}
              value={motivoCancel}
              onChange={(e) => setMotivoCancel(e.target.value)}
              placeholder="Ex.: cliente pediu para remarcar por motivo pessoal"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              O motivo é anexado às observações do agendamento para histórico.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarOpen(false)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => cancelarMut.mutate()}
              disabled={cancelarMut.isPending}
            >
              {cancelarMut.isPending ? "Cancelando…" : "Cancelar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir agendamento</DialogTitle>
            <DialogDescription>
              Esta ação remove permanentemente o agendamento de{" "}
              <strong>{row.pets?.nome ?? "pet"}</strong> em{" "}
              <strong>{row.data}</strong> às{" "}
              <strong>{row.hora ? String(row.hora).slice(0, 5) : "—"}</strong>.
              Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirOpen(false)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => excluirMut.mutate()}
              disabled={excluirMut.isPending}
            >
              {excluirMut.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Novo agendamento ----------

function EnderecoInputs({
  value,
  onChange,
}: {
  value: { rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string; referencia?: string };
  onChange: (v: any) => void;
}) {
  const set = (patch: any) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
      <Input className="col-span-2 sm:col-span-4" placeholder="Rua/Avenida"
        value={value.rua ?? ""} onChange={(e) => set({ rua: e.target.value })} />
      <Input placeholder="Número" value={value.numero ?? ""} onChange={(e) => set({ numero: e.target.value })} />
      <Input placeholder="CEP" value={value.cep ?? ""} onChange={(e) => set({ cep: e.target.value })} />
      <Input className="col-span-2 sm:col-span-3" placeholder="Complemento"
        value={value.complemento ?? ""} onChange={(e) => set({ complemento: e.target.value })} />
      <Input className="col-span-2 sm:col-span-3" placeholder="Bairro"
        value={value.bairro ?? ""} onChange={(e) => set({ bairro: e.target.value })} />
      <Input className="col-span-2 sm:col-span-3" placeholder="Cidade"
        value={value.cidade ?? ""} onChange={(e) => set({ cidade: e.target.value })} />
      <Input placeholder="UF" maxLength={2} value={value.estado ?? ""}
        onChange={(e) => set({ estado: e.target.value.toUpperCase() })} />
      <Input className="col-span-2 sm:col-span-6" placeholder="Ponto de referência"
        value={value.referencia ?? ""} onChange={(e) => set({ referencia: e.target.value })} />
    </div>
  );
}


type ItemServico = {
  servico_id: string;
  nome: string;
  valor_unit: number;
  duracao_min: number | null;
};

const novoSchema = z.object({
  cliente_id: z.string().uuid("Selecione um cliente"),
  pet_id: z.string().uuid("Selecione um pet"),
  itens: z.array(z.object({
    servico_id: z.string().uuid(),
    nome: z.string(),
    valor_unit: z.number().nonnegative(),
    duracao_min: z.number().int().positive().nullable(),
  })).min(1, "Adicione ao menos um serviço"),
  data: z.string().min(1, "Informe a data"),
  hora: z.string().min(1, "Informe a hora"),
  taxa_leva_traz: z.number().nonnegative(),
  status: z.enum(["agendado","confirmado","aguardando","em_atendimento","finalizado","cancelado","nao_compareceu"]),
  observacoes: z.string().max(1000).optional().or(z.literal("")),
});

type LTModalidade = "nao_utilizar" | "somente_buscar" | "somente_entregar" | "buscar_entregar";

type EnderecoLT = {
  rua?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; estado?: string; cep?: string;
  referencia?: string;
};

function NovoAgendamentoDialog({
  open, onOpenChange, defaultDate, defaultClienteId, defaultPetId, editId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string;
  defaultClienteId?: string; defaultPetId?: string;
  editId?: string;
}) {
  const qc = useQueryClient();
  const isEdit = !!editId;
  const [clienteId, setClienteId] = useState<string>("");
  const [petId, setPetId] = useState<string>("");
  const [itens, setItens] = useState<ItemServico[]>([]);
  const [servicoAdd, setServicoAdd] = useState<string>("");
  const [data, setData] = useState(defaultDate);
  const [hora, setHora] = useState("09:00");
  const [taxa, setTaxa] = useState<string>("0");
  const [status, setStatus] = useState<Status>("agendado");
  const [obs, setObs] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");

  // Leva e Traz
  const [ltModalidade, setLtModalidade] = useState<LTModalidade>("nao_utilizar");
  const [ltResponsavel, setLtResponsavel] = useState<string>("");
  const [ltTelefone, setLtTelefone] = useState<string>("");
  const [ltObs, setLtObs] = useState<string>("");
  const [ltIsento, setLtIsento] = useState(false);
  const [ltIsencaoMotivo, setLtIsencaoMotivo] = useState<string>("");
  const [buscaData, setBuscaData] = useState<string>("");
  const [buscaHora, setBuscaHora] = useState<string>("");
  const [entregaData, setEntregaData] = useState<string>("");
  const [entregaHora, setEntregaHora] = useState<string>("");
  const [buscaUsaClienteEnd, setBuscaUsaClienteEnd] = useState(true);
  const [entregaUsaClienteEnd, setEntregaUsaClienteEnd] = useState(true);
  const [buscaEnd, setBuscaEnd] = useState<EnderecoLT>({});
  const [entregaEnd, setEntregaEnd] = useState<EnderecoLT>({});

  // Carrega dados do agendamento existente ao editar
  const { data: editData } = useQuery({
    queryKey: ["agendamento-edit", editId],
    enabled: open && !!editId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*, agendamento_servicos(id, servico_id, nome, valor_unit, duracao_min, ordem)")
        .eq("id", editId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // reset ao abrir (novo) ou quando editData chega (edição)
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      if (!editData) return;
      setClienteId(editData.cliente_id ?? "");
      setPetId(editData.pet_id ?? "");
      const itensRaw = Array.isArray(editData.agendamento_servicos) ? editData.agendamento_servicos : [];
      const itensSorted = [...itensRaw].sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0));
      setItens(itensSorted.map((it: any) => ({
        servico_id: it.servico_id,
        nome: it.nome,
        valor_unit: Number(it.valor_unit ?? 0),
        duracao_min: it.duracao_min ?? null,
      })));
      setServicoAdd("");
      setData(editData.data ?? defaultDate);
      setHora(normalizarHora(editData.hora));
      setTaxa(String(editData.taxa_leva_traz ?? 0));
      setStatus((editData.status ?? "agendado") as Status);
      setObs(editData.observacoes ?? "");
      setClienteSearch("");
      setLtModalidade((editData.leva_traz_modalidade ?? "nao_utilizar") as LTModalidade);
      setLtResponsavel(editData.leva_traz_responsavel_id ?? "");
      setLtTelefone(editData.leva_traz_telefone ?? "");
      setLtObs(editData.leva_traz_obs ?? "");
      setLtIsento(!!editData.leva_traz_isento);
      setLtIsencaoMotivo(editData.leva_traz_isencao_motivo ?? "");
      setBuscaData(editData.busca_data ?? "");
      setBuscaHora(editData.busca_hora ? normalizarHora(editData.busca_hora) : "");
      setEntregaData(editData.entrega_data ?? "");
      setEntregaHora(editData.entrega_hora ? normalizarHora(editData.entrega_hora) : "");
      setBuscaUsaClienteEnd(!editData.busca_endereco);
      setEntregaUsaClienteEnd(!editData.entrega_endereco);
      setBuscaEnd(editData.busca_endereco ?? {});
      setEntregaEnd(editData.entrega_endereco ?? {});
    } else {
      setClienteId(defaultClienteId ?? ""); setPetId(defaultPetId ?? "");
      setItens([]); setServicoAdd("");
      setData(defaultDate); setHora("09:00");
      setTaxa("0");
      setStatus("agendado"); setObs(""); setClienteSearch("");
      setLtModalidade("nao_utilizar");
      setLtResponsavel(""); setLtTelefone(""); setLtObs("");
      setLtIsento(false); setLtIsencaoMotivo("");
      setBuscaData(""); setBuscaHora(""); setEntregaData(""); setEntregaHora("");
      setBuscaUsaClienteEnd(true); setEntregaUsaClienteEnd(true);
      setBuscaEnd({}); setEntregaEnd({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, editData?.id]);


  // Carrega responsáveis (admin + transportador)
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis-transporte"],
    enabled: open,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "transportador", "user"] as any);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [] as { id: string; nome: string; email: string | null }[];
      const { data: profs } = await supabase
        .from("profiles").select("id, nome, email").in("id", ids);
      return (profs ?? []) as { id: string; nome: string; email: string | null }[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select", clienteSearch, defaultClienteId ?? ""],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("clientes").select("id, nome, whatsapp, vip").order("nome").limit(30);
      if (clienteSearch.trim()) {
        const like = `%${clienteSearch.trim()}%`;
        q = q.or(`nome.ilike.${like},whatsapp.ilike.${like},telefone.ilike.${like}`);
      }
      const { data } = await q;
      let rows = data ?? [];
      if (defaultClienteId && !rows.some((c) => c.id === defaultClienteId)) {
        const { data: extra } = await supabase
          .from("clientes")
          .select("id, nome, whatsapp, vip")
          .eq("id", defaultClienteId)
          .maybeSingle();
        if (extra) rows = [extra, ...rows];
      }
      return rows;
    },
  });

  const { data: pets } = useQuery({
    queryKey: ["pets-of-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, nome, raca, porte")
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: servicos } = useQuery({
    queryKey: ["servicos-ativos"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("servicos")
        .select("id, nome, valor, duracao_min, categoria")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  // Totais calculados
  const totalValor = useMemo(
    () => itens.reduce((s, it) => s + Number(it.valor_unit ?? 0), 0),
    [itens],
  );
  const totalDuracao = useMemo(
    () => itens.reduce((s, it) => s + Number(it.duracao_min ?? 0), 0),
    [itens],
  );

  function adicionarServico(id: string) {
    if (!id) return;
    if (itens.some((it) => it.servico_id === id)) {
      toast.info("Este serviço já foi adicionado");
      setServicoAdd("");
      return;
    }
    const s = servicos?.find((x) => x.id === id);
    if (!s) return;
    setItens((prev) => [...prev, {
      servico_id: s.id,
      nome: s.nome,
      valor_unit: Number(s.valor ?? 0),
      duracao_min: s.duracao_min ?? null,
    }]);
    setServicoAdd("");
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function alterarItem(idx: number, patch: Partial<ItemServico>) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = novoSchema.parse({
        cliente_id: clienteId,
        pet_id: petId,
        itens,
        data, hora,
        taxa_leva_traz: taxa ? Number(taxa) : 0,
        status,
        observacoes: obs,
      });

      // Serviço principal = primeiro item (mantém compat com servico_id)
      const principal = parsed.itens[0];

      // Validações LT
      if (ltModalidade !== "nao_utilizar") {
        if (ltIsento && !ltIsencaoMotivo.trim()) {
          throw new Error("Informe a justificativa da isenção do Leva e Traz");
        }
      }
      const valorLT = ltModalidade === "nao_utilizar" ? 0
                    : ltIsento ? 0
                    : Number(taxa || 0);

      const buscaEndFinal = ltModalidade === "somente_buscar" || ltModalidade === "buscar_entregar"
        ? (buscaUsaClienteEnd ? null : buscaEnd)
        : null;
      const entregaEndFinal = ltModalidade === "somente_entregar" || ltModalidade === "buscar_entregar"
        ? (entregaUsaClienteEnd ? null : entregaEnd)
        : null;

      const payload = {
        cliente_id: parsed.cliente_id,
        pet_id: parsed.pet_id,
        servico_id: principal.servico_id,
        data: parsed.data,
        hora: parsed.hora,
        duracao_min: totalDuracao > 0 ? totalDuracao : null,
        valor_previsto: totalValor,
        taxa_leva_traz: valorLT,
        status: parsed.status,
        observacoes: parsed.observacoes || null,
        leva_traz_modalidade: ltModalidade,
        leva_traz_responsavel_id: ltResponsavel || null,
        leva_traz_telefone: ltTelefone || null,
        leva_traz_obs: ltObs || null,
        leva_traz_isento: ltIsento,
        leva_traz_isencao_motivo: ltIsento ? ltIsencaoMotivo : null,
        busca_data: buscaData || null,
        busca_hora: buscaHora || null,
        entrega_data: entregaData || null,
        entrega_hora: entregaHora || null,
        busca_endereco: buscaEndFinal as any,
        entrega_endereco: entregaEndFinal as any,
      };

      let agendamentoId: string;
      if (isEdit && editId) {
        const { error: errUpd } = await supabase
          .from("agendamentos")
          .update(payload as any)
          .eq("id", editId);
        if (errUpd) throw errUpd;
        agendamentoId = editId;
        // Substitui itens vinculados
        const { error: errDel } = await supabase
          .from("agendamento_servicos").delete().eq("agendamento_id", editId);
        if (errDel) throw errDel;
      } else {
        const { data: novo, error } = await supabase
          .from("agendamentos").insert(payload as any).select("id").single();
        if (error) throw error;
        agendamentoId = novo.id;
      }

      // Insere todos os itens (inclusive o principal) para simetria
      const rowsItens = parsed.itens.map((it, i) => ({
        agendamento_id: agendamentoId,
        servico_id: it.servico_id,
        nome: it.nome,
        valor_unit: it.valor_unit,
        duracao_min: it.duracao_min,
        ordem: i,
      }));
      const { error: errItens } = await supabase.from("agendamento_servicos").insert(rowsItens);
      if (errItens) throw errItens;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Agendamento atualizado" : "Agendamento criado");
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["agendamento-edit", editId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.issues?.[0]?.message ?? e?.message ?? "Erro ao salvar";
      toast.error(msg);
    },
  });

  const servicosDisponiveis = (servicos ?? []).filter((s) => !itens.some((it) => it.servico_id === s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Novo agendamento</DialogTitle>
          <DialogDescription>
            Adicione um ou mais serviços — o valor e a duração totais são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Cliente *</Label>
            <Input
              placeholder="Buscar por nome, telefone ou WhatsApp…"
              value={clienteSearch}
              onChange={(e) => setClienteSearch(e.target.value)}
              className="mb-2"
            />
            <Select value={clienteId || undefined} onValueChange={(v) => { setClienteId(v); setPetId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.vip ? "★" : ""} {c.whatsapp ? `· ${c.whatsapp}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Pet *</Label>
            <Select value={petId || undefined} onValueChange={setPetId} disabled={!clienteId}>
              <SelectTrigger>
                <SelectValue placeholder={clienteId ? "Selecionar pet" : "Escolha um cliente primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {(pets ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} {p.porte ? `· ${p.porte}` : ""} {p.raca ? `· ${p.raca}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clienteId && pets && pets.length === 0 && (
              <p className="text-xs text-warning mt-1">Este cliente ainda não tem pets cadastrados.</p>
            )}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>Serviços * <span className="text-muted-foreground text-xs">(um ou mais)</span></Label>
            <div className="flex gap-2">
              <Select value={servicoAdd || undefined} onValueChange={adicionarServico}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={servicosDisponiveis.length ? "Adicionar serviço…" : "Todos os serviços já adicionados"} />
                </SelectTrigger>
                <SelectContent>
                  {servicosDisponiveis.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} {s.valor != null ? `· ${brl(Number(s.valor))}` : ""}
                      {s.duracao_min ? ` · ${s.duracao_min}min` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {itens.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum serviço adicionado ainda.</p>
            ) : (
              <div className="space-y-2 rounded-md border border-border/60 p-2 bg-muted/20">
                {itens.map((it, idx) => (
                  <div key={`${it.servico_id}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_90px_80px_auto] gap-2 items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.nome}</div>
                      {idx === 0 && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</div>}
                    </div>
                    <Input
                      type="number" min={0} step="0.01"
                      value={it.valor_unit}
                      onChange={(e) => alterarItem(idx, { valor_unit: Number(e.target.value || 0) })}
                      aria-label="Valor"
                    />
                    <Input
                      type="number" min={0}
                      value={it.duracao_min ?? ""}
                      onChange={(e) => alterarItem(idx, { duracao_min: e.target.value ? Number(e.target.value) : null })}
                      placeholder="min"
                      aria-label="Duração"
                    />
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => removerItem(idx)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap justify-end gap-4 pt-2 border-t border-border/60 text-sm">
                  <span className="text-muted-foreground">
                    Duração total: <strong className="text-foreground">{totalDuracao} min</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Valor total: <strong className="text-primary">{brl(totalValor)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Hora *</Label>
            <TimeField value={hora} onChange={setHora} />
          </div>

          <div>
            <Label>Status inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Observações do atendimento</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          {/* ---------------- Leva e Traz ---------------- */}
          <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-display text-base font-semibold">Leva e Traz</div>
              {ltModalidade !== "nao_utilizar" && !ltIsento && (
                <div className="text-sm text-muted-foreground">
                  Somado ao total: <strong className="text-primary">{brl(Number(taxa || 0))}</strong>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { v: "nao_utilizar", l: "Não utilizar" },
                { v: "somente_buscar", l: "Somente buscar" },
                { v: "somente_entregar", l: "Somente entregar" },
                { v: "buscar_entregar", l: "Buscar e entregar" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setLtModalidade(o.v as LTModalidade)}
                  className={`rounded-lg border px-3 py-2 text-sm text-left transition ${
                    ltModalidade === o.v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            {ltModalidade !== "nao_utilizar" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label>Valor do Leva e Traz (R$) *</Label>
                  <Input type="number" min={0} step="0.01" value={taxa}
                    disabled={ltIsento}
                    onChange={(e) => setTaxa(e.target.value)} />
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={ltIsento} onChange={(e) => setLtIsento(e.target.checked)} />
                    Isentar valor (exige justificativa)
                  </label>
                </div>
                <div>
                  <Label>Responsável pelo transporte</Label>
                  <Select value={ltResponsavel || undefined} onValueChange={setLtResponsavel}>
                    <SelectTrigger><SelectValue placeholder="Selecionar responsável…" /></SelectTrigger>
                    <SelectContent>
                      {responsaveis.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nome || r.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ltIsento && (
                  <div className="sm:col-span-2">
                    <Label>Justificativa da isenção *</Label>
                    <Textarea rows={2} value={ltIsencaoMotivo} onChange={(e) => setLtIsencaoMotivo(e.target.value)} />
                  </div>
                )}

                {(ltModalidade === "somente_buscar" || ltModalidade === "buscar_entregar") && (
                  <>
                    <div>
                      <Label>Data da busca *</Label>
                      <Input type="date" value={buscaData || data} onChange={(e) => setBuscaData(e.target.value)} />
                    </div>
                    <div>
                      <Label>Horário da busca *</Label>
                      <TimeField value={buscaHora || hora} onChange={setBuscaHora} />
                    </div>
                    <div className="sm:col-span-2 rounded-md border border-border/60 p-3 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Endereço de busca</span>
                        <label className="text-xs flex items-center gap-1 text-muted-foreground">
                          <input type="checkbox" checked={buscaUsaClienteEnd}
                            onChange={(e) => setBuscaUsaClienteEnd(e.target.checked)} />
                          Usar endereço do cliente
                        </label>
                      </div>
                      {!buscaUsaClienteEnd && (
                        <EnderecoInputs value={buscaEnd} onChange={setBuscaEnd} />
                      )}
                    </div>
                  </>
                )}

                {(ltModalidade === "somente_entregar" || ltModalidade === "buscar_entregar") && (
                  <>
                    <div>
                      <Label>Data da entrega *</Label>
                      <Input type="date" value={entregaData || data} onChange={(e) => setEntregaData(e.target.value)} />
                    </div>
                    <div>
                      <Label>Horário previsto da entrega *</Label>
                      <TimeField value={entregaHora || hora} onChange={setEntregaHora} />
                    </div>
                    <div className="sm:col-span-2 rounded-md border border-border/60 p-3 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Endereço de entrega</span>
                        <label className="text-xs flex items-center gap-1 text-muted-foreground">
                          <input type="checkbox" checked={entregaUsaClienteEnd}
                            onChange={(e) => setEntregaUsaClienteEnd(e.target.checked)} />
                          Usar endereço do cliente
                        </label>
                      </div>
                      {!entregaUsaClienteEnd && (
                        <EnderecoInputs value={entregaEnd} onChange={setEntregaEnd} />
                      )}
                    </div>
                  </>
                )}

                <div>
                  <Label>Telefone para contato</Label>
                  <Input value={ltTelefone} onChange={(e) => setLtTelefone(e.target.value)}
                    placeholder="(00) 00000-0000" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações do transporte</Label>
                  <Textarea rows={2} value={ltObs} onChange={(e) => setLtObs(e.target.value)}
                    placeholder="Referência de endereço, orientações, alergias, temperamento durante o transporte…" />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || itens.length === 0}>
            {mutation.isPending ? "Salvando…" : `Criar agendamento${itens.length > 1 ? ` (${itens.length} serviços)` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// hook auxiliar: executa reset toda vez que `key` muda para true
function useMemoReset(key: boolean, fn: () => void) {
  // Precisa ser useEffect: useMemo pode ser re-executado pelo React a qualquer
  // momento (cache descartável), o que reseta o formulário durante a digitação
  // (ex.: campo hora "travado" em 09:00 após o usuário alterar).
  useEffect(() => { if (key) fn(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// ---------- Editar serviços de um agendamento existente ----------

function EditarServicosDialog({
  open,
  onOpenChange,
  agendamento,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agendamento: any;
}) {
  const qc = useQueryClient();
  const [itens, setItens] = useState<ItemServico[]>([]);
  const [servicoAdd, setServicoAdd] = useState<string>("");
  const [taxa, setTaxa] = useState<string>("0");

  // Inicializa itens quando abre
  useMemoReset(open, () => {
    const base = Array.isArray(agendamento?.agendamento_servicos) ? agendamento.agendamento_servicos : [];
    const ordered = base.length > 0
      ? [...base].sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((it: any) => ({
          servico_id: it.servico_id,
          nome: it.nome,
          valor_unit: Number(it.valor_unit ?? 0),
          duracao_min: it.duracao_min ?? null,
        }))
      : agendamento?.servicos
        ? [{
            servico_id: agendamento.servicos.id,
            nome: agendamento.servicos.nome,
            valor_unit: Number(agendamento.servicos.valor ?? agendamento.valor_previsto ?? 0),
            duracao_min: agendamento.servicos.duracao_min ?? agendamento.duracao_min ?? null,
          }]
        : [];
    setItens(ordered);
    setServicoAdd("");
    setTaxa(String(agendamento?.taxa_leva_traz ?? 0));
  });

  const { data: servicos } = useQuery({
    queryKey: ["servicos-ativos"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("servicos")
        .select("id, nome, valor, duracao_min, categoria")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const totalValor = useMemo(() => itens.reduce((s, it) => s + Number(it.valor_unit ?? 0), 0), [itens]);
  const totalDuracao = useMemo(() => itens.reduce((s, it) => s + Number(it.duracao_min ?? 0), 0), [itens]);
  const totalComTaxa = totalValor + Number(taxa || 0);

  function adicionarServico(id: string) {
    if (!id) return;
    if (itens.some((it) => it.servico_id === id)) {
      toast.info("Este serviço já foi adicionado");
      setServicoAdd("");
      return;
    }
    const s = servicos?.find((x) => x.id === id);
    if (!s) return;
    setItens((prev) => [...prev, {
      servico_id: s.id,
      nome: s.nome,
      valor_unit: Number(s.valor ?? 0),
      duracao_min: s.duracao_min ?? null,
    }]);
    setServicoAdd("");
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function alterarItem(idx: number, patch: Partial<ItemServico>) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function moverItem(idx: number, dir: -1 | 1) {
    setItens((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (itens.length === 0) throw new Error("Adicione ao menos um serviço");
      const principal = itens[0];

      // Atualiza o agendamento (serviço principal, totais, taxa)
      const { error: errUp } = await supabase.from("agendamentos").update({
        servico_id: principal.servico_id,
        valor_previsto: totalValor,
        duracao_min: totalDuracao > 0 ? totalDuracao : undefined,
        taxa_leva_traz: Number(taxa || 0),
      }).eq("id", agendamento.id);
      if (errUp) throw errUp;

      // Reseta os itens (delete + insert)
      const { error: errDel } = await supabase
        .from("agendamento_servicos")
        .delete()
        .eq("agendamento_id", agendamento.id);
      if (errDel) throw errDel;

      const rows = itens.map((it, i) => ({
        agendamento_id: agendamento.id,
        servico_id: it.servico_id,
        nome: it.nome,
        valor_unit: it.valor_unit,
        duracao_min: it.duracao_min,
        ordem: i,
      }));
      const { error: errIns } = await supabase.from("agendamento_servicos").insert(rows);
      if (errIns) throw errIns;
    },
    onSuccess: () => {
      toast.success("Serviços atualizados");
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const servicosDisponiveis = (servicos ?? []).filter((s) => !itens.some((it) => it.servico_id === s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Editar serviços do agendamento</DialogTitle>
          <DialogDescription>
            {agendamento?.pets?.nome ? `${agendamento.pets.nome} · ` : ""}
            {agendamento?.clientes?.nome ?? ""}
            {" — "}
            Valor e duração totais são recalculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Adicionar serviço</Label>
            <Select value={servicoAdd || undefined} onValueChange={adicionarServico}>
              <SelectTrigger>
                <SelectValue placeholder={servicosDisponiveis.length ? "Escolher serviço…" : "Todos os serviços já adicionados"} />
              </SelectTrigger>
              <SelectContent>
                {servicosDisponiveis.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} {s.valor != null ? `· ${brl(Number(s.valor))}` : ""}
                    {s.duracao_min ? ` · ${s.duracao_min}min` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum serviço no agendamento.</p>
          ) : (
            <div className="space-y-2 rounded-md border border-border/60 p-2 bg-muted/20">
              {itens.map((it, idx) => (
                <div key={`${it.servico_id}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_100px_80px_auto] gap-2 items-center">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{it.nome}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {idx === 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</span>
                      )}
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-primary disabled:opacity-30"
                        onClick={() => moverItem(idx, -1)}
                        disabled={idx === 0}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-primary disabled:opacity-30"
                        onClick={() => moverItem(idx, 1)}
                        disabled={idx === itens.length - 1}
                        title="Descer"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <Input
                    type="number" min={0} step="0.01"
                    value={it.valor_unit}
                    onChange={(e) => alterarItem(idx, { valor_unit: Number(e.target.value || 0) })}
                    aria-label="Valor"
                  />
                  <Input
                    type="number" min={0}
                    value={it.duracao_min ?? ""}
                    onChange={(e) => alterarItem(idx, { duracao_min: e.target.value ? Number(e.target.value) : null })}
                    placeholder="min"
                    aria-label="Duração"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => removerItem(idx)}
                    className="text-destructive hover:text-destructive"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap justify-end gap-4 pt-2 border-t border-border/60 text-sm">
                <span className="text-muted-foreground">
                  Duração total: <strong className="text-foreground">{totalDuracao} min</strong>
                </span>
                <span className="text-muted-foreground">
                  Serviços: <strong className="text-foreground">{brl(totalValor)}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Taxa leva-e-traz (R$)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-md border border-border/60 bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total previsto</div>
                <div className="font-display text-xl font-semibold text-primary">{brl(totalComTaxa)}</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || itens.length === 0}
          >
            {salvar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
