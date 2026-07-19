import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, PawPrint, User, Plus, Trash2,
  Upload, MessageCircle, CheckCircle2, Camera, ListChecks,
  ClipboardList, PlayCircle,
} from "lucide-react";
import {
  brl, sumItens, itemFromServico, isBanho, isTosa,
  COMPORTAMENTOS, OCORRENCIA_TIPOS, type ServicoItem,
} from "@/lib/atendimento-utils";

export const Route = createFileRoute("/_authenticated/atendimentos/$atendId")({
  component: AtendimentoDetalhe,
});

// ---------- Storage helpers ----------

async function uploadArquivo(atendId: string, sub: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `atendimentos/${atendId}/${sub}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("spa-fotos").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("spa-fotos")
        .createSignedUrl(path, 60 * 30);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function Thumb({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const { data: url } = useSignedUrl(path);
  return (
    <div className="relative group">
      {url ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img
          src={url}
          alt="foto"
          className="h-20 w-20 rounded-md object-cover border"
        />
      ) : (
        <div className="h-20 w-20 rounded-md bg-muted animate-pulse" />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition"
          title="Remover"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function UploadInput({
  label, onFile, disabled,
}: {
  label: string;
  onFile: (f: File) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try { await onFile(f); } finally { setBusy(false); }
        }}
      />
      <span
        className={
          "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer " +
          "hover:bg-accent " + (disabled || busy ? "opacity-60 pointer-events-none" : "")
        }
      >
        <Upload className="h-4 w-4" /> {busy ? "Enviando…" : label}
      </span>
    </label>
  );
}

// ---------- Página ----------

function AtendimentoDetalhe() {
  const { atendId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: atendimento, isLoading } = useQuery({
    queryKey: ["atendimento", atendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select(`
          *,
          clientes(id, nome, whatsapp, vip),
          pets(id, nome, porte, raca, foto_url, alergias, temperamento, necessita_focinheira, cuidados_saude, observacoes),
          agendamentos(id, data, hora, servicos(id, nome, valor, categoria))
        `)
        .eq("id", atendId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos-ativos"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("servicos")
        .select("id, nome, valor, categoria")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: ocorrencias = [] } = useQuery({
    queryKey: ["atendimento-ocorrencias", atendId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("atendimento_id", atendId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase
        .from("atendimentos")
        .update(patch)
        .eq("id", atendId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atendimento", atendId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!atendimento) return;
      const executados = (atendimento.servicos_executados ?? []) as ServicoItem[];
      const valor_executado = sumItens(executados);
      const taxa = Number(atendimento.taxa_leva_traz ?? 0);
      const total = valor_executado + taxa;

      const hojeISO = new Date().toISOString().slice(0, 10);
      const petPatch: Record<string, any> = { proxima_visita: atendimento.proxima_visita ?? null };
      if (executados.some(isBanho)) petPatch.ultimo_banho = hojeISO;
      if (executados.some(isTosa)) petPatch.ultima_tosa = hojeISO;

      const { error: e1 } = await supabase
        .from("atendimentos")
        .update({
          finalizado: true,
          data_fim: new Date().toISOString(),
          valor_executado,
        })
        .eq("id", atendId);
      if (e1) throw e1;

      if (atendimento.agendamento_id) {
        await supabase
          .from("agendamentos")
          .update({ status: "finalizado" })
          .eq("id", atendimento.agendamento_id);
      }

      // Upsert pagamento em aberto
      const { data: existingPay } = await supabase
        .from("pagamentos")
        .select("id")
        .eq("atendimento_id", atendId)
        .maybeSingle();
      const pagPayload = {
        atendimento_id: atendId,
        cliente_id: atendimento.cliente_id,
        valor_total: total,
        valor_pago: 0,
        forma: "pendente" as const,
        status: "pendente" as const,
        vencimento: hojeISO,
      };
      if (existingPay) {
        await supabase.from("pagamentos").update(pagPayload).eq("id", existingPay.id);
      } else {
        await supabase.from("pagamentos").insert(pagPayload);
      }

      // Atualiza pet
      if (atendimento.pet_id) {
        await supabase.from("pets").update(petPatch).eq("id", atendimento.pet_id);
      }
    },
    onSuccess: () => {
      toast.success("Atendimento finalizado");
      qc.invalidateQueries({ queryKey: ["atendimento", atendId] });
      qc.invalidateQueries({ queryKey: ["atendimentos-painel"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      navigate({ to: "/atendimentos" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  if (isLoading) {
    return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  }
  if (!atendimento) {
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">Atendimento não encontrado.</div>
      </PageShell>
    );
  }

  const pet = atendimento.pets;
  const cliente = atendimento.clientes;
  const planejados = (atendimento.servicos_planejados ?? []) as ServicoItem[];
  const executados = (atendimento.servicos_executados ?? []) as ServicoItem[];
  const totalPlanejado = sumItens(planejados) + Number(atendimento.taxa_leva_traz ?? 0);
  const totalExecutado = sumItens(executados) + Number(atendimento.taxa_leva_traz ?? 0);
  const delta = totalExecutado - totalPlanejado;

  const alertas: string[] = [];
  if (pet?.alergias) alertas.push(`Alergia: ${pet.alergias}`);
  if (pet?.temperamento) alertas.push(`Temperamento: ${pet.temperamento}`);
  if (pet?.necessita_focinheira) alertas.push("Precisa de focinheira");
  if (pet?.cuidados_saude) alertas.push(`Saúde: ${pet.cuidados_saude}`);

  return (
    <PageShell>
      <PageHeader
        title={`Atendimento · ${pet?.nome ?? "—"}`}
        description={cliente?.nome ?? undefined}
        actions={
          <Link to="/atendimentos">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao painel
            </Button>
          </Link>
        }
      />

      {/* Cabeçalho premium */}
      <Card className="p-4 mb-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center overflow-hidden shrink-0">
            {pet?.foto_url ? (
              <img src={pet.foto_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <PawPrint className="h-8 w-8 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-xl font-semibold text-primary truncate">{pet?.nome}</span>
              {cliente?.vip && <Badge className="badge-gold">VIP</Badge>}
              {atendimento.finalizado && (
                <Badge className="bg-success text-success-foreground">Finalizado</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {[pet?.porte, pet?.raca].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {cliente?.nome}</span>
              {cliente?.whatsapp && (
                <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {cliente.whatsapp}</span>
              )}
            </div>
            {alertas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {alertas.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 text-warning-foreground px-2 py-0.5 text-[11px]"
                  >
                    <AlertTriangle className="h-3 w-3" /> {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="checkin" className="pb-40">
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="checkin" className="flex-1"><Camera className="h-4 w-4 mr-1" />Check-in</TabsTrigger>
          <TabsTrigger value="servicos" className="flex-1"><ListChecks className="h-4 w-4 mr-1" />Serviços</TabsTrigger>
          <TabsTrigger value="registro" className="flex-1"><ClipboardList className="h-4 w-4 mr-1" />Registro</TabsTrigger>
          <TabsTrigger value="ocorrencias" className="flex-1"><AlertTriangle className="h-4 w-4 mr-1" />Ocorrências</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
          <CheckInTab atendimento={atendimento} onPatch={(p) => salvar.mutate(p)} />
        </TabsContent>

        <TabsContent value="servicos">
          <ServicosTab
            atendimento={atendimento}
            servicos={servicos}
            onPatch={(p) => salvar.mutate(p)}
          />
        </TabsContent>

        <TabsContent value="registro">
          <RegistroTab atendimento={atendimento} onPatch={(p) => salvar.mutate(p)} />
        </TabsContent>

        <TabsContent value="ocorrencias">
          <OcorrenciasTab
            atendimento={atendimento}
            ocorrencias={ocorrencias}
            onChanged={() => qc.invalidateQueries({ queryKey: ["atendimento-ocorrencias", atendId] })}
          />
        </TabsContent>
      </Tabs>

      {/* Rodapé fixo */}
      <div className="fixed bottom-0 inset-x-0 lg:left-64 border-t bg-background/95 backdrop-blur px-4 py-3 z-30">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] grid grid-cols-3 gap-4 text-center">
            <Totais label="Planejado" value={totalPlanejado} tone="text-muted-foreground" />
            <Totais label="Executado" value={totalExecutado} tone="text-primary" strong />
            <Totais
              label="Diferença"
              value={delta}
              tone={delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"}
              signed
            />
          </div>
          {atendimento.finalizado ? (
            <Badge className="bg-success text-success-foreground py-2 px-3">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Encerrado
            </Badge>
          ) : (
            <Button
              className="gap-2"
              onClick={() => finalizar.mutate()}
              disabled={finalizar.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {finalizar.isPending ? "Encerrando…" : "Finalizar atendimento"}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Totais({
  label, value, tone, strong, signed,
}: { label: string; value: number; tone: string; strong?: boolean; signed?: boolean }) {
  const prefix = signed && value > 0 ? "+ " : "";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display ${strong ? "text-xl font-bold" : "text-lg font-semibold"} ${tone}`}>
        {prefix}{brl(value)}
      </div>
    </div>
  );
}

