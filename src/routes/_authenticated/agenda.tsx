import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  ChevronLeft, ChevronRight, MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
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
  const [date, setDate] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<"todos" | Status>("todos");
  const [openNew, setOpenNew] = useState(false);
  const qc = useQueryClient();

  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["agendamentos", date, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("agendamentos")
        .select(`
          id, data, hora, duracao_min, valor_previsto, taxa_leva_traz, observacoes, status,
          clientes(id, nome, whatsapp, vip),
          pets(id, nome, raca, porte),
          servicos(id, nome, valor, duracao_min)
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

  return (
    <PageShell>
      <PageHeader
        title="Agenda"
        description="Fluxo do dia — do agendamento à finalização."
        actions={
          <Button onClick={() => setOpenNew(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        }
      />

      {/* Barra de data */}
      <Card className="p-3 mb-4">
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

          <div className="ml-auto text-sm text-muted-foreground">
            <span className="capitalize">{fmtDateLong(date)}</span>
            <span className="mx-2">·</span>
            <span>{agendamentos?.length ?? 0} agendamento(s)</span>
            <span className="mx-2">·</span>
            <span className="text-primary font-medium">Previsto: {brl(totalPrevisto)}</span>
          </div>
        </div>
      </Card>

      {/* Filtros por status */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter("todos")}
          className={`px-3 py-1.5 rounded-full text-xs border transition ${
            statusFilter === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
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
      ) : !agendamentos || agendamentos.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Nenhum agendamento neste dia"
          description="Clique em Novo agendamento para começar."
          action={<Button onClick={() => setOpenNew(true)} className="gap-2"><Plus className="h-4 w-4"/>Novo agendamento</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {agendamentos.map((a: any) => (
            <AgendamentoRow
              key={a.id}
              row={a}
              onChangeStatus={(status) => updateStatus.mutate({ id: a.id, status })}
            />
          ))}
        </div>
      )}

      <NovoAgendamentoDialog open={openNew} onOpenChange={setOpenNew} defaultDate={date} />
    </PageShell>
  );
}

function AgendamentoRow({
  row,
  onChangeStatus,
}: {
  row: any;
  onChangeStatus: (s: Status) => void;
}) {
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
  open, onOpenChange, defaultDate,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string;
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
    setClienteId(""); setPetId(""); setServicoId("");
    setData(defaultDate); setHora("09:00");
    setDuracao(""); setValor(""); setTaxa("0");
    setStatus("agendado"); setObs(""); setClienteSearch("");
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select", clienteSearch],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("clientes").select("id, nome, whatsapp, vip").order("nome").limit(30);
      if (clienteSearch.trim()) {
        const like = `%${clienteSearch.trim()}%`;
        q = q.or(`nome.ilike.${like},whatsapp.ilike.${like},telefone.ilike.${like}`);
      }
      const { data } = await q;
      return data ?? [];
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
        duracao_min: parsed.duracao_min,
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
