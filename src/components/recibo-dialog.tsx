import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateReciboPDF, type ReciboData } from "@/lib/recibo-pdf";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReciboData;
  telefone?: string | null; // whatsapp or telefone for the contraparte
  mensagemBase?: string; // frase contextual
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function digits(s: string) {
  return s.replace(/\D/g, "");
}

export function ReciboDialog({ open, onOpenChange, data, telefone, mensagemBase }: Props) {
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const isReceita = data.tipo === "receita";
  const numeroRaw = digits(telefone || "");
  const numero = numeroRaw ? (numeroRaw.startsWith("55") ? numeroRaw : `55${numeroRaw}`) : "";

  const mensagem =
    mensagemBase ||
    (isReceita
      ? `Olá, ${data.contraparte}! 🐾\n\nSegue o recibo de pagamento no valor de *${brl(data.valor)}*.\n\nObrigada pela confiança! ✨`
      : `Olá, ${data.contraparte}!\n\nSegue o comprovante da despesa referente a "${data.descricao}" no valor de *${brl(data.valor)}*.\n\nObrigada!`);

  const baixar = () => {
    generateReciboPDF(data);
  };

  const gerarLinkCompartilhavel = async (): Promise<string | null> => {
    if (signedUrl) return signedUrl;
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
        .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 dias
      if (sErr) throw sErr;
      setSignedUrl(signed.signedUrl);
      return signed.signedUrl;
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar link do comprovante");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const enviarWhats = async () => {
    if (!numero) {
      toast.error("Contato sem telefone/WhatsApp cadastrado");
      return;
    }
    const url = await gerarLinkCompartilhavel();
    if (!url) return;
    const texto = `${mensagem}\n\n${url}`;
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
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

        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Mensagem WhatsApp
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{mensagem}</p>
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
            <Button
              variant="ghost"
              asChild
              className="w-full sm:w-auto"
            >
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
