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
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  HandCoins,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { toast } from "sonner";

interface JessiCobrancasPanelProps {
  kpis?: {
    total_atraso: number;
    qtd_inadimplentes: number;
    vence_hoje: number;
    atraso_maior_7d: number;
    recuperado_mes: number;
    taxa_recuperacao: number;
  } | null;
  onFiltrarAtraso7d?: () => void;
  onFiltrarVenceHoje?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const JessiCobrancasPanel: React.FC<JessiCobrancasPanelProps> = ({
  kpis,
  onFiltrarAtraso7d,
  onFiltrarVenceHoje,
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

  // Reconhecimento de voz
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
            origem: "central_cobrancas",
            kpisCobranca: kpis,
          },
        },
      });

      setRespostaJessi(res.respostaTexto);
      setInputMsg("");
      setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Erro ao consultar a Jessi na Central de Cobrança:", err);
      toast.error("Não foi possível processar a consulta.");
      setRespostaJessi(
        "Tive uma dificuldade temporária ao analisar as cobranças. Por favor, tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const totalAtraso = kpis?.total_atraso ?? 0;
  const inadimplentes = kpis?.qtd_inadimplentes ?? 0;
  const venceHoje = kpis?.vence_hoje ?? 0;
  const atrasoCritico = kpis?.atraso_maior_7d ?? 0;
  const recuperado = kpis?.recuperado_mes ?? 0;
  const taxaRecuperacao = Math.round((kpis?.taxa_recuperacao ?? 0) * 100);

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const resumoLinguagemNatural =
    totalAtraso > 0
      ? `Temos ${inadimplentes} cliente(s) com débitos em atraso totalizando ${brl(totalAtraso)}. ${
          atrasoCritico > 0
            ? `Destes, ${brl(atrasoCritico)} estão com atraso superior a 7 dias e exigem atenção prioritária. `
            : ""
        }${
          venceHoje > 0 ? `Hoje temos ${venceHoje} cobrança(s) com vencimento programado. ` : ""
        }Neste mês já recuperamos ${brl(recuperado)} (${taxaRecuperacao}% de taxa de sucesso).`
      : `Excelente notícia! Todas as contas a receber estão em dia e não há inadimplência no momento. Neste mês já recuperamos ${brl(recuperado)}.`;

  return (
    <div className="space-y-3 my-1 animate-in fade-in duration-300">
      {/* Box Principal da Jessi */}
      <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 md:p-5 shadow-sm border border-[#C8A951]/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs shrink-0">
              <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="font-display font-bold text-base text-white tracking-tight">
                  Jessi · Inteligência de Recuperação e Cobrança
                </span>
                <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                  IA Ativa
                </Badge>
              </div>
              <p className="text-xs text-white/70">
                Sincronizado às {ultimaAtualizacao} • Monitoramento de régua, inadimplência e promessas de pagamento
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

        {/* Parecer Narrado pela Jessi */}
        <div className="p-3.5 rounded-xl bg-black/20 border border-white/10 text-xs md:text-sm text-white/95 leading-relaxed backdrop-blur-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-[#C8A951] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-[#F5E6BE]">Diagnóstico Financeiro da Jessi:</p>
              <p className="text-white/90 leading-snug">{resumoLinguagemNatural}</p>
            </div>
          </div>
        </div>

        {/* Chips de Ação Rápida */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-white/70 font-medium">Estratégias da Jessi:</span>
          {atrasoCritico > 0 && onFiltrarAtraso7d && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFiltrarAtraso7d}
              className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border-rose-400/30 rounded-lg gap-1.5 shadow-2xs"
            >
              <ShieldAlert className="h-3 w-3 text-rose-300" />
              Priorizar Atrasos &gt; 7 dias ({brl(atrasoCritico)})
            </Button>
          )}
          {venceHoje > 0 && onFiltrarVenceHoje && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFiltrarVenceHoje}
              className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-400/30 rounded-lg gap-1.5 shadow-2xs"
            >
              <CalendarClock className="h-3 w-3 text-amber-300" />
              Vencem Hoje ({venceHoje})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePerguntar("Jessi, quais são os clientes com maior valor em atraso?")}
            className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1.5 shadow-2xs"
          >
            <HandCoins className="h-3 w-3 text-[#C8A951]" />
            Maiores débitos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePerguntar("Jessi, qual é a melhor abordagem amigável para cobrar clientes do Clubinho?")}
            className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1.5 shadow-2xs"
          >
            <Zap className="h-3 w-3 text-[#C8A951]" />
            Dicas de abordagem cordial
          </Button>
        </div>

        {/* Resposta de Pergunta Personalizada */}
        {respostaJessi && (
          <div className="mt-3 p-3.5 rounded-xl bg-white text-zinc-900 border border-[#C8A951]/40 text-xs shadow-md animate-in fade-in space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#123F2A] border-b border-zinc-100 pb-1">
              <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
              <span>Orientação da Jessi:</span>
            </div>
            <p className="whitespace-pre-line text-zinc-800 leading-relaxed">{respostaJessi}</p>
          </div>
        )}

        {/* Campo de Interação por Texto e Voz */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Pergunte à Jessi sobre inadimplência, acordos ou sugestões de mensagem..."
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
              title={isListening ? "Parar de ouvir" : "Falar com a Jessi por voz"}
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
