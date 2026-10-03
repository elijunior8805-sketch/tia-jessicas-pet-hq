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
import { JessiBancadaMode } from "./JessiBancadaMode";
import { Sparkles, PanelRightOpen, PanelRightClose, Mic, Headphones } from "lucide-react";
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
 const [isBancadaModeOpen, setIsBancadaModeOpen] = useState(false);

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
 const {
 voiceStatus,
 isListening,
 isContinuousMode,
 interimTranscript,
 finalTranscript,
 isSpeaking,
 audioLevel,
 isInterrupted,
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
 falarResposta,
 pararFala,
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

 React.useEffect(() => {
 if (isLoading) {
 setStatus("processando");
 setStatusDetalhe("Consultando sistema e regras operacionais.");
 } else if (voiceStatus === "sending") {
 setStatus("enviando");
 setStatusDetalhe("Enviando comando.");
 } else if (voiceStatus === "transcribing") {
 setStatus("transcrevendo");
 setStatusDetalhe("Transcrevendo fala.");
 } else if (voiceStatus === "listening") {
 setStatus("ouvindo");
 setStatusDetalhe(isContinuousMode? "Modo Contínuo: Ouvindo.": "Ouvindo sua voz.");
 } else if (isSpeaking) {
 setStatus("processando");
 setStatusDetalhe("Falando resposta.");
 } else if (status === "ouvindo" || status === "transcrevendo" || status === "enviando" || status === "processando") {
 setStatus("disponivel");
 setStatusDetalhe(undefined);
 }
 }, [voiceStatus, isListening, isContinuousMode, isSpeaking, isLoading]);

 const abortControllerRef = React.useRef<AbortController | null>(null);

 const handleToggleVoice = () => {
 toggleContinuousMode();
 };

 const handleCancelProcessing = () => {
 pararFala();
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
 pararFala();
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

 const handleConfirmAction = async (acao: JessiPendingAction) => {
 setIsLoading(true);
 try {
 const res = await processarMensagemFn({ data: { mensagem: "confirmar", contexto, acaoConfirmada: acao } as any });
 if (res?.mensagem) {
 setMessages((prev) => [...prev, res.mensagem as JessiMessage]);
 if (res.contexto) setContexto(res.contexto);
 }
 toast.success("Ação confirmada!");
 if (isContinuousMode) resumeListening();
 } catch (e: any) {
 toast.error(e?.message || "Falha ao confirmar ação");
 } finally {
 setIsLoading(false);
 }
 };

 const handleCancelAction = () => {
 setContexto((prev) => ({ ...prev, operacaoPreparada: undefined }));
 setMessages((prev) => [...prev, { id: `cancel_${Date.now()}`, role: "assistant", content: "Tudo bem, cancelei a operação pendente." } as JessiMessage]);
 toast.info("Operação cancelada.");
 if (isContinuousMode) resumeListening();
 };

 const handleSendMessage = async (customText?: string) => {
 if (typeof window!== "undefined" && window.speechSynthesis) {
 try { window.speechSynthesis.resume(); } catch {}
 }
 pauseListening();
 resetTranscript();
 if (isLoading) return;
 pararFala();
 const textToSend = customText || inputText;
 if (!textToSend.trim() &&!selectedFile) {
 if (isContinuousMode) resumeListening();
 return;
 }
 const acaoPendenteAtiva = (contexto as any)?.operacaoPreparada || (messages.slice(-1)[0] as any)?.pendingAction;
 if (acaoPendenteAtiva &&!selectedFile) {
 const textoNorm = textToSend.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
 const ehConfirmacaoVoz = /^(pode confirmar|confirmar|confirma|pode agendar|pode marcar|pode cancelar|pode fazer|sim|autorizado|ok pode confirmar|ta confirmado|confirmo|pode registrar|sim pode|pode|autorizo|confirme)$/i.test(textoNorm) || textoNorm === "sim" || textoNorm === "pode" || textoNorm === "confirma" || textoNorm === "confirmar" || textoNorm === "pode confirmar";
 const ehCancelamentoVoz = /^(cancela|cancelar|nao cancela|nao|esquece|deixa pra la|nao confirma|cancela isso|parar)$/i.test(textoNorm) || textoNorm === "nao" || textoNorm === "não" || textoNorm === "cancela" || textoNorm === "cancelar";
 if (ehConfirmacaoVoz) { setInputText(""); await handleConfirmAction(acaoPendenteAtiva); return; }
 else if (ehCancelamentoVoz) { setInputText(""); handleCancelAction(); return; }
 }
 const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
 const userMsg: JessiMessage = {
 id: userMessageId,
 role: "user",
 content: selectedFile? `[Arquivo: ${selectedFile.name}] ${textToSend}`: textToSend,
 } as JessiMessage;
 setMessages((prev) => [...prev, userMsg]);
 setInputText("");
 setSelectedFile(null);
 setFilePreview(null);
 setIsLoading(true);
 const controller = new AbortController();
 abortControllerRef.current = controller;
 try {
 const res = await processarMensagemFn({ data: { mensagem: textToSend, contexto } as any });
 if (controller.signal.aborted) return;
 if (res?.mensagem) {
 setMessages((prev) => [...prev, res.mensagem as JessiMessage]);
 const textoResposta = (res.mensagem as any)?.content || "";
 if (textoResposta && ttsEnabled) falarResposta(textoResposta);
 }
 if (res?.contexto) setContexto(res.contexto);
 } catch (e: any) {
 if (e?.name === "AbortError") return;
 toast.error(e?.message || "Erro ao processar mensagem");
 } finally {
 if (abortControllerRef.current === controller) abortControllerRef.current = null;
 setIsLoading(false);
 if (isContinuousMode) resumeListening();
 }
 };

 handleSendMessageRef.current = handleSendMessage;

 const showWelcome = messages.length === 0 &&!isLoading;

 return (
 <div className="flex w-full min-w-0 flex-col lg:flex-row h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
 <div className="hidden lg:flex lg:w-[280px] lg:shrink-0 border-r border-border overflow-hidden">
 <JessiSidebar centralData={centralData} isLoadingCentral={isLoadingCentral} moduloAtivo={moduloAtivo} onSelectModulo={setModuloAtivo} onNovaConversa={handleNovaConversa} />
 </div>
 <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
 <div className="flex items-center justify-between gap-2 border-b border-border bg-card/50 px-4 sm:px-6 py-2 shrink-0 min-w-0">
 <div className="flex items-center gap-2 min-w-0">
 <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0"><Sparkles className="h-4 w-4" /></span>
 <span className="font-display text-sm font-semibold truncate">Jessi — Assistente Operacional</span>
 <JessiStatusIndicator status={status} detalhe={statusDetalhe} />
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setIsContextOpen((v) =>!v)} aria-label="Painel contextual">
 {isContextOpen? <PanelRightClose className="h-4 w-4" />: <PanelRightOpen className="h-4 w-4" />}
 </Button>
 <Button variant="ghost" size="icon" className="hidden lg:inline-flex h-8 w-8" onClick={() => setIsContextOpen((v) =>!v)} aria-label="Toggle contexto">
 {isContextOpen? <PanelRightClose className="h-4 w-4" />: <PanelRightOpen className="h-4 w-4" />}
 </Button>
 <Button variant={isContinuousMode? "default": "outline"} size="sm" onClick={handleToggleVoice} className="min-h-9 gap-1.5">
 {isContinuousMode? <Headphones className="h-4 w-4" />: <Mic className="h-4 w-4" />}
 <span className="hidden sm:inline">{isContinuousMode? "Ouvindo": "Voz"}</span>
 </Button>
 </div>
 </div>
 <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
 <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
 <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4">
 {showWelcome? (
 <JessiWelcome onSugestao={(t) => handleSendMessage(t)} centralData={centralData} />
 ): (
 <JessiChat messages={messages} isLoading={isLoading} onConfirm={handleConfirmAction} onCancel={handleCancelAction} onCancelProcessing={handleCancelProcessing} />
 )}
 </div>
 <div className="border-t border-border bg-card/50 p-3 sm:p-4 shrink-0">
 <JessiInputBar
 value={inputText}
 onChange={setInputText}
 onSend={() => handleSendMessage()}
 isLoading={isLoading}
 isListening={isListening}
 interimTranscript={interimTranscript}
 onStartListening={startListening}
 onStopListening={stopListening}
 selectedFile={selectedFile}
 onSelectFile={setSelectedFile}
 filePreview={filePreview}
 setFilePreview={setFilePreview}
 onCancelProcessing={handleCancelProcessing}
 />
 </div>
 </div>
 {isContextOpen && (
 <div className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto overflow-x-hidden max-h-[40vh] lg:max-h-none">
 <JessiContextPanel contexto={contexto} centralData={centralData} onClose={() => setIsContextOpen(false)} />
 </div>
 )}
 </div>
 </div>
 {isBancadaModeOpen && (
 <JessiBancadaMode open={isBancadaModeOpen} onClose={() => setIsBancadaModeOpen(false)} />
 )}
 </div>
 );
};
