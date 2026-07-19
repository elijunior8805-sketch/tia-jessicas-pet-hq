import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, Camera, Upload, Trash2, Star,
  CheckCircle2, FileText, PawPrint, Sparkles, MessageCircle,
  Download, Printer, Eye, ClipboardList, Lock, Plus, Minus,
} from "lucide-react";
import {
  brl, sumItens, itemFromServico, isBanho, isTosa,
  FORMAS_PAGAMENTO, getEtapaStatus, isEtapaConfirmada,
  type ServicoItem, type FotoItem, type EtapaStatus,
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
  path, onRemove, onStar, starred, disabled, onClick,
}: {
  path: string; onRemove?: () => void; onStar?: () => void;
  starred?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  const { data: url } = useSignedUrl(path);
  return (
    <div className="relative group">
      {url ? (
        <img
          src={url} alt="foto"
          onClick={onClick}
          className={`h-24 w-24 rounded-lg object-cover border cursor-zoom-in ${starred ? "ring-2 ring-primary" : ""}`}
        />
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

async function baixarFoto(path: string, filename: string) {
  try {
    const { data, error } = await supabase.storage.from("spa-fotos").createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) throw error ?? new Error("Sem URL");
    const resp = await fetch(data.signedUrl);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e: any) {
    toast.error(e?.message ?? "Erro ao baixar foto");
  }
}

async function compartilharFotoWhats(path: string, whatsapp: string | null | undefined, petNome: string, clienteNome: string) {
  const fone = (whatsapp ?? "").replace(/\D/g, "");
  if (!fone) { toast.error("Cliente sem WhatsApp"); return; }
  const { data, error } = await supabase.storage.from("spa-fotos").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
  const msg = `Olá, ${clienteNome}! 🐾 Foto do ${petNome} pronto no Spa da Tia Jéssica:\n\n${data.signedUrl}`;
  const numeroCC = fone.startsWith("55") ? fone : `55${fone}`;
  window.open(`https://wa.me/${numeroCC}?text=${encodeURIComponent(msg)}`, "_blank");
}

function ResultadoFotoCard({
  path, principal, disabled, hero, onZoom, onStar, onRemove, onDownload, onShare, filename,
}: {
  path: string; principal?: boolean; disabled?: boolean; hero?: boolean; filename: string;
  onZoom: () => void; onStar?: () => void; onRemove?: () => void;
  onDownload: () => void; onShare?: () => void;
}) {
  const { data: url } = useSignedUrl(path);
  return (
    <div className={`group relative overflow-hidden bg-muted ${
      hero
        ? "rounded-2xl border-2 border-primary/40 ring-1 ring-gold/40 shadow-premium"
        : `rounded-xl border ${principal ? "ring-2 ring-primary shadow-elegant" : ""}`
    }`}>
      {url ? (
        <img
          src={url}
          alt={filename}
          onClick={onZoom}
          className={`w-full object-cover cursor-zoom-in transition group-hover:scale-[1.02] ${
            hero ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-square"
          }`}
        />
      ) : (
        <div className={`w-full bg-muted animate-pulse ${hero ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-square"}`} />
      )}

      {principal && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary/95 text-primary-foreground text-[10px] font-semibold px-2 py-1 uppercase tracking-wider shadow-md">
          <Star className="h-3 w-3 fill-current" /> Principal
        </span>
      )}

      {onStar && !disabled && !principal && (
        <button
          type="button" onClick={onStar}
          className="absolute top-2 left-2 h-8 w-8 rounded-full bg-background/90 text-muted-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition hover:text-primary"
          title="Marcar como principal"
        >
          <Star className="h-4 w-4" />
        </button>
      )}

      {onRemove && !disabled && (
        <button
          type="button" onClick={onRemove}
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition"
          title="Remover"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Actions overlay: always visible on mobile, hover on desktop */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 flex gap-2">
        <Button
          type="button" size="sm" variant="secondary"
          className="flex-1 h-9 text-xs backdrop-blur bg-white/95 hover:bg-white text-foreground"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Baixar
        </Button>
        {onShare && (
          <Button
            type="button" size="sm"
            className="flex-1 h-9 text-xs bg-[#25D366] hover:bg-[#20b858] text-white"
            onClick={(e) => { e.stopPropagation(); onShare(); }}
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1" /> Enviar
          </Button>
        )}
      </div>
    </div>
  );
}

function UploadButton({
  onFile, disabled, label = "Adicionar foto",
}: { onFile: (f: File) => Promise<void> | void; disabled?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex">
      <input
        type="file" accept="image/*" multiple capture="environment" className="hidden"
        disabled={disabled || busy}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length === 0) return;
          setBusy(true);
          try { for (const f of files) await onFile(f); toast.success("Foto(s) enviada(s)"); }
          catch (err: any) { toast.error(err.message ?? "Erro ao enviar foto"); }
          finally { setBusy(false); }
        }}
      />
      <span className={
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm cursor-pointer hover:bg-accent transition " +
        (disabled || busy ? "opacity-60 pointer-events-none" : "")
      }>
        <Upload className="h-4 w-4" /> {busy ? "Enviando…" : label}
      </span>
    </label>
  );
}

// ---------- Etapa badge + confirm ----------

function EtapaBadge({ st }: { st: EtapaStatus }) {
  if (st.status === "concluida") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success border border-success/30 px-2.5 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="h-3 w-3" /> Concluída
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-[11px] font-medium">
      Pendente
    </span>
  );
}

