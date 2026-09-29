import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  HandCoins,
  Sparkles,
  Percent,
  CreditCard,
  QrCode,
  Copy,
  Send,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  simularAcordoIA,
  registrarPromessa,
  type CobrancaDTO,
  type FilaItemDTO,
} from "@/lib/cobrancas.functions";
import { openWhatsAppComposerGlobal } from "@/components/whatsapp-composer";

interface MesaNegociacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobranca: CobrancaDTO | FilaItemDTO | null;
  onQuitarSuccess?: (resultadoReativacao: any) => void;
}

export function MesaNegociacaoDialog({
  open,
  onOpenChange,
  cobranca,
  onQuitarSuccess,
}: MesaNegociacaoDialogProps) {
  const qc = useQueryClient();
  const simularFn = useServerFn(simularAcordoIA);
  const promessaFn = useServerFn(registrarPromessa);

  const [descontoPix, setDescontoPix] = useState<number>(5);
  const [parcelasMax, setParcelasMax] = useState<number>(3);
  const [carregando, setCarregando] = useState(false);
  const [simulacao, setSimulacao] = useState<any>(null);
  const [textoProposta, setTextoProposta] = useState("");

  // Promessa
  const [dataPromessa, setDataPromessa] = useState("");
  const [notaPromessa, setNotaPromessa] = useState("");

  const carregarSimulacao = async () => {
    if (!cobranca?.id) return;
    setCarregando(true);
    try {
      const res = await simularFn({
        data: {
          cobrancaId: cobranca.id,
          descontoPixPct: descontoPix,
          parcelasMax: parcelasMax,
        },
      });
      setSimulacao(res);
      setTextoProposta(res.propostaTexto);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao simular acordo");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (open && cobranca?.id) {
      carregarSimulacao();
      // Sugere promessa para daqui a 3 dias
      const d = new Date();
      d.setDate(d.getDate() + 3);
      setDataPromessa(d.toISOString().slice(0, 10));
    }
  }, [open, cobranca?.id, descontoPix, parcelasMax]);

  const registrarPromessaMut = useMutation({
    mutationFn: async () => {
      if (!cobranca?.id || !dataPromessa) return;
      return promessaFn({
        data: {
          cobrancaId: cobranca.id,
          data: dataPromessa,
          nota: notaPromessa || `Acordo simulado: ${descontoPix}% no Pix ou até ${parcelasMax}x no cartão.`,
        },
      });
    },
    onSuccess: () => {
      toast.success("Promessa de pagamento registrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao registrar promessa"),
  });

  if (!cobranca) return null;

  const brl = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleCopiarProposta = () => {
    navigator.clipboard.writeText(textoProposta);
    toast.success("Proposta de negociação copiada!");
  };

  const handleEnviarWhatsApp = () => {
    const whatsapp = cobranca.cliente_whatsapp;
    if (!whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }

    openWhatsAppComposerGlobal({
      tipo: "cobranca_vencida",
      destinatario: cobranca.cliente_nome ?? "Cliente",
      telefone: whatsapp,
      mensagem: textoProposta,
      motivo: "Acordo e Negociação",
      cliente_id: (cobranca as any).cliente_id ?? null,
      cobranca_id: cobranca.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-[#C8A951]/40">
        <DialogHeader className="p-5 pb-3 bg-gradient-to-r from-[#123328] via-[#1a4a3b] to-[#123328] text-white border-b border-[#C8A951]/30">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-[#C8A951] to-[#F1E5C4] text-[#123328] shadow-md">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2 font-display">
                Mesa de Negociação & Acordos IA
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-100/80">
                Simule condições especiais de quitação para {cobranca.cliente_nome} (Pet: {cobranca.pet_nome || "—"})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Card Resumo do Débito Original */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-xl border">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase">Cliente</span>
              <p className="font-semibold text-xs text-foreground truncate">{cobranca.cliente_nome}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase">Pet</span>
              <p className="font-semibold text-xs text-foreground">🐾 {cobranca.pet_nome || "—"}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase">Saldo Aberto</span>
              <p className="font-bold text-xs text-rose-600">{brl(cobranca.saldo)}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase">Dias em Atraso</span>
              <p className="font-semibold text-xs text-amber-700">{cobranca.dias_atraso} dias</p>
            </div>
          </div>

          {/* Controles de Simulação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Controle Desconto Pix */}
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-[#C8A951]" />
                  Desconto no PIX à vista:
                </label>
                <Badge variant="outline" className="bg-[#C8A951]/10 text-foreground border-[#C8A951]/50 font-bold">
                  {descontoPix}% OFF
                </Badge>
              </div>

              <Slider
                value={[descontoPix]}
                min={0}
                max={30}
                step={1}
                onValueChange={(val) => setDescontoPix(val[0])}
                className="py-2"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>Valor com desconto:</span>
                <strong className="text-emerald-600 text-sm">
                  {brl(simulacao?.valorComDesconto ?? cobranca.saldo)}
                </strong>
              </div>
            </div>

            {/* Controle Parcelamento */}
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  Parcelas Máximas no Cartão:
                </label>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-bold">
                  até {parcelasMax}x
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 6].map((num) => (
                  <Button
                    key={num}
                    size="sm"
                    variant={parcelasMax === num ? "default" : "outline"}
                    onClick={() => setParcelasMax(num)}
                    className="flex-1 h-8 text-xs font-semibold"
                  >
                    {num}x
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>Valor por parcela:</span>
                <strong className="text-foreground text-sm">
                  {parcelasMax}x de {brl(simulacao?.valorParcela ?? (cobranca.saldo / parcelasMax))}
                </strong>
              </div>
            </div>
          </div>

          {/* Preview da Proposta Gerada pela IA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
                Texto da Proposta Personalizada (IA)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopiarProposta}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar Proposta
                </button>
              </div>
            </div>

            <Textarea
              value={textoProposta}
              onChange={(e) => setTextoProposta(e.target.value)}
              rows={6}
              className="text-xs leading-relaxed font-sans bg-muted/20 border-primary/20 resize-none"
            />
          </div>

          {/* Bloco de Registro de Promessa */}
          <div className="p-4 rounded-xl border border-dashed bg-muted/30 space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5 text-primary" />
              Registrar Promessa de Pagamento Acordada
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Data acordada para quitação:</label>
                <Input
                  type="date"
                  value={dataPromessa}
                  onChange={(e) => setDataPromessa(e.target.value)}
                  className="h-8 text-xs mt-1 bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Nota / Observações do acordo:</label>
                <Input
                  placeholder="Ex: Prometeu pagar dia do pagamento via Pix com 5%"
                  value={notaPromessa}
                  onChange={(e) => setNotaPromessa(e.target.value)}
                  className="h-8 text-xs mt-1 bg-background"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Botões de Ação */}
        <DialogFooter className="p-4 bg-muted/30 border-t flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => registrarPromessaMut.mutate()}
              disabled={registrarPromessaMut.isPending || !dataPromessa}
              className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              {registrarPromessaMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              Salvar Promessa
            </Button>

            <Button
              size="sm"
              onClick={handleEnviarWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-md"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar Proposta no WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
