import React, { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  QrCode,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Share2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Loader2,
  Smartphone,
} from "lucide-react";
import {
  gerarPixMercadoPagoFn,
  gerarLinkMercadoPagoFn,
  verificarStatusPixMercadoPagoFn,
} from "@/lib/mercadopago.functions";

export interface PagamentoOnlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valor: number;
  descricao?: string;
  clienteNome?: string;
  clienteWhatsapp?: string;
  clienteEmail?: string;
  clienteId?: string;
  pagamentoId?: string;
  agendamentoId?: string;
  cobrancaId?: string;
  onPagoComSucesso?: () => void;
}

export function PagamentoOnlineDialog({
  open,
  onOpenChange,
  valor,
  descricao,
  clienteNome,
  clienteWhatsapp,
  clienteEmail,
  clienteId,
  pagamentoId,
  agendamentoId,
  cobrancaId,
  onPagoComSucesso,
}: PagamentoOnlineDialogProps) {
  const gerarPixFn = useServerFn(gerarPixMercadoPagoFn);
  const gerarLinkFn = useServerFn(gerarLinkMercadoPagoFn);
  const verificarFn = useServerFn(verificarStatusPixMercadoPagoFn);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pix
  const [pixPaymentId, setPixPaymentId] = useState<string | number | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [qrCodeBase64, setQrCodeBase64] = useState("");
  const [copiadoPix, setCopiadoPix] = useState(false);

  // Cartão
  const [linkCartao, setLinkCartao] = useState("");
  const [copiadoCartao, setCopiadoCartao] = useState(false);

  // Status
  const [pagoComSucesso, setPagoComSucesso] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"pix" | "cartao">("pix");
  const [segundosRestantes, setSegundosRestantes] = useState(900);

  const valorFormatado = valor.toFixed(2).replace(".", ",");
  const descricaoFinal = descricao || "Atendimento Spa de Pet Tia Jéssica";
  const primeiroNome = (clienteNome || "Tutor").split(" ")[0];

  // Gerar Pix + Link em paralelo ao abrir
  const gerarLinksOnline = useCallback(async () => {
    if (!valor || valor <= 0) {
      setErro("Valor inválido para pagamento.");
      return;
    }

    setCarregando(true);
    setErro(null);
    setPagoComSucesso(false);
    setSegundosRestantes(900);

    try {
      const [resPix, resLink] = await Promise.all([
        gerarPixFn({
          data: {
            valor,
            descricao: descricaoFinal,
            clienteNome: clienteNome || undefined,
            clienteEmail: clienteEmail || undefined,
            agendamentoId: agendamentoId || undefined,
            cobrancaId: cobrancaId || undefined,
            clienteId: clienteId || undefined,
          },
        }),
        gerarLinkFn({
          data: {
            titulo: descricaoFinal,
            valor,
            clienteNome: clienteNome || undefined,
            clienteEmail: clienteEmail || undefined,
            agendamentoId: agendamentoId || undefined,
            cobrancaId: cobrancaId || undefined,
            clienteId: clienteId || undefined,
          },
        }),
      ]);

      if (resPix.sucesso) {
        setPixPaymentId(resPix.paymentId || null);
        setQrCode(resPix.qrCode || "");
        setQrCodeBase64(resPix.qrCodeBase64 || "");
      } else {
        console.warn("[PagamentoOnline] Falha Pix:", resPix.mensagemErro);
      }

      if (resLink.sucesso) {
        setLinkCartao(resLink.initPoint || "");
      } else {
        console.warn("[PagamentoOnline] Falha Link:", resLink.mensagemErro);
      }

      if (!resPix.sucesso && !resLink.sucesso) {
        setErro(resPix.mensagemErro || resLink.mensagemErro || "Falha ao gerar links de pagamento.");
      }
    } catch (err: any) {
      setErro(err?.message || "Erro de conexão ao gerar pagamento online.");
    } finally {
      setCarregando(false);
    }
  }, [valor, descricaoFinal, clienteNome, clienteEmail, agendamentoId, cobrancaId, clienteId]);

  useEffect(() => {
    if (open && valor > 0) {
      gerarLinksOnline();
    }
    if (!open) {
      // Reset ao fechar
      setPixPaymentId(null);
      setQrCode("");
      setQrCodeBase64("");
      setLinkCartao("");
      setPagoComSucesso(false);
      setErro(null);
      setAbaAtiva("pix");
    }
  }, [open, valor]);

  // Polling automático a cada 5s
  useEffect(() => {
    if (!open || pagoComSucesso || (!pixPaymentId && !linkCartao)) return;

    const interval = setInterval(async () => {
      try {
        const res = await verificarFn({
          data: {
            paymentId: pixPaymentId || undefined,
            agendamentoId: agendamentoId || undefined,
            clienteId: clienteId || undefined,
          },
        });
        if (res.sucesso && res.status === "approved") {
          setPagoComSucesso(true);
          toast.success("🎉 Pagamento confirmado com sucesso! Baixa automática realizada.");
          onPagoComSucesso?.();
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [open, pagoComSucesso, pixPaymentId, agendamentoId, clienteId, linkCartao]);

  // Contagem regressiva
  useEffect(() => {
    if (!open || pagoComSucesso) return;
    const timer = setInterval(() => {
      setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, pagoComSucesso]);

  const formatarMinutos = (s: number) => {
    const m = Math.floor(s / 60);
    const seg = s % 60;
    return `${m}:${seg < 10 ? "0" : ""}${seg}`;
  };

  // Copiar código Pix
  const handleCopiarPix = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    setCopiadoPix(true);
    toast.success("Código Pix Copia-e-Cola copiado!");
    setTimeout(() => setCopiadoPix(false), 3000);
  };

  // Copiar link cartão
  const handleCopiarCartao = () => {
    if (!linkCartao) return;
    navigator.clipboard.writeText(linkCartao);
    setCopiadoCartao(true);
    toast.success("Link de pagamento com Cartão copiado!");
    setTimeout(() => setCopiadoCartao(false), 3000);
  };

  // Enviar tudo no WhatsApp
  const handleEnviarWhatsApp = () => {
    let textoMsg = `Olá, ${primeiroNome}! 🐾\n\nSegue as opções para pagamento de *${descricaoFinal}* no valor de *R$ ${valorFormatado}* no Spa de Pet Tia Jéssica:\n\n`;

    if (linkCartao) {
      textoMsg += `💳 *Pagar no Cartão de Crédito (em até 12x):*\n${linkCartao}\n\n`;
    }
    if (qrCode) {
      textoMsg += `⚡ *Pagar via Pix (Copia e Cola):*\n\`${qrCode}\`\n\n_(Basta copiar o código acima e colar no app do seu banco)_\n\n`;
    }
    textoMsg += `A confirmação é automática! ✨`;

    if (clienteWhatsapp) {
      const telFormatado = clienteWhatsapp.replace(/\D/g, "");
      const numCompleto = telFormatado.startsWith("55") ? telFormatado : `55${telFormatado}`;
      window.open(`https://wa.me/${numCompleto}?text=${encodeURIComponent(textoMsg)}`, "_blank");
    } else {
      navigator.clipboard.writeText(textoMsg);
      toast.info("Mensagem copiada! Cole na conversa com o cliente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden border-emerald-800/30">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 bg-gradient-to-r from-[#123328] via-[#1a4a3b] to-[#123328] text-white border-b border-[#C8A951]/30">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-[#C8A951] to-[#F1E5C4] text-[#123328] shadow-md">
              {pagoComSucesso ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Smartphone className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2 font-display">
                {pagoComSucesso ? "Pagamento Confirmado!" : "Pagamento Online"}
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-100/80">
                {pagoComSucesso
                  ? "Baixa automática realizada com sucesso."
                  : `${clienteNome || "Cliente"} · R$ ${valorFormatado}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Estado: Carregando */}
          {carregando && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="text-sm text-muted-foreground">Gerando Pix e Link de Cartão...</span>
            </div>
          )}

          {/* Estado: Erro */}
          {erro && !carregando && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-2">
              <p className="text-sm font-medium text-destructive">{erro}</p>
              <Button size="sm" variant="outline" onClick={gerarLinksOnline}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
              </Button>
            </div>
          )}

          {/* Estado: PAGO */}
          {pagoComSucesso && (
            <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
                Valor Liquidado
              </span>
              <span className="text-3xl font-bold text-emerald-800 font-display block">
                R$ {valorFormatado}
              </span>
              <p className="text-xs text-emerald-600">
                {clienteNome ? `Pagamento de ${clienteNome} confirmado.` : "Pagamento confirmado."}
                <br />Baixa automática realizada no sistema.
              </p>
            </div>
          )}

          {/* Estado: Links gerados, aguardando pagamento */}
          {!carregando && !erro && !pagoComSucesso && (qrCode || linkCartao) && (
            <>
              {/* Valor em destaque */}
              <div className="text-center py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Valor</span>
                <div className="text-2xl font-bold text-emerald-800 font-display">
                  R$ {valorFormatado}
                </div>
                <div className="text-xs text-muted-foreground">{descricaoFinal}</div>
              </div>

              {/* Abas Pix / Cartão */}
              <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
                <button
                  onClick={() => setAbaAtiva("pix")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                    abaAtiva === "pix"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <QrCode className="h-3.5 w-3.5" /> Pix Instantâneo
                </button>
                <button
                  onClick={() => setAbaAtiva("cartao")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                    abaAtiva === "cartao"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Cartão de Crédito
                </button>
              </div>

              {/* Conteúdo Pix */}
              {abaAtiva === "pix" && qrCode && (
                <div className="space-y-3">
                  {qrCodeBase64 && (
                    <div className="flex justify-center">
                      <div className="p-3 bg-white rounded-xl border shadow-sm">
                        <img
                          src={`data:image/png;base64,${qrCodeBase64}`}
                          alt="QR Code Pix"
                          className="w-48 h-48"
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 h-9"
                    onClick={handleCopiarPix}
                  >
                    {copiadoPix ? (
                      <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copiar Código Pix (Copia e Cola)</>
                    )}
                  </Button>
                </div>
              )}

              {abaAtiva === "pix" && !qrCode && (
                <div className="text-center text-xs text-muted-foreground py-4">
                  Pix não disponível para esta cobrança.
                </div>
              )}

              {/* Conteúdo Cartão */}
              {abaAtiva === "cartao" && linkCartao && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                    <p className="text-xs text-blue-800 font-medium text-center">
                      Pague no Cartão de Crédito em até 12x via Mercado Pago
                    </p>
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 h-9"
                      onClick={() => window.open(linkCartao, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir Página de Pagamento
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 h-9"
                    onClick={handleCopiarCartao}
                  >
                    {copiadoCartao ? (
                      <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copiar Link do Cartão</>
                    )}
                  </Button>
                </div>
              )}

              {abaAtiva === "cartao" && !linkCartao && (
                <div className="text-center text-xs text-muted-foreground py-4">
                  Link de cartão não disponível.
                </div>
              )}

              {/* Timer + Status */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Expira em {formatarMinutos(segundosRestantes)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Verificando pagamento automaticamente...</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer com ações */}
        {!carregando && !erro && !pagoComSucesso && (qrCode || linkCartao) && (
          <div className="p-4 border-t bg-muted/30 space-y-2">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2 h-10 shadow-md"
              onClick={handleEnviarWhatsApp}
            >
              <Share2 className="h-4 w-4" />
              Enviar Opções de Pagamento no WhatsApp {clienteNome ? `de ${primeiroNome}` : ""}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Envia Pix + Link de Cartão em uma única mensagem · Baixa automática ao pagar
            </p>
          </div>
        )}

        {pagoComSucesso && (
          <div className="p-4 border-t">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
