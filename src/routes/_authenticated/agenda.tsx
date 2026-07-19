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
  ChevronLeft, ChevronRight, MessageCircle, Send, Play,
} from "lucide-react";
import { useMyProfile, displayName, initials } from "@/hooks/use-my-profile";


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
  const phone = waPhone(row.clientes?.whatsapp);
  if (!phone) {
    toast.error("Cliente sem WhatsApp cadastrado");
    return;
  }
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage(row, signer))}`;
  window.open(url, "_blank", "noopener,noreferrer");
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

function AgendaPage() {
  const search = Route.useSearch();
  const navigateSelf = useNavigate({ from: Route.fullPath });
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
    mutationFn: async (row: any) => {
      // Se já existir atendimento vinculado, reutiliza
      const { data: existing } = await supabase.from("atendimentos")
        .select("id").eq("agendamento_id", row.id).maybeSingle();
      if (existing?.id) return existing.id as string;

      const itens = Array.isArray(row.agendamento_servicos) && row.agendamento_servicos.length > 0
        ? [...row.agendamento_servicos].sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : (row.servicos ? [{
            servico_id: row.servicos.id,
            nome: row.servicos.nome,
            valor_unit: Number(row.servicos.valor ?? row.valor_previsto ?? 0),
            duracao_min: row.servicos.duracao_min ?? null,
          }] : []);
      const servicoSolicitado = itens.map((it: any) => ({
        servico_id: it.servico_id,
        nome: it.nome,
        categoria: null,
        quantidade: 1,
        valor_unit: Number(it.valor_unit ?? 0),
        valor_total: Number(it.valor_unit ?? 0),
      }));

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
        valor_planejado: Number(row.valor_previsto ?? 0),
        valor_executado: 0,
        taxa_leva_traz: Number(row.taxa_leva_traz ?? 0),
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
  const previewStorageKey = `wa-preview:finalizado:${row.id}`;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");

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
  const total = Number(row.valor_previsto ?? 0) + Number(row.taxa_leva_traz ?? 0);

  return (
    <Card className="p-4 hover:shadow-elegant transition">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 items-start">
        <div className="text-center min-w-[64px]">
          <div className="font-display text-2xl font-semibold text-primary leading-none">
            {row.hora ? String(row.hora).slice(0, 5) : "—"}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            {row.duracao_min ?? row.servicos?.duracao_min ?? "—"} min
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] border ${meta.tone}`}>
              {meta.label}
            </span>
            {row.clientes?.vip && <Badge className="badge-gold text-[10px]">VIP</Badge>}
            <span className="font-display font-semibold text-primary truncate">
              {row.servicos?.nome ?? "Serviço"}
            </span>
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
          {row.observacoes && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{row.observacoes}</p>
          )}
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-primary">{brl(total)}</div>
            {Number(row.taxa_leva_traz ?? 0) > 0 && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                inclui leva-e-traz {brl(row.taxa_leva_traz)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Status <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                const phone = waPhone(row.clientes?.whatsapp);
                if (!phone) {
                  toast.error("Cliente sem WhatsApp cadastrado");
                  return;
                }
                const url = `https://wa.me/${phone}?text=${encodeURIComponent(previewText)}`;
                window.open(url, "_blank", "noopener,noreferrer");
                setPreviewOpen(false);
              }}
            >
              <Send className="h-4 w-4" /> Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Novo agendamento ----------

const novoSchema = z.object({
  cliente_id: z.string().uuid("Selecione um cliente"),
  pet_id: z.string().uuid("Selecione um pet"),
  servico_id: z.string().uuid("Selecione um serviço"),
  data: z.string().min(1, "Informe a data"),
  hora: z.string().min(1, "Informe a hora"),
  duracao_min: z.number().int().positive().nullable(),
  valor_previsto: z.number().nonnegative(),
  taxa_leva_traz: z.number().nonnegative(),
  status: z.enum(["agendado","confirmado","aguardando","em_atendimento","finalizado","cancelado","nao_compareceu"]),
  observacoes: z.string().max(1000).optional().or(z.literal("")),
});

function NovoAgendamentoDialog({
  open, onOpenChange, defaultDate, defaultClienteId, defaultPetId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string;
  defaultClienteId?: string; defaultPetId?: string;
}) {
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState<string>("");
  const [petId, setPetId] = useState<string>("");
  const [servicoId, setServicoId] = useState<string>("");
  const [data, setData] = useState(defaultDate);
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [taxa, setTaxa] = useState<string>("0");
  const [status, setStatus] = useState<Status>("agendado");
  const [obs, setObs] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");

  // reset ao abrir
  useMemoReset(open, () => {
    setClienteId(defaultClienteId ?? ""); setPetId(defaultPetId ?? ""); setServicoId("");
    setData(defaultDate); setHora("09:00");
    setDuracao(""); setValor(""); setTaxa("0");
    setStatus("agendado"); setObs(""); setClienteSearch("");
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
      // Garante que o cliente pré-selecionado apareça na lista
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

  // Ao escolher serviço, preencher valor/duração se vazios
  function onSelectServico(id: string) {
    setServicoId(id);
    const s = servicos?.find((x) => x.id === id);
    if (s) {
      if (!valor) setValor(String(s.valor ?? ""));
      if (!duracao) setDuracao(String(s.duracao_min ?? ""));
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = novoSchema.parse({
        cliente_id: clienteId,
        pet_id: petId,
        servico_id: servicoId,
        data, hora,
        duracao_min: duracao ? Number(duracao) : null,
        valor_previsto: valor ? Number(valor) : 0,
        taxa_leva_traz: taxa ? Number(taxa) : 0,
        status,
        observacoes: obs,
      });
      const { error } = await supabase.from("agendamentos").insert({
        cliente_id: parsed.cliente_id,
        pet_id: parsed.pet_id,
        servico_id: parsed.servico_id,
        data: parsed.data,
        hora: parsed.hora,
        duracao_min: parsed.duracao_min ?? undefined,
        valor_previsto: parsed.valor_previsto,
        taxa_leva_traz: parsed.taxa_leva_traz,
        status: parsed.status,
        observacoes: parsed.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado");
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.issues?.[0]?.message ?? e?.message ?? "Erro ao salvar";
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Novo agendamento</DialogTitle>
          <DialogDescription>
            Vincule cliente, pet e serviço. O valor e a duração podem ser ajustados.
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

          <div className="sm:col-span-2">
            <Label>Serviço *</Label>
            <Select value={servicoId || undefined} onValueChange={onSelectServico}>
              <SelectTrigger><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
              <SelectContent>
                {(servicos ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} {s.valor != null ? `· ${brl(Number(s.valor))}` : ""}
                    {s.duracao_min ? ` · ${s.duracao_min}min` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Hora *</Label>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>

          <div>
            <Label>Duração (min)</Label>
            <Input type="number" min={0} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
          </div>
          <div>
            <Label>Valor previsto (R$)</Label>
            <Input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>

          <div>
            <Label>Taxa leva-e-traz (R$)</Label>
            <Input type="number" min={0} step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
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
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// hook auxiliar: executa reset toda vez que `key` muda para true
function useMemoReset(key: boolean, fn: () => void) {
  useMemo(() => { if (key) fn(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
