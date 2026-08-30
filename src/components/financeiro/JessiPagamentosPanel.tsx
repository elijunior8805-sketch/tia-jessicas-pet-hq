import React, { useState } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  Users,
  RefreshCw,
  HandCoins,
  ShieldCheck,
  TrendingDown,
  Layers,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { useJessiVoice } from "@/lib/ia/useJessiVoice";
import { toast } from "sonner";

interface JessiPagamentosPanelProps {
  resumo?: {
    total_aberto?: number;
    qtd_aberto?: number;
    total_atrasado?: number;
    qtd_atrasado?: number;
    vence_hoje?: number;
    vence_7d?: number;
  };
  totalClientes?: number;
  clientesComMultiplosDebitos?: number;
  onFiltrarAtrasados?: () => void;
  onFiltrarMultiplosDebitos?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const JessiPagamentosPanel: React.FC<JessiPagamentosPanelProps> = ({
  resumo,
  totalClientes = 0,
  clientesComMultiplosDebitos = 0,
  onFiltrarAtrasados,
  onFiltrarMultiplosDebitos,
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
            origem: "pagamentos_abertos",
            resumoFinanceiro: resumo,
          },
        },
      });

      setRespostaJessi(res.respostaTexto);
      setInputMsg("");
      setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.error("Erro na comunicação com a Jessi:", err);
      toast.error("Não foi possível processar a consulta.");
      setRespostaJessi("Tive uma dificuldade temporária ao consultar os dados financeiros. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const totalAtrasado = resumo?.total_atrasado ?? 0;
  const qtdAtrasado = resumo?.qtd_atrasado ?? 0;
  const totalAberto = resumo?.total_aberto ?? 0;
  const venceHoje = resumo?.vence_hoje ?? 0;

  const resumoLinguagemNatural = `Eli, existem ${qtdAtrasado} parcela(s) atrasada(s), totalizando R$ ${totalAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (de um total em aberto de R$ ${totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}). ${
    venceHoje > 0 ? `Temos ${venceHoje} parcela(s) que vencem hoje. ` : ""
  }${
    clientesComMultiplosDebitos > 0
      ? `Identifiquei ${clientesComMultiplosDebitos} cliente(s) com mais de um pet ou serviço em aberto (podem ser consolidados). `
      : ""
  }Organizei a fila por prioridade para você revisar.`;

  return (
    <div className="space-y-4 my-2">
      {/* 1. Painel de Análise Proativa da Jessi */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1B5E20] via-[#144718] to-[#0D3311] text-white p-5 md:p-6 shadow-md border border-[#C8A951]/30 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
              <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="font-display font-bold text-base text-white tracking-tight">
                  Análise da Jessi · Gestão de Contas a Receber
                </span>
                <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px]">
                  IA V2 Conectada
                </Badge>
              </div>
              <p className="text-xs text-white/70">
                Sincronizado às {ultimaAtualizacao} • Consulta auditada em tempo real
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

          {/* Ações contextuais de 1 clique */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {qtdAtrasado > 0 && onFiltrarAtrasados && (
              <Button
                size="sm"
                onClick={onFiltrarAtrasados}
                className="h-8 px-3 text-xs bg-[#C8A951] hover:bg-[#B39340] text-emerald-950 font-bold rounded-xl shadow-xs gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Ver Atrasados ({qtdAtrasado})
              </Button>
            )}

            {clientesComMultiplosDebitos > 0 && onFiltrarMultiplosDebitos && (
              <Button
                size="sm"
                variant="outline"
                onClick={onFiltrarMultiplosDebitos}
                className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium rounded-xl gap-1.5"
              >
                <Layers className="h-3.5 w-3.5 text-[#F5E6BE]" /> Múltiplas Pendências ({clientesComMultiplosDebitos})
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePerguntar("Quem prometeu pagar hoje?")}
              className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium rounded-xl gap-1.5"
            >
              <HandCoins className="h-3.5 w-3.5 text-[#C8A951]" /> Conferir Promessas
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Campo "Pergunte à Jessi" */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-display">
            <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
            <span>Pergunte à Jessi sobre os pagamentos em aberto:</span>
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
              placeholder="Ex.: Quais cobranças são mais urgentes? / Quem prometeu pagar hoje? / Consolide as cobranças da Mayla..."
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
            "Quais cobranças são mais urgentes?",
            "Quem nunca recebeu mensagem?",
            "Quem prometeu pagar hoje?",
            "Quem não deve ser cobrado hoje?",
            "Quanto foi recuperado depois das cobranças?",
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
