import React, { useRef } from "react";
import { Mic, MicOff, Paperclip, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecognitionStatus } from "@/lib/ia/ia-voz";
import { cn } from "@/lib/utils";

interface JessiInputBarProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  voiceStatus: VoiceRecognitionStatus;
  isContinuousMode: boolean;
  onToggleContinuousVoice: () => void;
  onCancelVoice: () => void;
  interimTranscript?: string;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  selectedFile?: File | null;
  onSelectFile?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile?: () => void;
}

export const JessiInputBar: React.FC<JessiInputBarProps> = ({
  inputText,
  setInputText,
  onSend,
  isLoading = false,
  voiceStatus,
  isContinuousMode,
  onToggleContinuousVoice,
  onCancelVoice,
  interimTranscript = "",
  ttsEnabled,
  onToggleTts,
  selectedFile,
  onSelectFile,
  onRemoveFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isListening = voiceStatus === "listening" || voiceStatus === "requesting_permission";
  const canSend = Boolean(inputText.trim() || selectedFile) && !isLoading;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && canSend) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/70 bg-background/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm md:px-4">
      {(isListening || interimTranscript) && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            {interimTranscript || "Ouvindo… fale seu comando naturalmente"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancelVoice}
            aria-label="Cancelar gravação"
            title="Cancelar gravação"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {selectedFile && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="min-w-0 truncate text-foreground">{selectedFile.name}</span>
          {onRemoveFile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemoveFile}
              aria-label="Remover arquivo"
              className="h-7 w-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <div className="flex items-end gap-1.5 rounded-2xl border border-input bg-background p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
        {onSelectFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={onSelectFile}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Anexar arquivo"
              title="Anexar arquivo"
              className="h-9 w-9 shrink-0 text-muted-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        )}

        <Textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Estou ouvindo…" : "Pergunte para a Jessi ou digite um comando…"}
          disabled={isLoading}
          rows={1}
          className="max-h-32 min-h-9 flex-1 resize-none border-0 px-2 py-2 text-sm shadow-none focus-visible:ring-0"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleTts}
          aria-label={ttsEnabled ? "Desativar respostas por voz" : "Ativar respostas por voz"}
          title={ttsEnabled ? "Desativar respostas por voz" : "Ativar respostas por voz"}
          className="hidden h-9 w-9 shrink-0 text-muted-foreground sm:inline-flex"
        >
          {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleContinuousVoice}
          disabled={isLoading}
          aria-label={isContinuousMode || isListening ? "Parar comando por voz" : "Ativar comando por voz"}
          title={isContinuousMode || isListening ? "Parar comando por voz" : "Ativar comando por voz"}
          className={cn(
            "h-9 w-9 shrink-0",
            isContinuousMode || isListening
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground"
              : "text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          {isContinuousMode || isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          size="icon"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Enviar mensagem"
          title="Enviar mensagem"
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};