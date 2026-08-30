import React, { useRef, useEffect } from "react";
import { JessiMessage } from "@/lib/ia/jessi-contracts";
import { AgendaCard } from "./cards/AgendaCard";
import { ClienteCard } from "./cards/ClienteCard";
import { FinanceiroCard } from "./cards/FinanceiroCard";
import { ProgramaCard } from "./cards/ProgramaCard";
import { ComprovanteCard } from "./cards/ComprovanteCard";
import { ConfirmacaoCard } from "./cards/ConfirmacaoCard";
import { AlertaCard } from "./cards/AlertaCard";
import { Sparkles, User, ArrowRight } from "lucide-react";

interface JessiChatProps {
  messages: JessiMessage[];
  onConfirmAction?: (pendingAction: any) => void;
  onCancelAction?: () => void;
  onSendMessage?: (text: string) => void;
  isLoading?: boolean;
}

export const JessiChat: React.FC<JessiChatProps> = ({
  messages,
  onConfirmAction,
  onCancelAction,
  onSendMessage,
  isLoading,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      {messages.map((msg) => {
        const isAssistant = msg.role === "assistant";

        return (
          <div
            key={msg.id}
            className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
          >
            {isAssistant && (
              <div className="h-8 w-8 rounded-full bg-emerald-800 text-[#F5E6BE] flex items-center justify-center shrink-0 shadow-2xs border border-[#C8A951]/40">
                <Sparkles className="h-4 w-4 text-[#C8A951]" />
              </div>
            )}

            <div
              className={`max-w-[88%] md:max-w-[78%] space-y-3 rounded-2xl p-3.5 md:p-4 text-xs md:text-sm ${
                isAssistant
                  ? "bg-card border border-border/80 text-foreground shadow-xs"
                  : "bg-emerald-800 text-white shadow-xs rounded-br-xs"
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {msg.cards && msg.cards.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  {msg.cards.map((card, cIdx) => {
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
                        return <ComprovanteCard key={cIdx} data={card.data} />;
                      case "confirmacao":
                        return (
                          <ConfirmacaoCard
                            key={cIdx}
                            data={card.data}
                            onConfirmar={onConfirmAction}
                            onCancelar={onCancelAction}
                            isLoading={isLoading}
                          />
                        );
                      case "alerta":
                        return <AlertaCard key={cIdx} data={card.data} />;
                      default:
                        return null;
                    }
                  })}
                </div>
              )}

              {/* Botões de Ações de Continuidade quando houver ação pendente */}
              {isAssistant && msg.pendingAction && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 space-y-2">
                  <span className="font-semibold text-xs text-amber-950 block">
                    Confirmação Necessária: {msg.pendingAction.title}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onConfirmAction?.(msg.pendingAction)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-2xs"
                    >
                      Pode confirmar
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={onCancelAction}
                      className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div
                className={`text-[10px] text-right ${
                  isAssistant ? "text-muted-foreground" : "text-emerald-200"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-3 justify-start items-center">
          <div className="h-8 w-8 rounded-full bg-emerald-800 text-[#C8A951] flex items-center justify-center shrink-0 animate-pulse">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="rounded-2xl bg-card border border-border/80 p-3.5 text-xs text-muted-foreground shadow-xs flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
            <span>Consultando dados e verificando regras operacionais...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
