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
  onCancelProcessing?: () => void;
  isLoading?: boolean;
}

export const JessiChat: React.FC<JessiChatProps> = ({
  messages,
  onConfirmAction,
  onCancelAction,
  onSendMessage,
  onCancelProcessing,
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
                        return (
                          <div key={cIdx} className="space-y-1.5">
                            <AlertaCard data={card.data} />
                            {card.data?.comandoAcao && onSendMessage && (
                              <button
                                type="button"
                                onClick={() => onSendMessage(card.data.comandoAcao)}
                                className="text-xs text-emerald-800 font-semibold hover:underline"
                              >
                                {card.data.acaoTexto || "Tentar novamente"} →
                              </button>
                            )}
                          </div>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              )}

              {/* Botões de Ações de Continuidade quando houver ação pendente e não houver card de confirmação */}
              {isAssistant && msg.pendingAction && !msg.cards?.some((c) => c.type === "confirmacao") && (
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
          <div className="rounded-2xl bg-card border border-border/80 p-3.5 text-xs text-muted-foreground shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Consultando dados e verificando regras operacionais...</span>
            </div>
            {onCancelProcessing && (
              <button
                type="button"
                onClick={onCancelProcessing}
                className="text-[11px] text-muted-foreground hover:text-red-700 underline font-medium"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chips de Ações Rápidas de 1-Clique para Continuidade Fluida */}
      {onSendMessage && !isLoading && (
        <div className="pt-2 pb-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar">
            <span className="text-[10px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wider pl-1">
              Sugestões:
            </span>
            <button
              type="button"
              onClick={() => onSendMessage("consultar agenda de hoje")}
              className="px-2.5 py-1 rounded-full bg-background border border-emerald-300/80 hover:bg-emerald-50 text-emerald-900 text-xs font-medium shrink-0 transition-colors shadow-2xs hover:border-emerald-500"
            >
              📅 Agenda de hoje
            </button>
            <button
              type="button"
              onClick={() => onSendMessage("consultar faturamento do mês")}
              className="px-2.5 py-1 rounded-full bg-background border border-emerald-300/80 hover:bg-emerald-50 text-emerald-900 text-xs font-medium shrink-0 transition-colors shadow-2xs hover:border-emerald-500"
            >
              💰 Caixa & Finanças
            </button>
            <button
              type="button"
              onClick={() => onSendMessage("quais os horários livres de hoje?")}
              className="px-2.5 py-1 rounded-full bg-background border border-border/80 hover:bg-muted text-foreground text-xs font-medium shrink-0 transition-colors shadow-2xs"
            >
              ⏰ Horários livres
            </button>
            <button
              type="button"
              onClick={() => onSendMessage("buscar clientes")}
              className="px-2.5 py-1 rounded-full bg-background border border-border/80 hover:bg-muted text-foreground text-xs font-medium shrink-0 transition-colors shadow-2xs"
            >
              🐾 Clientes & Pets
            </button>
            <button
              type="button"
              onClick={() => onSendMessage("consultar catalogo de programas")}
              className="px-2.5 py-1 rounded-full bg-background border border-[#C8A951]/60 hover:bg-amber-50 text-[#8C6D1F] text-xs font-medium shrink-0 transition-colors shadow-2xs"
            >
              ⭐ Clubinho
            </button>
            <button
              type="button"
              onClick={() => onSendMessage("quais clientes não vêm há mais de 30 dias?")}
              className="px-2.5 py-1 rounded-full bg-background border border-purple-300/80 hover:bg-purple-50 text-purple-900 text-xs font-medium shrink-0 transition-colors shadow-2xs"
            >
              📢 Reativar clientes
            </button>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
