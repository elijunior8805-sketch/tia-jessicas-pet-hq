import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Loader2, AlertTriangle, Clock, CalendarClock, CheckCircle2,
  MessageSquareWarning, Banknote, PhoneOff, CalendarX2,
} from "lucide-react";
import {
  visaoGeralComunicacao, resumoInteligente, painelOperacional, metricasIa,
} from "@/lib/comunicacao-central.functions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function Kpi({
  icon: Icon, label, value, hint, tone = "default",
}: {
  icon: any; label: string; value: string; hint?: string;
  tone?: "default" | "alerta" | "ok" | "critico";
}) {
  const tones: Record<string, string> = {
    default: "border-border",
    ok: "border-emerald-200 bg-emerald-50/40",
    alerta: "border-amber-200 bg-amber-50/40",
    critico: "border-rose-200 bg-rose-50/40",
  };
  return (
    <Card className={`p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
          {hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </Card>
  );
}

export function VisaoGeralTab({ onIrParaFila, onIrParaInbox }: { onIrParaFila?: () => void, onIrParaInbox?: (clienteId?: string) => void }) {
  const visaoFn = useServerFn(visaoGeralComunicacao);
  const resumoFn = useServerFn(resumoInteligente);
  const painelFn = useServerFn(painelOperacional);

  const q = useQuery({
    queryKey: ["comunicacao", "visao-geral"],
    queryFn: () => visaoFn(),
    refetchInterval: 60_000,
  });
  const painelQ = useQuery({
    queryKey: ["comunicacao", "painel-operacional"],
    queryFn: () => painelFn(),
    refetchInterval: 120_000,
  });

  const resumoM = useMutation({ mutationFn: () => resumoFn() });

  const d = q.data as any;

  if (q.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Sparkles} label="Aguardando revisão" value={String(d?.aguardandoRevisao ?? 0)}
          hint="Mensagens na fila proativa" tone={d?.aguardandoRevisao ? "alerta" : "default"} />
        <Kpi icon={AlertTriangle} label="Cobranças vencidas" value={String(d?.cobrancasVencidas ?? 0)}
          hint={brl(d?.valorVencido ?? 0)} tone={d?.cobrancasVencidas ? "critico" : "ok"} />
        <Kpi icon={CalendarClock} label="Promessas vencendo hoje" value={String(d?.promessasHoje ?? 0)}
          tone={d?.promessasHoje ? "alerta" : "default"} />
        <Kpi icon={Clock} label="Mensagens agendadas" value={String(d?.mensagensAgendadas ?? 0)}
          hint="Adiadas para depois" />
        <Kpi icon={CheckCircle2} label="Enviadas hoje" value={String(d?.enviadasHoje ?? 0)} tone="ok" />
        <Kpi icon={Banknote} label="Pagos após cobrança" value={String(d?.pagosAposCobranca ?? 0)}
          hint="Efetividade de hoje" tone="ok" />
        <Kpi icon={MessageSquareWarning} label="Sem resposta há +48h" value={String(d?.clientesSemResposta ?? 0)}
          tone={d?.clientesSemResposta ? "alerta" : "default"} />
        <Kpi icon={CalendarX2} label="Precisam de atenção humana" value={String(d?.precisamAtencaoHumana ?? 0)}
          hint="3+ tentativas sem acordo" tone={d?.precisamAtencaoHumana ? "critico" : "default"} />
      </div>

      <Card className="p-5 border-primary/20 bg-primary/5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Resumo inteligente do dia
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA lê os números acima e sugere o foco. Nada é enviado automaticamente.
            </p>
          </div>
          <Button size="sm" onClick={() => resumoM.mutate()} disabled={resumoM.isPending}>
            {resumoM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Gerar resumo
          </Button>
        </div>

        {resumoM.data ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{(resumoM.data as any).resumo}</p>
            <p className="text-[11px] text-muted-foreground">
              Fonte: {(resumoM.data as any).ia ? `IA (${(resumoM.data as any).modelo})` : "regras locais (IA indisponível)"}
            </p>
            <div className="flex gap-2">
              {onIrParaFila ? (
                <Button size="sm" variant="outline" onClick={onIrParaFila}>Abrir fila proativa</Button>
              ) : null}
              {onIrParaInbox ? (
                <Button size="sm" variant="outline" onClick={() => onIrParaInbox()}>Abrir Inbox Inteligente</Button>
              ) : null}
            </div>

          </div>
        ) : resumoM.isError ? (
          <p className="mt-3 text-xs text-rose-700">
            Não foi possível gerar o resumo agora. Os números acima continuam válidos.
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Organização do dia</h3>
        {painelQ.isLoading ? (
          <Skeleton className="h-28 rounded-lg" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ListaBloco
              titulo="Agendamentos sem confirmação"
              vazio="Tudo confirmado por aqui."
              itens={(painelQ.data as any)?.agendamentosSemConfirmacao?.map((a: any) =>
                `${String(a.hora).slice(0, 5)} · ${a.pets?.nome ?? "Pet"} (${a.clientes?.nome ?? ""})`) ?? []}
            />
            <ListaBloco
              titulo="Horários vagos hoje"
              vazio="Agenda cheia hoje."
              itens={(painelQ.data as any)?.horariosVagos ?? []}
            />
            <ListaBloco
              titulo="Clientes com retorno atrasado"
              vazio="Nenhum retorno atrasado."
              itens={(painelQ.data as any)?.retornoAtrasado?.map((p: any) =>
                `${p.nome} — ${p.clientes?.nome ?? ""}`) ?? []}
            />
            <ListaBloco
              icon={PhoneOff}
              titulo="Aguardando resposta"
              vazio="Sem pendências de resposta."
              itens={(painelQ.data as any)?.aguardandoResposta?.slice(0, 8).map((m: any) =>
                m.clientes?.nome ?? "Cliente") ?? []}
            />
            <ListaBloco
              titulo="Pagamentos a conferir"
              vazio="Nada a conferir."
              itens={(painelQ.data as any)?.conferirPagamento?.map((p: any) =>
                `${p.clientes?.nome ?? "Cliente"} — falta ${brl(Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0))}`) ?? []}
            />
          </div>
        )}
      </Card>

      <MetricasIaCard />
    </div>
  );
}

function MetricasIaCard() {
  const metricasFn = useServerFn(metricasIa);
  const q = useQuery({
    queryKey: ["comunicacao", "metricas-ia"],
    queryFn: () => metricasFn(),
    refetchInterval: 300_000,
  });
  const m = q.data as any;

  return (
    <Card className="p-4">
      <p className="text-sm font-medium mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4" /> Desempenho da IA (últimos 30 dias)
      </p>
      {q.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !m || m.total === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma geração registrada ainda neste período.
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div><p className="text-xs text-muted-foreground">Gerações</p><p className="text-xl font-semibold">{m.total}</p></div>
          <div><p className="text-xs text-muted-foreground">Taxa de sucesso</p><p className="text-xl font-semibold">{m.taxaSucesso}%</p></div>
          <div><p className="text-xs text-muted-foreground">Tempo médio</p><p className="text-xl font-semibold">{(m.tempoMedioMs / 1000).toFixed(1)}s</p></div>
          <div><p className="text-xs text-muted-foreground">Fallbacks</p><p className="text-xl font-semibold">{m.fallbacks}</p></div>
          <div><p className="text-xs text-muted-foreground">Falhas</p><p className="text-xl font-semibold">{m.falhas}</p></div>
          {Object.keys(m.porModelo ?? {}).length > 0 ? (
            <div className="col-span-2 lg:col-span-5 flex flex-wrap gap-1.5 pt-1">
              {Object.entries(m.porModelo as Record<string, number>).map(([k, v]) => (
                <Badge key={k} variant="secondary">{k} · {v}</Badge>
              ))}
              {Object.entries(m.porErro as Record<string, number>).map(([k, v]) => (
                <Badge key={k} variant="destructive">{k} · {v}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function ListaBloco({
  titulo, itens, vazio, icon: Icon,
}: { titulo: string; itens: string[]; vazio: string; icon?: any }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null} {titulo}
        <Badge variant="secondary" className="ml-auto">{itens.length}</Badge>
      </p>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-auto pr-1">
          {itens.map((t, i) => (
            <li key={i} className="text-xs truncate">• {t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
