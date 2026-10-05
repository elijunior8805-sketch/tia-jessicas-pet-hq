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
    bairro?: string;
  };
  pet?: {
    id?: string;
    nome?: string;
    raca?: string;
    porte?: string;
  };
  diasInativo?: number;
  faixaRisco?: string;
  diaHabitual?: string;
  motivoInteligente?: string;
  probabilidadeConversao?: string;
  temClubinho?: boolean;
  creditosClubinho?: number;
  ultimoAtendimento?: string;
  mensagemSugerida?: {
    textoMensagem?: string;
    mensagemFormatada?: string;
    urlWhatsApp?: string;
    telefoneDestino?: string;
  };
}

interface ReativacaoCardProps {
  data: any;
  onActionClick?: (comando: string) => void;
}

const getFaixaBadge = (item: ReativacaoItem) => {
  if (item.probabilidadeConversao) {
    return {
      label: item.probabilidadeConversao,
      color: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30 font-semibold",
    };
  }
  const dias = item.diasInativo || 0;
  if (dias >= 120) return { label: `${dias}d (Crítico)`, color: "bg-red-500/15 text-red-700 border-red-500/30" };
  if (dias >= 90) return { label: `${dias}d (Prioridade)`, color: "bg-orange-500/15 text-orange-700 border-orange-500/30" };
  if (dias >= 60) return { label: `${dias}d (Atenção)`, color: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
  return { label: `${dias}d sem visita`, color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
};

export const ReativacaoCard: React.FC<ReativacaoCardProps> = ({ data, onActionClick }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const lista: ReativacaoItem[] = React.useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.itens)) return data.itens;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.candidatos)) return data.candidatos;
    if (Array.isArray(data?.sugestoes)) {
      return data.sugestoes.map((s: any) => ({
        cliente: {
          id: s.clienteId || s.cliente?.id,
          nome: s.clienteNome || s.cliente?.nome || "Cliente",
          telefone: s.telefone || s.cliente?.telefone,
          bairro: s.bairro || s.cliente?.bairro,
        },
        pet: {
          id: s.petId || s.pet?.id,
          nome: s.petNome || s.pet?.nome || "Pet",
          raca: s.petRaca || s.pet?.raca,
          porte: s.petPorte || s.pet?.porte,
        },
        diasInativo: s.diasInativo || s.diasSemVir || 14,
        faixaRisco: s.faixaRisco || "alerta",
        diaHabitual: s.diaHabitual,
        motivoInteligente: s.motivoInteligente,
        probabilidadeConversao: s.probabilidadeConversao,
        temClubinho: s.temClubinho,
        creditosClubinho: s.creditosClubinho,
        ultimoAtendimento: s.ultimoAtendimento,
        mensagemSugerida: {
          textoMensagem: s.mensagemWhatsapp || s.mensagemSugerida?.textoMensagem || s.mensagemSugerida?.mensagemFormatada,
          urlWhatsApp: s.whatsappUrl || s.mensagemSugerida?.urlWhatsApp,
          telefoneDestino: s.telefone || s.mensagemSugerida?.telefoneDestino,
        },
      }));
    }
    if (data && typeof data === "object" && (data.cliente || data.clienteNome || data.petNome)) {
      return [{
        cliente: {
          id: data.clienteId || data.cliente?.id,
          nome: data.clienteNome || data.cliente?.nome || "Cliente",
          telefone: data.telefone || data.cliente?.telefone,
          bairro: data.bairro || data.cliente?.bairro,
        },
        pet: {
          id: data.petId || data.pet?.id,
          nome: data.petNome || data.pet?.nome || "Pet",
          raca: data.petRaca || data.pet?.raca,
          porte: data.petPorte || data.pet?.porte,
        },
        diasInativo: data.diasInativo || data.diasSemVir || 14,
        faixaRisco: data.faixaRisco || "alerta",
        diaHabitual: data.diaHabitual,
        motivoInteligente: data.motivoInteligente,
        probabilidadeConversao: data.probabilidadeConversao,
        temClubinho: data.temClubinho,
        creditosClubinho: data.creditosClubinho,
        ultimoAtendimento: data.ultimoAtendimento,
        mensagemSugerida: {
          textoMensagem: data.mensagemWhatsapp || data.mensagemSugerida?.textoMensagem || data.mensagemSugerida?.mensagemFormatada,
          urlWhatsApp: data.whatsappUrl || data.mensagemSugerida?.urlWhatsApp,
          telefoneDestino: data.telefone || data.mensagemSugerida?.telefoneDestino,
        },
      }];
    }
    return [];
  }, [data]);

  if (lista.length === 0) return null;

  const handleCopiar = async (item: ReativacaoItem, id: string) => {
    const msg =
      item.mensagemSugerida?.textoMensagem ||
      (item.mensagemSugerida as any)?.mensagemFormatada ||
      (item as any).mensagemWhatsapp;
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
    const url =
      item.mensagemSugerida?.urlWhatsApp ||
      (item as any).whatsappUrl ||
      (item.cliente?.telefone
        ? `https://wa.me/55${item.cliente.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
            item.mensagemSugerida?.textoMensagem ||
              (item.mensagemSugerida as any)?.mensagemFormatada ||
              `Olá, ${item.cliente.nome}! Sentimos saudade do ${item.pet?.nome || "seu pet"} no Spa!`
          )}`
        : undefined);

    if (url) {
      abrirWhatsApp(url);
    } else {
      toast.error("Telefone não cadastrado para este cliente.");
    }
  };

  const ehSugestaoVagas = Boolean(data?.diaSemana || lista.some((item) => item.motivoInteligente || item.probabilidadeConversao));
  const tituloCard = ehSugestaoVagas ? `Sugestão para Vagas (${data?.diaSemana || "Grade"})` : "Reativação de Clientes";
  const subTituloCard = ehSugestaoVagas
    ? "Clientes frequentes ranqueados por hábito e ciclo ideal"
    : "Dispare mensagens carinhosas com 1 clique";

  return (
    <div className="rounded-2xl border border-purple-200/80 bg-linear-to-br from-purple-50/40 via-background to-background p-3.5 md:p-4 space-y-3.5 text-xs shadow-xs">
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between border-b border-purple-100/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              {tituloCard}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {subTituloCard}
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
          const badgeInfo = getFaixaBadge(item);
          const isCopied = copiedId === key;

          return (
            <div
              key={key}
              className="p-3 rounded-xl border border-border/70 bg-card hover:border-purple-300 transition-all space-y-2 shadow-2xs"
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
                <Badge variant="outline" className={`text-[10px] py-0.5 px-2 shrink-0 ${badgeInfo.color}`}>
                  {badgeInfo.label}
                </Badge>
              </div>

              {/* Explicação Inteligente / Hábitos de Agendamento */}
              {item.motivoInteligente && (
                <div className="bg-purple-50/60 dark:bg-purple-950/30 rounded-lg p-1.5 px-2 text-[11px] text-purple-900 dark:text-purple-200 flex items-center gap-1.5 border border-purple-100 dark:border-purple-900/50">
                  <Clock className="h-3 w-3 text-purple-600 shrink-0" />
                  <span className="truncate">{item.motivoInteligente}</span>
                </div>
              )}

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
