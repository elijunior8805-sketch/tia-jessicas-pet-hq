import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  QrCode,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Share2,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Sparkles,
} from "lucide-react";
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
  const linkCartao = data?.linkCartao || data?.initPoint || data?.init_point || "";
  const paymentId = data?.paymentId || data?.id || "";
  const agendamentoId = data?.agendamentoId || "";
  const clienteNome = data?.clienteNome || data?.cliente?.nome || "";
  const clienteTelefone = data?.clienteTelefone || data?.cliente?.telefone || "";

  const [abaAtiva, setAbaAtiva] = useState<"pix" | "cartao">("pix");
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [copiadoCartao, setCopiadoCartao] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pagoComSucesso, setPagoComSucesso] = useState(data?.status === "approved" || data?.pago === true);
  const [segundosRestantes, setSegundosRestantes] = useState(900); // 15 minutos

  // Copia o código Pix
  const handleCopiarPix = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    setCopiadoPix(true);
    toast.success("Código Pix Copia-e-Cola copiado com sucesso!");
    setTimeout(() => setCopiadoPix(false), 3000);
  };

  // Copia link do cartão
  const handleCopiarLinkCartao = () => {
    if (!linkCartao) return;
    navigator.clipboard.writeText(linkCartao);
    setCopiadoCartao(true);
    toast.success("Link de pagamento com Cartão copiado!");
    setTimeout(() => setCopiadoCartao(false), 3000);
  };

  // Envia no WhatsApp do cliente com opções de Pix e Cartão
  const handleEnviarWhatsApp = () => {
    const primeiroNome = (clienteNome || "Tutor").split(" ")[0];
    let textoMsg = `Olá, ${primeiroNome}! 🐾\n\nSegue as opções para pagamento de *${descricao}* no valor de *R$ ${valor.toFixed(2).replace(".", ",")}* no Spa de Pet Tia Jéssica:\n\n`;

    if (linkCartao) {
      textoMsg += `💳 *Pagar no Cartão de Crédito (em até 12x):*\n${linkCartao}\n\n`;
    }

    if (qrCode) {
      textoMsg += `⚡ *Pagar via Pix (Copia e Cola):*\n\`${qrCode}\`\n\n_(Basta copiar o código acima e colar no app do seu banco)_\n\n`;
    }

    textoMsg += `A confirmação e baixa são automáticas! ✨`;

    if (clienteTelefone) {
      const telFormatado = clienteTelefone.replace(/\D/g, "");
      const numCompleto = telFormatado.startsWith("55") ? telFormatado : `55${telFormatado}`;
      window.open(`https://wa.me/${numCompleto}?text=${encodeURIComponent(textoMsg)}`, "_blank");
    } else {
      navigator.clipboard.writeText(textoMsg);
      toast.info("Mensagem com Pix e Link de Cartão copiada! Cole na conversa com o cliente.");
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
        toast.info("Pagamento ainda pendente de liquidação.");
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
              <Sparkles className="w-4 h-4 text-emerald-700" />
            )}
          </div>
          <span className="font-display">
            {pagoComSucesso ? "Pagamento Confirmado com Sucesso" : "Pagamento Online · Mercado Pago"}
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

          {/* Abas Pix e Cartão de Crédito */}
          <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
            <button
              type="button"
              onClick={() => setAbaAtiva("pix")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                abaAtiva === "pix"
                  ? "bg-background text-emerald-900 shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pix Instantâneo</span>
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("cartao")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                abaAtiva === "cartao"
                  ? "bg-background text-emerald-900 shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
              <span>Cartão de Crédito</span>
            </button>
          </div>

          {/* Conteúdo Aba Pix */}
          {abaAtiva === "pix" && (
            <div className="space-y-3">
              {/* Imagem do QR Code Base64 */}
              {qrCodeBase64 && (
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border/80 shadow-2xs">
                  <img
                    src={`data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="w-40 h-40 object-contain"
                  />
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Expira em: <strong>{formatarMinutos(segundosRestantes)}</strong></span>
                  </div>
                </div>
              )}

              {/* Botão Copiar Código Pix */}
              <Button
                type="button"
                onClick={handleCopiarPix}
                className={`w-full h-9 text-xs font-bold gap-1.5 rounded-xl transition-all ${
                  copiadoPix
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs"
                }`}
              >
                {copiadoPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiadoPix ? "Código Pix Copiado!" : "Copiar Código Pix (Copia e Cola)"}
              </Button>
            </div>
          )}

          {/* Conteúdo Aba Cartão de Crédito */}
          {abaAtiva === "cartao" && (
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-border/70 space-y-3">
              <div className="space-y-1 text-center">
                <span className="text-xs font-bold text-foreground block">
                  Checkout Pro Mercado Pago
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Permite ao tutor pagar no Cartão de Crédito em até 12x com segurança máxima.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {linkCartao && (
                  <Button
                    type="button"
                    onClick={() => window.open(linkCartao, "_blank")}
                    className="h-9 text-xs font-bold gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir Página de Cartão
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopiarLinkCartao}
                  className="h-9 text-xs font-semibold gap-1.5 rounded-xl border-border hover:bg-muted"
                >
                  {copiadoCartao ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiadoCartao ? "Link Copiado!" : "Copiar Link de Pagamento"}
                </Button>
              </div>
            </div>
          )}

          {/* Botão de Envio Completo no WhatsApp */}
          <Button
            type="button"
            variant="outline"
            onClick={handleEnviarWhatsApp}
            className="w-full h-10 text-xs font-semibold gap-2 rounded-xl border-emerald-300 text-emerald-900 hover:bg-emerald-50 bg-emerald-50/30"
          >
            <Share2 className="w-4 h-4 text-emerald-700" />
            Enviar Opções (Pix & Cartão) no WhatsApp do Tutor
          </Button>

          {/* Rodapé de Status */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mercado Pago Oficial</span>
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
