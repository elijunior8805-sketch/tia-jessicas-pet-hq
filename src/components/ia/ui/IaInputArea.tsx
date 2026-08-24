import React, { useRef } from "react";
import { Send, Mic, MicOff, Paperclip, X, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecognitionStatus } from "@/lib/ia/ia-voz";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface IaInputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  voiceStatus: VoiceRecognitionStatus;
  isProcessing: boolean;
  handleSend: (text: string) => void;
  toggleVoice: () => void;
  cancelVoice: () => void;
  filePreview: string | null;
  setFilePreview: (preview: string | null) => void;
  setSelectedFile: (file: File | null) => void;
  handleAnalizarComprovante: () => void;
  interimTranscript: string;
  finalTranscript: string;
  isReviewingVoice: boolean;
  setFinalTranscript: (text: string) => void;
}

export const IaInputArea: React.FC<IaInputAreaProps> = ({
  inputText,
  setInputText,
  voiceStatus,
  isProcessing,
  handleSend,
  toggleVoice,
  cancelVoice,
  filePreview,
  setFilePreview,
  setSelectedFile,
  handleAnalizarComprovante,
  interimTranscript,
  finalTranscript,
  isReviewingVoice,
  setFinalTranscript,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white border-t border-[#C99845]/10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {/* Interim/Live Feedback */}
        {voiceStatus === "listening" && interimTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-[#F5F2EA] rounded-xl border border-[#C99845]/20 text-[#123F2A]/70 text-sm italic italic-serif"
          >
            {interimTranscript}...
          </motion.div>
        )}

        {/* Voice Review Area */}
        {isReviewingVoice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 bg-white rounded-2xl border-2 border-[#C99845]/30 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[#C99845] uppercase tracking-widest">Revisar Transcrição</span>
              <Badge variant="outline" className="text-[9px] bg-[#C99845]/5 border-[#C99845]/20 text-[#C99845]">VOZ</Badge>
            </div>
            
            <Textarea
              value={finalTranscript}
              onChange={(e) => setFinalTranscript(e.target.value)}
              className="min-h-[80px] bg-[#F5F2EA]/30 border-none focus-visible:ring-0 text-[#123F2A] text-sm mb-4 leading-relaxed"
              placeholder="Aguardando áudio..."
            />

            <div className="flex gap-2">
              <Button
                onClick={() => handleSend(finalTranscript)}
                className="flex-1 bg-[#C99845] hover:bg-[#C99845]/90 text-white rounded-xl h-10 font-bold text-xs"
                disabled={!finalTranscript.trim() || isProcessing}
              >
                <Check className="w-4 h-4 mr-2" /> Confirmar
              </Button>
              <Button
                variant="outline"
                onClick={toggleVoice}
                className="w-10 h-10 p-0 border-[#C99845]/20 text-[#C99845] rounded-xl hover:bg-[#C99845]/5"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={cancelVoice}
                className="w-10 h-10 p-0 border-red-100 text-red-500 rounded-xl hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className={cn(
        "relative flex items-end gap-3 bg-[#F5F2EA]/50 rounded-2xl p-2 border border-[#C99845]/10 focus-within:border-[#C99845]/30 focus-within:bg-white transition-all",
        isReviewingVoice && "opacity-50 pointer-events-none"
      )}>
        <div className="flex flex-col gap-1 pb-1 px-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (prev) => setFilePreview(prev.target?.result as string);
                if (file.type.startsWith("image/")) {
                  reader.readAsDataURL(file);
                } else {
                  setFilePreview("pdf");
                }
                setSelectedFile(file);
              }
            }}
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
          disabled={isProcessing || isReviewingVoice}
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
            disabled={!inputText.trim() || isProcessing || isReviewingVoice}
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

const Badge = ({ children, variant, className }: any) => (
  <span className={cn(
    "px-2 py-0.5 rounded text-[10px] font-bold border",
    variant === "outline" ? "bg-transparent" : "bg-current opacity-10",
    className
  )}>
    {children}
  </span>
);