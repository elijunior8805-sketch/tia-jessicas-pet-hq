import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, EmptyState } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Clock, PawPrint, User, PlayCircle, ArrowRight, ClipboardCheck,
  AlertTriangle, Sparkles, ListChecks, Star,
} from "lucide-react";
import { brl, itemFromServico } from "@/lib/atendimento-utils";
import { useSignedUrl } from "@/lib/use-signed-url";
import { cn } from "@/lib/utils";
import { z } from "zod";

const searchSchema = z.object({
  vip: z.enum(["1"]).optional(),
});

export const Route = createFileRoute("/_authenticated/atendimentos/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AtendimentosPainel,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AtendimentosPainel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { vip: vipParam } = Route.useSearch();
  const onlyVip = vipParam === "1";
  const hoje = todayISO();

  const filterVip = <T extends { clientes?: { vip?: boolean | null } | null }>(arr: T[]) =>
    onlyVip ? arr.filter((r) => r.clientes?.vip === true) : arr;

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["atendimentos-painel", "agenda", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          id, data, hora, status, valor_previsto, taxa_leva_traz, servico_id, cliente_id, pet_id,
          clientes(id, nome, whatsapp, vip),
          pets(id, nome, porte, raca, foto_url, alergias, temperamento, necessita_focinheira, cuidados_saude),
          servicos(id, nome, valor, categoria, duracao_min)
        `)
        .eq("data", hoje)
        .in("status", ["confirmado", "aguardando", "em_atendimento"])
        .order("hora", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ["atendimentos-painel", "atendimentos", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select(`
          id, agendamento_id, data_inicio, data_fim, finalizado,
          valor_planejado, valor_executado, taxa_leva_traz,
          clientes(id, nome, whatsapp, vip),
          pets(id, nome, porte, raca, foto_url, alergias, temperamento, necessita_focinheira, cuidados_saude),
          agendamentos(hora, servicos(nome))
        `)
        .or(`finalizado.eq.false,data_fim.gte.${hoje}T00:00:00Z`)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const iniciados = useMemo(
    () => new Set(atendimentos.map((a: any) => a.agendamento_id).filter(Boolean)),
    [atendimentos],
  );

  const aguardando = useMemo(
    () => filterVip(agendamentos.filter((a: any) => !iniciados.has(a.id))),
    [agendamentos, iniciados, onlyVip],
  );

  const emAndamento = filterVip(atendimentos.filter((a: any) => !a.finalizado));
  const finalizadosHoje = filterVip(
    atendimentos.filter((a: any) => a.finalizado && a.data_fim && a.data_fim.slice(0, 10) === hoje),
  );


  const iniciar = useMutation({
    mutationFn: async (ag: any) => {
      const { data: existente } = await supabase
        .from("atendimentos")
        .select("id")
        .eq("agendamento_id", ag.id)
        .maybeSingle();
      if (existente) return { id: existente.id };

      const servico = ag.servicos;
      const planejado = servico
        ? [itemFromServico({
            id: servico.id,
            nome: servico.nome,
            valor: servico.valor,
            categoria: servico.categoria,
          })]
        : [];
      const valor_planejado = planejado.reduce((s, i) => s + i.valor_total, 0);

      const { data, error } = await supabase
        .from("atendimentos")
        .insert({
          agendamento_id: ag.id,
          cliente_id: ag.cliente_id,
          pet_id: ag.pet_id,
          data_inicio: new Date().toISOString(),
          servicos_planejados: planejado,
          servicos_executados: planejado,
          valor_planejado,
          valor_executado: valor_planejado,
          taxa_leva_traz: Number(ag.taxa_leva_traz ?? 0),
          finalizado: false,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase
        .from("agendamentos")
        .update({ status: "em_atendimento" })
        .eq("id", ag.id);

      return data;
    },
    onSuccess: (res) => {
      toast.success("Atendimento iniciado");
      qc.invalidateQueries({ queryKey: ["atendimentos-painel"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      navigate({ to: "/atendimentos/$atendId", params: { atendId: res.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao iniciar atendimento"),
  });

  return (
    <PageShell>
      <PageHeader
        title="Atendimentos"
        description="Check-in, execução e check-out dos pets do dia."
        actions={
          <Button
            variant={onlyVip ? "default" : "outline"}
            className={cn(
              "gap-1.5",
              onlyVip && "bg-[var(--color-gold)] text-primary hover:bg-[var(--color-gold)]/90 border-[var(--color-gold)]",
            )}
            onClick={() =>
              navigate({
                to: "/atendimentos",
                search: (prev: any) => ({ ...prev, vip: onlyVip ? undefined : "1" }),
                replace: true,
              })
            }
            title="Mostrar somente pets de clientes VIP"
          >
            <Star className={cn("h-4 w-4", onlyVip && "fill-current")} />
            {onlyVip ? "Somente VIP" : "Filtrar VIP"}
          </Button>
        }

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Coluna
          title="Aguardando check-in"
          count={aguardando.length}
          icon={ClipboardCheck}
          tone="text-primary"
          empty="Nenhum pet aguardando."
        >
          {aguardando.map((ag: any) => (
            <AguardandoCard
              key={ag.id}
              ag={ag}
              onIniciar={() => iniciar.mutate(ag)}
              loading={iniciar.isPending}
            />
          ))}
        </Coluna>

        <Coluna
          title="Em andamento"
          count={emAndamento.length}
          icon={Sparkles}
          tone="text-gold"
          empty="Nada em andamento."
        >
          {emAndamento.map((a: any) => (
            <EmAndamentoCard key={a.id} a={a} />
          ))}
        </Coluna>

        <Coluna
          title="Finalizados hoje"
          count={finalizadosHoje.length}
          icon={ListChecks}
          tone="text-success"
          empty="Nenhum encerrado ainda."
        >
          {finalizadosHoje.map((a: any) => (
            <FinalizadoCard key={a.id} a={a} />
          ))}
        </Coluna>
      </div>
    </PageShell>
  );
}

function Coluna({
  title, count, icon: Icon, tone, empty, children,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tone}`} />
          <h2 className="font-display font-semibold text-primary">{title}</h2>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-3">
        {count === 0 ? (
          <EmptyState icon={PawPrint} title={empty} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function AlertChips({ pet }: { pet: any }) {
  const chips: string[] = [];
  if (pet?.alergias) chips.push(`Alergia: ${pet.alergias}`);
  if (pet?.temperamento && ["agressivo", "medroso"].includes(String(pet.temperamento).toLowerCase()))
    chips.push(`Temperamento: ${pet.temperamento}`);
  if (pet?.necessita_focinheira) chips.push("Focinheira");
  if (pet?.cuidados_saude) chips.push(`Saúde: ${pet.cuidados_saude}`);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 text-warning-foreground px-2 py-0.5 text-[10px]"
        >
          <AlertTriangle className="h-3 w-3" /> {c}
        </span>
      ))}
    </div>
  );
}