// ---------- Check-in ----------

function CheckInTab({ atendimento, onPatch }: { atendimento: any; onPatch: (p: any) => void }) {
  const [obs, setObs] = useState<string>(atendimento.check_in_obs ?? "");
  const finalizado = atendimento.finalizado;

  return (
    <Card className="p-5 mt-4">
      <h3 className="font-display font-semibold text-primary mb-3">Chegada do pet</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
            Foto de chegada
          </Label>
          {atendimento.check_in_foto ? (
            <div className="flex items-start gap-3">
              <Thumb
                path={atendimento.check_in_foto}
                onRemove={finalizado ? undefined : () => onPatch({ check_in_foto: null })}
              />
            </div>
          ) : (
            <UploadInput
              label="Enviar foto de chegada"
              disabled={finalizado}
              onFile={async (f) => {
                const path = await uploadArquivo(atendimento.id, "checkin", f);
                onPatch({ check_in_foto: path });
              }}
            />
          )}
        </div>

        <div>
          <Label htmlFor="checkin-obs" className="text-xs uppercase tracking-wider text-muted-foreground">
            Observações da chegada
          </Label>
          <Textarea
            id="checkin-obs"
            value={obs}
            disabled={finalizado}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => obs !== (atendimento.check_in_obs ?? "") && onPatch({ check_in_obs: obs })}
            placeholder="Como o pet chegou? Sujeira, feridas visíveis, humor, itens…"
            rows={5}
            className="mt-2"
          />
        </div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Início do atendimento:{" "}
        {atendimento.data_inicio
          ? new Date(atendimento.data_inicio).toLocaleString("pt-BR")
          : "—"}
      </div>
    </Card>
  );
}

