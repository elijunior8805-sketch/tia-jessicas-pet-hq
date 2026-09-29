import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QrCode, Copy, Check, CheckCircle2, Clock, Share2, RefreshCw, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { verificarStatusPixMercadoPagoFn } from "@/lib/mercadopago.functions";

interface PixMercadoPagoCardProps {
  data: any;
  onActionClick?: (cmd: string) => void;
}

export const PixMercadoPagoCard: React.FC<PixMercadoPagoCardProps> = ({ data, onActionClick }) => {
  const verificarStatusFn = useServerFn(verificarStatusPixMercadoPagoFn);

  const valor = Number(data?.valor || data?.transaction_amount || 0);
  const descricao = data?.descricao || data?.description || "Atendimento Spa de Pet";
  const qrCode = data?.qrCode || data?.qr_code || "";
  const qrCodeBase64 = data?.qrCodeBase64 || data?.qr_code_base64 || "";
  const paymentId = data?.paymentId || data?.id || "";
  const agendamentoId = data?.agendamentoId || "";
  const clienteNome = data?.clienteNome || data?.cliente?.nome || "";
  const clienteTelefone = data?.clienteTelefone || data?.cliente?.telefone || "";

  const [copiado, setCopiado] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pagoComSucesso, setPagoComSucesso] = useState(data?.status === "approved" || data?.pago === true);
  const [segundosRestantes, setSegundosRestantes] = useState(900); // 15 minutos

  // Copia o código Pix
  const handleCopiarPix = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    setCopiado(true);
    toast.success("Código Pix Copia-e-Cola copiado com sucesso!");
    setTimeout(() => setCopiado(false), 3000);
  };

  // Envia no WhatsApp do cliente
  const handleEnviarWhatsApp = () => {
    const primeiroNome = (clienteNome || "Tutor").split(" ")[0];
    const textoMsg = `Olá, ${primeiroNome}! 🐾\n\nSegue a chave Pix para pagamento de *${descricao}* no valor de *R$ ${valor.toFixed(2).replace(".", ",")}* no Spa de Pet Tia Jéssica:\n\n\`${qrCode}\`\n\nBasta copiar o código acima e colar na opção "Pix Copia e Cola" do aplicativo do seu banco. A baixa é instantânea! ✨`;

    if (clienteTelefone) {
      const telFormatado = clienteTelefone.replace(/\D/g, "");
      const numCompleto = telFormatado.startsWith("55") ? telFormatado : `55${telFormatado}`;
      window.open(`https://wa.me/${numCompleto}?text=${encodeURIComponent(textoMsg)}`, "_blank");
    } else {
      navigator.clipboard.writeText(textoMsg);
      toast.info("Mensagem Pix copiada! Cole na conversa com o cliente.");
    }
  };

  // Checar status
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
        toast.success("Pagamento confirmado instantaneamente no Mercado Pago!");
      } else {
        toast.info("Pagamento ainda pendente de pagamento.");
      }
    } catch {
      // ignore
    } finally {
      setIsChecking(false);
    }
  };

  // Polling automático a cada 5 segundos
  useEffect(() => {
    if (pagoComSucesso || !paymentId) return;

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
          toast.success("Pagamento Mercado Pago confirmado!");
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [pagoComSucesso, paymentId, agendamentoId]);

  // Contagem regressiva
  useEffect(() => {
    if (pagoComSucesso) return;
    const timer = setInterval(() => {
      setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [pagoComSucesso]);

  const formatarMinutos = (s: number) => {
    const m = Math.floor(s / 60);
    const seg = s % 60;
    return `${m}:${seg < 10 ? "0" : ""}${seg}`;
  };

  return (
    <div className="rounded-2xl border border-emerald-800/30 bg-card p-4 space-y-3.5 text-xs shadow-md my-2">
      {/* Header do Card */}
      <div className="font-semibold text-emerald-950 flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            {pagoComSucesso ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : (
              <QrCode className="w-4 h-4 text-emerald-700" />
            )}
          </div>
          <span className="font-display">
            {pagoComSucesso ? "Pix Confirmado com Sucesso" : "Pix Online · Mercado Pago"}
          </span>
        </div>
        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
          {pagoComSucesso ? "PAGO" : "BAIXA AUTOMÁTICA"}
        </span>
      </div>

      {pagoComSucesso ? (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1.5 text-center">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
            Valor Liquidado
          </span>
          <span className="text-2xl font-bold text-emerald-800 font-display block">
            R$ {valor.toFixed(2).replace(".", ",")}
          </span>
          <span className="text-[11px] text-emerald-700 block">
            Transação confirmada e baixada automaticamente no sistema!
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Informações da Cobrança */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
            <div>
              <span className="text-[11px] text-muted-foreground block">{descricao}</span>
              {clienteNome && (
                <span className="text-xs font-semibold text-foreground block">
                  Cliente: {clienteNome}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-800 font-display block">
                R$ {valor.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          {/* Imagem do QR Code Base64 */}
          {qrCodeBase64 && (
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border/80">
              <img
                src={`data:image/png;base64,${qrCodeBase64}`}
                alt="QR Code Pix"
                className="w-44 h-44 object-contain"
              />
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Expira em: <strong>{formatarMinutos(segundosRestantes)}</strong></span>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              onClick={handleCopiarPix}
              className={`h-9 text-xs font-bold gap-1.5 rounded-xl transition-all ${
                copiado
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs"
              }`}
            >
              {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado ? "Código Copiado!" : "Copiar Código Pix"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleEnviarWhatsApp}
              className="h-9 text-xs font-semibold gap-1.5 rounded-xl border-emerald-300 text-emerald-900 hover:bg-emerald-50"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-700" />
              Enviar no WhatsApp
            </Button>
          </div>

          {/* Rodapé de Status */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mercado Pago API Oficial</span>
            </div>
            <button
              type="button"
              onClick={handleVerificarStatus}
              disabled={isChecking}
              className="flex items-center gap-1 text-emerald-800 hover:underline font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
              <span>{isChecking ? "Verificando..." : "Verificar status"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
