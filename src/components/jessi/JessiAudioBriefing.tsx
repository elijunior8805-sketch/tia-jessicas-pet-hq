import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  Headphones
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { JessiProactiveCentral } from "@/lib/ia/jessi-contracts";

interface JessiAudioBriefingProps {
  centralData?: JessiProactiveCentral | null;
}

export const JessiAudioBriefing: React.FC<JessiAudioBriefingProps> = ({ centralData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasVoiceSupport, setHasVoiceSupport] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Monta o roteiro falado dinamicamente com base nos dados reais do dia
  const roteiroFalado = React.useMemo(() => {
    if (!centralData) {
      return "Olá! Sua central operacional está pronta. Consulte a agenda, contas a receber ou envie um comando para a Jessi.";
    }

    const nome = centralData.proprietarioNome || "Eli";
    const totalHoje = centralData.hoje?.totalAgendamentos ?? 0;
    const levaTraz = centralData.hoje?.levaTrazCount ?? 0;
    const previsto = centralData.hoje?.faturamentoPrevisto ?? 0;
    const pendencias = centralData.precisaAtencao?.length ?? 0;
    const amanhaNaoConf = centralData.amanha?.naoConfirmados ?? 0;
    const proximo = centralData.hoje?.proximoAtendimento;

    let texto = `Olá, ${nome}! Preparei o seu briefing operacional do Spa de Pet Tia Jéssica. `;

    if (totalHoje === 0) {
      texto += `Para hoje, não temos agendamentos marcados até o momento. É uma excelente oportunidade para encaixes ou reativação de clientes. `;
    } else {
      texto += `Hoje temos ${totalHoje} atendimento${totalHoje > 1 ? "s" : ""} agendado${totalHoje > 1 ? "s" : ""}, com previsão de faturamento de ${previsto.toFixed(0)} reais. `;
      if (levaTraz > 0) {
        texto += `Temos ${levaTraz} atendimento${levaTraz > 1 ? "s" : ""} com serviço de Leva e Traz. `;
      }
      if (proximo) {
        texto += `O próximo atendimento será às ${proximo.hora} para o pet ${proximo.pet}, com o tutor ${proximo.tutor}. `;
      }
    }

    if (pendencias > 0) {
      texto += `Identifiquei ${pendencias} ponto${pendencias > 1 ? "s" : ""} de atenção que precisam de resolução, como contas a receber. `;
    }

    if (amanhaNaoConf > 0) {
      texto += `Para amanhã, temos ${amanhaNaoConf} agendamento${amanhaNaoConf > 1 ? "s" : ""} aguardando confirmação no WhatsApp. `;
    }

    texto += `Tenha um excelente dia de atendimentos no Spa!`;

    return texto;
  }, [centralData]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setHasVoiceSupport(false);
    }
  }, []);

  const handlePlayAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(roteiroFalado);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05; // Velocidade natural e dinâmica
    utterance.pitch = 1.0;

    // Seleciona a melhor voz brasileira disponível
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.includes("pt-BR") || v.lang.includes("pt_BR"));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePauseAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStopAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  if (!hasVoiceSupport) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-900/90 via-emerald-950/90 to-[#0A2612] border border-[#C8A951]/40 text-white p-3.5 sm:p-4 shadow-sm space-y-2.5 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/50 text-[#F5E6BE] flex items-center justify-center shrink-0 shadow-xs">
            <Headphones className="h-4 w-4 text-[#C8A951]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm font-display text-white truncate">
                Briefing Matinal em Áudio · Jessi
              </span>
              {isPlaying && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 animate-pulse">
                  Reproduzindo
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/70 truncate">
              Resumo narrado de 30 segundos dos atendimentos, rotas e finanças
            </p>
          </div>
        </div>

        {/* Controles de Reprodução e Equalizador Animado */}
        <div className="flex items-center gap-2 shrink-0">
          {isPlaying && (
            <div className="flex items-center gap-0.5 px-2 py-1 bg-black/30 rounded-lg border border-white/10 mr-1">
              <span className="w-1 h-3 bg-[#C8A951] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-2 bg-[#F5E6BE] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="w-1 h-4 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: "450ms" }} />
            </div>
          )}

          {!isPlaying ? (
            <Button
              size="sm"
              onClick={handlePlayAudio}
              className="h-8 px-3 text-xs bg-[#C8A951] hover:bg-[#B3873B] text-black font-semibold rounded-xl gap-1.5 shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-black" />
              {isPaused ? "Continuar" : "Ouvir Resumo"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePauseAudio}
                className="h-8 px-2.5 text-xs bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-xl gap-1"
              >
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStopAudio}
                className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
                title="Parar"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowTranscript((prev) => !prev)}
            className="h-8 px-2 text-[11px] text-white/80 hover:text-white hover:bg-white/10 rounded-xl gap-1"
          >
            {showTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showTranscript ? "Ocultar" : "Texto"}
          </Button>
        </div>
      </div>

      {/* Transcrição em texto expansível */}
      {showTranscript && (
        <div className="pt-2 border-t border-white/15 text-xs text-white/90 leading-relaxed italic bg-black/20 p-2.5 rounded-xl animate-in fade-in">
          "{roteiroFalado}"
        </div>
      )}
    </div>
  );
};
