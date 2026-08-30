import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Loader2,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Layers,
  HeartHandshake,
  MessageSquare,
  Wand2,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  gerar3AbordagensIA,
  refinarMensagem,
  registrarComunicacao,
  salvarPromessa,
} from "@/lib/comunicacao-central.functions";
import { abrirWhatsAppBusiness } from "@/lib/whatsapp";

interface JessiCobrarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamento: any | null;
  outrasPendenciasDoCliente?: any[];
  onSuccess?: () => void;
}

export function JessiCobrarDialog({
  open,
  onOpenChange,
  pagamento,
  outrasPendenciasDoCliente = [],
  onSuccess,
}: JessiCobrarDialogProps) {
  const qc = useQueryClient();
  const gerar3Fn = useServerFn(gerar3AbordagensIA);
  const refinarFn = useServerFn(refinarMensagem);
  const registrarFn = useServerFn(registrarComunicacao);
  const promessaFn = useServerFn(salvarPromessa);

  const [versoes, setVersoes] = useState<Array<{ tom: string; texto: string }>>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState<number>(0);
  const [textoAtual, setTextoAtual] = useState<string>("");
  const [consolidar, setConsolidar] = useState<boolean>(false);
  const [instrucaoExtra, setInstrucaoExtra] = useState<string>("");
  const [promessaData, setPromessaData] = useState<string>("");
  const [promessaValor, setPromessaValor] = useState<string>("");

  const temMultiplas = outrasPendenciasDoCliente.length > 0;
  const valorTotalConsolidado = (pagamento?.saldo || 0) + outrasPendenciasDoCliente.reduce((acc, curr) => acc + (curr.saldo || 0), 0);
  const todosPets = [pagamento?.pet_nome, ...outrasPendenciasDoCliente.map((p) => p.pet_nome)].filter(Boolean).join(", ");

  const gerar3Mut = useMutation({
    mutationFn: async () => {
      if (!pagamento) return [];
      const ctxManual = consolidar
        ? `Consolidar débitos dos pets (${todosPets}). Total: R$ ${valorTotalConsolidado.toFixed(2)}. ${instrucaoExtra}`
        : instrucaoExtra;

      const res = await gerar3Fn({
        data: {
          clienteId: pagamento.cliente_id,
          cobrancaId: pagamento.id,
          petId: pagamento.pet_id,
          contextoManual: ctxManual || null,
          objetivo: "cobranca",
        },
      });

      return res?.versoes || [];
    },
    onSuccess: (novasVersoes) => {
      setVersoes(novasVersoes);
      if (novasVersoes.length > 0) {
        setVersaoSelecionada(0);
        setTextoAtual(novasVersoes[0].texto);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao gerar mensagens inteligentes.");
    },
  });

  // Gera abordagens ao abrir
  useEffect(() => {
    if (open && pagamento) {
      setConsolidar(false);
      setInstrucaoExtra("");
      setPromessaData("");
      setPromessaValor("");
      gerar3Mut.mutate();
    }
  }, [open, pagamento]);

  const refinarMut = useMutation({
    mutationFn: (acao: string) => refinarFn({ data: { texto: textoAtual, acao: acao as any } }),
    onSuccess: (r: any) => {
      setTextoAtual(r.texto ?? textoAtual);
      toast.success("Texto refinado com sucesso!");
    },
    onError: () => toast.error("Não foi possível refinar o texto."),
  });

  const enviarMut = useMutation({
    mutationFn: async () => {
      if (!pagamento) return;

      // 1. Registra no histórico de comunicação com o cliente
      await registrarFn({
        data: {
          clienteId: pagamento.cliente_id,
          corpo: textoAtual,
          mensagemIaOriginal: versoes[versaoSelecionada]?.texto || null,
          tomEscolhido: versoes[versaoSelecionada]?.tom || "personalizado",
          canal: "whatsapp",
          tipo: "cobranca",
          cobrancaId: pagamento.id,
          contextoIa: {
            consolidado: consolidar,
            totalConsolidado: consolidar ? valorTotalConsolidado : pagamento.saldo,
            petsMencionados: todosPets,
            revisadoManualmente: true,
          },
        },
      });

      // 2. Registra promessa de pagamento se preenchida
      if (promessaData) {
        await promessaFn({
          data: {
            clienteId: pagamento.cliente_id,
            cobrancaId: pagamento.id,
            valorPrometido: Number(promessaValor || pagamento.saldo || 0),
            dataPrometida: promessaData,
            status: "aguardando",
            valorRecebido: 0,
          },
        });
      }
    },
    onSuccess: () => {
      const fone = pagamento?.cliente_whatsapp || "";
      if (fone) {
        abrirWhatsAppBusiness(fone, textoAtual);
      }
      toast.success("Cobrança registrada e aberta no WhatsApp com sucesso!");
      qc.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao registrar cobrança.");
    },
  });

  if (!pagamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-semibold mb-1">
            <Sparkles className="h-4 w-4 text-[#C8A951]" />
            <span>Jessi · Central Inteligente de Cobrança</span>
          </div>
          <DialogTitle className="text-lg font-bold font-display">
            Cobrança Inteligente — {pagamento.cliente_nome}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A Jessi analisou o histórico e preparou 3 estratégias distintas para você revisar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Alerta de Múltiplos Débitos do mesmo Tutor */}
          {temMultiplas && (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-amber-700" /> Múltiplas pendências identificadas!
                </span>
                <Badge variant="outline" className="bg-amber-100/60 text-amber-900 border-amber-300 text-[10px]">
                  {outrasPendenciasDoCliente.length + 1} parcelas abertas
                </Badge>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Este tutor possui débitos adicionais vinculados aos pets: <strong>{todosPets}</strong>.
                Total conjunto: <strong>R$ {valorTotalConsolidado.toFixed(2)}</strong>.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant={consolidar ? "default" : "outline"}
                  onClick={() => {
                    setConsolidar(!consolidar);
                    setTimeout(() => gerar3Mut.mutate(), 50);
                  }}
                  className={`h-7 px-2.5 text-xs rounded-xl font-semibold ${
                    consolidar ? "bg-amber-800 text-white hover:bg-amber-900" : "border-amber-300 text-amber-950 hover:bg-amber-100/50"
                  }`}
                >
                  {consolidar ? "✓ Cobrança Consolidada Ativa" : "Consolidar todos os débitos em uma mensagem"}
                </Button>
              </div>
            </div>
          )}

          {/* 3 Opções de Abordagens da Jessi */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Escolha a Abordagem Recomendada:</span>
              <button
                type="button"
                onClick={() => gerar3Mut.mutate()}
                disabled={gerar3Mut.isPending}
                className="text-[11px] text-emerald-800 hover:underline flex items-center gap-1 font-medium"
              >
                <Sparkles className="h-3 w-3" /> Gerar novas opções
              </button>
            </Label>

            {gerar3Mut.isPending ? (
              <div className="p-8 rounded-2xl border border-border/80 text-center text-muted-foreground space-y-2 bg-muted/20">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-800" />
                <p className="text-xs font-medium">A Jessi está estudando o histórico e formulando 3 estratégias...</p>
              </div>
            ) : versoes.length === 0 ? (
              <div className="p-4 rounded-xl border border-border/80 text-center text-muted-foreground">
                Nenhuma versão gerada. Clique em gerar acima.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {versoes.map((v, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setVersaoSelecionada(idx);
                      setTextoAtual(v.texto);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all space-y-1.5 shadow-2xs ${
                      versaoSelecionada === idx
                        ? "border-emerald-800 bg-emerald-50/70 ring-1 ring-emerald-800 text-emerald-950"
                        : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-foreground">
                        {v.tom || `Opção ${idx + 1}`}
                      </span>
                      {versaoSelecionada === idx && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] line-clamp-3 leading-snug">
                      {v.texto}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Campo de Edição da Mensagem Escolhida */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Mensagem para Envio (Revise ou edite à vontade):
            </Label>
            <Textarea
              rows={5}
              value={textoAtual}
              onChange={(e) => setTextoAtual(e.target.value)}
              placeholder="A mensagem selecionada aparece aqui para sua revisão..."
              className="text-xs rounded-xl bg-background leading-relaxed"
            />

            {/* Refinamentos rápidos com 1 clique */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground self-center mr-1 font-medium">Refinar:</span>
              {[
                ["mais_cordial", "Mais cordial"],
                ["mais_humano", "Mais humano"],
                ["mais_direta", "Mais direta"],
                ["mais_firme", "Mais firme"],
                ["sem_valor", "Sem citar valor"],
                ["citar_pet", "Mencionar pet"],
                ["resumir", "Resumir"],
                ["corrigir", "Corrigir ortografia"],
              ].map(([acao, label]) => (
                <Button
                  key={acao}
                  size="sm"
                  variant="outline"
                  disabled={!textoAtual || refinarMut.isPending}
                  onClick={() => refinarMut.mutate(acao)}
                  className="h-6 text-[10px] px-2 rounded-lg"
                >
                  {refinarMut.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> : null}
                  {label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                disabled={!textoAtual}
                onClick={() => {
                  navigator.clipboard.writeText(textoAtual);
                  toast.success("Copiado para a área de transferência!");
                }}
                className="h-6 px-2 text-[10px] ml-auto text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </div>
          </div>

          {/* Registro de Promessa de Pagamento */}
          <Card className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-2">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-emerald-800" /> Registrar Promessa de Pagamento (Opcional):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Data Prometida</Label>
                <Input
                  type="date"
                  value={promessaData}
                  onChange={(e) => setPromessaData(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Valor Prometido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={String(consolidar ? valorTotalConsolidado : pagamento.saldo)}
                  value={promessaValor}
                  onChange={(e) => setPromessaValor(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={enviarMut.isPending}
            className="text-xs rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => enviarMut.mutate()}
            disabled={enviarMut.isPending || !textoAtual.trim()}
            className="text-xs bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-xs gap-1.5"
          >
            {enviarMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Aprovar e Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