function PetThumb({ path }: { path: string | null | undefined }) {
  const { data: url } = useSignedUrl(path);
  if (!url) return <PawPrint className="h-5 w-5 text-primary" />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

function CardHeader({ pet, cliente }: { pet: any; cliente: any }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="h-11 w-11 rounded-full bg-primary/10 grid place-items-center shrink-0 overflow-hidden">
        <PetThumb path={pet?.foto_url} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-primary truncate">{pet?.nome ?? "—"}</span>
          {cliente?.vip === true && (
            <span title="Cliente marcado como VIP no cadastro" className="inline-flex">
              <Badge className="badge-gold text-[10px]">VIP</Badge>
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {[pet?.porte, pet?.raca].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1 truncate">
          <User className="h-3 w-3" /> {cliente?.nome ?? "—"}
        </div>
      </div>
    </div>
  );
}

function AguardandoCard({ ag, onIniciar, loading }: { ag: any; onIniciar: () => void; loading: boolean }) {
  const total = Number(ag.valor_previsto ?? 0) + Number(ag.taxa_leva_traz ?? 0);
  return (
    <Card className="p-4 hover:shadow-elegant transition">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-center min-w-[52px]">
          <div className="font-display text-lg font-semibold text-primary leading-none">
            {ag.hora ? String(ag.hora).slice(0, 5) : "—"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" /> {ag.servicos?.duracao_min ?? "—"}m
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary truncate">{ag.servicos?.nome ?? "Serviço"}</div>
          <div className="text-xs text-muted-foreground">{brl(total)}</div>
        </div>
      </div>
      <CardHeader pet={ag.pets} cliente={ag.clientes} />
      <AlertChips pet={ag.pets} />
      <div className="mt-3 flex gap-2">
        <Button className="gap-1 flex-1" onClick={onIniciar} disabled={loading}>
          <PlayCircle className="h-4 w-4" /> Iniciar
        </Button>
        {ag.pet_id && (
          <Link to="/pets/$petId/ficha" params={{ petId: ag.pet_id }}>
            <Button variant="outline" size="icon" title="Ver ficha do pet">
              <PawPrint className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function EmAndamentoCard({ a }: { a: any }) {
  const inicio = a.data_inicio ? new Date(a.data_inicio) : null;
  const hora = inicio ? inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <Card className="p-4 hover:shadow-elegant transition border-gold/40">
      <CardHeader pet={a.pets} cliente={a.clientes} />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Início {hora}</span>
        <span className="font-semibold text-primary">
          {brl(Number(a.valor_executado ?? 0) + Number(a.taxa_leva_traz ?? 0))}
        </span>
      </div>
      <AlertChips pet={a.pets} />
      <div className="mt-3">
        <Link to="/atendimentos/$atendId" params={{ atendId: a.id }}>
          <Button className="gap-1 w-full">
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function FinalizadoCard({ a }: { a: any }) {
  const fim = a.data_fim ? new Date(a.data_fim) : null;
  const hora = fim ? fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <Card className="p-4 opacity-90">
      <CardHeader pet={a.pets} cliente={a.clientes} />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Encerrado às {hora}</span>
        <span className="font-semibold text-success">
          {brl(Number(a.valor_executado ?? 0) + Number(a.taxa_leva_traz ?? 0))}
        </span>
      </div>
      <div className="mt-3">
        <Link to="/atendimentos/$atendId" params={{ atendId: a.id }}>
          <Button variant="outline" className="gap-1 w-full">
            Ver detalhes <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
