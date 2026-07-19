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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, PawPrint, User, Plus, Trash2, Upload, MessageCircle,
  CheckCircle2, Lock, ChevronDown, ChevronUp, Pencil, Star, Printer, FileText,
} from "lucide-react";
import {
  brl, sumItens, itemFromServico, isBanho, isTosa,
  COMPORTAMENTOS, OCORRENCIA_TIPOS, FORMAS_PAGAMENTO, ETAPAS,
  getEtapaStatus, isEtapaConfirmada,
  type ServicoItem, type EtapaStatus,
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
  path, onRemove, onStar, starred,
}: { path: string; onRemove?: () => void; onStar?: () => void; starred?: boolean }) {
  const { data: url } = useSignedUrl(path);
  return (
    <div className="relative group">
      {url ? (
        <img src={url} alt="foto" className={`h-24 w-24 rounded-md object-cover border ${starred ? "ring-2 ring-gold" : ""}`} />
      ) : (
        <div className="h-24 w-24 rounded-md bg-muted animate-pulse" />
      )}
      {onStar && (
        <button
          type="button" onClick={onStar}
          className={`absolute top-1 left-1 h-6 w-6 rounded-full grid place-items-center transition ${
            starred ? "bg-gold text-white" : "bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
          title={starred ? "Foto principal" : "Marcar como principal"}
        >
          <Star className="h-3.5 w-3.5" />
        </button>
      )}
      {onRemove && (
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

function UploadInput({
  label, onFile, disabled, capture,
}: { label: string; onFile: (f: File) => Promise<void> | void; disabled?: boolean; capture?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex">
      <input
        type="file" accept="image/*" multiple className="hidden"
        {...(capture ? { capture: "environment" as any } : {})}
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
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent " +
        (disabled || busy ? "opacity-60 pointer-events-none" : "")
      }>
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
        agendamentos(id, data, hora, servicos(id, nome, valor, categoria))
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
      const { error } = await supabase.from("atendimentos").update(patch as any).eq("id", atendId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atendimento", atendId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const confirmarEtapa = useMutation({
    mutationFn: async ({ num, extra }: { num: number; extra?: Record<string, any> }) => {
      const map = { ...((atendimento?.etapas_status as Record<string, EtapaStatus>) ?? {}) };
      map[String(num)] = {
        status: "concluida",
        confirmado_em: new Date().toISOString(),
        confirmado_por: myProfile?.id ?? null,
        confirmado_por_nome: myProfile?.nome ?? null,
      };
      const nextEtapa = Math.min(8, Math.max(atendimento?.etapa_atual ?? 1, num + 1));
      const patch: Record<string, any> = {
        etapas_status: map,
        etapa_atual: nextEtapa,
        ...(extra ?? {}),
      };
      const { error } = await supabase.from("atendimentos").update(patch as never).eq("id", atendId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa confirmada");
      qc.invalidateQueries({ queryKey: ["atendimento", atendId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao confirmar"),
  });

  const encerrarMut = useMutation({
    mutationFn: async () => {
      if (!atendimento) return;
      const solicitados = (atendimento.servicos_solicitados ?? atendimento.servicos_planejados ?? []) as ServicoItem[];
      const extras = (atendimento.servicos_extras ?? []) as ServicoItem[];
      const executados = [...solicitados, ...extras];
      const valorSolic = sumItens(solicitados);
      const valorExtras = sumItens(extras);
      const taxa = Number(atendimento.taxa_leva_traz ?? 0);
      const desconto = Number(atendimento.desconto ?? 0);
      const valorExec = valorSolic + valorExtras;
      const total = Math.max(0, valorExec + taxa - desconto);

      // gera PDF
      const enriched = {
        ...atendimento,
        servicos_executados: executados,
        valor_executado: valorExec,
        encerrado_em: new Date().toISOString(),
        data_fim: atendimento.data_fim ?? new Date().toISOString(),
      };
      let pdfBlob: Blob | null = null;
      try {
        pdfBlob = generateAtendimentoPDF({
          atendimento: enriched, ocorrencias, empresa: empresa ?? null,
          operador: myProfile?.nome ?? null, returnBlob: true,
        }) as Blob;
      } catch (e) {
        // segue mesmo se falhar
      }

      let pdf_path: string | null = null;
      if (pdfBlob) {
        const path = `atendimentos/${atendId}/relatorio/relatorio-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("spa-fotos").upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });
        if (!upErr) pdf_path = path;
      }

      // marca etapa 8 concluída
      const map = { ...(atendimento.etapas_status ?? {}) } as Record<string, EtapaStatus>;
      map["8"] = {
        status: "concluida",
        confirmado_em: new Date().toISOString(),
        confirmado_por: myProfile?.id ?? null,
        confirmado_por_nome: myProfile?.nome ?? null,
      };

      const { error } = await supabase.from("atendimentos").update({
        finalizado: true,
        data_fim: new Date().toISOString(),
        encerrado_em: new Date().toISOString(),
        encerrado_por: myProfile?.id ?? null,
        etapa_atual: 8,
        etapas_status: map,
        servicos_executados: executados,
        valor_executado: valorExec,
        pdf_path: pdf_path ?? atendimento.pdf_path,
      }).eq("id", atendId);
      if (error) throw error;

      // agendamento → finalizado
      if (atendimento.agendamento_id) {
        await supabase.from("agendamentos").update({ status: "finalizado" }).eq("id", atendimento.agendamento_id);
      }

      // upsert pagamento
      const status = atendimento.pagamento_status === "pago" ? "pago" : "pendente";
      const forma = (atendimento.pagamento_forma ?? "pendente") as any;
      const valorPago = status === "pago" ? total : Number(atendimento.valor_pago ?? 0);
      const hojeISO = new Date().toISOString().slice(0, 10);
      const pagPayload = {
        atendimento_id: atendId,
        cliente_id: atendimento.cliente_id,
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

      // Atualiza pet
      if (atendimento.pet_id) {
        const petPatch: Record<string, any> = { proxima_visita: atendimento.proxima_visita ?? null };
        if (executados.some(isBanho)) petPatch.ultimo_banho = hojeISO;
        if (executados.some(isTosa)) petPatch.ultima_tosa = hojeISO;
        await supabase.from("pets").update(petPatch as any).eq("id", atendimento.pet_id);
      }

      // baixa PDF localmente
      try {
        generateAtendimentoPDF({
          atendimento: enriched, ocorrencias, empresa: empresa ?? null, operador: myProfile?.nome ?? null,
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

  if (isLoading) {
    return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  }
  if (!atendimento) {
    return <PageShell><div className="text-sm text-muted-foreground">Atendimento não encontrado.</div></PageShell>;
  }

  const pet = atendimento.pets;
  const cliente = atendimento.clientes;
  const encerrado = !!atendimento.encerrado_em;
  const canEditAfterLock = !!isAdmin;

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
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Painel</Button>
          </Link>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center overflow-hidden shrink-0">
            {pet?.foto_url ? <img src={pet.foto_url} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-8 w-8 text-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-xl font-semibold text-primary truncate">{pet?.nome}</span>
              {cliente?.vip && <Badge className="badge-gold">VIP</Badge>}
              {encerrado && <Badge className="bg-success text-success-foreground gap-1"><Lock className="h-3 w-3" /> Encerrado</Badge>}
            </div>
            <div className="text-sm text-muted-foreground truncate">{[pet?.porte, pet?.raca].filter(Boolean).join(" · ")}</div>
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {cliente?.nome}</span>
              {cliente?.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {cliente.whatsapp}</span>}
            </div>
            {alertas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {alertas.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 text-warning-foreground px-2 py-0.5 text-[11px]">
                    <AlertTriangle className="h-3 w-3" /> {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <ProgressoEtapas atendimento={atendimento} />

      <div className="space-y-3 mt-4 pb-24">
        {ETAPAS.map((et) => (
          <EtapaCard
            key={et.num}
            etapa={et}
            atendimento={atendimento}
            encerrado={encerrado}
            canEditAfterLock={canEditAfterLock}
            servicos={servicos}
            ocorrencias={ocorrencias}
            empresa={empresa}
            operador={myProfile?.nome}
            onPatch={(p) => patchMut.mutate(p)}
            onConfirmar={(extra) => confirmarEtapa.mutate({ num: et.num, extra })}
            onEncerrar={() => encerrarMut.mutate()}
            onOcorrenciasChanged={() => qc.invalidateQueries({ queryKey: ["atendimento-ocorrencias", atendId] })}
            confirming={confirmarEtapa.isPending}
            encerrando={encerrarMut.isPending}
          />
        ))}
      </div>
    </PageShell>
  );
}

// ---------- Progresso ----------

function ProgressoEtapas({ atendimento }: { atendimento: any }) {
  const atual = atendimento.etapa_atual ?? 1;
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {ETAPAS.map((et, idx) => {
          const st = getEtapaStatus(atendimento, et.num);
          const done = st.status === "concluida";
          const active = et.num === atual && !done;
          return (
            <div key={et.num} className="flex items-center gap-2 shrink-0">
              <div className={
                "h-7 w-7 rounded-full grid place-items-center text-xs font-semibold " +
                (done ? "bg-success text-success-foreground"
                  : active ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground")
              }>
                {done ? <CheckCircle2 className="h-4 w-4" /> : et.num}
              </div>
              <span className={"text-xs " + (active ? "font-semibold text-primary" : "text-muted-foreground")}>
                {et.titulo}
              </span>
              {idx < ETAPAS.length - 1 && <div className={"h-px w-6 " + (done ? "bg-success" : "bg-border")} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Etapa base ----------

function EtapaCard(props: {
  etapa: (typeof ETAPAS)[number];
  atendimento: any;
  encerrado: boolean;
  canEditAfterLock: boolean;
  servicos: any[];
  ocorrencias: any[];
  empresa: any;
  operador?: string | null;
  onPatch: (p: any) => void;
  onConfirmar: (extra?: Record<string, any>) => void;
  onEncerrar: () => void;
  onOcorrenciasChanged: () => void;
  confirming: boolean;
  encerrando: boolean;
}) {
  const { etapa, atendimento, encerrado, canEditAfterLock, onConfirmar, confirming } = props;
  const st = getEtapaStatus(atendimento, etapa.num);
  const done = st.status === "concluida";
  const prevDone = etapa.num === 1 || isEtapaConfirmada(atendimento, etapa.num - 1);
  const bloqueado = !prevDone && !done;
  const [aberto, setAberto] = useState(!done);
  const [editando, setEditando] = useState(false);

  const readOnly = (done && !editando) || encerrado || bloqueado;
  const podeEditarConfirmada = done && (!encerrado || canEditAfterLock);

  return (
    <Card className={"overflow-hidden " + (bloqueado ? "opacity-60" : "")}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/40 transition text-left"
      >
        <div className={
          "h-9 w-9 rounded-full grid place-items-center shrink-0 " +
          (done ? "bg-success text-success-foreground"
            : bloqueado ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground")
        }>
          {done ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-semibold">{etapa.num}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-primary">{etapa.titulo}</span>
            {done && <Badge className="bg-success text-success-foreground text-[10px]">Concluída</Badge>}
            {!done && !bloqueado && <Badge variant="secondary" className="text-[10px]">Em preenchimento</Badge>}
            {bloqueado && <Badge variant="outline" className="text-[10px]"><Lock className="h-3 w-3 mr-1" /> Bloqueada</Badge>}
          </div>
          {done && st.confirmado_em && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Confirmada por {st.confirmado_por_nome ?? "—"} em {new Date(st.confirmado_em).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
        {aberto ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {aberto && !bloqueado && (
        <div className="border-t p-5 space-y-4">
          <EtapaBody {...props} readOnly={readOnly} />
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            {podeEditarConfirmada && !editando && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditando(true)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {(!done || editando) && !encerrado && (
              <Button
                className="gap-2 ml-auto"
                onClick={() => {
                  onConfirmar();
                  setEditando(false);
                }}
                disabled={confirming || (etapa.num === 8)}
              >
                {etapa.num !== 8 && <><CheckCircle2 className="h-4 w-4" /> {etapa.cta}</>}
              </Button>
            )}
            {etapa.num === 8 && !encerrado && (
              <Button
                className="gap-2 ml-auto bg-success text-success-foreground hover:bg-success/90"
                onClick={props.onEncerrar}
                disabled={props.encerrando}
              >
                <Lock className="h-4 w-4" /> {props.encerrando ? "Encerrando…" : etapa.cta}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Corpo por etapa ----------

function EtapaBody(props: React.ComponentProps<typeof EtapaCard> & { readOnly: boolean }) {
  const { etapa } = props;
  switch (etapa.num) {
    case 1: return <Etapa1Solicitado {...props} />;
    case 2: return <Etapa2Extras {...props} />;
    case 3: return <Etapa3FotoAntes {...props} />;
    case 4: return <Etapa4Atendimento {...props} />;
    case 5: return <Etapa5FotoDepois {...props} />;
    case 6: return <Etapa6Relatorio {...props} />;
    case 7: return <Etapa7Pagamento {...props} />;
    case 8: return <Etapa8Encerrar {...props} />;
    default: return null;
  }
}

// ETAPA 1 — Serviço solicitado (snapshot do agendamento)
function Etapa1Solicitado({ atendimento, readOnly, onPatch }: any) {
  const solicitados: ServicoItem[] = atendimento.servicos_solicitados?.length
    ? atendimento.servicos_solicitados
    : atendimento.servicos_planejados ?? [];

  const total = sumItens(solicitados);
  const taxa = Number(atendimento.taxa_leva_traz ?? 0);

  const snapshotIfEmpty = () => {
    if (!atendimento.servicos_solicitados?.length && solicitados.length) {
      onPatch({ servicos_solicitados: solicitados });
    }
  };

  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Serviço vindo do agendamento (não editável)
      </div>
      {solicitados.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nenhum serviço no agendamento.</div>
      ) : (
        <ul className="divide-y">
          {solicitados.map((s, i) => (
            <li key={i} className="py-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{s.nome}</div>
                <div className="text-xs text-muted-foreground">{s.quantidade}× {brl(s.valor_unit)}</div>
              </div>
              <div className="text-sm font-semibold text-primary">{brl(s.valor_total)}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Taxa leva-e-traz: <b>{brl(taxa)}</b></span>
        <span className="font-semibold text-primary">Total solicitado: {brl(total + taxa)}</span>
      </div>
      {!readOnly && !atendimento.servicos_solicitados?.length && (
        <div className="mt-3 text-xs text-muted-foreground" onMouseEnter={snapshotIfEmpty}>
          Ao confirmar, este serviço será travado como o que foi solicitado.
        </div>
      )}
      <SnapshotHelper atendimento={atendimento} onPatch={onPatch} />
    </div>
  );
}

function SnapshotHelper({ atendimento, onPatch }: any) {
  // Garante snapshot na primeira confirmação, sem re-renderizar em loop
  if (!atendimento.servicos_solicitados?.length) {
    const base: ServicoItem[] = atendimento.servicos_planejados ?? [];
    if (base.length > 0) {
      setTimeout(() => onPatch({ servicos_solicitados: base }), 0);
    }
  }
  return null;
}

// ETAPA 2 — Serviços extras
function Etapa2Extras({ atendimento, readOnly, servicos, onPatch }: any) {
  const extras: ServicoItem[] = atendimento.servicos_extras ?? [];
  const [selecao, setSelecao] = useState("");

  const set = (novo: ServicoItem[]) => onPatch({ servicos_extras: novo });

  const add = () => {
    const s = servicos.find((x: any) => x.id === selecao);
    if (!s) return;
    set([...extras, { ...itemFromServico(s), motivo: "" }]);
    setSelecao("");
  };

  const update = (idx: number, patch: Partial<ServicoItem>) => {
    set(extras.map((it, i) => {
      if (i !== idx) return it;
      const m = { ...it, ...patch };
      m.valor_total = Number(m.valor_unit) * Number(m.quantidade);
      return m;
    }));
  };

  const remove = (idx: number) => set(extras.filter((_, i) => i !== idx));

  const total = sumItens(extras);

  return (
    <div>
      {extras.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nenhum serviço extra. Se não houver, apenas confirme.</div>
      ) : (
        <ul className="divide-y">
          {extras.map((e, i) => (
            <li key={i} className="py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{e.nome}</div>
                <Input
                  disabled={readOnly}
                  value={e.motivo ?? ""}
                  onChange={(ev) => update(i, { motivo: ev.target.value })}
                  placeholder="Motivo do extra (obrigatório para relatório)"
                  className="mt-1 text-xs"
                />
              </div>
              <Input type="number" min={1} disabled={readOnly} value={e.quantidade}
                onChange={(ev) => update(i, { quantidade: Math.max(1, Number(ev.target.value) || 1) })} className="w-16" />
              <Input type="number" min={0} step="0.01" disabled={readOnly} value={e.valor_unit}
                onChange={(ev) => update(i, { valor_unit: Number(ev.target.value) || 0 })} className="w-24" />
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-primary w-24 text-right">{brl(e.valor_total)}</span>
                {!readOnly && (
                  <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="mt-3 flex gap-2">
          <Select value={selecao} onValueChange={setSelecao}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar serviço extra" /></SelectTrigger>
            <SelectContent>
              {servicos.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nome} · {brl(s.valor)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={!selecao} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      )}
      {extras.length > 0 && (
        <div className="mt-3 pt-3 border-t text-right text-sm">
          Total extras: <b className="text-primary">{brl(total)}</b>
        </div>
      )}
    </div>
  );
}

// ETAPA 3 — Foto antes
function Etapa3FotoAntes({ atendimento, readOnly, onPatch }: any) {
  const fotos: string[] = atendimento.fotos_antes ?? [];
  const [obs, setObs] = useState(atendimento.observacoes_checkin ?? "");
  const [alergia, setAlergia] = useState(atendimento.alergia_observada ?? "");

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Fotos de chegada (mín. 1)</Label>
        <div className="mt-2 flex flex-wrap gap-3">
          {fotos.map((p) => (
            <Thumb key={p} path={p} onRemove={readOnly ? undefined : () => onPatch({ fotos_antes: fotos.filter((x) => x !== p) })} />
          ))}
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <UploadInput label="Escolher fotos" onFile={async (f) => {
                const path = await uploadArquivo(atendimento.id, "antes", f);
                onPatch({ fotos_antes: [...(atendimento.fotos_antes ?? []), path] });
              }} />
              <UploadInput label="Tirar agora" capture onFile={async (f) => {
                const path = await uploadArquivo(atendimento.id, "antes", f);
                onPatch({ fotos_antes: [...(atendimento.fotos_antes ?? []), path] });
              }} />
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Observações de chegada</Label>
          <Textarea rows={4} disabled={readOnly} value={obs} onChange={(e) => setObs(e.target.value)}
            onBlur={() => obs !== (atendimento.observacoes_checkin ?? "") && onPatch({ observacoes_checkin: obs })}
            placeholder="Sujeira, feridas visíveis, comportamento na chegada…" />
        </div>
        <div>
          <Label>Alergia/reação observada agora</Label>
          <Textarea rows={4} disabled={readOnly} value={alergia} onChange={(e) => setAlergia(e.target.value)}
            onBlur={() => alergia !== (atendimento.alergia_observada ?? "") && onPatch({ alergia_observada: alergia })}
            placeholder="Se algo novo foi notado no momento da chegada." />
        </div>
      </div>
    </div>
  );
}

// ETAPA 4 — Como foi o atendimento
function Etapa4Atendimento({ atendimento, readOnly, ocorrencias, onPatch, onOcorrenciasChanged }: any) {
  const comportamentos: string[] = atendimento.comportamentos ?? [];
  const [obs, setObs] = useState(atendimento.observacoes ?? "");
  const [obsInt, setObsInt] = useState(atendimento.observacoes_internas ?? "");
  const [rec, setRec] = useState(atendimento.recomendacoes ?? "");
  const [dlgOc, setDlgOc] = useState(false);

  const toggle = (v: string) => {
    const novo = comportamentos.includes(v) ? comportamentos.filter((x) => x !== v) : [...comportamentos, v];
    onPatch({ comportamentos: novo });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Comportamento</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMPORTAMENTOS.map((c) => {
            const on = comportamentos.includes(c.value);
            return (
              <button key={c.value} type="button" disabled={readOnly}
                onClick={() => toggle(c.value)}
                className={"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition " +
                  (on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent")}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!atendimento.usou_focinheira} disabled={readOnly}
            onCheckedChange={(v) => onPatch({ usou_focinheira: v === true })} />
          Precisou de focinheira
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!atendimento.precisou_pausa} disabled={readOnly}
            onCheckedChange={(v) => onPatch({ precisou_pausa: v === true })} />
          Precisou de pausa durante o serviço
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Observações para o tutor</Label>
          <Textarea rows={4} disabled={readOnly} value={obs} onChange={(e) => setObs(e.target.value)}
            onBlur={() => obs !== (atendimento.observacoes ?? "") && onPatch({ observacoes: obs })} />
        </div>
        <div>
          <Label>Observações internas (não vão ao tutor)</Label>
          <Textarea rows={4} disabled={readOnly} value={obsInt} onChange={(e) => setObsInt(e.target.value)}
            onBlur={() => obsInt !== (atendimento.observacoes_internas ?? "") && onPatch({ observacoes_internas: obsInt })} />
        </div>
      </div>

      <div>
        <Label>Recomendações ao tutor</Label>
        <Textarea rows={3} disabled={readOnly} value={rec} onChange={(e) => setRec(e.target.value)}
          onBlur={() => rec !== (atendimento.recomendacoes ?? "") && onPatch({ recomendacoes: rec })} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Ocorrências</Label>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={() => setDlgOc(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Registrar ocorrência
            </Button>
          )}
        </div>
        {ocorrencias.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</div>
        ) : (
          <ul className="space-y-2">
            {ocorrencias.map((o: any) => {
              const label = OCORRENCIA_TIPOS.find((t) => t.value === o.tipo)?.label ?? o.tipo;
              return (
                <li key={o.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <b>{label}</b>
                    {o.tutor_informado && <Badge variant="secondary" className="text-[10px]">Tutor informado</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {o.descricao && <p className="mt-1 whitespace-pre-wrap">{o.descricao}</p>}
                </li>
              );
            })}
          </ul>
        )}
        <NovaOcorrenciaDialog open={dlgOc} onOpenChange={setDlgOc} atendimento={atendimento} onCreated={onOcorrenciasChanged} />
      </div>
    </div>
  );
}

// ETAPA 5 — Foto depois
function Etapa5FotoDepois({ atendimento, readOnly, onPatch }: any) {
  const fotos: string[] = atendimento.fotos_depois ?? [];
  const principal: string | null = atendimento.foto_principal_depois ?? null;

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        Fotos do pet finalizado (mín. 1). Marque a estrela para eleger a foto principal.
      </Label>
      <div className="flex flex-wrap gap-3">
        {fotos.map((p) => (
          <Thumb
            key={p} path={p}
            starred={p === principal}
            onStar={readOnly ? undefined : () => onPatch({ foto_principal_depois: p })}
            onRemove={readOnly ? undefined : () => onPatch({
              fotos_depois: fotos.filter((x) => x !== p),
              foto_principal_depois: p === principal ? null : principal,
            })}
          />
        ))}
        {!readOnly && (
          <div className="flex flex-col gap-2">
            <UploadInput label="Escolher fotos" onFile={async (f) => {
              const path = await uploadArquivo(atendimento.id, "depois", f);
              const novo = [...fotos, path];
              onPatch({ fotos_depois: novo, foto_principal_depois: principal ?? path });
            }} />
            <UploadInput label="Tirar agora" capture onFile={async (f) => {
              const path = await uploadArquivo(atendimento.id, "depois", f);
              const novo = [...fotos, path];
              onPatch({ fotos_depois: novo, foto_principal_depois: principal ?? path });
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ETAPA 6 — Relatório
function Etapa6Relatorio({ atendimento, ocorrencias, empresa, operador }: any) {
  const solicitados: ServicoItem[] = atendimento.servicos_solicitados ?? atendimento.servicos_planejados ?? [];
  const extras: ServicoItem[] = atendimento.servicos_extras ?? [];
  const executados = [...solicitados, ...extras];
  const totalServ = sumItens(executados);
  const taxa = Number(atendimento.taxa_leva_traz ?? 0);
  const desconto = Number(atendimento.desconto ?? 0);
  const total = Math.max(0, totalServ + taxa - desconto);

  const baixarPDF = () => {
    try {
      generateAtendimentoPDF({
        atendimento: { ...atendimento, servicos_executados: executados, valor_executado: totalServ },
        ocorrencias, empresa: empresa ?? null, operador: operador ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    }
  };

  const abrirWhats = () => {
    const w = atendimento.clientes?.whatsapp;
    if (!w) { toast.error("Cliente sem WhatsApp"); return; }
    const digits = w.replace(/\D+/g, "");
    const phone = digits.length <= 11 ? `55${digits}` : digits;
    const msg = `Olá! 🐾 O atendimento de *${atendimento.pets?.nome}* foi encerrado. Enviaremos o relatório em PDF em seguida.\n\nSpa de Pet Tia Jéssica 💚`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-accent/20">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Serviços solicitados</div>
            <ul className="mt-1">{solicitados.map((s, i) => (
              <li key={i} className="flex justify-between"><span>{s.quantidade}× {s.nome}</span><b>{brl(s.valor_total)}</b></li>
            ))}</ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Serviços extras</div>
            {extras.length === 0 ? <div className="text-muted-foreground">Nenhum</div> : (
              <ul className="mt-1">{extras.map((s, i) => (
                <li key={i} className="flex justify-between"><span>{s.quantidade}× {s.nome}</span><b>{brl(s.valor_total)}</b></li>
              ))}</ul>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><div className="text-[10px] uppercase text-muted-foreground">Serviços</div><b className="text-primary">{brl(totalServ)}</b></div>
          <div><div className="text-[10px] uppercase text-muted-foreground">Leva-e-traz</div><b>{brl(taxa)}</b></div>
          <div><div className="text-[10px] uppercase text-muted-foreground">Desconto</div><b className="text-destructive">- {brl(desconto)}</b></div>
          <div><div className="text-[10px] uppercase text-muted-foreground">Total a cobrar</div><b className="text-lg text-primary">{brl(total)}</b></div>
        </div>
        {atendimento.observacoes && (
          <div className="mt-3"><div className="text-[10px] uppercase text-muted-foreground">Observações ao tutor</div>
            <p className="whitespace-pre-wrap text-sm">{atendimento.observacoes}</p></div>
        )}
        {atendimento.recomendacoes && (
          <div className="mt-2"><div className="text-[10px] uppercase text-muted-foreground">Recomendações</div>
            <p className="whitespace-pre-wrap text-sm">{atendimento.recomendacoes}</p></div>
        )}
        {ocorrencias.length > 0 && (
          <div className="mt-2"><div className="text-[10px] uppercase text-muted-foreground">Ocorrências</div>
            <ul className="text-sm">{ocorrencias.map((o: any) => (
              <li key={o.id}>• {OCORRENCIA_TIPOS.find((t) => t.value === o.tipo)?.label ?? o.tipo}</li>
            ))}</ul></div>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2" onClick={baixarPDF}><FileText className="h-4 w-4" /> Baixar PDF</Button>
        <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button>
        <Button variant="outline" className="gap-2" onClick={abrirWhats}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
      </div>
    </div>
  );
}

// ETAPA 7 — Pagamento
function Etapa7Pagamento({ atendimento, readOnly, onPatch }: any) {
  const solicitados: ServicoItem[] = atendimento.servicos_solicitados ?? atendimento.servicos_planejados ?? [];
  const extras: ServicoItem[] = atendimento.servicos_extras ?? [];
  const totalServ = sumItens([...solicitados, ...extras]);
  const taxa = Number(atendimento.taxa_leva_traz ?? 0);
  const desconto = Number(atendimento.desconto ?? 0);
  const total = Math.max(0, totalServ + taxa - desconto);

  const status = atendimento.pagamento_status ?? "pendente";
  const forma = atendimento.pagamento_forma ?? "pendente";
  const [motivo, setMotivo] = useState(atendimento.desconto_motivo ?? "");

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>Desconto (R$)</Label>
          <Input type="number" min={0} step="0.01" disabled={readOnly}
            value={atendimento.desconto ?? 0}
            onChange={(e) => onPatch({ desconto: Number(e.target.value) || 0 })} />
        </div>
        <div className="md:col-span-2">
          <Label>Motivo do desconto</Label>
          <Input disabled={readOnly} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => motivo !== (atendimento.desconto_motivo ?? "") && onPatch({ desconto_motivo: motivo })}
            placeholder="Ex.: cliente VIP, cortesia, correção" />
        </div>
      </div>

      <Card className="p-3 bg-primary/5 flex items-center justify-between">
        <div><div className="text-[10px] uppercase text-muted-foreground">Total a cobrar</div>
          <b className="font-display text-2xl text-primary">{brl(total)}</b></div>
        <div className="text-right text-xs text-muted-foreground">
          Serviços {brl(totalServ)}<br />
          Leva-e-traz {brl(taxa)}<br />
          Desconto - {brl(desconto)}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Status do pagamento</Label>
          <Select value={status} onValueChange={(v) => onPatch({ pagamento_status: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Forma</Label>
          <Select value={forma} onValueChange={(v) => onPatch({ pagamento_forma: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === "parcial" && (
        <div>
          <Label>Valor já pago (R$)</Label>
          <Input type="number" min={0} step="0.01" disabled={readOnly}
            value={atendimento.valor_pago ?? 0}
            onChange={(e) => onPatch({ valor_pago: Number(e.target.value) || 0 })} />
        </div>
      )}
    </div>
  );
}

// ETAPA 8 — Encerrar
function Etapa8Encerrar({ atendimento, encerrado }: any) {
  const pendencias: string[] = [];
  ETAPAS.slice(0, 7).forEach((et) => {
    if (!isEtapaConfirmada(atendimento, et.num)) pendencias.push(et.titulo);
  });
  const fotosAntesOk = (atendimento.fotos_antes ?? []).length > 0;
  const fotosDepoisOk = (atendimento.fotos_depois ?? []).length > 0;
  if (!fotosAntesOk) pendencias.push("Enviar pelo menos 1 foto do antes");
  if (!fotosDepoisOk) pendencias.push("Enviar pelo menos 1 foto do depois");

  if (encerrado) {
    return (
      <div className="text-sm">
        <div className="flex items-center gap-2 text-success"><Lock className="h-4 w-4" /> Atendimento encerrado.</div>
        <div className="mt-1 text-muted-foreground">
          Registro travado. Apenas administradores podem reabrir para edição.
        </div>
      </div>
    );
  }

  if (pendencias.length > 0) {
    return (
      <div>
        <div className="text-sm text-warning-foreground mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" /> Ainda faltam etapas obrigatórias:
        </div>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          {pendencias.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      Todas as etapas foram confirmadas. Ao encerrar: geramos o PDF final, atualizamos o histórico do pet
      e criamos o registro financeiro conforme o pagamento informado. Após encerrar, o atendimento fica travado.
    </div>
  );
}

// ---------- Nova ocorrência (dialog) ----------
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function NovaOcorrenciaDialog({
  open, onOpenChange, atendimento, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; atendimento: any; onCreated: () => void }) {
  const [tipo, setTipo] = useState<string>("machucado");
  const [descricao, setDescricao] = useState("");
  const [tutorInformado, setTutorInformado] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTipo("machucado"); setDescricao(""); setTutorInformado(false); setFotos([]); };

  const submit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("ocorrencias").insert({
        atendimento_id: atendimento.id,
        cliente_id: atendimento.cliente_id,
        pet_id: atendimento.pet_id,
        tipo: tipo as any,
        descricao: descricao || "",
        fotos,
        tutor_informado: tutorInformado,
      });
      if (error) throw error;
      toast.success("Ocorrência registrada");
      reset(); onOpenChange(false); onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nova ocorrência</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OCORRENCIA_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label>Fotos</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {fotos.map((p) => <Thumb key={p} path={p} onRemove={() => setFotos(fotos.filter((x) => x !== p))} />)}
              <UploadInput label="Adicionar foto" onFile={async (f) => {
                const path = await uploadArquivo(atendimento.id, "ocorrencias", f);
                setFotos((prev) => [...prev, path]);
              }} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={tutorInformado} onCheckedChange={(v) => setTutorInformado(v === true)} />
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
