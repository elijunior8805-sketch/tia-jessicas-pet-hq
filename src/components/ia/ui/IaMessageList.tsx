import React from "react";
import { motion } from "framer-motion";
import { User, Dog, ExternalLink, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { IAMessage } from "@/lib/ia/ia-agente.server";
import { IAResults } from "../types";

interface IaMessageListProps {
  messages: IAMessage[];
  searchResults: IAResults | null;
  handleSend: (text: string) => void;
  handleConfirmarAgendamento: (intent: any) => void;
  isProcessing: boolean;
}

export const IaMessageList: React.FC<IaMessageListProps> = ({
  messages,
  searchResults,
  handleSend,
  handleConfirmarAgendamento,
  isProcessing,
}) => {
  return (
    <div className="space-y-6 max-w-full mx-auto">
      {messages.map((msg, i) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={i}
          className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "group relative max-w-[85%] rounded-2xl px-5 py-4 shadow-sm",
              msg.role === "user"
                ? "bg-[#C99845] text-white rounded-tr-none"
                : "bg-white text-[#123F2A] border border-[#C99845]/10 rounded-tl-none shadow-black/5",
            )}
          >
            <div
              className={cn(
                "text-[14px] leading-relaxed prose prose-sm max-w-none",
                msg.role === "user" ? "prose-invert text-white" : "text-[#123F2A]",
              )}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>

            {/* Search Results */}
            {msg.role === "assistant" && i === messages.length - 1 && searchResults && (
              <div className="mt-4 grid grid-cols-1 gap-2 border-t border-[#C99845]/10 pt-4">
                {searchResults.clientes.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => handleSend(`Selecionado: Cliente ${c.nome}`)}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#C99845]/10 bg-[#F5F2EA]/50 hover:bg-[#F5F2EA] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-[#C99845]" />
                      <span className="text-sm font-bold">{c.nome}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-[#C99845]/30 text-[#C99845]">
                      CLIENTE
                    </Badge>
                  </button>
                ))}
                {searchResults.pets.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleSend(`Selecionado: Pet ${p.nome}`)}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#C99845]/10 bg-[#F5F2EA]/50 hover:bg-[#F5F2EA] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Dog className="w-4 h-4 text-[#C99845]" />
                      <span className="text-sm font-bold">{p.nome}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-[#C99845]/30 text-[#C99845]">
                      PET
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            {msg.intent && i === messages.length - 1 && (
              <div className="mt-4 pt-4 border-t border-current/10 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 text-[11px] font-bold rounded-lg px-3",
                    msg.role === "user" ? "text-white hover:bg-white/10" : "text-[#C99845] hover:bg-[#C99845]/5",
                  )}
                  onClick={() => window.open("/dashboard", "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Abrir Sistema
                </Button>

                {msg.intent.intencao === "criar_agendamento" && (
                  <Button
                    size="sm"
                    className="h-8 text-[11px] font-bold bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-lg px-3 shadow-md"
                    onClick={() => handleConfirmarAgendamento(msg.intent)}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Confirmar Agendamento
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {isProcessing && (
        <div className="flex justify-start">
          <div className="bg-white border border-[#C99845]/10 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-3 shadow-sm">
            <div className="flex gap-1">
              {[0, 0.2, 0.4].map((delay) => (
                <motion.span
                  key={delay}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay }}
                  className="w-1.5 h-1.5 rounded-full bg-[#C99845]"
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-[#123F2A]/60 uppercase tracking-widest">
              Processando...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
