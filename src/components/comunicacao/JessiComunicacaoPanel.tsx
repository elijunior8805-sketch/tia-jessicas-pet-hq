import React, { useState } from "react";
import { 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  ArrowRight,
  TrendingUp,
  RefreshCw,
  HandCoins,
  ShieldCheck,
  Zap,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { toast } from "sonner";

interface JessiComunicacaoPanelProps {
  kpis?: {
    aguardandoRevisao?: number;
    cobrancasVencidas?: number;
    valorVencido?: number;
    promessasHoje?: number;
    mensagensAgendadas?: number;
    enviadasHoje?: number;
    pagosAposCobranca?: number;
    clientesSemResposta?: number;
    precisamAtencaoHumana?: number;
  };
  onNavegarAba?: (aba: string) => void;
  onSelecionarClienteInbox?: (clienteId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const JessiComunicacaoPanel: React.FC<JessiComunicacaoPanelProps> = ({
  kpis,
  onNavegarAba,
  onSelecionarClienteInbox,
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
  const {
    isListening,
    startListening,
    stopListening,
  } = useJessiVoice((textoTranscrito) => {
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
            origem: "comunicacao_ia",
            kpisComunicacao: kpis,
          },
        },
      });

      setRespostaJessi(res.respostaTexto);
      setInputMsg("");
      setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Erro na comunicação com a Jessi:", err);
      toast.error("Não foi possível processar a consulta.");
      setRespostaJessi("Tive uma dificuldade temporária ao consultar os dados de comunicação. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const aguardando = kpis?.aguardandoRevisao ?? 0;
  const cobrancas = kpis?.cobrancasVencidas ?? 0;
  const valorVencido = kpis?.valorVencido ?? 0;
  const promessas = kpis?.promessasHoje ?? 0;
  const semResposta = kpis?.clientesSemResposta ?? 0;

  // Texto em linguagem natural gerado pela Jessi
  const resumoLinguagemNatural = `Existem ${aguardando} mensagem(ns) aguardando sua revisão e ${cobrancas} cobrança(s) vencida(s), totalizando R$ ${valorVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ${
    promessas > 0 ? `Temos ${promessas} promessa(s) com vencimento para hoje. ` : ""
  }${
    semResposta > 0 ? `${semResposta} cliente(s) continuam sem resposta há mais de 48h. ` : ""
  }Priorizei primeiro os clientes com maior atraso para você revisar.`;

  return (
    <div className="space-y-4 my-2">
      {/* 1. Painel Resumo da Jessi */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1B5E20] via-[#144718] to-[#0D3311] text-white p-5 md:p-6 shadow-md border border-[#C8A951]/30 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
              <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="font-display font-bold text-base text-white tracking-tight">
                  Resumo da Jessi · Relacionamento & Cobrança
                </span>
                <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px]">
                  IA V2 Conectada
                </Badge>
              </div>
              <p className="text-xs text-white/70">
                Sincronizado às {ultimaAtualizacao} • Análise orientada a dados reais
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
                className="text-xs text-white/90 hover:bg-white/10 hover:text-white h-8 gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Atualizar Análise</span>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm md:text-[15px] font-medium text-white/95 leading-relaxed">
            {resumoLinguagemNatural}
          </p>

          {/* Ações contextuais rápidas */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {aguardando > 0 && onNavegarAba && (
              <Button
                size="sm"
                onClick={() => onNavegarAba("fila")}
                className="h-8 px-3 text-xs bg-[#C8A951] hover:bg-[#B39340] text-emerald-950 font-bold rounded-xl shadow-xs gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Revisar ({aguardando})
              </Button>
            )}

            {cobrancas > 0 && onNavegarAba && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavegarAba("fila")}
                className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium rounded-xl gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> Ver Cobranças Prioritárias
              </Button>
            )}

            {promessas > 0 && onNavegarAba && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavegarAba("promessas")}
                className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium rounded-xl gap-1.5"
              >
                <HandCoins className="h-3.5 w-3.5 text-[#C8A951]" /> Conferir Promessas ({promessas})
              </Button>
            )}

            {onNavegarAba && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavegarAba("inbox")}
                className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium rounded-xl gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Abrir Inbox Inteligente
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Campo Interativo "Pergunte à Jessi" */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-display">
            <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
            <span>Pergunte à Jessi sobre clientes, cobranças, mensagens ou retornos:</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePerguntar();
                }
              }}
              placeholder="Ex.: Quais são as 5 cobranças mais antigas? / Quem prometeu pagar hoje?..."
              className="h-10 text-xs md:text-sm pr-10 rounded-xl bg-background"
            />
            <button
              type="button"
              onClick={isListening ? stopListening : () => startListening(inputMsg)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors ${
                isListening ? "text-red-600 animate-pulse bg-red-100/50" : ""
              }`}
              title={isListening ? "Parar gravação" : "Falar por voz"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>

          <Button
            onClick={() => handlePerguntar()}
            disabled={isLoading || !inputMsg.trim()}
            className="h-10 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-2xs gap-1.5"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Perguntar</span>
          </Button>
        </div>

        {/* Sugestões de Perguntas Rápidas */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] text-muted-foreground font-medium self-center mr-1">Sugestões:</span>
          {[
            "Quais são as 5 cobranças mais antigas?",
            "Quem prometeu pagar hoje?",
            "Quais clientes não responderam há +48h?",
            "Prepare os lembretes de amanhã",
            "Quem pagou depois da última cobrança?",
          ].map((sugestao, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePerguntar(sugestao)}
              className="px-2.5 py-1 rounded-lg border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-[11px] text-muted-foreground hover:text-foreground font-medium transition-all"
            >
              {sugestao}
            </button>
          ))}
        </div>

        {/* Resposta em Tempo Real da Jessi */}
        {respostaJessi && (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-foreground space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between font-semibold text-emerald-950">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-700" /> Resposta da Jessi:
              </span>
              <button
                type="button"
                onClick={() => setRespostaJessi(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {respostaJessi}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
