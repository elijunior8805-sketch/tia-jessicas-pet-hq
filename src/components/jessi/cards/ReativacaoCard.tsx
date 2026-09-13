import React, { useState } from "react";
import {
  HeartHandshake,
  Send,
  Copy,
  Check,
  ExternalLink,
  PawPrint,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { Link } from "@tanstack/react-router";

interface ReativacaoItem {
  cliente?: {
    id?: string;
    nome?: string;
    telefone?: string;
  };
  pet?: {
    id?: string;
    nome?: string;
  };
  diasInativo?: number;
  faixaRisco?: string;
  ultimoAtendimento?: string;
  mensagemSugerida?: {
    textoMensagem?: string;
    urlWhatsApp?: string;
    telefoneDestino?: string;
  };
}

interface ReativacaoCardProps {
  data: any;
  onActionClick?: (comando: string) => void;
}

const getFaixaBadge = (dias: number) => {
  if (dias >= 120) return { label: `${dias}d (Crítico)`, color: "bg-red-500/15 text-red-700 border-red-500/30" };
  if (dias >= 90) return { label: `${dias}d (Prioridade)`, color: "bg-orange-500/15 text-orange-700 border-orange-500/30" };
  if (dias >= 60) return { label: `${dias}d (Atenção)`, color: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
  return { label: `${dias}d sem visita`, color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
};

export const ReativacaoCard: React.FC<ReativacaoCardProps> = ({ data }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const lista: ReativacaoItem[] = React.useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.itens)) return data.itens;
    if (Array.isArray(data?.data)) return data.data;
    if (data && typeof data === "object" && data.cliente) return [data];
    return [];
  }, [data]);

  if (lista.length === 0) return null;

  const handleCopiar = async (item: ReativacaoItem, id: string) => {
    const msg = item.mensagemSugerida?.textoMensagem;
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(id);
      toast.success(`Mensagem para ${item.cliente?.nome || "cliente"} copiada!`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleEnviar = (item: ReativacaoItem) => {
    const url = item.mensagemSugerida?.urlWhatsApp;
    if (url) {
      abrirWhatsApp(url);
    } else {
      toast.error("Telefone não cadastrado para este cliente.");
    }
  };

  return (
    <div className="rounded-2xl border border-purple-200/80 bg-linear-to-br from-purple-50/40 via-background to-background p-3.5 md:p-4 space-y-3.5 text-xs shadow-xs">
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between border-b border-purple-100/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              Reativação de Clientes
            </span>
            <span className="text-[10px] text-muted-foreground">
              Dispare mensagens carinhosas com 1 clique
            </span>
          </div>
        </div>
        <Badge variant="outline" className="bg-purple-100/70 text-purple-800 border-purple-200 text-[10px] font-medium">
          {lista.length} sugerido(s)
        </Badge>
      </div>

      {/* Lista de Pets / Tutores */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
        {lista.map((item, idx) => {
          const key = item.pet?.id || item.cliente?.id || `reativa-${idx}`;
          const dias = item.diasInativo || 0;
          const badgeInfo = getFaixaBadge(dias);
          const isCopied = copiedId === key;

          return (
            <div
              key={key}
              className="p-3 rounded-xl border border-border/70 bg-card hover:border-purple-300 transition-all space-y-2.5 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <PawPrint className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-primary truncate">
                        {item.pet?.nome || "Pet"}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        ({item.cliente?.nome || "Tutor"})
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] py-0 shrink-0 font-medium ${badgeInfo.color}`}>
                  {badgeInfo.label}
                </Badge>
              </div>

              {/* Botões de Ação Direta */}
              <div className="flex items-center gap-2 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleEnviar(item)}
                  disabled={!item.mensagemSugerida?.urlWhatsApp}
                  className="flex-1 h-7 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-medium gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Send className="h-3 w-3" />
                  Enviar WhatsApp
                  <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopiar(item, key)}
                  className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-muted-foreground" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé com link para o painel de Reativação */}
      <div className="pt-1 border-t border-purple-100/60 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Campanhas e ofertas completas:
        </span>
        <Link
          to="/reativacao"
          className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
        >
          Painel de Reativação
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};
