import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Save, ShieldAlert, Sparkles, FlaskConical } from "lucide-react";
import { obterIaConfig, salvarIaConfig, salvarRegraTom, testarGeracaoIA } from "@/lib/ia-config.functions";

export function IaConfigTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const obterFn = useServerFn(obterIaConfig);
  const salvarFn = useServerFn(salvarIaConfig);
  const regraFn = useServerFn(salvarRegraTom);
  const testarFn = useServerFn(testarGeracaoIA);

  const q = useQuery({ queryKey: ["ia-config"], queryFn: () => obterFn() });
  const [form, setForm] = useState<any>(null);
  const [cenario, setCenario] = useState(
    "Cliente Ana, pet Mel, saldo de R$ 120,00, vencido há 5 dias, já respondeu que pagaria na sexta.",
  );

  useEffect(() => {
    const cfg = (q.data as any)?.config;
    if (cfg && !form) setForm({ ...cfg, palavras_proibidas: cfg.palavras_proibidas ?? [] });
  }, [q.data]);

  const salvarM = useMutation({
    mutationFn: () => {
      const { id, created_at, updated_at, singleton, updated_by, ...rest } = form ?? {};
      return salvarFn({ data: rest });
    },
    onSuccess: () => {
      toast.success("Configuração da IA salva.");
      qc.invalidateQueries({ queryKey: ["ia-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const regraM = useMutation({
    mutationFn: (p: any) => regraFn({ data: p }),
    onSuccess: () => {
      toast.success("Regra de tom atualizada.");
      qc.invalidateQueries({ queryKey: ["ia-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar a regra."),
  });

  const testarM = useMutation({ mutationFn: () => testarFn({ data: { cenario } }) });

  if (!isAdmin) {
    return (
      <Alert className="border-amber-200 bg-amber-50/60">
        <ShieldAlert className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-sm">
          Somente administradores podem alterar as configurações da IA.
        </AlertDescription>
      </Alert>
    );
  }

  if (q.isLoading || !form) return <Skeleton className="h-96 rounded-xl" />;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Comportamento da IA
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.ia_ativa} onCheckedChange={(v) => set("ia_ativa", v)} />
            IA ativa
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Modelo principal" v={form.modelo_principal} on={(v) => set("modelo_principal", v)} />
          <Campo label="Modelo alternativo (fallback)" v={form.modelo_alternativo} on={(v) => set("modelo_alternativo", v)} />
          <Campo label="Criatividade (0 a 1)" type="number" step="0.05" v={form.criatividade}
            on={(v) => set("criatividade", Number(v))} />
          <Campo label="Limite de caracteres" type="number" v={form.limite_caracteres}
            on={(v) => set("limite_caracteres", Number(v))} />
          <Campo label="Horário permitido — início" type="time" v={String(form.horario_inicio).slice(0, 5)}
            on={(v) => set("horario_inicio", v)} />
          <Campo label="Horário permitido — fim" type="time" v={String(form.horario_fim).slice(0, 5)}
            on={(v) => set("horario_fim", v)} />
          <Campo label="Intervalo mínimo entre contatos (horas)" type="number" v={form.intervalo_min_horas}
            on={(v) => set("intervalo_min_horas", Number(v))} />
          <Campo label="Máx. tentativas antes de escalar" type="number" v={form.max_tentativas_contato}
            on={(v) => set("max_tentativas_contato", Number(v))} />
          <Campo label="Chave Pix" v={form.pix_chave ?? ""} on={(v) => set("pix_chave", v)} />
          <Campo label="Link de pagamento" v={form.link_pagamento ?? ""} on={(v) => set("link_pagamento", v)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Instruções da empresa (contexto fixo da IA)</Label>
          <Textarea rows={4} value={form.instrucoes_empresa ?? ""}
            onChange={(e) => set("instrucoes_empresa", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Assinatura padrão</Label>
          <Input value={form.assinatura ?? ""} onChange={(e) => set("assinatura", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Palavras proibidas (separadas por vírgula)</Label>
          <Input value={(form.palavras_proibidas ?? []).join(", ")}
            onChange={(e) =>
              set("palavras_proibidas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
            } />
          <p className="text-[11px] text-muted-foreground">
            Se a IA usar alguma delas, a mensagem é bloqueada e marcada para revisão humana.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!form.permitir_mencao_juridica}
            onCheckedChange={(v) => set("permitir_mencao_juridica", v)} />
          Permitir menção a cobrança jurídica / negativação
        </label>

        <Button onClick={() => salvarM.mutate()} disabled={salvarM.isPending}>
          {salvarM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configuração
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Regras de tom por situação</h3>
        <p className="text-xs text-muted-foreground">
          Define o tom sugerido automaticamente conforme os dias de atraso e o histórico do cliente.
        </p>
        <div className="space-y-2">
          {((q.data as any)?.regras ?? []).map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.situacao ?? r.nome ?? "Situação"}</p>
                <p className="text-[11px] text-muted-foreground">{r.observacao ?? r.descricao ?? ""}</p>
              </div>
              <Badge variant="secondary">{r.tom}</Badge>
              <span className="text-xs text-muted-foreground">firmeza {r.nivel_firmeza}</span>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={!!r.ativo}
                  onCheckedChange={(v) =>
                    regraM.mutate({
                      id: r.id, tom: r.tom, nivel_firmeza: r.nivel_firmeza,
                      bloquear_ia: !!r.bloquear_ia, ativo: v, observacao: r.observacao ?? null,
                    })
                  } />
                Ativa
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={!!r.bloquear_ia}
                  onCheckedChange={(v) =>
                    regraM.mutate({
                      id: r.id, tom: r.tom, nivel_firmeza: r.nivel_firmeza,
                      bloquear_ia: v, ativo: !!r.ativo, observacao: r.observacao ?? null,
                    })
                  } />
                Exigir humano
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> Testar geração (sem enviar nada)
        </h3>
        <Textarea rows={3} value={cenario} onChange={(e) => setCenario(e.target.value)} />
        <Button size="sm" onClick={() => testarM.mutate()} disabled={testarM.isPending}>
          {testarM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Rodar teste
        </Button>
        {testarM.data ? (
          <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded-md p-3">
            {JSON.stringify(testarM.data, null, 2)}
          </pre>
        ) : null}
        {testarM.isError ? (
          <p className="text-xs text-rose-700">A IA não respondeu. Verifique o modelo configurado.</p>
        ) : null}
      </Card>
    </div>
  );
}

function Campo({
  label, v, on, type = "text", step,
}: { label: string; v: any; on: (v: string) => void; type?: string; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} step={step} value={v ?? ""} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
