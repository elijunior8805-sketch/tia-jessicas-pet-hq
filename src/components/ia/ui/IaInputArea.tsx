import React, { useRef } from "react";
import { Send, Mic, MicOff, Paperclip, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecognitionStatus } from "@/lib/ia/ia-voz";

interface IaInputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  voiceStatus: VoiceRecognitionStatus;
  isProcessing: boolean;
  handleSend: (text: string) => void;
  toggleVoice: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  filePreview: string | null;
  setFilePreview: (preview: string | null) => void;
  setSelectedFile: (file: File | null) => void;
  handleAnalizarComprovante: () => void;
}

export const IaInputArea: React.FC<IaInputAreaProps> = ({
  inputText,
  setInputText,
  voiceStatus,
  isProcessing,
  handleSend,
  toggleVoice,
  handleFileSelect,
  filePreview,
  setFilePreview,
  setSelectedFile,
  handleAnalizarComprovante,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  return (
    <div className="p-6 bg-white border-t border-[#C99845]/10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {filePreview && (
        <div className="mb-4 relative inline-block group">
          <div className="w-24 h-24 rounded-2xl border-2 border-[#C99845]/20 overflow-hidden bg-[#F5F2EA] flex items-center justify-center shadow-lg">
            {filePreview === "pdf" ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-red-600">PDF</span>
                </div>
              </div>
            ) : (
              <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
            )}
          </div>
          <button
            onClick={() => {
              setFilePreview(null);
              setSelectedFile(null);
            }}
            className="absolute -top-2 -right-2 w-7 h-7 bg-white rounded-full border border-[#C99845]/20 shadow-md flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
          
          <Button
            size="sm"
            className="mt-2 w-full bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider"
            onClick={handleAnalizarComprovante}
            disabled={isProcessing}
          >
            Analisar Agora
          </Button>
        </div>
      )}

      <div className="relative flex items-end gap-3 bg-[#F5F2EA]/50 rounded-2xl p-2 border border-[#C99845]/10 focus-within:border-[#C99845]/30 focus-within:bg-white transition-all">
        <div className="flex flex-col gap-1 pb-1 px-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,application/pdf"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-xl text-[#123F2A]/40 hover:text-[#C99845] hover:bg-[#C99845]/10"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
        </div>

        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Como posso ajudar na gestão hoje?"
          className="flex-1 min-h-[44px] max-h-[120px] bg-transparent border-none focus-visible:ring-0 resize-none py-3 px-0 text-[14px] text-[#123F2A] placeholder:text-[#123F2A]/30"
          disabled={isProcessing}
        />

        <div className="flex gap-1.5 pb-1 pr-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            className={cn(
              "h-10 w-10 rounded-xl transition-all duration-300",
              voiceStatus === "listening"
                ? "bg-red-500 text-white animate-pulse"
                : "text-[#123F2A]/40 hover:text-[#C99845] hover:bg-[#C99845]/10"
            )}
          >
            {voiceStatus === "listening" ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          
          <Button
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim() || isProcessing}
            className={cn(
              "h-10 w-10 rounded-xl shadow-md transition-all",
              inputText.trim()
                ? "bg-[#C99845] text-white hover:bg-[#C99845]/90"
                : "bg-[#123F2A]/5 text-[#123F2A]/20"
            )}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(" ");
