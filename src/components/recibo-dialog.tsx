import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, MessageCircle, Loader2, ExternalLink, CheckCircle2, Eye } from "lucide-react";
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
  receita:
    'Olá, {contraparte}! 🐾\n\nSegue o recibo de pagamento nº {numero} no valor de *{valor}* referente a "{descricao}".\n\nObrigada pela confiança! ✨\n{assinatura}',
  despesa:
    'Olá, {contraparte}!\n\nSegue o comprovante nº {numero} referente a "{descricao}" no valor de *{valor}*, pago em {data}.\n\nObrigada!\n{assinatura}',
};

function applyVars(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function ReciboDialog({ open, onOpenChange, data, telefone, referenciaId }: Props) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const isReceita = data.tipo === "receita";
  const numeroRaw = digits(telefone || "");
  const numero = numeroRaw ? (numeroRaw.startsWith("55") ? numeroRaw : `55${numeroRaw}`) : "";

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
        .select("id, enviado_em, signed_url, mensagem")
        .eq("tipo", isReceita ? "receita" : "despesa")
        .eq("referencia_id", referenciaId!)
        .order("enviado_em", { ascending: false })
        .limit(1);
      return rows?.[0] ?? null;
    },
  });

  const vars = useMemo(() => ({
    contraparte: data.contraparte,
    valor: brl(data.valor),
    numero: data.numero,
    descricao: data.descricao || "—",
    forma: (data.forma || "").replace(/_/g, " "),
    data: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    assinatura: config?.whatsapp_assinatura ?? "",
  }), [data, config]);

  useEffect(() => {
    if (!open) return;
    const tpl =
      (isReceita ? config?.whatsapp_template_receber : config?.whatsapp_template_pagar) ||
      FALLBACK_TEMPLATES[isReceita ? "receita" : "despesa"];
    setMensagem(applyVars(tpl, vars));
  }, [open, config, isReceita, vars]);

  // Prévia do PDF: gera blob URL sempre que abrir/dados mudarem
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


  const baixar = () => {
    generateReciboPDF(data);
  };

  const gerarLinkCompartilhavel = async (): Promise<{ url: string; path: string } | null> => {
    if (signedUrl && storagePath) return { url: signedUrl, path: storagePath };
    setUploading(true);
    try {
      const r = generateReciboPDF(data, true) as { blob: Blob; fileName: string };
      const path = `recibos/${data.numero}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("spa-fotos")
        .upload(path, r.blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("spa-fotos")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (sErr) throw sErr;
      setSignedUrl(signed.signedUrl);
      setStoragePath(path);
      return { url: signed.signedUrl, path };
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar link do comprovante");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const registrarEnvio = async (url: string, path: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("recibos_enviados").insert({
      tipo: isReceita ? "receita" : "despesa",
      referencia_id: referenciaId ?? data.numero,
      numero_recibo: data.numero,
      contraparte: data.contraparte,
      telefone: telefone || null,
      valor: data.valor,
      mensagem,
      signed_url: url,
      storage_path: path,
      enviado_por: u.user.id,
    });
    if (error) {
      console.error(error);
      toast.error("Envio realizado, mas não foi possível registrar auditoria");
      return;
    }
    qc.invalidateQueries({ queryKey: ["recibo-envio", isReceita ? "receita" : "despesa", referenciaId] });
  };

  const enviarWhats = async () => {
    if (!numero) {
      toast.error("Contato sem telefone/WhatsApp cadastrado");
      return;
    }
    const link = await gerarLinkCompartilhavel();
    if (!link) return;
    const texto = `${mensagem}\n\n${link.url}`;
    await registrarEnvio(link.url, link.path);
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
    toast.success("WhatsApp aberto — envio registrado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReceita ? "Recibo emitido" : "Comprovante emitido"}
          </DialogTitle>
          <DialogDescription>
            Nº <span className="font-mono">{data.numero}</span> · {brl(data.valor)}
          </DialogDescription>
        </DialogHeader>

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

        {envioAnterior && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-primary">WhatsApp já enviado</div>
              <div className="text-muted-foreground">
                {format(new Date(envioAnterior.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
              {envioAnterior.signed_url && (
                <a
                  href={envioAnterior.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  Abrir link enviado
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
            rows={7}
            className="text-sm font-normal resize-none"
          />
          <p className="text-[11px] text-muted-foreground">
            Modelo carregado das Configurações. Variáveis: {"{contraparte}"}, {"{valor}"}, {"{numero}"}, {"{descricao}"}, {"{data}"}, {"{forma}"}, {"{assinatura}"}.
          </p>
        </div>

        {!numero && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Sem WhatsApp/telefone cadastrado para envio automático.
          </p>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={baixar} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-1" /> Baixar PDF
          </Button>
          {signedUrl && (
            <Button variant="ghost" asChild className="w-full sm:w-auto">
              <a href={signedUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir link
              </a>
            </Button>
          )}
          <Button
            onClick={enviarWhats}
            disabled={!numero || uploading}
            className="w-full sm:w-auto"
          >
            {uploading ? (
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
