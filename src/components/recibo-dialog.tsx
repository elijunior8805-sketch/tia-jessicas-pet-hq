import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { Download, MessageCircle, Loader2, ExternalLink, CheckCircle2, Eye, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateReciboPDF, type ReciboData } from "@/lib/recibo-pdf";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReciboData;
  telefone?: string | null;
  /** ID do pagamento (receita) ou compras_parcelas (despesa) para auditoria */
  referenciaId?: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function digits(s: string) {
  return s.replace(/\D/g, "");
}

const FALLBACK_TEMPLATES = {
  receita_com_pet: `Olá, {contraparte}! Tudo bem?

Confirmamos o seu pagamento de {valor} referente ao atendimento do {pet}. ✅

Seu recibo está disponível com segurança no link abaixo:
{link}

Muito obrigada pela confiança! 🐾
{assinatura}`,
  receita_sem_pet: `Olá, {contraparte}! Tudo bem?

Confirmamos o seu pagamento de {valor} referente aos serviços realizados. ✅

Seu recibo está disponível com segurança no link abaixo:
{link}

Muito obrigada pela confiança! 🐾
{assinatura}`,
  despesa: `Olá, {contraparte}!

Segue o comprovante de pagamento no valor de {valor}, referente a "{descricao}", pago em {data}.

Consulte o comprovante com segurança pelo link:
{link}

{assinatura}`,
};

