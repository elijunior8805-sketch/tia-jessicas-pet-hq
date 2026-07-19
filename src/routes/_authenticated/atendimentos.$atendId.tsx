import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, Camera, Upload, Trash2, Star,
  CheckCircle2, FileText, PawPrint, Sparkles,
} from "lucide-react";
import {
  brl, sumItens, itemFromServico, isBanho, isTosa,
  FORMAS_PAGAMENTO, type ServicoItem, type FotoItem,
} from "@/lib/atendimento-utils";
import { generateAtendimentoPDF } from "@/lib/atendimento-pdf";
import { useMyProfile } from "@/hooks/use-my-profile";

export const Route = createFileRoute("/_authenticated/atendimentos/$atendId")({
  component: AtendimentoDetalhe,
});

// ---------- Storage helpers ----------

async function uploadArquivo(atendId: string, sub: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `atendimentos/${atendId}/${sub}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("spa-fotos").upload(path, file, {
    upsert: false, contentType: file.type,
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
        .from("spa-fotos").createSignedUrl(path, 60 * 30);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function Thumb({
  path, onRemove, onStar, starred, disabled,
}: { path: string; onRemove?: () => void; onStar?: () => void; starred?: boolean; disabled?: boolean }) {
  const { data: url } = useSignedUrl(path);
  return (
    <div className="relative group">
      {url ? (
        <img src={url} alt="foto" className={`h-24 w-24 rounded-lg object-cover border ${starred ? "ring-2 ring-primary" : ""}`} />
      ) : (
        <div className="h-24 w-24 rounded-lg bg-muted animate-pulse" />
      )}
      {onStar && !disabled && (
        <button
          type="button" onClick={onStar}
          className={`absolute top-1 left-1 h-6 w-6 rounded-full grid place-items-center transition ${
            starred ? "bg-primary text-primary-foreground" : "bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
          title={starred ? "Foto principal" : "Marcar como principal"}
        >
          <Star className="h-3.5 w-3.5" />
        </button>
      )}
      {onRemove && !disabled && (
        <button
          type="button" onClick={onRemove}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition"
          title="Remover"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function UploadButton({
  onFile, disabled,
}: { onFile: (f: File) => Promise<void> | void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex">
      <input
        type="file" accept="image/*" multiple className="hidden"
        disabled={disabled || busy}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length === 0) return;
          setBusy(true);
          try { for (const f of files) await onFile(f); } finally { setBusy(false); }
        }}
      />
      <span className={
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm cursor-pointer hover:bg-accent transition " +
        (disabled || busy ? "opacity-60 pointer-events-none" : "")
      }>
        <Upload className="h-4 w-4" /> {busy ? "Enviando…" : "adicionar"}
      </span>
    </label>
  );
}

// ---------- Página ----------

