import React from "react";
import { Sparkles, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IAStatus } from "../types";

interface IaHeaderProps {
  iaStatus: IAStatus;
  onClose: () => void;
}

const statusMessages: Record<IAStatus, string> = {
  idle: "Spa Tia Jéssica • Online",
  requesting_permission: "Solicitando microfone...",
  listening: "Ouvindo...",
  reviewing_transcription: "Revisando voz...",
  ready_to_send: "Pronto para enviar",
  sending: "Enviando...",
  processing: "Validando dados...",
  interpretando: "Pensando...",
  pesquisando: "Consultando base de dados...",
  aguardando_informacao: "Aguardando detalhes...",
  aguardando_confirmacao: "Aguardando sua confirmação...",
  executando: "Executando operação real...",
  verificando: "Verificando resultado...",
  concluido: "Operação concluída",
  cancelado: "Cancelado",
  error: "Ocorreu um erro",
};

export const IaHeader: React.FC<IaHeaderProps> = ({ iaStatus, onClose }) => (
  <div className="px-6 py-5 border-b border-[#C99845]/10 flex items-center justify-between bg-[#123F2A] text-white">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#C99845]/20 flex items-center justify-center border border-[#C99845]/30 shadow-inner">
        <Sparkles className="w-5 h-5 text-[#C99845] animate-pulse" />
      </div>
      <div>
        <h2 className="font-display font-semibold text-lg tracking-tight leading-none">
          Assistente IA
        </h2>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={`flex h-1.5 w-1.5 rounded-full animate-pulse ${iaStatus === "error" ? "bg-red-500" : "bg-[#C99845]"}`}
          />
          <p className="text-[9px] uppercase tracking-widest font-bold text-white/60">
            {statusMessages[iaStatus]}
          </p>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="text-white/70 hover:text-white hover:bg-white/10 hidden md:flex"
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="text-white/70 hover:text-white hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  </div>
);
