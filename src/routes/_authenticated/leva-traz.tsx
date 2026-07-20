import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Truck, MapPin, Phone, MessageCircle, Navigation, PawPrint, Clock,
  DollarSign, User as UserIcon, AlertTriangle, CheckCircle2, CalendarDays,
} from "lucide-react";
import { format, addDays, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMyProfile } from "@/hooks/use-my-profile";

type LTStatus =
  | "aguardando_responsavel" | "agendado" | "a_caminho_busca" | "pet_coletado"
  | "chegou_spa" | "aguardando_entrega" | "a_caminho_entrega" | "pet_entregue"
  | "cancelado" | "nao_realizado";

const STATUS_META: Record<LTStatus, { label: string; color: string }> = {
  aguardando_responsavel: { label: "Aguardando responsável", color: "bg-rose-500/10 text-rose-700 border-rose-200" },
  agendado:               { label: "Agendado", color: "bg-primary/10 text-primary border-primary/20" },
  a_caminho_busca:        { label: "A caminho da busca", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  pet_coletado:           { label: "Pet coletado", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  chegou_spa:             { label: "Chegou ao spa", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  aguardando_entrega:     { label: "Aguardando entrega", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  a_caminho_entrega:      { label: "A caminho da entrega", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  pet_entregue:           { label: "Pet entregue", color: "bg-muted text-muted-foreground" },
  cancelado:              { label: "Cancelado", color: "bg-rose-500/10 text-rose-700 border-rose-200" },
  nao_realizado:          { label: "Não realizado", color: "bg-rose-500/10 text-rose-700 border-rose-200" },
};

const NEXT_STATUS: Record<LTStatus, LTStatus[]> = {
  aguardando_responsavel: ["agendado", "cancelado"],
  agendado:               ["a_caminho_busca", "a_caminho_entrega", "cancelado"],
  a_caminho_busca:        ["pet_coletado", "nao_realizado"],
  pet_coletado:           ["chegou_spa"],
  chegou_spa:             ["aguardando_entrega"],
  aguardando_entrega:     ["a_caminho_entrega"],
  a_caminho_entrega:      ["pet_entregue", "nao_realizado"],
  pet_entregue:           [],
  cancelado:              [],
  nao_realizado:          [],
};

type Endereco = {
  rua?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; estado?: string; cep?: string; referencia?: string;
};

type Tarefa = {
  id: string;
  agendamento_id: string;
  cliente_id: string;
  pet_id: string;
  tipo: "busca" | "entrega";
  data: string;
  hora_prevista: string;
  responsavel_id: string | null;
  status: LTStatus;
  endereco: Endereco;
  telefone: string | null;
  observacoes: string | null;
  alergias_snapshot: string | null;
  temperamento_snapshot: string | null;
  valor_rateado: number | null;
  cliente: { nome: string; whatsapp: string | null; telefone: string | null; vip: boolean | null } | null;
  pet: { nome: string; foto_url: string | null } | null;
};

function enderecoStr(e: Endereco | null | undefined) {
  if (!e) return "";
  return [
    [e.rua, e.numero].filter(Boolean).join(", "),
    e.complemento, e.bairro,
    [e.cidade, e.estado].filter(Boolean).join(" - "),
    e.cep,
  ].filter(Boolean).join(" · ");
}

function enderecoCurto(e: Endereco | null | undefined) {
  if (!e) return "Endereço não cadastrado";
  const l1 = [e.rua, e.numero].filter(Boolean).join(", ");
  const l2 = [e.bairro, e.cidade].filter(Boolean).join(" · ");
  return [l1, l2].filter(Boolean).join(" — ") || "Endereço não cadastrado";
}

function mapsHref(e: Endereco | null | undefined) {
  const q = enderecoStr(e);
  if (!q) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function waHref(fone: string | null | undefined, texto: string) {
  const raw = (fone || "").replace(/\D/g, "");
  if (!raw) return "#";
  const num = raw.startsWith("55") ? raw : `55${raw}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

function isAtrasada(t: Tarefa) {
  if (["pet_entregue", "cancelado", "nao_realizado"].includes(t.status)) return false;
  const alvo = new Date(`${t.data}T${t.hora_prevista}`);
  return alvo.getTime() < Date.now() - 10 * 60 * 1000;
}

function TarefaCard({ tarefa }: { tarefa: Tarefa }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[tarefa.status];
  const proximos = NEXT_STATUS[tarefa.status] || [];
  const atrasada = isAtrasada(tarefa);
  const nomePet = tarefa.pet?.nome ?? "Pet";
  const nomeCli = tarefa.cliente?.nome ?? "Cliente";

  const mudarStatus = useMutation({
    mutationFn: async (novo: LTStatus) => {
      const { error } = await (supabase as any).from("leva_traz_tarefas")
        .update({ status: novo }).eq("id", tarefa.id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("leva_traz_eventos").insert({
        tarefa_id: tarefa.id,
        agendamento_id: tarefa.agendamento_id,
        tipo: "status_atualizado",
        payload: { de: tarefa.status, para: novo },
        user_id: u.user?.id ?? null,
        user_email: u.user?.email ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["leva-traz-tarefas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const texto = tarefa.tipo === "busca"
    ? `Olá, ${nomeCli}! Estou a caminho para buscar o ${nomePet} para o spa. 🐾`
    : `Olá, ${nomeCli}! Estou a caminho para entregar o ${nomePet} pronto e cheiroso. 🐾✨`;

  const confirmarMaps = () => {
    if (window.confirm(`Abrir rota para:\n\n${enderecoStr(tarefa.endereco) || "endereço vazio"}?`)) {
      window.open(mapsHref(tarefa.endereco), "_blank");
    }
  };

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition ${
      atrasada ? "border-rose-300 bg-rose-50/40" : "border-border/60 bg-card"
    } shadow-sm hover:shadow-md`}>
      <div className="flex items-start gap-3">
        {tarefa.pet?.foto_url ? (
          <img src={tarefa.pet.foto_url} alt={nomePet}
            className="h-12 w-12 rounded-full object-cover border" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
            <PawPrint className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={tarefa.tipo === "busca" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-amber-300 bg-amber-50 text-amber-700"}>
              {tarefa.tipo === "busca" ? "Buscar" : "Entregar"}
            </Badge>
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <Clock className="h-3.5 w-3.5" /> {tarefa.hora_prevista?.slice(0, 5)}
            </span>
            {tarefa.cliente?.vip && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">VIP</Badge>
            )}
            {atrasada && (
              <Badge className="bg-rose-500 text-white gap-1">
                <AlertTriangle className="h-3 w-3" /> Atrasada
              </Badge>
            )}
            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
          </div>
          <div className="mt-1 text-sm">
            <span className="font-medium">{nomePet}</span>
            <span className="text-muted-foreground"> · {nomeCli}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{enderecoCurto(tarefa.endereco)}</span>
          </div>
          {Number(tarefa.valor_rateado) > 0 && (
            <div className="mt-0.5 text-xs text-muted-foreground inline-flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {Number(tarefa.valor_rateado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={confirmarMaps}>
          <Navigation className="h-3 w-3 mr-1" /> Rota
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <a href={waHref(tarefa.telefone || tarefa.cliente?.whatsapp || tarefa.cliente?.telefone, texto)}
             target="_blank" rel="noreferrer">
            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
          </a>
        </Button>
        {tarefa.telefone && (
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <a href={`tel:${tarefa.telefone}`}><Phone className="h-3 w-3 mr-1" /> Ligar</a>
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Menos" : "Detalhes"}
        </Button>
        <Button asChild size="sm" variant="ghost" className="h-7 text-xs ml-auto">
          <Link to="/clientes/$id" params={{ id: tarefa.cliente_id }}>Perfil</Link>
        </Button>
      </div>

      {expanded && (
        <div className="rounded-md bg-muted/40 p-2 text-xs space-y-1 border border-border/50">
          <div><strong>Endereço:</strong> {enderecoStr(tarefa.endereco) || "—"}</div>
          {tarefa.endereco?.referencia && <div><strong>Referência:</strong> {tarefa.endereco.referencia}</div>}
          {tarefa.observacoes && <div><strong>Observações:</strong> {tarefa.observacoes}</div>}
          {tarefa.alergias_snapshot && <div className="text-rose-700"><strong>Alergias:</strong> {tarefa.alergias_snapshot}</div>}
          {tarefa.temperamento_snapshot && <div><strong>Temperamento:</strong> {tarefa.temperamento_snapshot}</div>}
        </div>
      )}

      {proximos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
          {proximos.map((n) => (
            <Button key={n} size="sm" variant={n === "cancelado" || n === "nao_realizado" ? "outline" : "default"}
              className="h-7 text-xs"
              disabled={mudarStatus.isPending}
              onClick={() => mudarStatus.mutate(n)}>
              {n === "cancelado" || n === "nao_realizado" ? null : <CheckCircle2 className="h-3 w-3 mr-1" />}
              {STATUS_META[n].label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function LevaTrazPage() {
  const [aba, setAba] = useState<"hoje" | "amanha" | "semana" | "todos">("hoje");
  const [filtroResp, setFiltroResp] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativos");
  const { data: me } = useMyProfile();

  const hoje = new Date();
  const range = useMemo(() => {
    const start = aba === "hoje" ? hoje
      : aba === "amanha" ? addDays(hoje, 1)
      : aba === "semana" ? startOfWeek(hoje, { weekStartsOn: 1 })
      : null;
    const end = aba === "hoje" ? hoje
      : aba === "amanha" ? addDays(hoje, 1)
      : aba === "semana" ? endOfWeek(hoje, { weekStartsOn: 1 })
      : null;
    return { start: start ? format(start, "yyyy-MM-dd") : null, end: end ? format(end, "yyyy-MM-dd") : null };
  }, [aba]);

  const { data: tarefas = [], isLoading } = useQuery<Tarefa[]>({
    queryKey: ["leva-traz-tarefas", range, filtroResp, filtroStatus],
    queryFn: async () => {
      let q = (supabase as any).from("leva_traz_tarefas")
        .select(`id, agendamento_id, cliente_id, pet_id, tipo, data, hora_prevista,
                 responsavel_id, status, endereco, telefone, observacoes,
                 alergias_snapshot, temperamento_snapshot, valor_rateado,
                 cliente:clientes(nome, whatsapp, telefone, vip),
                 pet:pets(nome, foto_url)`)
        .order("data", { ascending: true })
        .order("hora_prevista", { ascending: true });
      if (range.start) q = q.gte("data", range.start);
      if (range.end)   q = q.lte("data", range.end);
      if (filtroResp === "mim") q = q.eq("responsavel_id", me?.id);
      else if (filtroResp === "sem") q = q.is("responsavel_id", null);
      else if (filtroResp !== "todos") q = q.eq("responsavel_id", filtroResp);
      if (filtroStatus === "ativos") {
        q = q.not("status", "in", "(pet_entregue,cancelado,nao_realizado)");
      } else if (filtroStatus !== "todos") {
        q = q.eq("status", filtroStatus);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["lt-responsaveis"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, email").order("nome");
      return data ?? [];
    },
  });

  const totalReceita = tarefas
    .filter((t) => !["cancelado", "nao_realizado"].includes(t.status))
    .reduce((s, t) => s + Number(t.valor_rateado || 0), 0);
  const semResponsavel = tarefas.filter((t) => !t.responsavel_id && t.status !== "cancelado").length;
  const atrasadas = tarefas.filter(isAtrasada).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-semibold">Leva e Traz</h1>
          </div>
          <p className="text-sm text-muted-foreground">Painel operacional integrado ao agendamento</p>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(["hoje", "amanha", "semana", "todos"] as const).map((k) => (
            <button key={k}
              onClick={() => setAba(k)}
              className={`px-3 py-1.5 text-sm ${aba === k ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
              {k === "hoje" ? "Hoje" : k === "amanha" ? "Amanhã" : k === "semana" ? "Semana" : "Todos"}
            </button>
          ))}
        </div>
        <Select value={filtroResp} onValueChange={setFiltroResp}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            <SelectItem value="mim">Só minhas tarefas</SelectItem>
            <SelectItem value="sem">Sem responsável</SelectItem>
            {responsaveis.map((r: any) => (
              <SelectItem key={r.id} value={r.id}>{r.nome || r.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativas (padrão)</SelectItem>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_META) as LTStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Tarefas</div>
          <div className="text-2xl font-semibold mt-1">{tarefas.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Sem responsável</div>
          <div className={`text-2xl font-semibold mt-1 ${semResponsavel > 0 ? "text-rose-600" : ""}`}>{semResponsavel}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Atrasadas</div>
          <div className={`text-2xl font-semibold mt-1 ${atrasadas > 0 ? "text-rose-600" : ""}`}>{atrasadas}</div>
        </CardContent></Card>
        <Card className="border-t-2 border-t-amber-400/60"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Receita</div>
          <div className="text-2xl font-semibold mt-1">
            {totalReceita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-16">Carregando roteiro…</div>
      ) : tarefas.length === 0 ? (
        <Card><CardContent className="py-14 text-center">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="mt-3 font-medium">Nenhuma tarefa para este filtro</p>
          <p className="text-sm text-muted-foreground">
            Marque um agendamento com Leva e Traz para aparecer aqui.
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {tarefas.map((t) => (
            <TarefaCard key={t.id} tarefa={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/leva-traz")({
  component: LevaTrazPage,
});
