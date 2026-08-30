import React, { useRef, useState } from "react";
import { Mic, MicOff, Send, Paperclip, X, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface JessiInputBarProps {
  inputText: string;
  setInputText: (val: string) => void;
  onSend: () => void;
  isLoading: boolean;
  voiceStatus: "idle" | "listening" | "reviewing";
  onToggleVoice: () => void;
  onCancelVoice: () => void;
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
  selectedFile,
  onSelectFile,
  onRemoveFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          className="h-10 w-10 shrink-0 border-border/80 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={voiceStatus === "listening" ? "destructive" : "outline"}
          onClick={voiceStatus === "listening" ? onCancelVoice : onToggleVoice}
          disabled={isLoading}
          title={voiceStatus === "listening" ? "Parar gravação" : "Falar por voz"}
          className={`h-10 w-10 shrink-0 border-border/80 ${
            voiceStatus === "listening" ? "animate-pulse" : "text-muted-foreground hover:text-emerald-700"
          }`}
        >
          {voiceStatus === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <div className="flex-1 relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              voiceStatus === "listening"
                ? "Ouvindo sua instrução..."
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
