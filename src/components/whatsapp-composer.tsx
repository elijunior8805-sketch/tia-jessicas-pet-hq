import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Sparkles,
  SpellCheck,
  Loader2,
} from "lucide-react";
import {
  abrirWhatsApp,
  montarWaUrl,
  normalizarTelefoneBR,
  TIPO_LABEL,
  WA_MAX_TEXT,
  type WhatsAppTipoMensagem,
} from "@/lib/whatsapp";
import { TOM_OPCOES, type TomIA } from "@/lib/whatsapp-templates";
import { revisarMensagemWhatsApp } from "@/lib/whatsapp-ia.functions";
import { registrarAberturaWhatsApp } from "@/lib/whatsapp-historico.functions";

export type WhatsAppComposerPayload = {
  tipo: WhatsAppTipoMensagem;
  destinatario: string;
  telefone: string;
  mensagem: string;
  motivo?: string | null;
  cliente_id?: string | null;
  atendimento_id?: string | null;
  pagamento_id?: string | null;
  cobranca_id?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: WhatsAppComposerPayload | null;
  onSent?: () => void;
};

export function WhatsAppComposer({ open, onOpenChange, payload, onSent }: Props) {
  const [texto, setTexto] = useState("");
  const [tom, setTom] = useState<TomIA>("amigavel");
  const [diff, setDiff] = useState<{ original: string; revisado: string } | null>(
    null
  );

  const revisar = useServerFn(revisarMensagemWhatsApp);
  const registrar = useServerFn(registrarAberturaWhatsApp);

  useEffect(() => {
    if (open && payload) {
      setTexto(payload.mensagem ?? "");
      setDiff(null);
    }
  }, [open, payload]);

  const tel = useMemo(
    () => normalizarTelefoneBR(payload?.telefone ?? ""),
    [payload?.telefone]
  );

  const ortografiaMut = useMutation({
    mutationFn: async () =>
      revisar({ data: { texto, tom: "amigavel", modo: "ortografia" } }),
    onSuccess: (r) => {
      if (!r.mudou) {
        toast.success("Nada a corrigir — a mensagem já está limpa.");
        return;
      }
      setDiff({ original: r.original, revisado: r.revisado });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao revisar."),
  });

  const melhorarMut = useMutation({
    mutationFn: async () =>
      revisar({ data: { texto, tom, modo: "melhorar" } }),
    onSuccess: (r) => setDiff({ original: r.original, revisado: r.revisado }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao melhorar."),
  });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function abrir() {
    if (!payload || !tel.ok) return;
    const url = montarWaUrl(tel.e164, texto);
    try {
      await registrar({
        data: {
          tipo: payload.tipo,
          destinatario: payload.destinatario,
          telefone: tel.e164,
          mensagem: texto,
          motivo: payload.motivo ?? null,
          cliente_id: payload.cliente_id ?? null,
          atendimento_id: payload.atendimento_id ?? null,
          pagamento_id: payload.pagamento_id ?? null,
          cobranca_id: payload.cobranca_id ?? null,
        },
      });
    } catch {
      // não bloqueia envio — registra falha silenciosa
    }
    abrirWhatsApp(url);
    onSent?.();
    onOpenChange(false);
  }

  const chars = texto.length;
  const aviso = chars > 3000;
  const carregandoIA = ortografiaMut.isPending || melhorarMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar antes de enviar</DialogTitle>
          <DialogDescription>
            Confira o destinatário e o texto. O WhatsApp Web abrirá com a mensagem
            preenchida — o envio final é seu.
          </DialogDescription>
        </DialogHeader>

        {payload && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{payload.destinatario}</div>
                <Badge variant="secondary" className="text-xs">
                  {TIPO_LABEL[payload.tipo]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {tel.ok ? tel.formatado : payload.telefone || "—"}
              </div>
              {!tel.ok && (
                <Alert variant="destructive" className="mt-2 py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {tel.motivo}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-1">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, WA_MAX_TEXT))}
                rows={9}
                className="resize-none font-normal"
                placeholder="Digite a mensagem…"
              />
              <div
                className={`text-xs text-right ${
                  aviso ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                {chars} / {WA_MAX_TEXT} caracteres
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => ortografiaMut.mutate()}
                disabled={carregandoIA || !texto.trim()}
              >
                {ortografiaMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SpellCheck className="h-4 w-4" />
                )}
                <span className="ml-1">Corrigir</span>
              </Button>

              <div className="col-span-1 flex items-center gap-1">
                <Select value={tom} onValueChange={(v) => setTom(v as TomIA)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOM_OPCOES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => melhorarMut.mutate()}
                disabled={carregandoIA || !texto.trim()}
              >
                {melhorarMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-1">Melhorar</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copiar}
                disabled={!texto.trim()}
              >
                <Copy className="h-4 w-4" />
                <span className="ml-1">Copiar</span>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={abrir}
            disabled={!tel.ok || !texto.trim()}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir no WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Sub-dialog de diff */}
      <Dialog open={!!diff} onOpenChange={(v) => !v && setDiff(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisão da IA</DialogTitle>
            <DialogDescription>
              Compare o texto original com a versão sugerida antes de substituir.
            </DialogDescription>
          </DialogHeader>
          {diff && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Original
                </div>
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {diff.original}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-700 mb-1">
                  Sugestão
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm whitespace-pre-wrap">
                  {diff.revisado}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDiff(null)}>
              Descartar
            </Button>
            <Button
              onClick={() => {
                if (diff) setTexto(diff.revisado);
                setDiff(null);
                toast.success("Texto substituído.");
              }}
            >
              Aceitar sugestão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// Hook utilitário para telas que precisam abrir o composer com poucos parâmetros.
export function useWhatsAppComposer() {
  const [state, setState] = useState<{
    open: boolean;
    payload: WhatsAppComposerPayload | null;
  }>({ open: false, payload: null });

  useEffect(() => {
    const handler = (payload: WhatsAppComposerPayload) =>
      setState({ open: true, payload });
    __waComposerListeners.add(handler);
    return () => {
      __waComposerListeners.delete(handler);
    };
  }, []);

  return {
    state,
    open: (payload: WhatsAppComposerPayload) =>
      setState({ open: true, payload }),
    close: () => setState((s) => ({ ...s, open: false })),
    setOpen: (v: boolean) => setState((s) => ({ ...s, open: v })),
  };
}

// Barramento global — permite abrir o composer de funções top-level (fora de componentes).
const __waComposerListeners = new Set<(p: WhatsAppComposerPayload) => void>();
export function openWhatsAppComposerGlobal(payload: WhatsAppComposerPayload) {
  if (__waComposerListeners.size === 0) {
    // Fallback: abre wa.me diretamente se nenhum host montado
    const tel = normalizarTelefoneBR(payload.telefone);
    if (!tel.ok) {
      toast.error("Telefone inválido");
      return;
    }
    window.open(montarWaUrl(tel.e164, payload.mensagem), "_blank", "noopener,noreferrer");
    return;
  }
  __waComposerListeners.forEach((fn) => fn(payload));
}

