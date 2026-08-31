import React, { useState } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Loader2,
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  PawPrint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { toast } from "sonner";

interface JessiAgendaPanelProps {
  dataSelecionada: string;
  totalAgendamentos: number;
  confirmados: number;
  aguardando: number;
  levaETrazCount: number;
  onFiltrarAguardando?: () => void;
  onFiltrarLevaETraz?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const JessiAgendaPanel: React.FC<JessiAgendaPanelProps> = ({
  dataSelecionada,
  totalAgendamentos,
  confirmados,
  aguardando,
  levaETrazCount,
  onFiltrarAguardando,
  onFiltrarLevaETraz,
  onRefresh,
  isRefreshing,
}) => {
  const processarMensagemFn = useServerFn(processarMensagemJessi);

  const [inputMsg, setInputMsg] = useState("");
  const [respostaJessi, setRespostaJessi] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>(
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  // Hook de reconhecimento de voz
  const { isListening, startListening, stopListening } = useJessiVoice((textoTranscrito) => {
    if (textoTranscrito.trim()) {
      setInputMsg(textoTranscrito);
    }
  });

  const handlePerguntar = async (textoPersonalizado?: string) => {
    const query = textoPersonalizado || inputMsg;
    if (!query.trim()) return;

    setIsLoading(true);
    setRespostaJessi(null);

    try {
      const res = await processarMensagemFn({
        data: {
          mensagem: query,
          contexto: {
            origem: "agenda",
            dataReferencia: dataSelecionada,
            totalAgendamentos,
            confirmados,
            aguardando,
            levaETrazCount,
          },
        },
      });

      setRespostaJessi(res.respostaTexto);
      setInputMsg("");
      setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Erro ao consultar a Jessi na Agenda:", err);
      toast.error("Não foi possível processar a consulta.");
      setRespostaJessi(
        "Tive uma dificuldade temporária ao consultar a agenda. Por favor, tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fmtDataStr = (iso: string) => {
    try {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    } catch {
      return iso;
    }
  };

  const resumoLinguagemNatural =
    totalAgendamentos > 0
      ? `Para o dia ${fmtDataStr(dataSelecionada)}, temos ${totalAgendamentos} atendimento(s) programado(s). ${
          confirmados > 0 ? `${confirmados} já estão confirmados pelo tutor. ` : ""
        }${
          aguardando > 0 ? `${aguardando} aguardam confirmação de presença. ` : ""
        }${levaETrazCount > 0 ? `Temos ${levaETrazCount} serviço(s) com transporte Leva e Traz.` : ""}`
      : `Não há agendamentos cadastrados para o dia ${fmtDataStr(dataSelecionada)}. A agenda está livre para novos horários e encaixes!`;

  return (
    <div className="space-y-3 my-2 animate-in fade-in duration-300">
      {/* Box Principal da Jessi na Agenda */}
      <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 md:p-5 shadow-sm border border-[#C8A951]/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs shrink-0">
              <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="font-display font-bold text-base text-white tracking-tight">
                  Jessi · Assistente Operacional da Agenda
                </span>
                <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                  IA Ativa
                </Badge>
              </div>
              <p className="text-xs text-white/70">
                Sincronizado às {ultimaAtualizacao} • Monitoramento de horários, confirmações e Leva &amp; Traz
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="text-xs text-white/90 hover:bg-white/10 hover:text-white h-8 gap-1.5 rounded-lg"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </Button>
            )}
          </div>
        </div>

        {/* Parecer Narrado pela Jessi */}
        <div className="p-3.5 rounded-xl bg-black/20 border border-white/10 text-xs md:text-sm text-white/95 leading-relaxed backdrop-blur-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-[#C8A951] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-[#F5E6BE]">Panorama da Agenda ({fmtDataStr(dataSelecionada)}):</p>
              <p className="text-white/90 leading-snug">{resumoLinguagemNatural}</p>
            </div>
          </div>
        </div>

        {/* Chips de Ação Rápida */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-white/70 font-medium">Ações da Jessi:</span>
          {aguardando > 0 && onFiltrarAguardando && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFiltrarAguardando}
              className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-400/30 rounded-lg gap-1.5 shadow-2xs"
            >
              <Clock className="h-3 w-3 text-amber-300" />
              Aguardando confirmação ({aguardando})
            </Button>
          )}
          {levaETrazCount > 0 && onFiltrarLevaETraz && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFiltrarLevaETraz}
              className="h-7 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border-emerald-400/30 rounded-lg gap-1.5 shadow-2xs"
            >
              <Car className="h-3 w-3 text-emerald-300" />
              Leva e Traz ({levaETrazCount})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePerguntar("Jessi, quem é o próximo pet agendado para hoje?")}
            className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1.5 shadow-2xs"
          >
            <PawPrint className="h-3 w-3 text-[#C8A951]" />
            Próximo pet
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePerguntar("Jessi, temos horários livres para banho hoje?")}
            className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1.5 shadow-2xs"
          >
            <Zap className="h-3 w-3 text-[#C8A951]" />
            Horários livres
          </Button>
        </div>

        {/* Resposta de Pergunta Personalizada */}
        {respostaJessi && (
          <div className="mt-3 p-3.5 rounded-xl bg-white text-zinc-900 border border-[#C8A951]/40 text-xs shadow-md animate-in fade-in space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#123F2A] border-b border-zinc-100 pb-1">
              <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
              <span>Resposta da Jessi:</span>
            </div>
            <p className="whitespace-pre-line text-zinc-800 leading-relaxed">{respostaJessi}</p>
          </div>
        )}

        {/* Campo de Interação por Texto e Voz */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Pergunte à Jessi sobre a agenda, horários, encaixes ou pets..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePerguntar()}
              className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 text-xs focus:bg-white/20 focus:border-[#C8A951] rounded-xl pr-9"
            />
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-white/70 hover:text-white"
              }`}
              title={isListening ? "Parar de ouvir" : "Falar com a Jessi por voz"}
            >
              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => handlePerguntar()}
            disabled={isLoading || !inputMsg.trim()}
            className="h-9 px-3.5 bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold text-xs rounded-xl shadow-xs shrink-0"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
