import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, X, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { JessiChat } from "@/components/jessi/JessiChat";
import { JessiInputBar } from "@/components/jessi/JessiInputBar";
import { JessiStatusIndicator, JessiStatus } from "@/components/jessi/JessiStatusIndicator";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { JessiMessage, JessiPendingAction } from "@/lib/ia/jessi-contracts";
import { JessiContextState } from "@/lib/ia/jessi-session";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";

interface AssistenteIaSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistenteIaSidebar({ isOpen, onClose }: AssistenteIaSidebarProps) {
  const processarMensagemFn = useServerFn(processarMensagemJessi);

  const [messages, setMessages] = useState<JessiMessage[]>([
    {
      id: "msg_welcome",
      role: "assistant",
      content: "Olá, Eli! Sou a Jessi, assistente inteligente do Spa de Pet Tia Jéssica. Posso consultar a agenda, conferir saldo de programas, verificar o faturamento ou preparar agendamentos com sua supervisão. Como posso ajudar agora?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<JessiStatus>("disponivel");
  const [statusDetalhe, setStatusDetalhe] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contexto, setContexto] = useState<JessiContextState>({
    dataReferencia: new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessageRef = useRef<((text?: string) => Promise<void>) | null>(null);

  // Hook de reconhecimento de voz com auto-envio imediato
  const {
    voiceStatus,
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    cancelListening,
  } = useJessiVoice(
    (textoFinal) => {
      if (textoFinal.trim()) {
        setInputText(textoFinal);
      }
    },
    (textoParaEnvio) => {
      if (textoParaEnvio.trim() && handleSendMessageRef.current) {
        handleSendMessageRef.current(textoParaEnvio.trim());
      }
    }
  );

  React.useEffect(() => {
    if (isListening) {
      setStatus("ouvindo");
      setStatusDetalhe("Ouvindo sua voz...");
    } else if (status === "ouvindo") {
      setStatus("disponivel");
      setStatusDetalhe(undefined);
    }
  }, [isListening]);

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(inputText);
    }
  };

  const handleNovaConversa = () => {
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        role: "assistant",
        content: "Nova conversa iniciada. Em que posso ajudar no Spa hoje?",
        timestamp: new Date().toISOString(),
      },
    ]);
    setContexto({
      dataReferencia: new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    });
    setStatus("disponivel");
    setStatusDetalhe(undefined);
  };

  const handleSendMessage = async (customText?: string) => {
    if (isLoading) return;

    const textToSend = customText || inputText;
    if (!textToSend.trim() && !selectedFile) return;

    const userMessageId = `msg_user_${Date.now()}`;
    const userMsg: JessiMessage = {
      id: userMessageId,
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setStatus("processando");
    setStatusDetalhe("Consultando inteligência e registros...");

    try {
      const historicoRecente = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res: any = await processarMensagemFn({
        data: {
          mensagem: textToSend.trim(),
          contexto: contexto as any,
          historico: historicoRecente,
        },
      });

      if (res?.novoContexto) {
        setContexto((prev) => ({ ...prev, ...res.novoContexto }));
      }

      const assistantMsg: JessiMessage = {
        id: `msg_asst_${Date.now()}`,
        role: "assistant",
        content: res?.respostaTexto || "Não consegui obter uma resposta no momento.",
        timestamp: new Date().toISOString(),
        cards: res?.cards || [],
        pendingAction: res?.pendingAction || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Erro na comunicação com a Jessi V2:", err);
      toast.error("Não foi possível processar o comando. Tente novamente.");
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: "Encontrei uma instabilidade temporária ao consultar os registros. Por favor, tente novamente.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStatus("disponivel");
      setStatusDetalhe(undefined);
      setSelectedFile(null);
    }
  };

  handleSendMessageRef.current = handleSendMessage;

  const handleConfirmAction = async (pendingAction: JessiPendingAction) => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus("processando");
    setStatusDetalhe("Gravando alteração com validação...");

    try {
      const res: any = await processarMensagemFn({
        data: {
          mensagem: "confirmar",
          contexto: contexto as any,
          confirmacaoAcaoPendenteId: pendingAction.id,
          dadosConfirmacao: {
            tool: pendingAction.tool,
            params: pendingAction.params,
          },
        },
      });

      if (res?.novoContexto) {
        setContexto((prev) => ({ ...prev, ...res.novoContexto }));
      }

      const confirmMsg: JessiMessage = {
        id: `msg_asst_conf_${Date.now()}`,
        role: "assistant",
        content: res?.respostaTexto || "Operação executada e confirmada com sucesso.",
        timestamp: new Date().toISOString(),
        cards: res?.cards || [],
      };

      setMessages((prev) => [...prev, confirmMsg]);
      toast.success("Ação confirmada e gravada!");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao executar a confirmação.");
    } finally {
      setIsLoading(false);
      setStatus("disponivel");
      setStatusDetalhe(undefined);
    }
  };

  const handleCancelAction = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_cancel_${Date.now()}`,
        role: "assistant",
        content: "Ação cancelada. Nenhuma alteração foi realizada no sistema.",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }
    setSelectedFile(file);
    toast.success(`Arquivo ${file.name} anexado.`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Drawer Lateral Jessi V2 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="bg-background w-full sm:w-[500px] h-full flex flex-col shadow-2xl relative z-10 border-l border-border"
          >
            {/* Header Sofisticado */}
            <div className="h-16 px-4 bg-emerald-900 text-white flex items-center justify-between border-b border-emerald-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-white/10 text-[#C8A951] flex items-center justify-center border border-white/15">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white font-display truncate">
                      Jessi V2
                    </span>
                    <span className="text-[10px] bg-emerald-800 text-[#F5E6BE] px-2 py-0.5 rounded-full border border-[#C8A951]/40 font-semibold">
                      Supervisionada
                    </span>
                  </div>
                  <JessiStatusIndicator status={status} statusDetalhe={statusDetalhe} />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleNovaConversa}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                  title="Limpar e Nova Conversa"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Link to="/jessi">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                    title="Abrir em Tela Cheia"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Corpo Conversacional Interativo com Cards */}
            <JessiChat
              messages={messages}
              onSendMessage={handleSendMessage}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
              isLoading={isLoading}
            />

            {/* Barra de Entrada de Mensagens e Voz */}
            <JessiInputBar
              inputText={inputText}
              setInputText={setInputText}
              onSend={() => handleSendMessage()}
              isLoading={isLoading}
              voiceStatus={voiceStatus}
              onToggleVoice={handleToggleVoice}
              onCancelVoice={cancelListening}
              interimTranscript={interimTranscript}
              selectedFile={selectedFile}
              onSelectFile={handleFileSelect}
              onRemoveFile={() => setSelectedFile(null)}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
