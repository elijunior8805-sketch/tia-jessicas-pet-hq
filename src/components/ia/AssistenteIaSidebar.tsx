import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Sparkles, 
  X, 
  RotateCcw, 
  ExternalLink,
  Calendar,
  DollarSign,
  Users,
  Clock,
  Car,
  Package,
  AlertTriangle,
  Gift,
  TrendingUp,
  Scissors
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useRouterState } from "@tanstack/react-router";
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

interface ContextSuggestion {
  label: string;
  icon: any;
  command: string;
}

export function AssistenteIaSidebar({ isOpen, onClose }: AssistenteIaSidebarProps) {
  const routerState = useRouterState();
  const currentPath = routerState?.location?.pathname || "/";
  const processarMensagemFn = useServerFn(processarMensagemJessi);

  // Mapeamento dinâmico de contexto e sugestões conforme a rota ativa
  const { moduloNome, sugestoesContextuais, saudacaoContextual } = useMemo(() => {
    if (currentPath.includes("/agenda")) {
      return {
        moduloNome: "Agenda & Grade",
        saudacaoContextual: "Olá, Eli! Estou conectada à Agenda do Spa. Posso verificar horários livres, checar confirmações ou agendar um novo atendimento.",
        sugestoesContextuais: [
          { label: "Vagas livres hoje", icon: Clock, command: "consultar horarios livres hoje" },
          { label: "Confirmar amanhã", icon: Calendar, command: "preparar lembretes de confirmacao para amanha" },
          { label: "Leva e Traz de hoje", icon: Car, command: "consultar rota leva e traz de hoje" },
          { label: "Criar Agendamento", icon: Sparkles, command: "criar agendamento" },
        ],
      };
    }

    if (currentPath.includes("/financeiro") || currentPath.includes("/cobrancas") || currentPath.includes("/pagamentos")) {
      return {
        moduloNome: "Financeiro & Cobrança",
        saudacaoContextual: "Olá, Eli! Estou conectada ao módulo Financeiro. Posso conferir contas a receber, faturamento do mês ou conciliação Pix.",
        sugestoesContextuais: [
          { label: "Contas a Receber", icon: DollarSign, command: "consultar valores a receber" },
          { label: "Faturamento do Mês", icon: TrendingUp, command: "consultar faturamento do mes" },
          { label: "Pendências de Cobrança", icon: AlertTriangle, command: "consultar pendencias financeiras" },
          { label: "Programas Ativos", icon: Sparkles, command: "consultar catalogo de programas" },
        ],
      };
    }

    if (currentPath.includes("/clientes") || currentPath.includes("/pets")) {
      return {
        moduloNome: "Clientes & Pets",
        saudacaoContextual: "Olá, Eli! Estou no módulo de Clientes & Pets. Posso buscar a ficha de um tutor, histórico de atendimentos ou aniversariantes.",
        sugestoesContextuais: [
          { label: "Buscar Cliente", icon: Users, command: "buscar cliente" },
          { label: "Pets para Reativar", icon: Clock, command: "clientes inativos ha mais de 20 dias" },
          { label: "Aniversariantes", icon: Gift, command: "aniversariantes do mes" },
          { label: "Créditos de Programas", icon: Sparkles, command: "consultar saldos de planos" },
        ],
      };
    }

    if (currentPath.includes("/estoque") || currentPath.includes("/compras") || currentPath.includes("/fornecedores")) {
      return {
        moduloNome: "Estoque & Suprimentos",
        saudacaoContextual: "Olá, Eli! Conectada ao Estoque. Posso verificar níveis de shampoos, itens abaixo do mínimo e lista de compras.",
        sugestoesContextuais: [
          { label: "Itens em Baixa", icon: Package, command: "consultar estoque baixo" },
          { label: "Shampoos & Cosméticos", icon: Sparkles, command: "consultar estoque de shampoos" },
          { label: "Últimas Compras", icon: DollarSign, command: "consultar ultimas compras" },
        ],
      };
    }

    if (currentPath.includes("/atendimentos")) {
      return {
        moduloNome: "Atendimentos & Execução",
        saudacaoContextual: "Olá, Eli! Estou conectada à bancada de Atendimentos. Posso conferir os banhos em andamento, observações de tosa e histórico do pet.",
        sugestoesContextuais: [
          { label: "Em Atendimento Agora", icon: Scissors, command: "consultar atendimentos em andamento" },
          { label: "Próximos da Fila", icon: Clock, command: "consultar proximos atendimentos de hoje" },
          { label: "Finalizar Atendimento", icon: Sparkles, command: "como finalizar atendimento" },
        ],
      };
    }

    return {
      moduloNome: "Central Geral",
      saudacaoContextual: "Olá, Eli! Sou a Jessi, seu copiloto no Spa de Pet Tia Jéssica. Posso consultar a agenda, contas a receber, histórico de pets ou preparar agendamentos com sua supervisão. Como posso ajudar agora?",
      sugestoesContextuais: [
        { label: "Agenda de hoje", icon: Calendar, command: "consultar agenda de hoje" },
        { label: "Caixa & Finanças", icon: DollarSign, command: "consultar valores a receber" },
        { label: "Horários livres", icon: Clock, command: "consultar horarios livres hoje" },
        { label: "Programas & Banhos", icon: Sparkles, command: "consultar catalogo de programas" },
      ],
    };
  }, [currentPath]);

  const [messages, setMessages] = useState<JessiMessage[]>([
    {
      id: "msg_welcome",
      role: "assistant",
      content: saudacaoContextual,
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

  // Atualiza mensagem de boas-vindas se rota mudar e o chat estiver limpo
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === "msg_welcome") {
      setMessages([
        {
          id: "msg_welcome",
          role: "assistant",
          content: saudacaoContextual,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [saudacaoContextual]);


  const abortControllerRef = useRef<AbortController | null>(null);

  // Hook de reconhecimento de voz
  const {
    voiceStatus,
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    cancelListening,
  } = useJessiVoice((textoFinal) => {
    if (textoFinal.trim()) {
      setInputText(textoFinal);
    }
  });

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
    setStatus("interpretando");
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

  const handleConfirmAction = async (pendingAction: JessiPendingAction) => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus("executando");
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
                  <JessiStatusIndicator status={status} detalhe={statusDetalhe} />
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

            {/* Barra de Contexto da Rota Ativa */}
            <div className="bg-emerald-950/10 px-4 py-1.5 border-b border-border/50 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-emerald-900 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
                <span className="text-[11px]">Contexto: <strong className="text-foreground">{moduloNome}</strong></span>
              </div>
              <span className="text-[10px] text-muted-foreground">Sugestões em tempo real</span>
            </div>

            {/* Corpo Conversacional Interativo com Cards */}
            <JessiChat
              messages={messages}
              onSendMessage={handleSendMessage}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
              isLoading={isLoading}
            />

            {/* Pílulas de Sugestões Rápidas Contextuais */}
            <div className="px-3 py-2 bg-muted/30 border-t border-border/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider shrink-0 pl-1">
                Sugestões:
              </span>
              {sugestoesContextuais.map((sug, idx) => {
                const Icon = sug.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(sug.command)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background hover:bg-emerald-50 hover:border-emerald-600/50 border border-border/80 text-[11px] font-medium text-foreground whitespace-nowrap transition-all shadow-2xs group shrink-0"
                  >
                    <Icon className="h-3 w-3 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span>{sug.label}</span>
                  </button>
                );
              })}
            </div>

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