function AtendimentoDetalhe() {
  const { atendId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: myProfile } = useMyProfile();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", myProfile?.id],
    enabled: !!myProfile?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: myProfile!.id, _role: "admin" });
      return !!data;
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa-config"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config")
        .select("nome_fantasia, cnpj, telefone, endereco").limit(1).maybeSingle();
      if (!data) return null;
      return {
        nome: (data as any).nome_fantasia as string | null,
        cnpj: (data as any).cnpj as string | null,
        telefone: (data as any).telefone as string | null,
        endereco: (data as any).endereco as string | null,
      };
    },
  });

  const { data: atendimento, isLoading } = useQuery({
    queryKey: ["atendimento", atendId],
    queryFn: async () => {
      const { data, error } = await supabase.from("atendimentos").select(`
        *,
        clientes(id, nome, whatsapp, vip),
        pets(id, nome, porte, raca, foto_url, alergias, temperamento, necessita_focinheira, cuidados_saude, observacoes),
        agendamentos(id, data, hora)
      `).eq("id", atendId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos-ativos"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("servicos")
        .select("id, nome, valor, categoria").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: ocorrencias = [] } = useQuery({
    queryKey: ["atendimento-ocorrencias", atendId],
    queryFn: async () => {
      const { data } = await supabase.from("ocorrencias")
        .select("*").eq("atendimento_id", atendId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const patchMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase.from("atendimentos").update(patch as never).eq("id", atendId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atendimento", atendId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const encerrarMut = useMutation({
    mutationFn: async () => {
      if (!atendimento) return;
      const executados = ((atendimento as any).servicos_executados ?? []) as ServicoItem[];
      const valorExec = sumItens(executados);
      const taxa = Number((atendimento as any).taxa_leva_traz ?? 0);
      const desconto = Number((atendimento as any).desconto ?? 0);
      const total = Math.max(0, valorExec + taxa - desconto);

      const enriched = {
        ...atendimento,
        servicos_executados: executados,
        valor_executado: valorExec,
        encerrado_em: new Date().toISOString(),
        data_fim: (atendimento as any).data_fim ?? new Date().toISOString(),
      };

      let pdfBlob: Blob | null = null;
      try {
        pdfBlob = generateAtendimentoPDF({
          atendimento: enriched, ocorrencias, empresa: empresa ?? null,
          operador: myProfile?.nome ?? null, returnBlob: true,
        }) as Blob;
      } catch { /* segue */ }

      let pdf_path: string | null = null;
      if (pdfBlob) {
        const path = `atendimentos/${atendId}/relatorio/relatorio-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("spa-fotos").upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });
        if (!upErr) pdf_path = path;
      }

      const { error } = await supabase.from("atendimentos").update({
        finalizado: true,
        data_fim: new Date().toISOString(),
        encerrado_em: new Date().toISOString(),
        encerrado_por: myProfile?.id ?? null,
        servicos_executados: executados,
        valor_executado: valorExec,
        pdf_path: pdf_path ?? (atendimento as any).pdf_path,
      } as never).eq("id", atendId);
      if (error) throw error;

      if ((atendimento as any).agendamento_id) {
        await supabase.from("agendamentos")
          .update({ status: "finalizado" })
          .eq("id", (atendimento as any).agendamento_id);
      }

      const status = (atendimento as any).pagamento_status === "pago" ? "pago" : "pendente";
      const forma = ((atendimento as any).pagamento_forma ?? "pendente") as any;
      const valorPago = status === "pago" ? total : Number((atendimento as any).valor_pago ?? 0);
      const hojeISO = new Date().toISOString().slice(0, 10);
      const pagPayload = {
        atendimento_id: atendId,
        cliente_id: (atendimento as any).cliente_id,
        valor_total: total,
        valor_pago: valorPago,
        forma,
        status: status as any,
        vencimento: hojeISO,
        data_pagamento: status === "pago" ? hojeISO : null,
      };
      const { data: existing } = await supabase.from("pagamentos")
        .select("id").eq("atendimento_id", atendId).maybeSingle();
      if (existing) await supabase.from("pagamentos").update(pagPayload).eq("id", existing.id);
      else await supabase.from("pagamentos").insert(pagPayload);

      if ((atendimento as any).pet_id) {
        const petPatch: Record<string, any> = {
          proxima_visita: (atendimento as any).proxima_visita ?? null,
        };
        if (executados.some(isBanho)) petPatch.ultimo_banho = hojeISO;
        if (executados.some(isTosa)) petPatch.ultima_tosa = hojeISO;
        await supabase.from("pets").update(petPatch as any).eq("id", (atendimento as any).pet_id);
      }

      try {
        generateAtendimentoPDF({
          atendimento: enriched, ocorrencias, empresa: empresa ?? null,
          operador: myProfile?.nome ?? null,
        });
      } catch {}
    },
    onSuccess: () => {
      toast.success("Atendimento encerrado");
      qc.invalidateQueries({ queryKey: ["atendimento", atendId] });
      qc.invalidateQueries({ queryKey: ["atendimentos-painel"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      navigate({ to: "/atendimentos" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao encerrar"),
  });

  // Local state for fields with typing lag
  const [obs, setObs] = useState("");
  const [rec, setRec] = useState("");
  const [prox, setProx] = useState("");
  const [taxa, setTaxa] = useState(0);
  const [desc, setDesc] = useState(0);

  useEffect(() => {
    if (!atendimento) return;
    setObs((atendimento as any).observacoes ?? "");
    setRec((atendimento as any).recomendacoes ?? "");
    setProx((atendimento as any).proxima_visita ?? "");
    setTaxa(Number((atendimento as any).taxa_leva_traz ?? 0));
    setDesc(Number((atendimento as any).desconto ?? 0));
  }, [atendimento?.id]);

  if (isLoading) {
    return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  }
  if (!atendimento) {
    return <PageShell><div className="text-sm text-muted-foreground">Atendimento não encontrado.</div></PageShell>;
  }

  const pet = (atendimento as any).pets;
  const cliente = (atendimento as any).clientes;
  const encerrado = !!(atendimento as any).encerrado_em;
  const readOnly = encerrado && !isAdmin;

  const executados: ServicoItem[] = ((atendimento as any).servicos_executados ?? []) as ServicoItem[];
  const fotosAntes: FotoItem[] = ((atendimento as any).fotos_antes ?? []) as FotoItem[];
  const fotosDepois: FotoItem[] = ((atendimento as any).fotos_depois ?? []) as FotoItem[];

  const subtotal = sumItens(executados);
  const total = Math.max(0, subtotal + Number(taxa || 0) - Number(desc || 0));

  const alertas: string[] = [];
  if (pet?.alergias) alertas.push(`Alergia: ${pet.alergias}`);
  if (pet?.temperamento) alertas.push(`Temperamento: ${pet.temperamento}`);
  if (pet?.necessita_focinheira) alertas.push("Precisa de focinheira");
  if (pet?.cuidados_saude) alertas.push(`Saúde: ${pet.cuidados_saude}`);

  const subtitleParts = [
    pet?.especie, pet?.raca, pet?.porte, cliente?.whatsapp,
  ].filter(Boolean);

  // ---- Handlers ----

  const addServico = (id: string) => {
    if (readOnly) return;
    const s = servicos.find((x: any) => x.id === id);
    if (!s) return;
    const novo = itemFromServico(s as any, 1);
    novo.adicionado_por = myProfile?.id ?? null;
    novo.adicionado_por_nome = myProfile?.nome ?? null;
    novo.adicionado_em = new Date().toISOString();
    patchMut.mutate({ servicos_executados: [...executados, novo] as any });
  };

  const updateServico = (idx: number, patch: Partial<ServicoItem>) => {
    if (readOnly) return;
    const next = executados.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.valor_total = Number(merged.quantidade || 0) * Number(merged.valor_unit || 0);
      return merged;
    });
    patchMut.mutate({ servicos_executados: next as any });
  };

  const removeServico = (idx: number) => {
    if (readOnly) return;
    const next = executados.filter((_, i) => i !== idx);
    patchMut.mutate({ servicos_executados: next as any });
  };

  const addFoto = async (tipo: "antes" | "depois", file: File) => {
    if (readOnly) return;
    const path = await uploadArquivo(atendId, `foto-${tipo}`, file);
    const novo: FotoItem = {
      path,
      created_at: new Date().toISOString(),
      created_by: myProfile?.id ?? null,
      created_by_nome: myProfile?.nome ?? null,
    };
    const key = tipo === "antes" ? "fotos_antes" : "fotos_depois";
    const list = tipo === "antes" ? fotosAntes : fotosDepois;
    patchMut.mutate({ [key]: [...list, novo] as any });
  };

  const removeFoto = async (tipo: "antes" | "depois", idx: number) => {
    if (readOnly) return;
    const key = tipo === "antes" ? "fotos_antes" : "fotos_depois";
    const list = tipo === "antes" ? fotosAntes : fotosDepois;
    const item = list[idx];
    if (item?.path) {
      await supabase.storage.from("spa-fotos").remove([item.path]).catch(() => {});
    }
    patchMut.mutate({ [key]: list.filter((_, i) => i !== idx) as any });
  };

  const setPrincipal = (idx: number) => {
    if (readOnly) return;
    const list = fotosDepois.map((f, i) => ({ ...f, principal: i === idx }));
    patchMut.mutate({
      fotos_depois: list as any,
      foto_principal_depois: list[idx]?.path ?? null,
    });
  };

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-6">
        <Link to="/atendimentos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-4xl md:text-5xl leading-tight tracking-tight">
              {pet?.nome ?? "—"} <span className="text-muted-foreground font-normal">—</span> {cliente?.nome ?? "—"}
            </h1>
            {subtitleParts.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {subtitleParts.join(" · ")}
              </p>
            )}
          </div>
          {encerrado && (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Encerrado
            </span>
          )}
        </div>

        {alertas.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            {alertas.map((a, i) => (
              <span key={i} className="text-xs bg-background/60 border rounded-full px-2 py-1">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ---- Left column ---- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fotos antes */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl flex items-center gap-2">
                <Camera className="h-5 w-5 text-muted-foreground" /> Fotos antes
              </h2>
              {!readOnly && <UploadButton onFile={(f) => addFoto("antes", f)} />}
            </div>
            {fotosAntes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                Nenhuma foto ainda.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {fotosAntes.map((f, i) => (
                  <Thumb key={i} path={f.path} disabled={readOnly}
                    onRemove={() => removeFoto("antes", i)} />
                ))}
              </div>
            )}
          </Card>

          {/* Serviços executados */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="font-display text-xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" /> Serviços executados
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione todos os serviços realizados neste atendimento.
                </p>
              </div>
              {!readOnly && (
                <div className="min-w-[220px]">
                  <Select value="" onValueChange={addServico}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder="+ serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome} — {brl(s.valor)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {executados.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                Nenhum serviço adicionado ainda.
              </p>
            ) : (
              <div className="divide-y">
                {executados.map((it, i) => (
                  <div key={i} className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-medium">{it.nome}</div>
                      {it.categoria && (
                        <div className="text-xs text-muted-foreground">{it.categoria}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Qtd</Label>
                      <Input
                        type="number" min={1} step={1}
                        value={it.quantidade}
                        disabled={readOnly}
                        onChange={(e) => updateServico(i, { quantidade: Number(e.target.value || 1) })}
                        className="w-16 h-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Valor</Label>
                      <Input
                        type="number" min={0} step="0.01"
                        value={it.valor_unit}
                        disabled={readOnly}
                        onChange={(e) => updateServico(i, { valor_unit: Number(e.target.value || 0) })}
                        className="w-24 h-9"
                      />
                    </div>
                    <div className="w-24 text-right font-medium tabular-nums">
                      {brl(it.valor_total)}
                    </div>
                    {!readOnly && (
                      <Button variant="ghost" size="icon" onClick={() => removeServico(i)}
                        className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Fotos depois */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl flex items-center gap-2">
                <Camera className="h-5 w-5 text-muted-foreground" /> Fotos depois
              </h2>
              {!readOnly && <UploadButton onFile={(f) => addFoto("depois", f)} />}
            </div>
            {fotosDepois.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                Nenhuma foto ainda.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  {fotosDepois.map((f, i) => (
                    <Thumb
                      key={i} path={f.path} disabled={readOnly}
                      starred={!!f.principal}
                      onStar={() => setPrincipal(i)}
                      onRemove={() => removeFoto("depois", i)}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Clique na estrela para escolher a foto principal (perfil do pet).
                </p>
              </>
            )}
          </Card>

          {/* Observações e Recomendações */}
          <Card className="p-6">
            <h2 className="font-display text-xl mb-4">Observações e Recomendações</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="obs">Observações do dia</Label>
                <Textarea
                  id="obs" value={obs} disabled={readOnly}
                  onChange={(e) => setObs(e.target.value)}
                  onBlur={() => patchMut.mutate({ observacoes: obs })}
                  placeholder="Comportamento, particularidades, incidentes…"
                  className="mt-1 min-h-[90px]"
                />
              </div>
              <div>
                <Label htmlFor="rec">Recomendações para o tutor</Label>
                <Textarea
                  id="rec" value={rec} disabled={readOnly}
                  onChange={(e) => setRec(e.target.value)}
                  onBlur={() => patchMut.mutate({ recomendacoes: rec })}
                  placeholder="Produtos recomendados, cuidados em casa, alertas…"
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <div className="max-w-xs">
                <Label htmlFor="prox">Próxima visita</Label>
                <Input
                  id="prox" type="date" value={prox ?? ""} disabled={readOnly}
                  onChange={(e) => setProx(e.target.value)}
                  onBlur={() => patchMut.mutate({ proxima_visita: prox || null })}
                  className="mt-1"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ---- Right sidebar: Fechamento ---- */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card className="p-6">
              <h2 className="font-display text-xl mb-4 flex items-center gap-2">
                <PawPrint className="h-5 w-5 text-primary" /> Fechamento
              </h2>

              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{brl(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between py-2 gap-3">
                <Label className="text-sm text-muted-foreground">Taxa de entrega</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={taxa} disabled={readOnly}
                  onChange={(e) => setTaxa(Number(e.target.value || 0))}
                  onBlur={() => patchMut.mutate({ taxa_leva_traz: Number(taxa || 0) })}
                  className="w-24 h-9 text-right"
                />
              </div>

              <div className="flex items-center justify-between py-2 gap-3">
                <Label className="text-sm text-muted-foreground">Desconto</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={desc} disabled={readOnly}
                  onChange={(e) => setDesc(Number(e.target.value || 0))}
                  onBlur={() => patchMut.mutate({ desconto: Number(desc || 0) })}
                  className="w-24 h-9 text-right"
                />
              </div>

              <div className="border-t mt-3 pt-4 flex items-center justify-between">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-3xl text-primary tabular-nums">
                  {brl(total)}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label>Forma de pagamento</Label>
                  <Select
                    value={(atendimento as any).pagamento_forma ?? ""}
                    disabled={readOnly}
                    onValueChange={(v) => patchMut.mutate({
                      pagamento_forma: v,
                      pagamento_status: v === "pendente" ? "pendente" : "pago",
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full h-12 text-base gap-2"
                  disabled={readOnly || encerrarMut.isPending || executados.length === 0}
                  onClick={() => encerrarMut.mutate()}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {encerrarMut.isPending ? "Finalizando…" : "Finalizar atendimento"}
                </Button>

                {executados.length === 0 && !encerrado && (
                  <p className="text-xs text-muted-foreground text-center">
                    Adicione ao menos um serviço para finalizar.
                  </p>
                )}

                {(atendimento as any).pdf_path && (
                  <Button
                    variant="outline" className="w-full gap-2"
                    onClick={async () => {
                      const { data } = await supabase.storage.from("spa-fotos")
                        .createSignedUrl((atendimento as any).pdf_path, 60 * 5);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                    }}
                  >
                    <FileText className="h-4 w-4" /> Ver relatório
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
