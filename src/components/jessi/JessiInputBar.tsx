import React, { useRef, useState, useCallback, useEffect } from "react";
import { Send, Mic, Square, Sparkles } from "lucide-react";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";

interface JessiInputBarProps {
  onSend: (text: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Waveform simulado — 5 barras que pulsam em velocidades ligeiramente diferentes.
 * Mantém o feedback visual de "falando" sem depender de análise de áudio real.
 */
const SpeakingWaveform: React.FC = () => (
  <div className="flex items-center gap-0.5 px-1 select-none" aria-label="Falando">
    {[0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="w-0.5 rounded-full bg-[#C8A951] animate-pulse"
        style={{
          height: `${8 + i % 3 * 4}px`,
          animationDuration: `${0.4 + (i % 3) * 0.15}s`,
          animationDelay: `${i * 0.08}s`,
          opacity: 0.7 + (i % 2) * 0.3,
        }}
      />
    ))}
  </div>
);

export const JessiInputBar: React.FC<JessiInputBarProps> = ({
  onSend,
  isProcessing = false,
  disabled = false,
  placeholder = "Pergunte para a Jessi ou digite um comando…",
}) => {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    isSpeaking,
    isRecording,
    isSupported: voiceSupported,
    speak,
    cancelVoice,
    startRecording,
    stopRecording,
    transcript,
  } = useJessiVoice();

  // Injeta transcript do gravador na textarea em tempo real
  useEffect(() => {
    if (transcript && isRecording) {
      setText((prev) => {
        // Substitui apenas o conteúdo que o usuário não editou manualmente
        return transcript;
      });
    }
  }, [transcript, isRecording]);

  // Auto-resize da textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing || disabled) return;

    // Aborta voz residual antes de enviar — a nova resposta tratara sua propria fala
    if (isSpeaking) {
      cancelVoice();
    }

    onSend(trimmed);
    setText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [text, isProcessing, disabled, isSpeaking, cancelVoice, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const canSend = !disabled && !isProcessing && text.trim().length > 0;
  const isActive = isProcessing || isSpeaking || isRecording;

  return (
    <div className="flex flex-col gap-2 px-4 pb-4 pt-2 border-t bg-background/80 backdrop-blur-sm">
      {/* Barra de status quando gravando */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs text-red-700 font-medium flex-1">
            Gravando… diga seu comando ou toque no microfone novamente para parar
          </span>
          <Square
            className="h-3.5 w-3.5 text-red-500 cursor-pointer hover:text-red-700"
            onClick={stopRecording}
            aria-label="Parar gravação"
          />
        </div>
      )}

      {/* Barra de status quando a Jessi está falando */}
      {isSpeaking && !isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
          <SpeakingWaveform />
          <span className="text-xs text-amber-800 font-medium flex-1">Jessi está respondendo…</span>
          <button
            type="button"
            onClick={cancelVoice}
            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors"
            aria-label="Interromper fala"
          >
            <Square className="h-3 w-3" />
            Parar
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Microfone */}
        {voiceSupported && !isProcessing && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={disabled || isProcessing}
            className={`shrink-0 mb-1 h-9 w-9 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white shadow-md"
                : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300"
            } ${disabled || isProcessing ? "opacity-40 cursor-not-allowed" : ""}`}
            aria-label={isRecording ? "Parar gravação" : "Gravar comando de voz"}
          >
            <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
          </button>
        )}

        {/* Campo de texto */}
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isSpeaking
                ? "Aguarde a Jessi terminar de falar…"
                : isProcessing
                ? "Consultando dados e verificando regras…"
                : placeholder
            }
            disabled={disabled || isProcessing}
            rows={1}
            className={`w-full resize-none rounded-2xl border bg-background px-4 py-2.5 pr-12 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors ${
              isSpeaking
                ? "border-amber-300 ring-1 ring-amber-200 focus-visible:ring-amber-400/50"
                : isRecording
                ? "border-red-300 ring-1 ring-red-200"
                : "border-border focus-visible:border-emerald-400"
            }`}
            style={{ minHeight: "44px", maxHeight: "160px" }}
          />

          {/* Botão de envio */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={`absolute right-2 bottom-1.5 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
              canSend
                ? "bg-emerald-800 hover:bg-emerald-900 text-[#C8A951] shadow-sm"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            aria-label="Enviar mensagem"
          >
            {isActive ? (
              <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Dica contextual sutil */}
      {(isSpeaking || isRecording) && (
        <p className="text-[11px] text-muted-foreground/70 text-center">
          {isRecording
            ? "Toque no microfone ou pressione Enter para enviar"
            : "Toque em 'Parar' para interromper a resposta de voz"}
        </p>
      )}
    </div>
  );
};
