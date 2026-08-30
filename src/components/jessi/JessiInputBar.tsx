import React, { useRef } from "react";
import { Mic, MicOff, Send, Paperclip, X, Image as ImageIcon, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface JessiInputBarProps {
  inputText: string;
  setInputText: (val: string) => void;
  onSend: () => void;
  isLoading: boolean;
  voiceStatus: "idle" | "listening" | "reviewing" | "requesting_permission" | "finalizing" | "error" | "processing";
  onToggleVoice: () => void;
  onCancelVoice: () => void;
  interimTranscript?: string;
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
  onToggleVoice,
  onCancelVoice,
  interimTranscript,
  selectedFile,
  onSelectFile,
  onRemoveFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isListening = voiceStatus === "listening" || voiceStatus === "requesting_permission";

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
      {/* Visual de gravação de voz em tempo real */}
      {isListening && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-red-50 text-red-950 border border-red-200 text-xs animate-pulse">
          <div className="flex items-center gap-2 truncate">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-ping shrink-0" />
            <span className="font-semibold text-red-900 shrink-0">Ouvindo sua voz:</span>
            <span className="italic text-red-800 truncate">
              {interimTranscript || inputText || "Fale seu comando..."}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={onToggleVoice}
              className="h-7 px-2.5 text-[11px] font-semibold gap-1 rounded-lg"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Concluir Fala
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelVoice}
              className="h-7 px-2 text-[11px] border-red-200 text-red-800 hover:bg-red-100 rounded-lg"
            >
              Cancelar
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
          variant={isListening ? "destructive" : "outline"}
          onClick={onToggleVoice}
          disabled={isLoading}
          title={isListening ? "Parar gravação de voz" : "Falar comando por voz"}
          className={`h-10 w-10 shrink-0 border-border/80 rounded-xl transition-all ${
            isListening
              ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
              : "text-muted-foreground hover:text-emerald-700 hover:border-emerald-600/40"
          }`}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <div className="flex-1 relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "Ouvindo sua voz..."
                : "Fale com a Jessi: consultar agenda, buscar cliente, verificar saldos, comprovantes..."
            }
            rows={1}
            disabled={isLoading}
            className="min-h-[40px] max-h-32 resize-none py-2 px-3 text-xs md:text-sm bg-background border-border/80 focus-visible:ring-emerald-700 rounded-xl"
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
