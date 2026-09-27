import React, { useState } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Loader2,
  Clock,
  RefreshCw,
  Zap,
  Bell,
  Copy,
  CheckCircle2,
  DollarSign,
  Crown,
  Heart,
  MessageSquareText,
  Sparkle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { toast } from "sonner";

interface JessiInboxPanelProps {
  kpis?: {
    nao_lidas?: number;
    aguardando_resposta?: number;
    hoje?: number;
    minhas?: number;
  };
  clienteSelecionado?: {
    id: string;
    nome: string;
    pets?: Array<{ id: string; nome: string; raca?: string }>;
  } | null;
  onInserirNoChat?: (texto: string) => void;
  onFiltrarAguardando?: () => void;
  onFiltrarNaoLidas?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const JessiInboxPanel: React.FC<JessiInboxPanelProps> = ({
  kpis,
  clienteSelecionado,
  onInserirNoChat,
  onFiltrarAguardando,
  onFiltrarNaoLidas,
  onRefresh,
  isRefreshing,
}) => {
  const processarMensagemFn = useServerFn(processarMensagemJessi);

  const [inputMsg, setInputMsg] = useState("");
  const [respostaJessi, setRespostaJessi] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>(
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  // Hook de reconhecimento de voz
  const { isListening, startListening, stopListening } = useJessiVoice((textoTranscrito) => {
    if (textoTranscrito.trim()) {
      setInputMsg(textoTranscrito);
    }
  });

  const handlePerguntar = async (textoPersonalizado?: string) => {
    const query = textoPersonalizado || inputMsg;
    if (!query.trim()) return;

    setIsLoading(true);
    setRespostaJessi(null);

    try {
      const res = await processarMensagemFn({
        data: {
          mensagem: query,
          contexto: {
            origem: "central_mensagens_inbox",
            kpisInbox: kpis,
            clienteId: clienteSelecionado?.id,
            clienteNome: clienteSelecionado?.nome,
            pets: clienteSelecionado?.pets,
          },
        },
      });

      setRespostaJessi(res.respostaTexto);
      setInputMsg("");
      setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Erro ao consultar a Jessi na Central de Mensagens:", err);
      toast.error("Não foi possível processar a consulta.");
      setRespostaJessi(
        "Tive uma dificuldade temporária ao consultar as mensagens. Por favor, tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const naoLidas = kpis?.nao_lidas ?? 0;
  const aguardando = kpis?.aguardando_resposta ?? 0;

  const nomePetFoco = clienteSelecionado?.pets?.[0]?.nome;
  const nomeClienteFoco = clienteSelecionado?.nome?.split(" ")[0];

  return (
    <div className="space-y-3 my-1 animate-in fade-in duration-300">
      {/* Box Premium da Jessi */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F3622] via-[#164B30] to-[#0A2618] text-white p-4 md:p-5 shadow-sm border border-[#C8A951]/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs shrink-0">
              <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-base text-white tracking-tight">
                  Jessi · Copiloto de Atendimento & Conversão
                </span>
                <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2 font-medium">
                  IA Generativa Gemini 1.5
                </Badge>
                {clienteSelecionado && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px]">
                    Foco: {nomeClienteFoco} {nomePetFoco ? `(${nomePetFoco})` : ""}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Raciocínio operacional completo: histórico de banhos, tabela de serviços, planos do Clubinho e respostas sob medida
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="text-xs text-white/90 hover:bg-white/10 hover:text-white h-8 gap-1.5 rounded-lg"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </Button>
            )}
          </div>
        </div>

        {/* Chips Inteligentes de Prompt com 1 Clique */}
        <div className="flex flex-wrap gap-1.5 items-center mb-3">
          <span className="text-[11px] text-white/70 font-semibold mr-1">Sugestões Rápidas:</span>

          {clienteSelecionado ? (
            <>
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  handlePerguntar(
                    `Redija uma mensagem carinhosa para ${clienteSelecionado.nome} convidando para o banho do ${nomePetFoco || "pet"} nesta semana.`
                  )
                }
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1 shadow-2xs"
              >
                <Heart className="h-3 w-3 text-[#C8A951]" />
                Convidar p/ Banho
              </Button>

              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  handlePerguntar(
                    `Quais são os argumentos de economia e benefícios para oferecer o plano do Clubinho para ${clienteSelecionado.nome} e o pet ${nomePetFoco || "pet"}?`
                  )
                }
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1 shadow-2xs"
              >
                <Crown className="h-3 w-3 text-purple-300" />
                Argumentos Clubinho
              </Button>

              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  handlePerguntar(
                    `Qual o histórico recente de atendimentos e serviços do cliente ${clienteSelecionado.nome} e seu pet ${nomePetFoco || ""}?`
                  )
                }
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1 shadow-2xs"
              >
                <MessageSquareText className="h-3 w-3 text-blue-300" />
                Histórico do Pet
              </Button>
            </>
          ) : (
            <>
              <Button
                size="xs"
                variant="outline"
                onClick={() => handlePerguntar("Jessi, quem são os clientes que estão aguardando retorno no momento?")}
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1 shadow-2xs"
              >
                <Clock className="h-3 w-3 text-amber-300" />
                Quem espera retorno?
              </Button>

              <Button
                size="xs"
                variant="outline"
                onClick={() => handlePerguntar("Jessi, quais são os preços oficiais de Banho, Tosa e Hidratação no Spa?")}
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1 shadow-2xs"
              >
                <DollarSign className="h-3 w-3 text-emerald-300" />
                Tabela de Preços
              </Button>

              <Button
                size="xs"
                variant="outline"
                onClick={() => handlePerguntar("Jessi, como funciona o plano do Clubinho e quais os benefícios?")}
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1 shadow-2xs"
              >
                <Crown className="h-3 w-3 text-purple-300" />
                Como funciona o Clubinho?
              </Button>
            </>
          )}

          {aguardando > 0 && onFiltrarAguardando && (
            <Button
              size="xs"
              variant="outline"
              onClick={onFiltrarAguardando}
              className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/40 rounded-lg gap-1 shadow-2xs ml-auto"
            >
              <Clock className="h-3 w-3 text-amber-300" />
              Aguardando ({aguardando})
            </Button>
          )}
        </div>

        {/* Resposta Gerada pela IA Jessi */}
        {respostaJessi && (
          <div className="p-4 rounded-xl bg-background text-foreground border border-[#C8A951]/40 text-xs shadow-md animate-in fade-in space-y-2 mb-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <div className="flex items-center gap-2 font-bold text-primary">
                <Sparkles className="h-4 w-4 text-[#C8A951]" />
                <span>Resposta da Jessi:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(respostaJessi);
                    toast.success("Texto copiado para a área de transferência!");
                  }}
                  className="h-6 text-[10px] gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
                {onInserirNoChat && (
                  <Button
                    size="xs"
                    onClick={() => {
                      onInserirNoChat(respostaJessi);
                      toast.success("Texto inserido no campo de resposta do WhatsApp!");
                    }}
                    className="h-6 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
                  >
                    <Send className="h-3 w-3" /> Inserir no Chat
                  </Button>
                )}
              </div>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-[12px]">{respostaJessi}</p>
          </div>
        )}

        {/* Campo de Interação por Texto e Voz */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              placeholder={
                clienteSelecionado
                  ? `Pergunte à Jessi sobre ${clienteSelecionado.nome}, valores, serviços ou peça para redigir uma mensagem...`
                  : "Pergunte à Jessi sobre mensagens, clientes, preços de serviços ou peça para redigir..."
              }
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePerguntar()}
              className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 text-xs focus:bg-white/20 focus:border-[#C8A951] rounded-xl pr-9"
            />
            <button
              type="button"
              onClick={() => (isListening ? stopListening() : startListening())}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-white/70 hover:text-white"
              }`}
              title={isListening ? "Parar de ouvir" : "Falar com a Jessi por voz (Modo Bancada)"}
            >
              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => handlePerguntar()}
            disabled={isLoading || !inputMsg.trim()}
            className="h-9 px-3.5 bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold text-xs rounded-xl shadow-xs shrink-0"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