// ---------- Serviços ----------

function ServicosTab({
  atendimento, servicos, onPatch,
}: { atendimento: any; servicos: any[]; onPatch: (p: any) => void }) {
  const finalizado = atendimento.finalizado;
  const planejados = (atendimento.servicos_planejados ?? []) as ServicoItem[];
  const executados = (atendimento.servicos_executados ?? []) as ServicoItem[];

  const [selecaoAdd, setSelecaoAdd] = useState<string>("");

  const setExecutados = (novo: ServicoItem[]) => {
    onPatch({ servicos_executados: novo, valor_executado: sumItens(novo) });
  };

  const addServico = () => {
    const s = servicos.find((x) => x.id === selecaoAdd);
    if (!s) return;
    setExecutados([...executados, itemFromServico(s)]);
    setSelecaoAdd("");
  };

  const updateItem = (idx: number, patch: Partial<ServicoItem>) => {
    const novo = executados.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.valor_total = Number(merged.valor_unit) * Number(merged.quantidade);
      return merged;
    });
    setExecutados(novo);
  };

  const removeItem = (idx: number) => {
    setExecutados(executados.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5">
        <h3 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Planejado
          <Badge variant="secondary" className="ml-auto">{brl(sumItens(planejados))}</Badge>
        </h3>
        {planejados.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum serviço planejado.</div>
        ) : (
          <ul className="divide-y">
            {planejados.map((p, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.quantidade}× {brl(p.valor_unit)}
                  </div>
                </div>
                <div className="text-sm font-semibold text-primary">{brl(p.valor_total)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
          <PlayCircle className="h-4 w-4" /> Executado
          <Badge className="ml-auto bg-primary text-primary-foreground">{brl(sumItens(executados))}</Badge>
        </h3>

        {executados.length === 0 ? (
          <div className="text-sm text-muted-foreground mb-3">Nenhum serviço executado ainda.</div>
        ) : (
          <ul className="divide-y">
            {executados.map((e, i) => (
              <li key={i} className="py-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.nome}</div>
                  {e.categoria && (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {e.categoria}
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  min={1}
                  disabled={finalizado}
                  value={e.quantidade}
                  onChange={(ev) => updateItem(i, { quantidade: Math.max(1, Number(ev.target.value) || 1) })}
                  className="w-16"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={finalizado}
                  value={e.valor_unit}
                  onChange={(ev) => updateItem(i, { valor_unit: Number(ev.target.value) || 0 })}
                  className="w-24"
                />
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-primary w-24 text-right">{brl(e.valor_total)}</span>
                  {!finalizado && (
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)} title="Remover">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!finalizado && (
          <div className="mt-4 flex gap-2">
            <Select value={selecaoAdd} onValueChange={setSelecaoAdd}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar serviço do catálogo" /></SelectTrigger>
              <SelectContent>
                {servicos.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} · {brl(s.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addServico} disabled={!selecaoAdd} className="gap-1">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Taxa leva-e-traz</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            disabled={finalizado}
            value={atendimento.taxa_leva_traz ?? 0}
            onChange={(e) =>
              onPatch({ taxa_leva_traz: Number(e.target.value) || 0 })
            }
            className="w-28"
          />
        </div>
      </Card>
    </div>
  );
}

// ---------- Registro ----------

function RegistroTab({ atendimento, onPatch }: { atendimento: any; onPatch: (p: any) => void }) {
  const finalizado = atendimento.finalizado;
  const comportamentos: string[] = atendimento.comportamentos ?? [];
  const fotosAntes: string[] = atendimento.fotos_antes ?? [];
  const fotosDepois: string[] = atendimento.fotos_depois ?? [];
  const [rec, setRec] = useState(atendimento.recomendacoes ?? "");
  const [obs, setObs] = useState(atendimento.observacoes ?? "");
  const [prox, setProx] = useState(atendimento.proxima_visita ?? "");

  const toggleComportamento = (v: string) => {
    const novo = comportamentos.includes(v)
      ? comportamentos.filter((x) => x !== v)
      : [...comportamentos, v];
    onPatch({ comportamentos: novo });
  };

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 lg:col-span-2">
        <h3 className="font-display font-semibold text-primary mb-3">Comportamento durante o atendimento</h3>
        <div className="flex flex-wrap gap-2">
          {COMPORTAMENTOS.map((c) => {
            const on = comportamentos.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                disabled={finalizado}
                onClick={() => toggleComportamento(c.value)}
                className={
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition " +
                  (on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent")
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </Card>

      <FotosCard
        title="Fotos antes"
        paths={fotosAntes}
        finalizado={finalizado}
        onAdd={async (path) => onPatch({ fotos_antes: [...fotosAntes, path] })}
        onRemove={(p) => onPatch({ fotos_antes: fotosAntes.filter((x) => x !== p) })}
        atendimentoId={atendimento.id}
        sub="antes"
      />
      <FotosCard
        title="Fotos depois"
        paths={fotosDepois}
        finalizado={finalizado}
        onAdd={async (path) => onPatch({ fotos_depois: [...fotosDepois, path] })}
        onRemove={(p) => onPatch({ fotos_depois: fotosDepois.filter((x) => x !== p) })}
        atendimentoId={atendimento.id}
        sub="depois"
      />

      <Card className="p-5">
        <Label htmlFor="rec" className="text-xs uppercase tracking-wider text-muted-foreground">
          Recomendações ao tutor
        </Label>
        <Textarea
          id="rec"
          rows={5}
          disabled={finalizado}
          value={rec}
          onChange={(e) => setRec(e.target.value)}
          onBlur={() => rec !== (atendimento.recomendacoes ?? "") && onPatch({ recomendacoes: rec })}
          className="mt-2"
          placeholder="Cuidados em casa, produtos indicados, alertas…"
        />
      </Card>

      <Card className="p-5">
        <Label htmlFor="obs" className="text-xs uppercase tracking-wider text-muted-foreground">
          Observações internas
        </Label>
        <Textarea
          id="obs"
          rows={5}
          disabled={finalizado}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={() => obs !== (atendimento.observacoes ?? "") && onPatch({ observacoes: obs })}
          className="mt-2"
          placeholder="Notas para a equipe (não vão ao tutor)."
        />
        <div className="mt-4">
          <Label htmlFor="prox" className="text-xs uppercase tracking-wider text-muted-foreground">
            Próxima visita sugerida
          </Label>
          <Input
            id="prox"
            type="date"
            disabled={finalizado}
            value={prox ?? ""}
            onChange={(e) => setProx(e.target.value)}
            onBlur={() => prox !== (atendimento.proxima_visita ?? "") && onPatch({ proxima_visita: prox || null })}
            className="mt-2 max-w-[200px]"
          />
        </div>
      </Card>
    </div>
  );
}

function FotosCard({
  title, paths, finalizado, onAdd, onRemove, atendimentoId, sub,
}: {
  title: string;
  paths: string[];
  finalizado: boolean;
  onAdd: (path: string) => Promise<void> | void;
  onRemove: (path: string) => void;
  atendimentoId: string;
  sub: string;
}) {
  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
        <Camera className="h-4 w-4" /> {title}
        <Badge variant="secondary" className="ml-auto">{paths.length}</Badge>
      </h3>
      <div className="flex flex-wrap gap-2">
        {paths.map((p) => (
          <Thumb key={p} path={p} onRemove={finalizado ? undefined : () => onRemove(p)} />
        ))}
        {!finalizado && (
          <UploadInput
            label="Adicionar"
            onFile={async (f) => {
              const path = await uploadArquivo(atendimentoId, sub, f);
              await onAdd(path);
            }}
          />
        )}
      </div>
    </Card>
  );
}

// ---------- Ocorrências ----------

function OcorrenciasTab({
  atendimento, ocorrencias, onChanged,
}: { atendimento: any; ocorrencias: any[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-primary">Ocorrências</h3>
        {!atendimento.finalizado && (
          <Button onClick={() => setOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova ocorrência
          </Button>
        )}
      </div>

      {ocorrencias.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma ocorrência registrada.</div>
      ) : (
        <div className="space-y-3">
          {ocorrencias.map((o) => (
            <OcorrenciaCard key={o.id} o={o} onChanged={onChanged} whatsapp={atendimento.clientes?.whatsapp} />
          ))}
        </div>
      )}

      <NovaOcorrenciaDialog
        open={open}
        onOpenChange={setOpen}
        atendimento={atendimento}
        onCreated={onChanged}
      />
    </Card>
  );
}

function OcorrenciaCard({
  o, onChanged, whatsapp,
}: { o: any; onChanged: () => void; whatsapp?: string }) {
  const fotos: string[] = o.fotos ?? [];
  const marcarInformado = async () => {
    const { error } = await supabase
      .from("ocorrencias")
      .update({ tutor_informado: true })
      .eq("id", o.id);
    if (error) toast.error(error.message);
    else { toast.success("Tutor informado"); onChanged(); }
  };
  const abrirWhats = () => {
    if (!whatsapp) { toast.error("Cliente sem WhatsApp"); return; }
    const digits = whatsapp.replace(/\D+/g, "");
    const phone = digits.length <= 11 ? `55${digits}` : digits;
    const label = OCORRENCIA_TIPOS.find((t) => t.value === o.tipo)?.label ?? o.tipo;
    const msg = `Olá! 🐾\n\nPrecisamos avisar sobre uma ocorrência durante o atendimento:\n\n• Tipo: ${label}\n${o.descricao ? `• Descrição: ${o.descricao}\n` : ""}\nEstamos à disposição.\nSpa de Pet Tia Jéssica 💚`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };
  const tipoLabel = OCORRENCIA_TIPOS.find((t) => t.value === o.tipo)?.label ?? o.tipo;
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <div className="font-medium text-sm">{tipoLabel}</div>
          {o.tutor_informado && <Badge variant="secondary">Tutor informado</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(o.created_at).toLocaleString("pt-BR")}
        </div>
      </div>
      {o.descricao && <p className="text-sm mt-1 whitespace-pre-wrap">{o.descricao}</p>}
      {fotos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {fotos.map((p) => <Thumb key={p} path={p} />)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1 border-success/40 text-success hover:bg-success/10"
          onClick={abrirWhats}
        >
          <MessageCircle className="h-3.5 w-3.5" /> Avisar tutor
        </Button>
        {!o.tutor_informado && (
          <Button size="sm" variant="ghost" onClick={marcarInformado}>Marcar como informado</Button>
        )}
      </div>
    </div>
  );
}

function NovaOcorrenciaDialog({
  open, onOpenChange, atendimento, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atendimento: any;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<string>("machucado");
  const [descricao, setDescricao] = useState("");
  const [tutorInformado, setTutorInformado] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTipo("machucado"); setDescricao(""); setTutorInformado(false); setFotos([]);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("ocorrencias").insert({
        atendimento_id: atendimento.id,
        cliente_id: atendimento.cliente_id,
        pet_id: atendimento.pet_id,
        tipo,
        descricao: descricao || null,
        fotos,
        tutor_informado: tutorInformado,
      });
      if (error) throw error;
      toast.success("Ocorrência registrada");
      reset(); onOpenChange(false); onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova ocorrência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OCORRENCIA_TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que aconteceu, onde no corpo, como foi tratado…"
            />
          </div>
          <div>
            <Label>Fotos</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {fotos.map((p) => (
                <Thumb key={p} path={p} onRemove={() => setFotos(fotos.filter((x) => x !== p))} />
              ))}
              <UploadInput
                label="Adicionar foto"
                onFile={async (f) => {
                  const path = await uploadArquivo(atendimento.id, "ocorrencias", f);
                  setFotos((prev) => [...prev, path]);
                }}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={tutorInformado}
              onCheckedChange={(v) => setTutorInformado(v === true)}
            />
            Tutor já informado
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
