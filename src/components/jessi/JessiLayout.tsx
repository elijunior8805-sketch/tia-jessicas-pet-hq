import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { JessiSidebar } from "./JessiSidebar";
import { JessiChat } from "./JessiChat";
import { JessiWelcome } from "./JessiWelcome";
import { JessiInputBar } from "./JessiInputBar";
import { JessiContextPanel } from "./JessiContextPanel";
import { JessiStatusIndicator, JessiStatus } from "./JessiStatusIndicator";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { JessiMessage, JessiPendingAction } from "@/lib/ia/jessi-contracts";
import { JessiContextState, criarSessaoInicial } from "@/lib/ia/jessi-session";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { Sparkles, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";

export const JessiLayout: React.FC = () => {
  const processarMensagemFn = useServerFn(processarMensagemJessi);

  const [messages, setMessages] = useState<JessiMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<JessiStatus>("disponivel");
  const [statusDetalhe, setStatusDetalhe] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [contexto, setContexto] = useState<JessiContextState>({
    dataReferencia: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  });
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState("rotina");

  // Hook real de reconhecimento de voz
  const {
    voiceStatus,
    isListening,
    interimTranscript,
    finalTranscript,
    startListening,
    stopListening,
    cancelListening,
  } = useJessiVoice((textoFinal) => {
    if (textoFinal.trim()) {
      setInputText(textoFinal);
    }
  });

  // Sincroniza status visual quando estiver gravando voz
  React.useEffect(() => {
    if (isListening) {
      setStatus("ouvindo");
      setStatusDetalhe("Ouvindo comando de voz...");
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
    setMessages([]);
    setContexto({
      dataReferencia: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    });
    setStatus("disponivel");
    setStatusDetalhe(undefined);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() && !selectedFile) return;

    const userMessageId = `user_${Date.now()}`;
    const userMsg: JessiMessage = {
      id: userMessageId,
      role: "user",
      content: selectedFile ? `[Arquivo: ${selectedFile.name}] ${textToSend}` : textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setStatus("processando");

    try {
      let fileBase64: string | undefined;
      if (selectedFile) {
        const reader = new FileReader();
        fileBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(selectedFile);
        });
      }

      const res = await processarMensagemFn({
        data: {
          mensagem: textToSend,
          contexto: contexto as any,
          historico: messages.slice(-8) as any,
        },
      });

      const assistantMsg: JessiMessage = {
        id: `ast_${Date.now()}`,
        role: "assistant",
        content: res.respostaTexto,
        timestamp: new Date().toISOString(),
        cards: res.cards,
        pendingAction: res.pendingAction,
        intent: res.intencao,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.novoContexto) {
        setContexto((prev) => ({ ...prev, ...res.novoContexto }));
      }

      if (res.pendingAction) {
        setStatus("aguardando_confirmacao");
      } else {
        setStatus("disponivel");
    } catch (err: any) {
      console.error("Erro na comunicação com a Jessi:", err);
      const assistantErrMsg: JessiMessage = {
        id: `ast_err_${Date.now()}`,
        role: "assistant",
        content: "Tive uma dificuldade temporária na comunicação com o servidor. Por favor, tente enviar novamente.",
        timestamp: new Date().toISOString(),
        cards: [
          {
            type: "alerta",
            data: {
              tipo: "erro",
              titulo: "Instabilidade temporária",
              mensagem: "A requisição não pôde ser completada. Se persistir, recarregue a página.",
            },
          },
        ],
      };
      setMessages((prev) => [...prev, assistantErrMsg]);
      toast.error("Não foi possível processar a mensagem.");
      setStatus("erro");
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
      setFilePreview(null);
    }
  };

  const handleConfirmAction = async (pendingAction: JessiPendingAction) => {
    if (!pendingAction) return;

    setIsLoading(true);
    setStatus("processando");

    try {
      const res = await processarMensagemFn({
        data: {
          mensagem: `Confirmar ação: ${pendingAction.title}`,
          confirmacaoAcaoPendenteId: pendingAction.id,
          dadosConfirmacao: {
            tool: pendingAction.tool,
            params: pendingAction.params,
          },
        },
      });

      const assistantMsg: JessiMessage = {
        id: `ast_${Date.now()}`,
        role: "assistant",
        content: res.respostaTexto,
        timestamp: new Date().toISOString(),
        cards: res.cards,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStatus("disponivel");
      toast.success("Ação confirmada e registrada com sucesso!");
    } catch (err) {
      toast.error("Erro ao executar ação confirmada.");
      setStatus("erro");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAction = () => {
    const cancelMsg: JessiMessage = {
      id: `ast_${Date.now()}`,
      role: "assistant",
      content: "Operação cancelada. Nenhuma alteração foi realizada no sistema.",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, cancelMsg]);
    setStatus("disponivel");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo excede o limite de 8MB.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview("pdf");
    }
  };

  const handleSelecionarModulo = (modulo: string) => {
    setModuloAtivo(modulo);
    switch (modulo) {
      case "agenda":
        handleSendMessage("consultar agenda de hoje");
        break;
      case "clientes":
        handleSendMessage("buscar clientes");
        break;
      case "financeiro":
        handleSendMessage("consultar faturamento do mês");
        break;
      case "programas":
        handleSendMessage("consultar catalogo de programas");
        break;
      case "comprovantes":
        handleSendMessage("como envio um comprovante pix?");
        break;
      case "alertas":
        handleSendMessage("consultar valores a receber");
        break;
      case "historico":
        handleSendMessage("consultar indicadores de qualidade da IA");
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#FAF8F5] overflow-hidden">
      {/* Sidebar de Navegação */}
      <JessiSidebar
        onNovaConversa={handleNovaConversa}
        onSelecionarModulo={handleSelecionarModulo}
        moduloAtivo={moduloAtivo}
      />

      {/* Área Central de Conversação */}
      <main className="flex-1 flex flex-col h-full bg-background border-r border-border/70 overflow-hidden">
        {/* Header da Jessi */}
        <header className="h-14 border-b border-border/70 bg-card/70 backdrop-blur-xs px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 font-display">
                <span>Jessi</span>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                  Operacional
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Spa de Pet Tia Jéssica</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <JessiStatusIndicator status={status} statusDetalhe={statusDetalhe} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsContextOpen(!isContextOpen)}
              title={isContextOpen ? "Ocultar contexto" : "Ver contexto"}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {isContextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Mensagens ou Welcome Screen */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {messages.length === 0 ? (
            <JessiWelcome onQuickAction={handleSendMessage} />
          ) : (
            <JessiChat
              messages={messages}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Barra de Entrada */}
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
          onRemoveFile={() => {
            setSelectedFile(null);
            setFilePreview(null);
          }}
        />
      </main>

      {/* Painel Lateral de Contexto */}
      <JessiContextPanel
        contexto={contexto}
        isOpen={isContextOpen}
        onClose={() => setIsContextOpen(false)}
      />
    </div>
  );
};
