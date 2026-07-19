import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  MapPin,
  Phone,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Navigation,
  PawPrint,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Row = {
  id: string;
  data: string;
  hora: string;
  duracao_min: number | null;
  taxa_leva_traz: number | null;
  observacoes: string | null;
  status: string;
  cliente: {
    id: string;
    nome: string;
    telefone: string | null;
    whatsapp: string | null;
    cep: string | null;
    rua: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    vip: boolean | null;
  } | null;
  pet: { id: string; nome: string; porte_id: string | null } | null;
  servico: { nome: string } | null;
};

function enderecoStr(c: Row["cliente"]) {
  if (!c) return "";
  const parts = [
    [c.rua, c.numero].filter(Boolean).join(", "),
    c.complemento,
    c.bairro,
    [c.cidade, c.estado].filter(Boolean).join(" - "),
    c.cep,
  ].filter(Boolean);
  return parts.join(" · ");
}

function enderecoCurto(c: Row["cliente"]) {
  if (!c) return "Endereço não cadastrado";
  const linha1 = [c.rua, c.numero].filter(Boolean).join(", ");
  const linha2 = [c.bairro, c.cidade].filter(Boolean).join(" · ");
  return [linha1, linha2].filter(Boolean).join(" — ") || "Endereço não cadastrado";
}