function gerarCodigoPublico() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  (globalThis.crypto ?? window.crypto).getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function applyVars(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/**
 * Remove QUALQUER URL insegura de um template (links assinados do Supabase,
 * domínios técnicos de storage, tokens) e garante que só reste {link} — que
 * será substituído pelo link curto /recibo/{codigo}. Templates antigos, salvos
 * antes da correção, podem ainda conter URLs cruas: essa função neutraliza.
 */
function sanitizeTemplate(tpl: string, safeLink: string): string {
  if (!tpl) return tpl;
  let out = tpl;
  // 1) Remove URLs http(s) que não sejam o link seguro (ex.: *.supabase.co,
  //    storage/v1/object/sign, tokens, presigned URLs de qualquer origem).
  out = out.replace(/https?:\/\/\S+/gi, (match) => {
    if (safeLink && match === safeLink) return match;
    return "{link}";
  });
  // 2) Colapsa múltiplos {link} consecutivos que possam ter surgido.
  out = out.replace(/(\{link\}[\s]*){2,}/g, "{link}\n");
  return out;
}



export function ReciboDialog({ open, onOpenChange, data, telefone, referenciaId }: Props) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string>("");
  const [mensagem, setMensagem] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const isReceita = data.tipo === "receita";
  const numeroRaw = digits(telefone || "");
  const numero = numeroRaw ? (numeroRaw.startsWith("55") ? numeroRaw : `55${numeroRaw}`) : "";

  const publicUrl = useMemo(() => {
    if (!codigo) return "";
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    return `${origin}/recibo/${codigo}`;
  }, [codigo]);

  const { data: config } = useQuery({
    queryKey: ["empresa-config-whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_config")
        .select("whatsapp_template_receber, whatsapp_template_pagar, whatsapp_assinatura")
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const { data: envioAnterior } = useQuery({
    queryKey: ["recibo-envio", data.tipo, referenciaId],
    enabled: !!referenciaId && open,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("recibos_enviados")
        .select("id, enviado_em, codigo_publico, mensagem")
        .eq("tipo", isReceita ? "receita" : "despesa")
        .eq("referencia_id", referenciaId!)
        .order("enviado_em", { ascending: false })
        .limit(1);
      return rows?.[0] ?? null;
    },
  });

  // Ao abrir: reaproveita codigo_publico anterior se houver, senão gera um novo
  useEffect(() => {
    if (!open) return;
    if (envioAnterior?.codigo_publico) {
      setCodigo(envioAnterior.codigo_publico);
    } else if (!codigo) {
      setCodigo(gerarCodigoPublico());
    }
  }, [open, envioAnterior, codigo]);

  const petNome = (data.petNome ?? "").trim();

  const vars = useMemo(() => ({
    contraparte: data.contraparte,
    valor: brl(data.valor),
    numero: data.numero,
    descricao: data.descricao || "—",
    forma: (data.forma || "").replace(/_/g, " "),
    data: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    assinatura: config?.whatsapp_assinatura ?? "Spa de Pet Tia Jéssica",
    pet: petNome || "seu pet",
    link: publicUrl,
  }), [data, config, publicUrl, petNome]);

  useEffect(() => {
    if (!open) return;
    const fallbackKey: keyof typeof FALLBACK_TEMPLATES = isReceita
      ? petNome
        ? "receita_com_pet"
        : "receita_sem_pet"
      : "despesa";
    const rawTpl =
      (isReceita ? config?.whatsapp_template_receber : config?.whatsapp_template_pagar) ||
      FALLBACK_TEMPLATES[fallbackKey];
    // Bloqueia links inseguros (Supabase signed URLs, tokens, etc.) e caracteres quebrados
    const safeTpl = sanitizeTemplate(rawTpl, publicUrl).replace(/\uFFFD/g, "");
    setMensagem(applyVars(safeTpl, vars));
  }, [open, config, isReceita, vars, publicUrl, petNome]);

  // Prévia do PDF
  useEffect(() => {
    if (!open) {
      setConfirmado(false);
      return;
    }
    let revoked: string | null = null;
    try {
      const res = generateReciboPDF(data, true) as { blob: Blob; fileName: string };
      const url = URL.createObjectURL(res.blob);
      revoked = url;
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
      setPreviewUrl(null);
    };
  }, [open, data]);

  const mensagemFinal = useMemo(() => applyVars(mensagem, vars), [mensagem, vars]);
  const variaveisRestantes = useMemo(() => {
    const m = mensagemFinal.match(/\{(\w+)\}/g);
    return m ? Array.from(new Set(m)) : [];
  }, [mensagemFinal]);

  const baixar = () => {
    generateReciboPDF(data);
  };

  const registrarEnvio = async (): Promise<string | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    // Se já existe registro para essa referência, apenas devolve o código dele
    if (envioAnterior?.codigo_publico) {
      return envioAnterior.codigo_publico;
    }
    const cod = codigo || gerarCodigoPublico();
    const { error } = await supabase.from("recibos_enviados").insert({
      tipo: isReceita ? "receita" : "despesa",
      referencia_id: referenciaId ?? data.numero,
      numero_recibo: data.numero,
      codigo_publico: cod,
      contraparte: data.contraparte,
      telefone: telefone || null,
      valor: data.valor,
      mensagem: mensagemFinal,
      pet_nome: petNome || null,
      servico: data.descricao || null,
      forma_pagamento: data.forma || null,
      data_pagamento: data.data || null,
      enviado_por: u.user.id,
    });
    if (error) {
      console.error(error);
      toast.error("Não foi possível registrar o envio");
      return null;
    }
    qc.invalidateQueries({ queryKey: ["recibo-envio", isReceita ? "receita" : "despesa", referenciaId] });
    return cod;
  };

  const buildTextoFinal = (link: string) => {
    // Sanitiza a mensagem editada pelo usuário: URLs cruas (incl. Supabase
    // signed URLs) viram {link}; caracteres quebrados (�) são removidos.
    const safeMensagem = sanitizeTemplate(mensagem, link).replace(/\uFFFD/g, "");
    return applyVars(safeMensagem, { ...vars, link }).replace(/\uFFFD/g, "");
  };

  const enviarWhats = async () => {
    if (!numero) {
      toast.error("Contato sem WhatsApp cadastrado");
      return;
    }
    setEnviando(true);
    try {
      const cod = await registrarEnvio();
      if (!cod) return;
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "";
      const link = `${origin}/recibo/${cod}`;
      const textoFinal = buildTextoFinal(link);
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(textoFinal)}`,
        "_blank",
        "noopener,noreferrer",
      );
      toast.success("WhatsApp aberto — envio registrado");
    } finally {
      setEnviando(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isReceita ? "Recibo emitido" : "Comprovante emitido"}
          </DialogTitle>
          <DialogDescription>
            Nº <span className="font-mono">{data.numero}</span> · {brl(data.valor)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">
                  {isReceita ? "Cliente:" : "Fornecedor:"}
                </span>{" "}
                <span className="font-medium">{data.contraparte}</span>
              </div>
              <div className="line-clamp-2">
                <span className="text-muted-foreground">Descrição:</span>{" "}
                {data.descricao || "—"}
              </div>
              {data.forma && (
                <div>
                  <span className="text-muted-foreground">Forma:</span>{" "}
                  <span className="capitalize">{data.forma.replace(/_/g, " ")}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Prévia do documento
                </div>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary underline"
                  >
                    Abrir em nova aba
                  </a>
                )}
              </div>
              {previewUrl ? (
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="Prévia do recibo"
                  className="w-full h-[420px] bg-white"
                />
              ) : (
                <div className="h-[420px] flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando prévia…
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 cursor-pointer">
              <Checkbox
                checked={confirmado}
                onCheckedChange={(v) => setConfirmado(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs leading-relaxed">
                <span className="font-semibold text-primary">Confirmo que revisei a prévia</span>
                {" "}e que o documento nº <span className="font-mono">{data.numero}</span> está correto e atualizado.
              </span>
            </label>
          </div>

          <div className="space-y-3">


        {envioAnterior && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-primary">WhatsApp já enviado</div>
              <div className="text-muted-foreground">
                {format(new Date(envioAnterior.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
              {envioAnterior.codigo_publico && (
                <a
                  href={`/recibo/${envioAnterior.codigo_publico}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  Abrir página do recibo
                </a>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Mensagem WhatsApp
            </div>
            <Badge variant="outline" className="text-[10px]">Editável</Badge>
          </div>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={6}
            className="text-sm font-normal resize-none"
          />
          <p className="text-[11px] text-muted-foreground">
            Variáveis: {"{contraparte}"}, {"{valor}"}, {"{numero}"}, {"{descricao}"}, {"{data}"}, {"{forma}"}, {"{assinatura}"}, {"{link}"}.
          </p>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
                Prévia enviada
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-800">
                Como o cliente vai ver
              </Badge>
            </div>
            <div className="rounded-md bg-white border p-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
              {mensagemFinal || <span className="text-muted-foreground italic">Mensagem vazia</span>}
            </div>
            {publicUrl && (
              <p className="text-[11px] text-emerald-800">
                Link seguro do recibo:{" "}
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline break-all"
                >
                  {publicUrl}
                </a>
              </p>
            )}
            {variaveisRestantes.length > 0 && (
              <p className="text-[11px] text-amber-700">
                Atenção: variáveis não substituídas — {variaveisRestantes.join(", ")}
              </p>
            )}
          </div>
        </div>

          {!numero && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Sem WhatsApp/telefone cadastrado para envio automático.
            </p>
          )}
          </div>
        </div>





        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!confirmado && (
            <p className="text-[11px] text-muted-foreground sm:mr-auto">
              Confirme a prévia acima para habilitar as ações.
            </p>
          )}
          <Button
            variant="outline"
            onClick={baixar}
            disabled={!confirmado}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-1" /> Baixar PDF
          </Button>
          {publicUrl && (
            <Button variant="ghost" asChild className="w-full sm:w-auto">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir link
              </a>
            </Button>
          )}
          <Button
            onClick={enviarWhats}
            disabled={!numero || enviando || !confirmado}
            className="w-full sm:w-auto"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4 mr-1" />
            )}
            Enviar por WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
