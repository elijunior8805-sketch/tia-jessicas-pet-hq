import React, { useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  HelpCircle,
  ShieldAlert,
  Calendar,
  DollarSign,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JessiMessage } from "@/lib/ia/jessi-contracts";
import { VoiceRecognitionStatus } from "@/lib/ia/ia-voz";
import { AgendaCard } from "./cards/AgendaCard";
import { ClienteCard } from "./cards/ClienteCard";
import { FinanceiroCard } from "./cards/FinanceiroCard";
import { ProgramaCard } from "./cards/ProgramaCard";
import { ComprovanteCard } from "./cards/ComprovanteCard";
import { ConfirmacaoCard } from "./cards/ConfirmacaoCard";
import { AlertaCard } from "./cards/AlertaCard";
import { LevaTrazCard } from "./cards/LevaTrazCard";
import { ComunicacaoCard } from "./cards/ComunicacaoCard";
import { ReativacaoCard } from "./cards/ReativacaoCard";
import { AnalyticsCard } from "./cards/AnalyticsCard";
import { SentinelaCard } from "./cards/SentinelaCard";
import { PetCard } from "./cards/PetCard";
import { PixMercadoPagoCard } from "./cards/PixMercadoPagoCard";

interface JessiBancadaModeProps {
  isOpen: boolean;
  onClose: () => void;
  voiceStatus: VoiceRecognitionStatus;
  isListening: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  finalTranscript: string;
  audioLevel?: number;
  isInterrupted?: boolean;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onToggleListening: () => void;
  onSendMessage: (texto: string) => void;
  onConfirmAction?: (pendingAction?: any) => void;
  onCancelAction?: () => void;
  messages: JessiMessage[];
  isLoading: boolean;
}

