import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMyAccess } from "@/hooks/use-my-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getPainelQualidade,
  getFaseLiberacao,
  setFaseLiberacao,
  marcarCorrecaoHumana,
} from "@/lib/ia/ia-observabilidade.functions";

export const Route = createFileRoute("/_authenticated/qualidade-ia")({
  component: QualidadeIA,
  head: () => ({
    meta: [
      { title: "Qualidade da Assistente IA • Spa de Pet Tia Jéssica" },
      {
        name: "description",
        content:
          "Painel técnico de qualidade da Assistente IA: sucessos, erros, timeouts, duplicidades e tempo médio.",
      },
      { property: "og:title", content: "Qualidade da Assistente IA" },
      {
        property: "og:description",
        content: "Observabilidade e liberação controlada da Assistente Operacional IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FASES: { valor: "observacao" | "teste_controlado" | "piloto" | "producao"; label: string; desc: string }[] = [
  { valor: "observacao", label: "Fase 1 — Observação", desc: "Consultas reais. Ações apenas simuladas." },
  { valor: "teste_controlado", label: "Fase 2 — Teste controlado", desc: "Ações em registros autorizados." },
  { valor: "piloto", label: "Fase 3 — Piloto", desc: "Ações liberadas somente para o proprietário." },
  { valor: "producao", label: "Fase 4 — Produção", desc: "Liberação por permissão." },
];

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function QualidadeIA() {
  const { data: access } = useMyAccess();
  const qc = useQueryClient();
  const [dias, setDias] = useState(7);
  const canView = !!access && (access.isAdmin || access.isProprietario);

  const { data: painel, isFetching, refetch } = useQuery({
    queryKey: ["ia-qualidade", dias],
    enabled: canView,
    queryFn: () => getPainelQualidade({ data: { dias } }),
  });

  const { data: faseData } = useQuery({
    queryKey: ["ia-fase"],
    enabled: canView,
    queryFn: () => getFaseLiberacao(),
  });

  const mudarFase = useMutation({
    mutationFn: (fase: any) => setFaseLiberacao({ data: { fase } }),
    onSuccess: () => {
      toast.success("Fase de liberação atualizada.");
      qc.invalidateQueries({ queryKey: ["ia-fase"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const corrigir = useMutation({
    mutationFn: (command_id: string) =>
      marcarCorrecaoHumana({ data: { command_id, intencao_incorreta: true } }),
    onSuccess: () => {
      toast.success("Comando marcado como intenção incorreta.");
      qc.invalidateQueries({ queryKey: ["ia-qualidade"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Você não tem permissão para ver o painel de qualidade da IA.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" /> Qualidade da Assistente IA
            </h1>
            <p className="text-sm text-muted-foreground">Observabilidade completa e liberação controlada.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 7, 30].map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Liberação em etapas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          {FASES.map((f) => {
            const ativa = faseData?.fase === f.valor;
            return (
              <button
                key={f.valor}
                onClick={() => mudarFase.mutate(f.valor)}
                className={`text-left rounded-lg border p-3 transition ${
                  ativa ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
                {ativa && <Badge className="mt-2">Ativa</Badge>}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric label="Comandos" value={painel?.total_comandos ?? 0} />
        <Metric label="Sucessos" value={painel?.sucessos ?? 0} tone="text-emerald-600" />
        <Metric label="Erros" value={painel?.erros ?? 0} tone="text-red-600" />
        <Metric label="Timeouts" value={painel?.timeouts ?? 0} tone="text-amber-600" />
        <Metric label="Duplicidades bloqueadas" value={painel?.duplicidades_bloqueadas ?? 0} />
        <Metric label="Intenções incorretas" value={painel?.intencoes_incorretas ?? 0} />
        <Metric label="Correções humanas" value={painel?.correcoes_humanas ?? 0} />
        <Metric label="Tempo médio" value={`${painel?.tempo_medio_ms ?? 0} ms`} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label="Acerto de intenção (meta 95%)"
          value={`${(painel?.acerto_intencao ?? 100).toFixed(1)}%`}
          tone={(painel?.acerto_intencao ?? 100) >= 95 ? "text-emerald-600" : "text-red-600"}
        />
        <Metric label="Taxa de sucesso" value={`${(painel?.taxa_sucesso ?? 100).toFixed(1)}%`} />
        <Metric
          label="Ações com registro verificado"
          value={`${(painel?.acoes_rastreadas_pct ?? 100).toFixed(1)}%`}
          tone={(painel?.acoes_rastreadas_pct ?? 100) >= 100 ? "text-emerald-600" : "text-amber-600"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos comandos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(painel?.ultimos ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum comando registrado no período.</p>
          )}
          {(painel?.ultimos ?? []).map((l: any) => (
            <div key={l.id} className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium">{l.comando_original}</span>
                <div className="flex items-center gap-2">
                  {l.simulado && <Badge variant="outline">simulado</Badge>}
                  <Badge variant={l.sucesso ? "default" : "destructive"}>
                    {l.sucesso ? "sucesso" : "erro"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{l.tempo_resposta_ms ?? 0}ms</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {l.intencao_detectada || "—"} · {l.especialista || "—"} · {l.ferramenta_utilizada || "—"} ·{" "}
                {l.tipo_operacao || "—"} · fase: {l.fase_liberacao || "—"}
              </p>
              <p className="text-xs text-muted-foreground break-all">
                command_id: {l.command_id || "—"} · registro: {l.registro_afetado_id || "—"} · retry:{" "}
                {l.retry_count ?? 0} · confirmado: {l.confirmado ? "sim" : "não"}
              </p>
              {l.erro && <p className="text-xs text-red-600">Erro: {l.erro}</p>}
              {l.command_id && !l.correcao_humana && (
                <Button size="sm" variant="ghost" onClick={() => corrigir.mutate(l.command_id)}>
                  Marcar intenção incorreta
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
