import React, { useRef } from "react";
import {
  Mic,
  MicOff,
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Volume2,
  VolumeX,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecognitionStatus } from "@/lib/ia/ia-voz";

interface JessiInputBarProps {
  inputText: string;
  setInputText: (val: string) => void;
  onSend: () => void;
  isLoading: boolean;
  voiceStatus: VoiceRecognitionStatus;
  isContinuousMode: boolean;
  onToggleContinuousVoice: () => void;
  onCancelVoice: () => void;
  interimTranscript?: string;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  selectedFile: File | null;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
}

export const JessiInputBar: React.FC<JessiInputBarProps> = ({
  inputText,
  setInputText,
  onSend,
  isLoading,
  voiceStatus,
  isContinuousMode,
  onToggleContinuousVoice,
  onCancelVoice,
  interimTranscript,
  ttsEnabled,
  onToggleTts,
  selectedFile,
  onSelectFile,
  onRemoveFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isListening = voiceStatus === "listening" || voiceStatus === "transcribing" || voiceStatus === "requesting_permission";
  const isSending = voiceStatus === "sending";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((inputText.trim() || selectedFile) && !isLoading) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-border/70 bg-background/95 backdrop-blur-xs p-3 md:p-4 space-y-2">
      {/* Faixa permanente e dinâmica de Modo de Voz Contínua */}
      {isContinuousMode && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50/90 text-emerald-950 border border-emerald-300 shadow-xs text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 truncate">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isListening ? "bg-red-600" : "bg-emerald-600"}`} />
            </span>
            <span className="font-semibold text-emerald-900 shrink-0 flex items-center gap-1">
              <Radio className="h-3.5 w-3.5 text-emerald-700 animate-pulse" />
              Modo Voz Contínuo:
            </span>
            <span className="italic text-emerald-800 truncate">
              {isSending
                ? "Enviando comando..."
                : interimTranscript
                ? `"${interimTranscript}"`
                : isLoading
                ? "Aguardando resposta da Jessi..."
                : "Ouvindo... Pode falar qualquer comando"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onToggleTts}
              title={ttsEnabled ? "Resposta por áudio ativada" : "Resposta por áudio desativada"}
              className="h-7 px-2 text-[11px] text-emerald-800 hover:bg-emerald-100 rounded-lg gap-1"
            >
              {ttsEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-700" /> : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="hidden sm:inline">{ttsEnabled ? "Voz Ativa" : "Mudo"}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onToggleContinuousVoice}
              className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-lg"
            >
              Desativar Voz
            </Button>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-medium">
          {selectedFile.type.startsWith("image/") ? (
            <ImageIcon className="h-4 w-4 text-emerald-700" />
          ) : (
            <FileText className="h-4 w-4 text-emerald-700" />
          )}
          <span className="truncate max-w-[200px]">{selectedFile.name}</span>
          <button
            type="button"
            onClick={onRemoveFile}
            className="p-0.5 hover:bg-emerald-200/50 rounded-full text-emerald-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={onSelectFile}
        />

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Anexar comprovante ou imagem"
          className="h-10 w-10 shrink-0 border-border/80 text-muted-foreground hover:text-foreground rounded-xl"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={isContinuousMode ? "destructive" : "outline"}
          onClick={onToggleContinuousVoice}
          disabled={isLoading}
          title={isContinuousMode ? "Desativar modo de conversa contínua" : "Ativar Modo de Conversa por Voz Contínua"}
          className={`h-10 w-10 shrink-0 border-border/80 rounded-xl transition-all ${
            isContinuousMode
              ? "bg-red-600 hover:bg-red-700 text-white shadow-sm ring-2 ring-red-400 ring-offset-1"
              : "text-muted-foreground hover:text-emerald-700 hover:border-emerald-600/40"
          }`}
        >
          {isContinuousMode ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <div className="flex-1 relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isContinuousMode
                ? "🎙️ Modo Voz Contínuo Ativo: fale ou digite a qualquer momento..."
                : "Fale com a Jessi: consultar agenda, buscar cliente, verificar saldos, comprovantes..."
            }
            rows={1}
            disabled={isLoading}
            className="min-h-[42px] max-h-36 resize-none py-2.5 px-3.5 text-xs md:text-sm leading-relaxed bg-background border-border/80 focus-visible:ring-emerald-700 rounded-xl"
          />
        </div>

        <Button
          type="button"
          size="icon"
          disabled={(!inputText.trim() && !selectedFile) || isLoading}
          onClick={onSend}
          className="h-10 w-10 shrink-0 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-xs"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