export const JessiBancadaMode: React.FC<JessiBancadaModeProps> = ({
  isOpen,
  onClose,
  voiceStatus,
  isListening,
  isSpeaking,
  interimTranscript,
  finalTranscript,
  audioLevel = 0,
  isInterrupted = false,
  ttsEnabled,
  onToggleTts,
  onToggleListening,
  onSendMessage,
  onConfirmAction,
  onCancelAction,
  messages,
  isLoading,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pega a última mensagem do assistente e a última do usuário
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const pendingAction = lastAssistantMsg?.pendingAction;

  useEffect(() => {
    if (isOpen) {
      // Desbloqueia contexto de áudio do navegador
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }
      if (!isListening) {
        onToggleListening();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1E13]/98 text-white flex flex-col justify-between p-4 sm:p-6 md:p-8 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      {/* 1. Barra Superior com Status e Controles Mãos-Livres */}
      <div className="flex items-center justify-between border-b border-emerald-800/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-emerald-800 text-[#C8A951] flex items-center justify-center shadow-lg border border-[#C8A951]/40">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight font-display text-[#F5E6BE]">
                Jessi · Modo Bancada Mãos-Livres
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px] font-semibold animate-pulse">
                {isListening ? "Microfone Ativo (Mãos-Livres)" : "Áudio Pausado"}
              </Badge>
            </div>
            <p className="text-xs text-white/70">
              Operação 100% por voz para banho, tosa e atendimento sem tocar na tela
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onToggleTts}
            className="h-10 px-3.5 border-emerald-700/60 bg-emerald-900/40 text-white hover:bg-emerald-800 text-xs font-semibold gap-2 rounded-xl cursor-pointer"
          >
            {ttsEnabled ? <Volume2 className="h-4 w-4 text-[#C8A951]" /> : <VolumeX className="h-4 w-4 text-white/50" />}
            <span className="hidden sm:inline">{ttsEnabled ? "Voz Ativa" : "Voz Muda"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
            className="h-10 px-3 border-emerald-700/60 bg-emerald-900/40 text-white hover:bg-emerald-800 text-xs font-semibold rounded-xl cursor-pointer hidden md:flex items-center justify-center"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="h-10 px-4 bg-red-800/80 hover:bg-red-700 text-white font-semibold text-xs rounded-xl gap-1.5 shadow-md cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>Sair do Modo Bancada</span>
          </Button>
        </div>
      </div>

      {/* 2. Área Central: Visualizador em Destaque Gigante */}
      <div className="flex-1 flex flex-col justify-center items-center py-6 sm:py-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Indicador de Estado de Escuta / Fala com Ondas */}
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative flex items-center justify-center">
            {/* Ondas Sonoras Animadas */}
            {isListening && (
              <>
                <div className="absolute h-28 w-28 sm:h-36 sm:w-36 rounded-full bg-emerald-500/20 animate-ping duration-1000 pointer-events-none" />
                <div className="absolute h-36 w-36 sm:h-48 sm:w-48 rounded-full bg-emerald-500/10 animate-pulse duration-1500 pointer-events-none" />
              </>
            )}

            {isSpeaking && (
              <div className="absolute h-28 w-28 sm:h-36 sm:w-36 rounded-full bg-[#C8A951]/20 animate-pulse duration-700 pointer-events-none" />
            )}

            <button
              type="button"
              onClick={onToggleListening}
              className={`h-20 w-20 sm:h-24 sm:w-24 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer z-10 border-2 ${
                isSpeaking
                  ? "bg-[#C8A951] text-[#123F2A] border-[#F5E6BE] shadow-[#C8A951]/40 shadow-xl"
                  : isListening
                  ? "bg-emerald-600 text-white border-emerald-300 shadow-emerald-500/40 shadow-xl"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {isSpeaking ? (
                <Volume2 className="h-10 w-10 sm:h-12 sm:w-12 animate-pulse" />
              ) : isListening ? (
                <Mic className="h-10 w-10 sm:h-12 sm:w-12 animate-bounce" />
              ) : (
                <MicOff className="h-10 w-10 sm:h-12 sm:w-12" />
              )}
            </button>
          </div>

          <div className="space-y-1">
            {isInterrupted && (
              <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-bold animate-bounce shadow-md">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Interrupção detectada · Ouvindo sua nova fala...
              </div>
            )}
            <span className="text-sm sm:text-base font-bold tracking-wide uppercase text-[#F5E6BE] block">
              {isLoading
                ? "Jessi consultando sistema..."
                : isInterrupted
                ? "Interrompida · Ouvindo você..."
                : isSpeaking
                ? "Jessi Falando (Fale para interromper)..."
                : isListening
                ? (interimTranscript ? "Ouvindo você..." : "Microfone Aberto · Pode Falar")
                : "Microfone Pausado"}
            </span>
            <p className="text-xs sm:text-sm text-emerald-200/80">
              {pendingAction
                ? "⚠️ Ação preparada! Diga \"Pode confirmar\" ou \"Cancelar\""
                : isListening
                ? "Fale naturalmente enquanto atende o pet — interrompa quando quiser"
                : "Toque no microfone para reativar a escuta contínua"}
            </p>

            {/* Barras de Equalizador de Volume em Tempo Real */}
            {isListening && (
              <div className="flex items-center justify-center gap-1.5 pt-2 h-5">
                {[...Array(11)].map((_, i) => {
                  const baseLevel = audioLevel > 5 ? audioLevel : 20;
                  const dynamicHeight = Math.max(
                    4,
                    Math.min(22, Math.round((baseLevel / 100) * (14 + (i % 4) * 3) + Math.random() * 3))
                  );
                  return (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-[#C8A951] transition-all duration-75"
                      style={{
                        height: `${dynamicHeight}px`,
                        opacity: audioLevel > 5 ? 0.95 : 0.4,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Transcrição em Tempo Real (Gigante) */}
        {(interimTranscript || finalTranscript) && (
          <div className="w-full rounded-2xl bg-black/40 border border-emerald-500/30 p-4 sm:p-5 text-center shadow-inner">
            <span className="text-xs text-emerald-400 font-semibold block mb-1">Transcrição ao vivo:</span>
            <p className="text-base sm:text-xl font-medium text-white leading-relaxed">
              &ldquo;{interimTranscript || finalTranscript}&rdquo;
            </p>
          </div>
        )}

        {/* Card de Resposta da Jessi (Legível a 3 metros) */}
        {lastAssistantMsg && !interimTranscript && (
          <div className="w-full rounded-2xl bg-emerald-950/70 border border-[#C8A951]/40 p-4 sm:p-6 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-emerald-800/40 pb-2">
              <span className="text-xs font-bold text-[#F5E6BE] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
                Última Resposta da Jessi:
              </span>
              <span className="text-[10px] text-white/60">
                {new Date(lastAssistantMsg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <p className="text-sm sm:text-base md:text-lg text-white font-normal leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto pr-1">
              {lastAssistantMsg.content}
            </p>

            {/* Cards Visuais Ricos no Modo Bancada (QR Code Pix, Agenda, Ficha, etc.) */}
            {lastAssistantMsg.cards && lastAssistantMsg.cards.length > 0 && (
              <div className="pt-2 space-y-2.5 max-h-72 sm:max-h-80 overflow-y-auto pr-1 text-slate-900">
                {lastAssistantMsg.cards.map((card, cIdx) => {
                  switch (card.type) {
                    case "agenda":
                      return <AgendaCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "cliente":
                      return <ClienteCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "financeiro":
                      return <FinanceiroCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "programa":
                      return <ProgramaCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "comprovante":
                      return <ComprovanteCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "comunicacao":
                      return <ComunicacaoCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "reativacao":
                    case "proativo":
                      return <ReativacaoCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "confirmacao":
                      return (
                        <ConfirmacaoCard
                          key={cIdx}
                          data={card.data}
                          onConfirmar={onConfirmAction}
                          onCancelar={onCancelAction}
                          onActionClick={onSendMessage}
                          isLoading={isLoading}
                        />
                      );
                    case "alerta":
                      return <AlertaCard key={cIdx} data={card.data} onAcao={onSendMessage} />;
                    case "leva_traz":
                      return <LevaTrazCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "analytics":
                      return <AnalyticsCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "sentinela":
                      return <SentinelaCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "pet":
                      return <PetCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    case "pix_mercadopago":
                    case "mercadopago":
                    case "pix":
                      return <PixMercadoPagoCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                    default:
                      return null;
                  }
                })}
              </div>
            )}

            {/* Banner de Confirmação por Voz caso haja ação pendente */}
            {pendingAction && (
              <div className="pt-3 border-t border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-amber-200">
                    Confirmação por Voz: Fale &ldquo;Pode confirmar&rdquo; ou toque ao lado:
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    onClick={() => onConfirmAction?.(pendingAction)}
                    className="flex-1 sm:flex-none h-8 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                  >
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancelAction}
                    className="flex-1 sm:flex-none h-8 px-3 border-white/20 text-white hover:bg-white/10 text-xs rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Rodapé com Sugestões de Comandos Rápidos Falados */}
      <div className="border-t border-emerald-800/40 pt-3 sm:pt-4">
        <span className="text-xs font-semibold text-[#F5E6BE] block mb-2 font-display">
          Exemplos de Comandos que Você Pode Falar na Bancada:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSendMessage("Qual o próximo atendimento da agenda?")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all text-white/90 text-[11px] sm:text-xs truncate cursor-pointer"
          >
            🗣️ &ldquo;Qual o próximo pet?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => onSendMessage("Quem está atrasado hoje?")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all text-white/90 text-[11px] sm:text-xs truncate cursor-pointer"
          >
            🗣️ &ldquo;Quem está atrasado?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => onSendMessage("Quais os horários livres para hoje?")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all text-white/90 text-[11px] sm:text-xs truncate cursor-pointer"
          >
            🗣️ &ldquo;Tem horário livre hoje?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => onSendMessage("Fechamento de caixa de hoje")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all text-white/90 text-[11px] sm:text-xs truncate cursor-pointer"
          >
            🗣️ &ldquo;Fechamento de caixa&rdquo;
          </button>
          <button
            type="button"
            onClick={() => onSendMessage("Consultar pagamentos pendentes dos clientes")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all text-white/90 text-[11px] sm:text-xs truncate cursor-pointer"
          >
            🗣️ &ldquo;Pagamentos pendentes&rdquo;
          </button>
          <button
            type="button"
            onClick={() => onSendMessage("Verificar sentinelas operacionais")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all text-white/90 text-[11px] sm:text-xs truncate cursor-pointer"
          >
            🗣️ &ldquo;Sentinelas & Alertas&rdquo;
          </button>
        </div>
      </div>
    </div>
  );
};