function mapsHref(c: Row["cliente"]) {
  const q = enderecoStr(c);
  if (!q) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function waHref(c: Row["cliente"], texto: string) {
  const raw = (c?.whatsapp || c?.telefone || "").replace(/\D/g, "");
  if (!raw) return "#";
  const num = raw.startsWith("55") ? raw : `55${raw}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    aguardando: "Aguardando",
    em_atendimento: "Em atendimento",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
    nao_compareceu: "Não compareceu",
  };
  return m[s] || s;
}

function statusColor(s: string) {
  switch (s) {
    case "confirmado":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
    case "aguardando":
      return "bg-amber-500/10 text-amber-700 border-amber-200";
    case "em_atendimento":
      return "bg-blue-500/10 text-blue-700 border-blue-200";
    case "finalizado":
      return "bg-muted text-muted-foreground";
    case "cancelado":
    case "nao_compareceu":
      return "bg-rose-500/10 text-rose-700 border-rose-200";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

function useOrdem(chave: string, ids: string[]) {
  const storageKey = `leva-traz:ordem:${chave}`;
  const [ordem, setOrdem] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const savedArr: string[] = saved ? JSON.parse(saved) : [];
    // mantém ordem salva + acrescenta novos
    const filtered = savedArr.filter((id) => ids.includes(id));
    const novos = ids.filter((id) => !filtered.includes(id));
    setOrdem([...filtered, ...novos]);
  }, [storageKey, ids.join(",")]);

  const persist = (novaOrdem: string[]) => {
    setOrdem(novaOrdem);
    localStorage.setItem(storageKey, JSON.stringify(novaOrdem));
  };

  const mover = (id: string, dir: -1 | 1) => {
    const idx = ordem.indexOf(id);
    const alvo = idx + dir;
    if (idx < 0 || alvo < 0 || alvo >= ordem.length) return;
    const novo = [...ordem];
    [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
    persist(novo);
  };

  return { ordem, mover };
}

function RotaCard({
  row,
  idx,
  total,
  tipo,
  onSubir,
  onDescer,
}: {
  row: Row;
  idx: number;
  total: number;
  tipo: "coleta" | "entrega";
  onSubir: () => void;
  onDescer: () => void;
}) {
  const nomePet = row.pet?.nome || "Pet";
  const nomeCli = row.cliente?.nome || "Cliente";
  const texto =
    tipo === "coleta"
      ? `Olá, ${nomeCli}! Estou a caminho para buscar o ${nomePet} para o spa. 🐾`
      : `Olá, ${nomeCli}! Estou a caminho para entregar o ${nomePet} pronto e cheiroso. 🐾✨`;

  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col items-center gap-1">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          {idx + 1}
        </div>
        <div className="flex flex-col gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={idx === 0}
            onClick={onSubir}
            aria-label="Subir"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={idx === total - 1}
            onClick={onDescer}
            aria-label="Descer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm truncate">{nomeCli}</span>
          {row.cliente?.vip && (
            <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
              VIP
            </Badge>
          )}
          <Badge variant="outline" className={statusColor(row.status)}>
            {statusLabel(row.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PawPrint className="h-3.5 w-3.5" />
          <span className="truncate">
            {nomePet} · {row.servico?.nome || "Serviço"}
          </span>
        </div>
        <div className="flex items-start gap-1.5 text-xs">
          <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <span className="text-foreground/80">{enderecoCurto(row.cliente)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {row.hora?.slice(0, 5)}
          </span>
          {row.taxa_leva_traz && Number(row.taxa_leva_traz) > 0 && (
            <span className="inline-flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {Number(row.taxa_leva_traz).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <a href={mapsHref(row.cliente)} target="_blank" rel="noreferrer">
              <Navigation className="h-3 w-3 mr-1" />
              Mapa
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <a href={waHref(row.cliente, texto)} target="_blank" rel="noreferrer">
              <MessageCircle className="h-3 w-3 mr-1" />
              WhatsApp
            </a>
          </Button>
          {row.cliente?.telefone && (
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <a href={`tel:${row.cliente.telefone}`}>
                <Phone className="h-3 w-3 mr-1" />
                Ligar
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to="/clientes/$id" params={{ id: row.cliente?.id || "" }}>
              Perfil
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function LevaTrazPage() {
  const [data, setData] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["leva-traz", data],
    queryFn: async () => {
      const { data: ags, error } = await supabase
        .from("agendamentos")
        .select(
          `id, data, hora, duracao_min, taxa_leva_traz, observacoes, status,
           cliente:clientes(id, nome, telefone, whatsapp, cep, rua, numero, complemento, bairro, cidade, estado, vip),
           pet:pets(id, nome, porte_id),
           servico:servicos(nome)`,
        )
        .eq("data", data)
        .gt("taxa_leva_traz", 0)
        .order("hora", { ascending: true });
      if (error) throw error;
      return (ags as any) || [];
    },
  });

  const ativos = useMemo(
    () => rows.filter((r) => r.status !== "cancelado" && r.status !== "nao_compareceu"),
    [rows],
  );

  const coletaIds = useMemo(() => ativos.map((r) => r.id), [ativos]);
  const entregaIds = useMemo(
    () =>
      [...ativos]
        .sort((a, b) => {
          const durA = a.duracao_min ?? 0;
          const durB = b.duracao_min ?? 0;
          const fimA = a.hora + `+${durA}`;
          const fimB = b.hora + `+${durB}`;
          return fimA.localeCompare(fimB);
        })
        .map((r) => r.id),
    [ativos],
  );

  const coletas = useOrdem(`coleta:${data}`, coletaIds);
  const entregas = useOrdem(`entrega:${data}`, entregaIds);

  const rowById = useMemo(() => {
    const m = new Map<string, Row>();
    ativos.forEach((r) => m.set(r.id, r));
    return m;
  }, [ativos]);

  const totalTaxa = ativos.reduce((acc, r) => acc + Number(r.taxa_leva_traz || 0), 0);
  const dataFmt = data
    ? format(parseISO(data), "EEEE, dd 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-semibold">Leva e Traz</h1>
          </div>
          <p className="text-sm text-muted-foreground lowercase">{dataFmt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setData(format(addDays(parseISO(data), -1), "yyyy-MM-dd"))}
          >
            ◀
          </Button>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="pl-8 w-[170px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setData(format(addDays(parseISO(data), 1), "yyyy-MM-dd"))}
          >
            ▶
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setData(format(new Date(), "yyyy-MM-dd"))}>
            Hoje
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Paradas</div>
            <div className="text-2xl font-semibold mt-1">{ativos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Coletas + Entregas</div>
            <div className="text-2xl font-semibold mt-1">{ativos.length * 2}</div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-amber-400/60">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Receita do trajeto</div>
            <div className="text-2xl font-semibold mt-1">
              {totalTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-16">Carregando roteiro…</div>
      ) : ativos.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Truck className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="mt-3 font-medium">Nenhuma coleta ou entrega para este dia</p>
            <p className="text-sm text-muted-foreground">
              Marque um agendamento com taxa de Leva e Traz para aparecer aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                Coletas
                <Badge variant="secondary" className="ml-auto">
                  {coletas.ordem.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {coletas.ordem.map((id, idx) => {
                const r = rowById.get(id);
                if (!r) return null;
                return (
                  <RotaCard
                    key={id}
                    row={r}
                    idx={idx}
                    total={coletas.ordem.length}
                    tipo="coleta"
                    onSubir={() => coletas.mover(id, -1)}
                    onDescer={() => coletas.mover(id, 1)}
                  />
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500/15 text-amber-700 text-xs font-bold">
                  2
                </span>
                Entregas
                <Badge variant="secondary" className="ml-auto">
                  {entregas.ordem.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {entregas.ordem.map((id, idx) => {
                const r = rowById.get(id);
                if (!r) return null;
                return (
                  <RotaCard
                    key={id}
                    row={r}
                    idx={idx}
                    total={entregas.ordem.length}
                    tipo="entrega"
                    onSubir={() => entregas.mover(id, -1)}
                    onDescer={() => entregas.mover(id, 1)}
                  />
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/leva-traz")({
  component: LevaTrazPage,
});