function ConfirmadaFooter({ st }: { st: EtapaStatus }) {
  if (st.status !== "concluida") return null;
  const dt = st.confirmado_em ? new Date(st.confirmado_em).toLocaleString("pt-BR") : "—";
  return (
    <p className="mt-3 text-[11px] text-muted-foreground">
      Confirmada em {dt} por {st.confirmado_por_nome ?? "—"}
    </p>
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
        agendamentos(id, data, hora, observacoes)
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

  const confirmarEtapa = async (num: number, extraPatch: Record<string, any> = {}) => {
    const map = { ...((atendimento as any)?.etapas_status ?? {}) };
    map[String(num)] = {
      status: "concluida",
      confirmado_em: new Date().toISOString(),
      confirmado_por: myProfile?.id ?? null,
      confirmado_por_nome: myProfile?.nome ?? null,
    };
    await patchMut.mutateAsync({ ...extraPatch, etapas_status: map });
    toast.success("Etapa confirmada");
  };

  // Local state for inputs
  const [obs, setObs] = useState("");
  const [obsInt, setObsInt] = useState("");
  const [rec, setRec] = useState("");
  const [prox, setProx] = useState("");
  const [taxa, setTaxa] = useState(0);
  const [desc, setDesc] = useState(0);
  const [valorPagoInput, setValorPagoInput] = useState(0);
  const [formaPag, setFormaPag] = useState<string>("");
  const [focinheira, setFocinheira] = useState(false);
  const [pausa, setPausa] = useState(false);
  const [zoomFoto, setZoomFoto] = useState<string | null>(null);
  const [motivoReabrir, setMotivoReabrir] = useState("");
  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);

  useEffect(() => {
    if (!atendimento) return;
    setObs((atendimento as any).observacoes ?? "");
    setObsInt((atendimento as any).observacoes_internas ?? "");
    setRec((atendimento as any).recomendacoes ?? "");
    setProx((atendimento as any).proxima_visita ?? "");
    setTaxa(Number((atendimento as any).taxa_leva_traz ?? 0));
    setDesc(Number((atendimento as any).desconto ?? 0));
    setValorPagoInput(Number((atendimento as any).valor_pago ?? 0));
    setFormaPag((atendimento as any).pagamento_forma ?? "");
    setFocinheira(!!(atendimento as any).usou_focinheira);
    setPausa(!!(atendimento as any).precisou_pausa);
  }, [atendimento?.id]);

  // Hooks must run on every render — declare BEFORE any early return.
  const encerrarMut = useMutation({
    mutationFn: async () => {
      if (!atendimento) throw new Error("Atendimento não carregado");
      const pendentes: string[] = [];
      const need = [
        [1, "Serviço solicitado"], [2, "Serviços extras"], [3, "Fotos antes"],
        [4, "Informações do atendimento"], [5, "Fotos depois"],
        [7, "Pagamento"], [6, "Relatório"],
      ] as const;
      for (const [n, label] of need) {
        if (!isEtapaConfirmada(atendimento, n)) pendentes.push(label);
      }
      if (pendentes.length) {
        throw new Error("Etapas pendentes:\n• " + pendentes.join("\n• "));
      }
      const executados = [...(((atendimento as any).servicos_solicitados ?? (atendimento as any).servicos_planejados ?? []) as ServicoItem[]), ...(((atendimento as any).servicos_extras ?? []) as ServicoItem[])];
      const subtotalCalc = sumItens(executados) + Number(taxa || 0) - Number(desc || 0);
      const { error } = await supabase.from("atendimentos").update({
        finalizado: true,
        data_fim: new Date().toISOString(),
        encerrado_em: new Date().toISOString(),
        encerrado_por: myProfile?.id ?? null,
        servicos_executados: executados as any,
        valor_executado: subtotalCalc,
        taxa_leva_traz: Number(taxa || 0),
        desconto: Number(desc || 0),
      } as never).eq("id", atendId);
      if (error) throw error;

      if ((atendimento as any).agendamento_id) {
        await supabase.from("agendamentos")
          .update({ status: "finalizado" })
          .eq("id", (atendimento as any).agendamento_id);
      }
      const hojeISO = new Date().toISOString().slice(0, 10);
      if ((atendimento as any).pet_id) {
        const petPatch: Record<string, any> = {
          proxima_visita: (atendimento as any).proxima_visita ?? null,
        };
        if (executados.some(isBanho)) petPatch.ultimo_banho = hojeISO;
        if (executados.some(isTosa)) petPatch.ultima_tosa = hojeISO;
        await supabase.from("pets").update(petPatch as any).eq("id", (atendimento as any).pet_id);
      }
      await confirmarEtapa(8);
    },
    onSuccess: () => {
      toast.success("Atendimento encerrado com sucesso");
      qc.invalidateQueries({ queryKey: ["atendimento", atendId] });
      qc.invalidateQueries({ queryKey: ["atendimentos-painel"] });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao encerrar"),
  });

  const pendentesFinais = useMemo(() => {
    if (!atendimento) return [];
    const items = [
      [1, "Serviço solicitado"], [2, "Serviços realizados"], [3, "Fotos antes"],
      [4, "Informações do atendimento"], [5, "Fotos depois"],
      [7, "Pagamento"], [6, "Relatório"],
    ] as const;
    return items.filter(([n]) => !isEtapaConfirmada(atendimento, n)).map(([, l]) => l);
  }, [atendimento]);

  const excluirMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("excluir_atendimento", { _atendimento_id: atendId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento excluído. Agendamento, histórico e financeiro atualizados.");
      qc.invalidateQueries({ queryKey: ["atendimento", atendId] });
      qc.invalidateQueries({ queryKey: ["atendimentos-painel"] });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["pets"] });
      setExcluirOpen(false);
      navigate({ to: "/agenda" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir atendimento"),
  });


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

  const solicitados: ServicoItem[] = ((atendimento as any).servicos_solicitados ?? (atendimento as any).servicos_planejados ?? []) as ServicoItem[];
  const extras: ServicoItem[] = ((atendimento as any).servicos_extras ?? []) as ServicoItem[];
  const fotosAntes: FotoItem[] = ((atendimento as any).fotos_antes ?? []) as FotoItem[];
  const fotosDepois: FotoItem[] = ((atendimento as any).fotos_depois ?? []) as FotoItem[];

  const valorSolicitados = sumItens(solicitados);
  const valorExtras = sumItens(extras);
  const subtotal = valorSolicitados + valorExtras;
  const total = Math.max(0, subtotal + Number(taxa || 0) - Number(desc || 0));

  const st = (n: number) => getEtapaStatus(atendimento, n);

  const alertas: string[] = [];
  if (pet?.alergias) alertas.push(`Alergia: ${pet.alergias}`);
  if (pet?.temperamento) alertas.push(`Temperamento: ${pet.temperamento}`);
  if (pet?.necessita_focinheira) alertas.push("Precisa de focinheira");
  if (pet?.cuidados_saude) alertas.push(`Saúde: ${pet.cuidados_saude}`);

  const subtitleParts = [pet?.raca, pet?.porte, cliente?.whatsapp].filter(Boolean);

  // ---- Handlers ----

  const addExtra = (id: string) => {
    if (readOnly) return;
    const s = servicos.find((x: any) => x.id === id);
    if (!s) return;
    const novo = itemFromServico(s as any, 1);
    novo.adicionado_por = myProfile?.id ?? null;
    novo.adicionado_por_nome = myProfile?.nome ?? null;
    novo.adicionado_em = new Date().toISOString();
    patchMut.mutate({ servicos_extras: [...extras, novo] as any });
  };

  const updateExtra = (idx: number, patch: Partial<ServicoItem>) => {
    if (readOnly) return;
    const next = extras.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.valor_total = Number(merged.quantidade || 0) * Number(merged.valor_unit || 0);
      return merged;
    });
    patchMut.mutate({ servicos_extras: next as any });
  };

  const removeExtra = (idx: number) => {
    if (readOnly) return;
    patchMut.mutate({ servicos_extras: extras.filter((_, i) => i !== idx) as any });
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
    await patchMut.mutateAsync({ [key]: [...list, novo] as any });
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

  // ---- Pagamento ----

  const confirmarPagamento = async () => {
    if (!formaPag) { toast.error("Selecione a forma de pagamento"); return; }
    const pago = ["dinheiro","pix","debito","credito"].includes(formaPag);
    const parcial = formaPag === "parcial";
    const valorPago = pago ? total : parcial ? Number(valorPagoInput || 0) : 0;
    const status = pago ? "pago" : parcial && valorPago > 0 && valorPago < total ? "parcial" : "pendente";

    await patchMut.mutateAsync({
      pagamento_forma: formaPag,
      pagamento_status: status,
      valor_pago: valorPago,
      taxa_leva_traz: Number(taxa || 0),
      desconto: Number(desc || 0),
    });

    const hojeISO = new Date().toISOString().slice(0, 10);
    const pagPayload: any = {
      atendimento_id: atendId,
      cliente_id: (atendimento as any).cliente_id,
      valor_total: total,
      valor_pago: valorPago,
      forma: pago ? formaPag : parcial ? "pendente" : "pendente",
      status: pago ? "pago" : "pendente",
      vencimento: hojeISO,
      data_pagamento: pago ? hojeISO : null,
    };
    const { data: existing } = await supabase.from("pagamentos")
      .select("id").eq("atendimento_id", atendId).maybeSingle();
    if (existing) await supabase.from("pagamentos").update(pagPayload).eq("id", existing.id);
    else await supabase.from("pagamentos").insert(pagPayload);

    await confirmarEtapa(7);
  };

  // ---- Relatório ----

  const buildPDF = (returnBlob = false): Blob | string => {
    const executados: ServicoItem[] = [...solicitados, ...extras];
    const enriched = {
      ...atendimento,
      servicos_executados: executados,
      valor_executado: subtotal,
      taxa_leva_traz: Number(taxa || 0),
      desconto: Number(desc || 0),
      encerrado_em: (atendimento as any).encerrado_em ?? new Date().toISOString(),
      data_fim: (atendimento as any).data_fim ?? new Date().toISOString(),
    };
    return generateAtendimentoPDF({
      atendimento: enriched,
      ocorrencias,
      empresa: empresa ?? null,
      operador: myProfile?.nome ?? null,
      returnBlob,
    }) as any;
  };

  const visualizarRelatorio = () => {
    const blob = buildPDF(true) as Blob;
    const url = URL.createObjectURL(blob);
    setPdfPreview(url);
  };

  const baixarRelatorio = () => { buildPDF(false); };

  const imprimirRelatorio = () => {
    const blob = buildPDF(true) as Blob;
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) { setTimeout(() => { try { w.print(); } catch {} }, 500); }
  };

  const confirmarRelatorio = async () => {
    const blob = buildPDF(true) as Blob;
    const path = `atendimentos/${atendId}/relatorio/relatorio-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("spa-fotos")
      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (error) { toast.error("Erro ao salvar PDF"); return; }
    await confirmarEtapa(6, { pdf_path: path });
  };

  // ---- Reabrir (admin) ----
  const reabrir = async () => {
    if (!motivoReabrir.trim()) { toast.error("Informe o motivo"); return; }
    await patchMut.mutateAsync({
      encerrado_em: null,
      encerrado_por: null,
      finalizado: false,
      reaberto_motivo: motivoReabrir,
    });
    toast.success("Atendimento reaberto");
    setReabrirOpen(false);
  };

  const pagStatus = (atendimento as any).pagamento_status;

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-6">
        <Link to="/agenda" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Voltar para agenda
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-tight">
              {pet?.nome ?? "—"} <span className="text-muted-foreground font-normal">·</span> {cliente?.nome ?? "—"}
            </h1>
            {subtitleParts.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitleParts.join(" · ")}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {encerrado && (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Encerrado
              </span>
            )}
            {isAdmin && encerrado && (
              <Button size="sm" variant="outline" onClick={() => setReabrirOpen(true)}>
                <Lock className="h-3.5 w-3.5 mr-1" /> Reabrir
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setExcluirOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
              </Button>
            )}
          </div>
        </div>

        {alertas.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            {alertas.map((a, i) => (
              <span key={i} className="text-xs bg-background/60 border rounded-full px-2 py-1">{a}</span>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ---- Left column ---- */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Serviço Solicitado */}
          <Card className="p-6 border-l-4 border-l-gold">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-display text-xl flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Serviço solicitado
              </h2>
              <EtapaBadge st={st(1)} />
            </div>
            {solicitados.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum serviço vinculado ao agendamento original.
              </p>
            ) : (
              <div className="divide-y">
                {solicitados.map((it, i) => (
                  <div key={i} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{it.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        Quantidade: {it.quantidade} · Registro original do agendamento
                      </div>
                    </div>
                    <div className="font-medium tabular-nums">{brl(it.valor_total)}</div>
                  </div>
                ))}
              </div>
            )}
            {(atendimento as any).agendamentos?.observacoes && (
              <p className="mt-3 text-sm bg-muted/40 rounded-lg p-3 border">
                <span className="font-medium">Observações do agendamento:</span>{" "}
                {(atendimento as any).agendamentos.observacoes}
              </p>
            )}
            {!readOnly && !isEtapaConfirmada(atendimento, 1) && (
              <Button className="mt-4 w-full uppercase" onClick={() => confirmarEtapa(1)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar serviço solicitado
              </Button>
            )}
            <ConfirmadaFooter st={st(1)} />
          </Card>

          {/* 2. Serviços extras */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="font-display text-xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" /> Serviços extras
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione serviços realizados além do solicitado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EtapaBadge st={st(2)} />
                {!readOnly && (
                  <div className="min-w-[220px]">
                    <Select value="" onValueChange={addExtra}>
                      <SelectTrigger className="rounded-full">
                        <SelectValue placeholder="+ adicionar serviço" />
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
            </div>

            {extras.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                Nenhum serviço extra adicionado.
              </p>
            ) : (
              <div className="divide-y">
                {extras.map((it, i) => (
                  <div key={i} className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-medium">{it.nome}</div>
                      {it.categoria && (
                        <div className="text-xs text-muted-foreground">{it.categoria}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8"
                        disabled={readOnly}
                        onClick={() => updateExtra(i, { quantidade: Math.max(1, (it.quantidade || 1) - 1) })}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input type="number" min={1} step={1} value={it.quantidade}
                        disabled={readOnly}
                        onChange={(e) => updateExtra(i, { quantidade: Number(e.target.value || 1) })}
                        className="w-14 h-8 text-center" />
                      <Button variant="outline" size="icon" className="h-8 w-8"
                        disabled={readOnly}
                        onClick={() => updateExtra(i, { quantidade: (it.quantidade || 1) + 1 })}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Valor</Label>
                      <Input type="number" min={0} step="0.01" value={it.valor_unit}
                        disabled={readOnly}
                        onChange={(e) => updateExtra(i, { valor_unit: Number(e.target.value || 0) })}
                        className="w-24 h-8" />
                    </div>
                    <div className="w-24 text-right font-medium tabular-nums">{brl(it.valor_total)}</div>
                    {!readOnly && (
                      <Button variant="ghost" size="icon" onClick={() => removeExtra(i)}
                        className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!readOnly && !isEtapaConfirmada(atendimento, 2) && (
              <Button className="mt-4 w-full uppercase" onClick={() => confirmarEtapa(2)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar e confirmar serviços
              </Button>
            )}
            <ConfirmadaFooter st={st(2)} />
          </Card>

          {/* 3. Fotos antes */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-display text-xl flex items-center gap-2">
                <Camera className="h-5 w-5 text-muted-foreground" /> Fotos antes do atendimento
              </h2>
              <div className="flex items-center gap-2">
                <EtapaBadge st={st(3)} />
                {!readOnly && <UploadButton onFile={(f) => addFoto("antes", f)} label="Adicionar" />}
              </div>
            </div>
            {fotosAntes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma foto ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {fotosAntes.map((f, i) => (
                  <Thumb key={i} path={f.path} disabled={readOnly}
                    onClick={() => setZoomFoto(f.path)}
                    onRemove={() => removeFoto("antes", i)} />
                ))}
              </div>
            )}
            {!readOnly && !isEtapaConfirmada(atendimento, 3) && (
              <Button className="mt-4 w-full uppercase" onClick={() => confirmarEtapa(3)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar e confirmar fotos do antes
              </Button>
            )}
            <ConfirmadaFooter st={st(3)} />
          </Card>

          {/* 4. Informações do atendimento */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-display text-xl">Observações do atendimento</h2>
              <EtapaBadge st={st(4)} />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={focinheira} disabled={readOnly}
                    onCheckedChange={(v) => setFocinheira(!!v)} />
                  Usou focinheira
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={pausa} disabled={readOnly}
                    onCheckedChange={(v) => setPausa(!!v)} />
                  Precisou de pausa
                </label>
              </div>
              <div>
                <Label htmlFor="obs">Comportamento, particularidades e incidentes</Label>
                <Textarea id="obs" value={obs} disabled={readOnly}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Comportamento do pet, particularidades, intercorrências…"
                  className="mt-1 min-h-[90px]" />
              </div>
              <div>
                <Label htmlFor="obsint">Observações internas (não vão para o tutor)</Label>
                <Textarea id="obsint" value={obsInt} disabled={readOnly}
                  onChange={(e) => setObsInt(e.target.value)}
                  className="mt-1 min-h-[70px]" />
              </div>
              <div>
                <Label htmlFor="rec">Recomendações para o tutor</Label>
                <Textarea id="rec" value={rec} disabled={readOnly}
                  onChange={(e) => setRec(e.target.value)}
                  placeholder="Produtos, cuidados em casa, alertas…"
                  className="mt-1 min-h-[80px]" />
              </div>
              <div className="max-w-xs">
                <Label htmlFor="prox">Próxima visita recomendada</Label>
                <Input id="prox" type="date" value={prox ?? ""} disabled={readOnly}
                  onChange={(e) => setProx(e.target.value)} className="mt-1" />
              </div>
            </div>
            {!readOnly && (
              <Button className="mt-4 w-full uppercase"
                onClick={async () => {
                  await patchMut.mutateAsync({
                    observacoes: obs, observacoes_internas: obsInt, recomendacoes: rec,
                    proxima_visita: prox || null, usou_focinheira: focinheira, precisou_pausa: pausa,
                  });
                  await confirmarEtapa(4);
                }}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar e confirmar informações
              </Button>
            )}
            <ConfirmadaFooter st={st(4)} />
          </Card>

          {/* 5. Fotos depois — destaque premium */}
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/[0.03] to-transparent shadow-elegant">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div className="min-w-0">
                <h2 className="font-display text-2xl flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                  Pet pronto — Resultado
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Fotos do {pet?.nome ?? "pet"} lindo depois do banho. Compartilhe pelo WhatsApp ou baixe direto no celular.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EtapaBadge st={st(5)} />
                {!readOnly && <UploadButton onFile={(f) => addFoto("depois", f)} label="Nova foto" />}
              </div>
            </div>
            {fotosDepois.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-primary/20 py-12 text-center">
                <Camera className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground italic">Nenhuma foto do resultado ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Capriche na foto do pet lindo!</p>
              </div>
            ) : (() => {
              const principalIdx = fotosDepois.findIndex((f) => f.principal);
              const heroIdx = principalIdx >= 0 ? principalIdx : 0;
              const petSlug = (pet?.nome ?? "pet").toLowerCase().replace(/\s+/g, "-");
              const cardFor = (i: number, opts: { hero?: boolean } = {}) => {
                const f = fotosDepois[i];
                const filename = `${petSlug}-pronto-${i + 1}.jpg`;
                return (
                  <ResultadoFotoCard
                    key={i}
                    path={f.path}
                    principal={!!f.principal}
                    disabled={readOnly}
                    hero={opts.hero}
                    filename={filename}
                    onZoom={() => setZoomFoto(f.path)}
                    onStar={f.principal ? undefined : () => setPrincipal(i)}
                    onRemove={() => removeFoto("depois", i)}
                    onDownload={() => baixarFoto(f.path, filename)}
                    onShare={() => compartilharFotoWhats(
                      f.path, cliente?.whatsapp, pet?.nome ?? "seu pet", cliente?.nome ?? "",
                    )}
                  />
                );
              };
              const outros = fotosDepois.map((_, i) => i).filter((i) => i !== heroIdx);
              return (
                <>
                  {/* Foto principal — destaque hero, sticky no topo em mobile */}
                  <div className="sticky top-2 z-10 -mx-2 px-2 pb-4 sm:static sm:mx-0 sm:px-0 sm:pb-0 sm:mb-4">
                    {cardFor(heroIdx, { hero: true })}
                  </div>
                  {outros.length > 0 && (
                    <>
                      <div className="mb-3 mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        Outras fotos ({outros.length})
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {outros.map((i) => cardFor(i))}
                      </div>
                    </>
                  )}
                  <p className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                    <Star className="h-3 w-3" /> Clique na estrela para marcar a foto principal do resultado.
                  </p>
                </>
              );
            })()}
            {!readOnly && !isEtapaConfirmada(atendimento, 5) && (
              <Button className="mt-5 w-full h-11 uppercase" onClick={() => confirmarEtapa(5)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar e confirmar fotos do resultado
              </Button>
            )}
            <ConfirmadaFooter st={st(5)} />
          </Card>
        </div>

        {/* ---- Right sidebar ---- */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">

            {/* Fechamento e pagamento */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <PawPrint className="h-5 w-5 text-primary" /> Fechamento
                </h2>
                <EtapaBadge st={st(7)} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Serviço solicitado</span>
                  <span className="font-medium tabular-nums">{brl(valorSolicitados)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Serviços extras</span>
                  <span className="font-medium tabular-nums">{brl(valorExtras)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{brl(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <Label className="text-sm text-muted-foreground">Taxa leva-e-traz (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={taxa}
                    disabled={readOnly}
                    onChange={(e) => setTaxa(Number(e.target.value || 0))}
                    className="w-24 h-9 text-right" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-muted-foreground">Desconto (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={desc}
                    disabled={readOnly}
                    onChange={(e) => setDesc(Number(e.target.value || 0))}
                    className="w-24 h-9 text-right" />
                </div>
              </div>

              <div className="border-t mt-3 pt-4 flex items-center justify-between">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-3xl text-primary tabular-nums">{brl(total)}</span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label>Forma de pagamento</Label>
                  <Select value={formaPag || undefined} disabled={readOnly}
                    onValueChange={(v) => setFormaPag(v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                      <SelectItem value="parcial">Pagamento parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formaPag === "parcial" && (
                  <div>
                    <Label>Valor pago agora (R$)</Label>
                    <Input type="number" min={0} step="0.01" value={valorPagoInput}
                      disabled={readOnly}
                      onChange={(e) => setValorPagoInput(Number(e.target.value || 0))}
                      className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Restante em aberto: {brl(Math.max(0, total - Number(valorPagoInput || 0)))}
                    </p>
                  </div>
                )}

                {pagStatus && (
                  <p className="text-xs text-muted-foreground">
                    Status atual: <span className="font-medium">{pagStatus}</span>
                  </p>
                )}

                <Button className="w-full h-11 uppercase"
                  disabled={readOnly || !formaPag}
                  onClick={confirmarPagamento}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar pagamento ou pendência
                </Button>
              </div>
              <ConfirmadaFooter st={st(7)} />
            </Card>

            {/* Relatório */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Relatório final
                </h2>
                <EtapaBadge st={st(6)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={visualizarRelatorio} disabled={readOnly}>
                  <Eye className="h-4 w-4 mr-1" /> Visualizar
                </Button>
                <Button variant="outline" size="sm" onClick={baixarRelatorio} disabled={readOnly}>
                  <Download className="h-4 w-4 mr-1" /> Baixar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={imprimirRelatorio} disabled={readOnly}>
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
                <Button variant="outline" size="sm"
                  disabled={readOnly || !(atendimento as any).pdf_path}
                  onClick={async () => {
                    const fone = (cliente?.whatsapp ?? "").replace(/\D/g, "");
                    if (!fone) { toast.error("Cliente sem WhatsApp"); return; }
                    const { data } = await supabase.storage.from("spa-fotos")
                      .createSignedUrl((atendimento as any).pdf_path, 60 * 60 * 24 * 7);
                    if (!data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
                    const msg = `Olá, ${cliente?.nome ?? ""}! O relatório do atendimento de ${pet?.nome ?? "seu pet"} está pronto:\n\n${data.signedUrl}`;
                    const numeroCC = fone.startsWith("55") ? fone : `55${fone}`;
                    window.open(`https://wa.me/${numeroCC}?text=${encodeURIComponent(msg)}`, "_blank");
                  }}>
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </Button>
              </div>
              {!readOnly && !isEtapaConfirmada(atendimento, 6) && (
                <Button className="mt-3 w-full uppercase" onClick={confirmarRelatorio}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Gerar e confirmar relatório
                </Button>
              )}
              <ConfirmadaFooter st={st(6)} />
            </Card>

            {/* Encerrar */}
            <Card className="p-6">
              <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Encerrar atendimento
              </h2>
              {pendentesFinais.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">Etapas pendentes:</p>
                  <ul className="text-sm space-y-1 mb-3">
                    {pendentesFinais.map((p) => (
                      <li key={p} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {p}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-success mb-3">Todas as etapas confirmadas.</p>
              )}
              <Button className="w-full h-12 uppercase"
                disabled={readOnly || encerrado || encerrarMut.isPending || pendentesFinais.length > 0}
                onClick={() => encerrarMut.mutate()}>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {encerrado ? "Já encerrado" : encerrarMut.isPending ? "Encerrando…" : "Encerrar atendimento"}
              </Button>
            </Card>
          </div>
        </div>
      </div>

      {/* Zoom foto */}
      <Dialog open={!!zoomFoto} onOpenChange={(v) => !v && setZoomFoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Foto</DialogTitle></DialogHeader>
          {zoomFoto && <ZoomImage path={zoomFoto} />}
        </DialogContent>
      </Dialog>

      {/* Preview PDF */}
      <Dialog open={!!pdfPreview} onOpenChange={(v) => { if (!v) { if (pdfPreview) URL.revokeObjectURL(pdfPreview); setPdfPreview(null); } }}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2"><DialogTitle>Pré-visualização do relatório</DialogTitle></DialogHeader>
          {pdfPreview && <iframe src={pdfPreview} className="w-full h-full border-0" title="Relatório" />}
        </DialogContent>
      </Dialog>

      {/* Reabrir dialog */}
      <Dialog open={reabrirOpen} onOpenChange={setReabrirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir atendimento</DialogTitle>
            <DialogDescription>Descreva o motivo. Ficará registrado no histórico.</DialogDescription>
          </DialogHeader>
          <Textarea value={motivoReabrir} onChange={(e) => setMotivoReabrir(e.target.value)}
            placeholder="Motivo da reabertura" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirOpen(false)}>Cancelar</Button>
            <Button onClick={reabrir}>Confirmar reabertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir dialog */}
      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir atendimento</DialogTitle>
            <DialogDescription>
              Esta ação é permanente. Ao excluir este atendimento:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Os pagamentos vinculados serão <strong>removidos</strong>.</li>
                <li>O agendamento vinculado voltará para <strong>Agendado</strong>.</li>
                <li>O histórico do pet (último banho, última tosa, próxima visita) será <strong>recalculado</strong> a partir dos atendimentos restantes.</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirOpen(false)} disabled={excluirMut.isPending}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => excluirMut.mutate()}
              disabled={excluirMut.isPending}
            >
              {excluirMut.isPending ? "Excluindo…" : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function ZoomImage({ path }: { path: string }) {
  const { data: url } = useSignedUrl(path);
  if (!url) return <div className="w-full h-96 bg-muted animate-pulse" />;
  return <img src={url} alt="foto ampliada" className="w-full max-h-[80vh] object-contain rounded-lg" />;
}
