import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { verificarStatusPixMercadoPagoFn } from "@/lib/mercadopago.functions";

interface MercadoPagoPixModalProps {
  isOpen: boolean;
  onClose: () => void;
  valor: number;
  descricao: string;
  qrCode: string; // Pix Copia-e-Cola
  qrCodeBase64?: string; // Imagem em base64
  paymentId: string | number;
  agendamentoId?: string;
  clienteNome?: string;
  clienteTelefone?: string;
  onPagamentoConfirmado?: () => void;
}

export const MercadoPagoPixModal: React.FC<MercadoPagoPixModalProps> = ({
  isOpen,
  onClose,
  valor,
  descricao,
  qrCode,
  qrCodeBase64,
  paymentId,
  agendamentoId,
  clienteNome,
  clienteTelefone,
  onPagamentoConfirmado,
}) => {
  const verificarStatusFn = useServerFn(verificarStatusPixMercadoPagoFn);

  const [copiado, setCopiado] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pagoComSucesso, setPagoComSucesso] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(900); // 15 minutos

  // Copia o código Pix
  const handleCopiarPix = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    setCopiado(true);
    toast.success("Código Pix Copia-e-Cola copiado com sucesso!");
    setTimeout(() => setCopiado(false), 3000);
  };

  // Compartilha no WhatsApp com o tutor
  const handleEnviarWhatsApp = () => {
    const primeiroNome = (clienteNome || "Tutor").split(" ")[0];
    const textoMsg = `Olá, ${primeiroNome}! 🐾\n\nSegue o código Pix para o pagamento de *${descricao}* no valor de *R$ ${valor.toFixed(2).replace(".", ",")}* no Spa de Pet Tia Jéssica:\n\n\`${qrCode}\`\n\nBasta copiar o código acima e colar na opção "Pix Copia e Cola" do aplicativo do seu banco. A confirmação é instantânea! ✨`;

    if (clienteTelefone) {
      const telFormatado = clienteTelefone.replace(/\D/g, "");
      const numCompleto = telFormatado.startsWith("55") ? telFormatado : `55${telFormatado}`;
      window.open(`https://wa.me/${numCompleto}?text=${encodeURIComponent(textoMsg)}`, "_blank");
    } else {
      navigator.clipboard.writeText(textoMsg);
      toast.info("Mensagem copiada! Cole no WhatsApp do cliente.");
    }
  };

  // Checagem manual de status
  const handleVerificarStatus = async () => {
    if (!paymentId || isChecking || pagoComSucesso) return;
    try {
      setIsChecking(true);
      const res = await verificarStatusFn({
        data: {
          paymentId,
          agendamentoId,
        },
      });

      if (res.sucesso && res.status === "approved") {
        setPagoComSucesso(true);
        toast.success("Pagamento confirmado com sucesso!");
        if (onPagamentoConfirmado) onPagamentoConfirmado();
      } else {
        toast.info("Pagamento ainda pendente no banco.");
      }
    } catch {
      // ignore
    } finally {
      setIsChecking(false);
    }
  };

  // Polling automático a cada 4 segundos enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen || pagoComSucesso || !paymentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await verificarStatusFn({
          data: {
            paymentId,
            agendamentoId,
          },
        });
        if (res.sucesso && res.status === "approved") {
          setPagoComSucesso(true);
          toast.success("Pagamento recebido instantaneamente!");
          if (onPagamentoConfirmado) onPagamentoConfirmado();
        }
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, pagoComSucesso, paymentId, agendamentoId]);

  // Contador regressivo de expiração
  useEffect(() => {
    if (!isOpen || pagoComSucesso) return;
    const timer = setInterval(() => {
      setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, pagoComSucesso]);

  const formatarMinutos = (s: number) => {
    const m = Math.floor(s / 60);
    const seg = s % 60;
    return `${m}:${seg < 10 ? "0" : ""}${seg}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full p-5 sm:p-6 rounded-3xl bg-card border-border/80 shadow-2xl">
        <DialogHeader className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-1">
            {pagoComSucesso ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-600 animate-bounce" />
            ) : (
              <QrCode className="w-6 h-6 text-emerald-700" />
            )}
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold font-display text-foreground">
            {pagoComSucesso ? "Pagamento Confirmado!" : "Pagamento Pix Online"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {pagoComSucesso
              ? "O valor já foi creditado na sua conta e a baixa foi realizada no sistema."
              : `Mercado Pago · ${descricao}`}
          </DialogDescription>
        </DialogHeader>

        {pagoComSucesso ? (
          <div className="py-6 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block">
                Valor Recebido
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-800 font-display block">
                R$ {valor.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-[11px] text-emerald-700 block">
                Baixa automática concluída com sucesso!
              </span>
            </div>

            <Button
              onClick={onClose}
              className="w-full h-11 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl"
            >
              Concluir e Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Valor em Destaque */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border/60">
              <span className="text-xs text-muted-foreground font-medium">Total a Pagar:</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-800 font-display">
                R$ {valor.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {/* Imagem do QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-border/80 shadow-xs">
              {qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${qrCodeBase64}`}
                  alt="QR Code Pix Mercado Pago"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground bg-zinc-100 rounded-xl">
                  Carregando QR Code...
                </div>
              )}

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Expira em: <strong>{formatarMinutos(segundosRestantes)}</strong></span>
              </div>
            </div>

            {/* Botão Copiar Código Pix */}
            <Button
              type="button"
              onClick={handleCopiarPix}
              className={`w-full h-11 text-xs sm:text-sm font-bold gap-2 rounded-xl transition-all ${
                copiado
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-800 hover:bg-emerald-900 text-white shadow-md"
              }`}
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? "Código Pix Copiado!" : "Copiar Código Pix (Copia e Cola)"}
            </Button>

            {/* Botão Enviar no WhatsApp */}
            <Button
              type="button"
              variant="outline"
              onClick={handleEnviarWhatsApp}
              className="w-full h-10 text-xs font-semibold gap-2 rounded-xl border-emerald-300 text-emerald-900 hover:bg-emerald-50"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-700" />
              Enviar Pix no WhatsApp do Tutor
            </Button>

            {/* Status e Checagem */}
            <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Identificação instantânea</span>
              </div>
              <button
                type="button"
                onClick={handleVerificarStatus}
                disabled={isChecking}
                className="flex items-center gap-1 text-emerald-800 hover:underline font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
                <span>{isChecking ? "Checando..." : "Checar pagamento"}</span>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
