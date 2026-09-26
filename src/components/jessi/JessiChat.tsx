import React, { useRef, useEffect, useCallback } from "react";
import { JessiMessage } from "@/lib/ia/jessi-contracts";
import { AgendaCard } from "./cards/AgendaCard";
import { ClienteCard } from "./cards/ClienteCard";
import { FinanceiroCard } from "./cards/FinanceiroCard";
import { ProgramaCard } from "./cards/ProgramaCard";
import { ComprovanteCard } from "./cards/ComprovanteCard";
import { ConfirmacaoCard } from "./cards/ConfirmacaoCard";
import { AlertaCard } from "./cards/AlertaCard";
import { LevaTrazCard } from "./cards/LevaTrazCard";
import { ComunicacaoCard } from "./cards/ComunicacaoCard";
import { ReativacaoCard } from "./cards/ReativacaoCard";
import { ChevronDown, Sparkles, User, ArrowRight } from "lucide-react";


const renderInlineMarkdown = (text: string, isAssistant: boolean): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+(?:\?[^\s)]*)?\))/g;
  const segments = text.split(regex);

  segments.forEach((seg, idx) => {
    if (!seg) return;

    if (seg.startsWith("**") && seg.endsWith("**")) {
      const boldText = seg.slice(2, -2);
      parts.push(
        <strong key={idx} className={isAssistant ? "font-semibold text-foreground" : "font-semibold text-white"}>
          {boldText}
        </strong>
      );
    } else if (seg.startsWith("*") && seg.endsWith("*")) {
      const italicText = seg.slice(1, -1);
      parts.push(
        <em key={idx} className="italic opacity-90">
          {italicText}
        </em>
      );
    } else if (seg.startsWith("[") && seg.includes("](") && seg.endsWith(")")) {
      const match = seg.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const linkText = match[1];
        const linkUrl = match[2];
        parts.push(
          <a
            key={idx}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 underline font-medium"
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(seg);
      }
    } else {
      parts.push(seg);
    }
  });

  return parts;
};

export const FormattedMessageContent: React.FC<{ content: string; isAssistant: boolean }> = ({ content, isAssistant }) => {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1.5 pl-0.5">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      elements.push(<div key={`br-${lineIdx}`} className="h-1.5" />);
      return;
    }

    const isBullet = /^[•*\-–—]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);

    if (isBullet) {
      const cleanLine = trimmed.replace(/^[•*\-–—]\s+/, "").replace(/^\d+\.\s+/, "");
      currentList.push(
        <li key={`li-${lineIdx}`} className="flex items-start gap-2 text-xs md:text-sm">
          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isAssistant ? "bg-emerald-700" : "bg-white"}`} />
          <span className="flex-1 leading-relaxed">
            {renderInlineMarkdown(cleanLine, isAssistant)}
          </span>
        </li>
      );
    } else {
      flushList();
      const isHeader = /^#{1,6}\s+/.test(trimmed) || (trimmed.endsWith(":") && trimmed.length < 80);
      if (isHeader) {
        const cleanHeader = trimmed.replace(/^#{1,6}\s+/, "");
        elements.push(
          <div key={`h-${lineIdx}`} className={`font-semibold text-xs md:text-sm pt-1 pb-0.5 ${isAssistant ? "text-foreground" : "text-white"}`}>
            {renderInlineMarkdown(cleanHeader, isAssistant)}
          </div>
        );
      } else {
        elements.push(
          <p key={`p-${lineIdx}`} className="leading-relaxed">
            {renderInlineMarkdown(trimmed, isAssistant)}
          </p>
        );
      }
    }
  });

  flushList();
  return <div className="space-y-1">{elements}</div>;
};



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
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = React.useState(false);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    } else if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 100;
    userScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  }, []);

  // Auto-scroll imediato e suave quando novas mensagens ou cards chegam
  useEffect(() => {
    // Se o usuário não subiu propositalmente, ou se é mensagem enviada pelo usuário, rola pro fim
    const lastMsg = messages[messages.length - 1];
    const isUserLast = lastMsg?.role === "user";

    if (!userScrolledUpRef.current || isUserLast || isLoading) {
      scrollToBottom(true);
      // Timeout seguro para renderização de cards assíncronos
      const t1 = setTimeout(() => scrollToBottom(true), 60);
      const t2 = setTimeout(() => scrollToBottom(true), 200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [messages, isLoading, scrollToBottom]);

  // ResizeObserver para manter scroll sincronizado quando cards mudam de altura
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      if (!userScrolledUpRef.current) {
        scrollToBottom(false);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth relative"
    >
      {messages.map((msg) => {
        const isAssistant = msg.role === "assistant";

        return (
          <div
            key={msg.id}
            className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${isAssistant ? "justify-start" : "justify-end"}`}
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
              <FormattedMessageContent content={msg.content} isAssistant={isAssistant} />

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
                      case "comunicacao":
                        return <ComunicacaoCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
                      case "reativacao":
                      case "proativo":
                        return <ReativacaoCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
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
                      case "leva_traz":
                        return <LevaTrazCard key={cIdx} data={card.data} onActionClick={onSendMessage} />;
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



      {/* Botão flutuante suave para descer quando estiver navegando no histórico */}
      {showScrollBottom && (
        <div className="sticky bottom-1 left-0 right-0 flex justify-center pointer-events-none z-10 pb-1">
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/90 hover:bg-emerald-950 text-white text-xs font-semibold shadow-lg backdrop-blur-xs border border-[#C8A951]/50 transition-all transform hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-bottom-2"
          >
            <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
            <span>Últimas mensagens</span>
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
