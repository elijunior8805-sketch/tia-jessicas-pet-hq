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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Send,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  MessageCircle,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  gerarMensagensLoteIA,
  registrarEnvio,
} from "@/lib/cobrancas.functions";
import { openWhatsAppComposerGlobal } from "@/components/whatsapp-composer";

interface DisparoLoteInteligenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobrancaIds?: string[];
  onFinish?: () => void;
}

type ItemDisparo = {
  cobrancaId: string;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp: string | null;
  petNome: string;
  saldo: number;
  diasAtraso: number;
  tomSugerido: string;
  mensagem: string;
  chavePix: string;
  statusEnvio?: "pendente" | "enviado" | "erro";
};

export function DisparoLoteInteligenteDialog({
  open,
  onOpenChange,
  cobrancaIds,
  onFinish,
}: DisparoLoteInteligenteDialogProps) {
  const qc = useQueryClient();
  const gerarMensagensFn = useServerFn(gerarMensagensLoteIA);
  const registrarEnvioFn = useServerFn(registrarEnvio);

  const [carregando, setCarregando] = useState(false);
  const [itens, setItens] = useState<ItemDisparo[]>([]);
  const [busca, setBusca] = useState("");
  const [itemAtivoIndex, setItemAtivoIndex] = useState(0);

  // Carrega as mensagens quando abre o modal
  const carregarMensagens = async () => {
    setCarregando(true);
    try {
      const res = await gerarMensagensFn({
        data: {
          cobrancaIds: cobrancaIds && cobrancaIds.length > 0 ? cobrancaIds : undefined,
        },
      });
      setItens(
        (res || []).map((r) => ({
          ...r,
          petNome: r.petNome ?? "",
          statusEnvio: "pendente",
        }))
      );
      setItemAtivoIndex(0);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar mensagens de cobrança");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (open) {
      carregarMensagens();
    }
  }, [open, cobrancaIds]);

  const registrarEnvioMut = useMutation({
    mutationFn: async ({
      cobrancaId,
      mensagem,
    }: {
      cobrancaId: string;
      mensagem: string;
    }) => {
      return registrarEnvioFn({
        data: {
          cobrancaId,
          mensagem,
          canal: "whatsapp",
          automatico: true,
        },
      });
    },
    onSuccess: (_, vars) => {
      setItens((prev) =>
        prev.map((it) =>
          it.cobrancaId === vars.cobrancaId ? { ...it, statusEnvio: "enviado" } : it
        )
      );
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
  });

  const handleCopiarPix = (chave: string) => {
    navigator.clipboard.writeText(chave);
    toast.success("Chave PIX copiada para a área de transferência!");
  };

  const handleCopiarMensagem = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada com sucesso!");
  };

  const handleEnviarWhatsApp = (item: ItemDisparo, index: number) => {
    if (!item.clienteWhatsapp) {
      toast.error(`Cliente ${item.clienteNome} não possui WhatsApp cadastrado.`);
      return;
    }

    openWhatsAppComposerGlobal({
      tipo: "cobranca_vencida",
      destinatario: item.clienteNome,
      telefone: item.clienteWhatsapp,
      mensagem: item.mensagem,
      motivo: `Cobrança de ${item.saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      cliente_id: item.clienteId,
      cobranca_id: item.cobrancaId,
    });

    registrarEnvioMut.mutate({
      cobrancaId: item.cobrancaId,
      mensagem: item.mensagem,
    });

    // Avança para o próximo se não for o último
    if (index < itens.length - 1) {
      setItemAtivoIndex(index + 1);
    }
  };

  const handleAtualizarMensagem = (cobrancaId: string, novaMsg: string) => {
    setItens((prev) =>
      prev.map((it) => (it.cobrancaId === cobrancaId ? { ...it, mensagem: novaMsg } : it))
    );
  };

  const itensFiltrados = itens.filter(
    (it) =>
      it.clienteNome.toLowerCase().includes(busca.toLowerCase()) ||
      it.petNome.toLowerCase().includes(busca.toLowerCase())
  );

  const enviadosCount = itens.filter((it) => it.statusEnvio === "enviado").length;
  const totalCount = itens.length;
  const totalValor = itens.reduce((acc, it) => acc + it.saldo, 0);

  const getTomBadge = (tom: string) => {
    switch (tom) {
      case "lembrete_amigavel":
        return <Badge className="bg-amber-100 text-amber-900 border-amber-300">Lembrete Suave</Badge>;
      case "cobranca_cordial":
        return <Badge className="bg-orange-100 text-orange-900 border-orange-300">Cobrança Cordial</Badge>;
      case "negociacao_acordo":
        return <Badge className="bg-rose-100 text-rose-900 border-rose-300">Negociação & Acordo</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">Ativo</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-[#C8A951]/40">
        {/* Header Elegante com Tema Spa */}
        <DialogHeader className="p-5 pb-3 bg-gradient-to-r from-[#123328] via-[#1a4a3b] to-[#123328] text-white border-b border-[#C8A951]/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-[#C8A951] to-[#F1E5C4] text-[#123328] shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2 font-display">
                  Disparo em Lote • Régua Inteligente Jessi
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-100/80">
                  Mensagens adaptativas com chave PIX e tom personalizado por tempo de atraso.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-[#C8A951]/20 text-[#F1E5C4] border border-[#C8A951]/40 font-bold px-3 py-1">
                {enviadosCount}/{totalCount} disparados
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs"
                onClick={carregarMensagens}
                disabled={carregando}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${carregando ? "animate-spin" : ""}`} />
                Regenerar IA
              </Button>
            </div>
          </div>

          {/* Resumo da Régua */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10 text-xs">
            <span className="text-emerald-200">
              Total a recuperar no lote:{" "}
              <strong className="text-white font-bold">
                {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </span>
            <span className="text-emerald-200/80">
              {itens.length} tutores selecionados para contato
            </span>
          </div>
        </DialogHeader>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Coluna da Esquerda: Lista de Destinatários */}
          <div className="w-full md:w-2/5 p-3 flex flex-col gap-2 max-h-[50vh] md:max-h-[60vh] overflow-y-auto bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou pet..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            {carregando ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                <p className="text-xs">Gerando mensagens hiperpersonalizadas com IA...</p>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum tutor encontrado na régua.
              </div>
            ) : (
              <div className="space-y-1.5">
                {itensFiltrados.map((it, idx) => {
                  const isSelected = idx === itemAtivoIndex;
                  return (
                    <div
                      key={it.cobrancaId}
                      onClick={() => setItemAtivoIndex(idx)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#C8A951] bg-[#C8A951]/10 shadow-xs"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-semibold text-xs text-foreground truncate">
                          {it.clienteNome}
                        </div>
                        <span className="font-bold text-xs text-rose-600 shrink-0">
                          {it.saldo.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                        <span>🐾 {it.petNome}</span>
                        <span className="text-amber-700 font-medium">
                          {it.diasAtraso}d atraso
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                        {getTomBadge(it.tomSugerido)}
                        {it.statusEnvio === "enviado" ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Enviado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna da Direita: Preview e Edição da Mensagem Ativa */}
          <div className="flex-1 p-4 flex flex-col justify-between max-h-[50vh] md:max-h-[60vh] overflow-y-auto bg-background">
            {itensFiltrados.length > 0 && itensFiltrados[itemAtivoIndex] ? (
              (() => {
                const item = itensFiltrados[itemAtivoIndex];
                return (
                  <div className="space-y-4 flex flex-col h-full justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 bg-muted/40 p-3 rounded-xl border">
                        <div>
                          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                            {item.clienteNome}
                            <span className="text-xs font-normal text-muted-foreground">
                              (WhatsApp: {item.clienteWhatsapp || "Não informado"})
                            </span>
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pet: <strong>{item.petNome}</strong> • Débito:{" "}
                            <strong className="text-rose-600">
                              {item.saldo.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </strong>{" "}
                            • Atraso: <strong>{item.diasAtraso} dias</strong>
                          </p>
                        </div>
                        {getTomBadge(item.tomSugerido)}
                      </div>

                      {/* Caixa de Texto da Mensagem */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
                            Texto Sugerido pela IA (editável)
                          </label>
                          <button
                            onClick={() => handleCopiarMensagem(item.mensagem)}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" /> Copiar texto
                          </button>
                        </div>

                        <Textarea
                          value={item.mensagem}
                          onChange={(e) =>
                            handleAtualizarMensagem(item.cobrancaId, e.target.value)
                          }
                          rows={7}
                          className="text-xs leading-relaxed font-sans bg-muted/20 resize-none border-primary/20 focus:border-primary"
                        />
                      </div>

                      {/* Chave Pix e Facilidade */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                            Chave PIX:
                          </span>
                          <span className="font-mono text-muted-foreground truncate">
                            {item.chavePix}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/20 shrink-0"
                          onClick={() => handleCopiarPix(item.chavePix)}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copiar PIX
                        </Button>
                      </div>
                    </div>

                    {/* Botões de Ação do Item */}
                    <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        Destinatário {itemAtivoIndex + 1} de {itensFiltrados.length}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.statusEnvio === "enviado" && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Já enviado
                          </Badge>
                        )}

                        <Button
                          onClick={() => handleEnviarWhatsApp(item, itemAtivoIndex)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 gap-1.5 shadow-md"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Disparar WhatsApp</span>
                          {itemAtivoIndex < itensFiltrados.length - 1 && (
                            <ArrowRight className="h-3.5 w-3.5 ml-1 opacity-70" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-12 text-center text-muted-foreground text-xs">
                Selecione um destinatário ao lado para revisar a mensagem.
              </div>
            )}
          </div>
        </div>

        {/* Footer com Ações Gerais */}
        <DialogFooter className="p-4 bg-muted/30 border-t flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-[#C8A951]/60 text-foreground hover:bg-[#C8A951]/10"
              onClick={() => {
                toast.success("Régua concluída! Todos os registros foram atualizados.");
                onOpenChange(false);
                if (onFinish) onFinish();
              }}
            >
              Concluir Régua ({enviadosCount}/{totalCount})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
