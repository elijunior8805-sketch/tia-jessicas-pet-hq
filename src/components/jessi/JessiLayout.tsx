import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { JessiSidebar } from "./JessiSidebar";
import { JessiChat } from "./JessiChat";
import { JessiWelcome } from "./JessiWelcome";
import { JessiInputBar } from "./JessiInputBar";
import { JessiContextPanel } from "./JessiContextPanel";
import { JessiStatusIndicator, JessiStatus } from "./JessiStatusIndicator";
import { processarMensagemJessi, obterCentralOperacionalJessiFn } from "@/lib/ia/jessi-agent.functions";
import { JessiMessage, JessiPendingAction, JessiProactiveCentral } from "@/lib/ia/jessi-contracts";
import { JessiContextState, criarSessaoInicial } from "@/lib/ia/jessi-session";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { Sparkles, PanelRightOpen, PanelRightClose, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export const JessiLayout: React.FC = () => {
  const processarMensagemFn = useServerFn(processarMensagemJessi);
  const obterCentralFn = useServerFn(obterCentralOperacionalJessiFn);

  const [messages, setMessages] = useState<JessiMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<JessiStatus>("disponivel");
  const [statusDetalhe, setStatusDetalhe] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [centralData, setCentralData] = useState<JessiProactiveCentral | null>(null);
  const [isLoadingCentral, setIsLoadingCentral] = useState(true);
  const [contexto, setContexto] = useState<JessiContextState>({
    dataReferencia: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  });
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState("rotina");

  // Carrega a Central Operacional Proativa com dados 100% reais do banco na inicialização
  React.useEffect(() => {
    async function carregarCentral() {
      try {
        setIsLoadingCentral(true);
        const res = await obterCentralFn();
        setCentralData(res);
      } catch (err) {
        console.warn("Aviso ao carregar central proativa da Jessi:", err);
      } finally {
        setIsLoadingCentral(false);
      }
    }
    carregarCentral();
  }, []);

  const handleSendMessageRef = React.useRef<((text?: string) => Promise<void>) | null>(null);

  // Hook de reconhecimento de voz contínua com detecção de silêncio de 1.5s e auto-envio
  const {
    voiceStatus,
    isListening,
    isContinuousMode,
    interimTranscript,
    finalTranscript,
    ttsEnabled,
    setTtsEnabled,
    startListening,
    stopListening,
    startContinuousMode,
    stopContinuousMode,
    toggleContinuousMode,
    pauseListening,
    resumeListening,
    cancelListening,
    resetTranscript,
    speakResponse,
  } = useJessiVoice(
    (textoFinal) => {
      if (!isContinuousMode && textoFinal.trim()) {
        setInputText(textoFinal);
      }
    },
    (textoParaEnvio) => {
      if (textoParaEnvio.trim() && handleSendMessageRef.current) {
        handleSendMessageRef.current(textoParaEnvio.trim());
      }
    }
  );

  // Sincroniza status visual quando estiver gravando voz ou em modo contínuo
  React.useEffect(() => {
    if (isLoading) {
      setStatus("processando");
      setStatusDetalhe("Consultando sistema e regras operacionais...");
    } else if (voiceStatus === "sending") {
      setStatus("enviando");
      setStatusDetalhe("Enviando comando...");
    } else if (voiceStatus === "transcribing") {
      setStatus("transcrevendo");
      setStatusDetalhe("Transcrevendo fala...");
    } else if (voiceStatus === "listening") {
      setStatus("ouvindo");
      setStatusDetalhe(isContinuousMode ? "Modo Contínuo: Ouvindo..." : "Ouvindo sua voz...");
    } else if (status === "ouvindo" || status === "transcrevendo" || status === "enviando") {
      setStatus("disponivel");
      setStatusDetalhe(undefined);
    }
  }, [voiceStatus, isListening, isContinuousMode, isLoading]);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleToggleVoice = () => {
    toggleContinuousMode();
  };

  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatus("disponivel");
    setStatusDetalhe(undefined);
    toast.info("Processamento cancelado pelo usuário.");
    if (isContinuousMode) {
      resumeListening();
    }
  };

  const handleNovaConversa = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setContexto({
      dataReferencia: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    });
    setStatus("disponivel");
    setStatusDetalhe(undefined);
  };

  const handleSendMessage = async (customText?: string) => {
    // 1. Pausa o microfone para não capturar a própria fala
    pauseListening();
    resetTranscript();

    // 2. Prevenção Rígida de Duplicidade: Impede envio simultâneo se já estiver processando
    if (isLoading) {
      return;
    }

    const textToSend = customText || inputText;
    if (!textToSend.trim() && !selectedFile) {
      if (isContinuousMode) {
        resumeListening();
      }
      return;
    }

    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userMsg: JessiMessage = {
      id: userMessageId,
      role: "user",
      content: selectedFile ? `[Arquivo: ${selectedFile.name}] ${textToSend}` : textToSend,
      timestamp: new Date().toISOString(),
    };

    // 3. Preserva mensagem enviada no histórico
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setStatus("processando");
    setStatusDetalhe("Consultando sistema e regras operacionais...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
          historico: messages.slice(-20) as any,
          correlationId: `req_${Date.now()}`,
        },
      });

      // Se foi cancelado antes do retorno, descarta a resposta
      if (controller.signal.aborted) {
        if (isContinuousMode) resumeListening();
        return;
      }

      const assistantMsg: JessiMessage = {
        id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: "assistant",
        content: res.respostaTexto,
        timestamp: new Date().toISOString(),
        cards: res.cards as any,
        pendingAction: res.pendingAction,
        intent: res.intencao,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.novoContexto) {
        setContexto((prev) => ({ ...prev, ...res.novoContexto }));
      }

      if (res.pendingAction) {
        setStatus("aguardando_confirmacao");
        setStatusDetalhe("Aguardando sua confirmação");
      } else {
        setStatus("disponivel");
        setStatusDetalhe(undefined);
      }

      // 4. Retomada automática da escuta após a resposta da Jessi
      if (isContinuousMode) {
        if (ttsEnabled) {
          speakResponse(res.respostaTexto, () => {
            resumeListening();
          });
        } else {
          setTimeout(() => {
            resumeListening();
          }, 350);
        }
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        if (isContinuousMode) resumeListening();
        return;
      }

      console.error("Erro na comunicação com a Jessi:", err);
      const assistantErrMsg: JessiMessage = {
        id: `ast_err_${Date.now()}`,
        role: "assistant",
        content: "Houve uma instabilidade temporária na comunicação com o servidor. Sua mensagem foi preservada e você pode reenviá-la.",
        timestamp: new Date().toISOString(),
        cards: [
          {
            type: "alerta",
            data: {
              tipo: "erro",
              titulo: "Dificuldade de Conexão",
              mensagem: "A consulta falhou temporariamente. Clique abaixo para tentar novamente.",
              acaoTexto: "Tentar novamente",
              comandoAcao: textToSend,
            },
          },
        ],
      };
      setMessages((prev) => [...prev, assistantErrMsg]);
      toast.error("Instabilidade na conexão. Tente novamente.");
      setStatus("erro");
      setStatusDetalhe("Falha temporária de conexão");

      if (isContinuousMode) {
        setTimeout(() => {
          resumeListening();
        }, 1200);
      }
    } finally {
      // 5. Retira o indicador de processamento ao concluir ou falhar
      setIsLoading(false);
      setSelectedFile(null);
      setFilePreview(null);
      abortControllerRef.current = null;
    }
  };

  handleSendMessageRef.current = handleSendMessage;

  const handleConfirmAction = async (pendingAction?: any) => {
    const action = pendingAction || contexto?.operacaoPreparada || (messages.slice(-1)[0]?.pendingAction);
    if (!action) {
      toast.error("Nenhuma ação pendente localizada para confirmação.");
      return;
    }

    const actionId = action.id || `idemp_${Date.now()}`;
    const actionTitle = action.title || action.motivo || "Operação";
    const actionTool = action.tool || action.tipo || "criar_agendamento";
    const actionParams = action.params || action.parametros || action.estadoProposto || {};

    setIsLoading(true);
    setStatus("processando");

    try {
      const res = await processarMensagemFn({
        data: {
          mensagem: `Confirmar ação: ${actionTitle}`,
          contexto: contexto as any,
          historico: messages.slice(-10) as any,
          confirmacaoAcaoPendenteId: actionId,
          dadosConfirmacao: {
            tool: actionTool,
            params: actionParams,
          },
          correlationId: `req_conf_${Date.now()}`,
        },
      });

      const assistantMsg: JessiMessage = {
        id: `ast_${Date.now()}`,
        role: "assistant",
        content: res.respostaTexto,
        timestamp: new Date().toISOString(),
        cards: res.cards as any,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (res.novoContexto) {
        setContexto((prev) => ({ ...prev, ...res.novoContexto }));
      }
      setStatus("disponivel");
      toast.success("Ação confirmada e registrada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao executar ação confirmada:", err);
      toast.error(err?.message || "Erro ao executar ação confirmada.");
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
    <div className="flex w-full h-[calc(100dvh-3.5rem)] pb-20 md:pb-0 bg-[#FAF8F5] overflow-hidden">
      {/* Sidebar de Navegação */}
      <JessiSidebar
        onNovaConversa={handleNovaConversa}
        onSelecionarModulo={handleSelecionarModulo}
        moduloAtivo={moduloAtivo}
      />

      {/* Área Central de Conversação */}
      <main className="w-full flex-1 flex flex-col h-full bg-background md:border-r border-border/70 overflow-hidden min-w-0">
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
                  IA V2 Operacional
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Spa de Pet Tia Jéssica</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isContinuousMode ? "default" : "outline"}
              size="sm"
              onClick={toggleContinuousMode}
              title={isContinuousMode ? "Desativar modo de conversa contínua" : "Ativar Modo de Conversa por Voz Contínua"}
              className={`h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-lg transition-all ${
                isContinuousMode
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-xs animate-pulse"
                  : "text-emerald-800 border-emerald-300 hover:bg-emerald-50"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isContinuousMode ? "Voz Contínua ON" : "Ativar Voz"}</span>
            </Button>
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
            <JessiWelcome 
              onQuickAction={handleSendMessage} 
              centralData={centralData}
              isLoadingCentral={isLoadingCentral}
            />
          ) : (
            <JessiChat
              messages={messages}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
              onSendMessage={handleSendMessage}
              onCancelProcessing={handleCancelProcessing}
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
          isContinuousMode={isContinuousMode}
          onToggleContinuousVoice={toggleContinuousMode}
          onCancelVoice={cancelListening}
          interimTranscript={interimTranscript}
          ttsEnabled={ttsEnabled}
          onToggleTts={() => setTtsEnabled(!ttsEnabled)}
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
