import React from "react";
import {
  Sparkles,
  TrendingUp,
  Clock,
  Heart,
  Gift,
  Zap,
  Repeat,
  Crown,
  CheckCircle2,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface JessiLembretesCopilotProps {
  totalCicloRetorno?: number;
  potencialFaturamento?: number;
  totalAmanha?: number;
  totalPosHoje?: number;
  totalClubinho?: number;
  totalAniversariantes?: number;
  onSelectTab?: (tab: string) => void;
}

export const JessiLembretesCopilot: React.FC<JessiLembretesCopilotProps> = ({
  totalCicloRetorno = 0,
  potencialFaturamento = 0,
  totalAmanha = 0,
  totalPosHoje = 0,
  totalClubinho = 0,
  totalAniversariantes = 0,
  onSelectTab,
}) => {
  const formatarMoeda = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Mensagem dinâmica orientada a negócios
  let briefingTexto = "";
  if (totalCicloRetorno > 0 && totalAmanha === 0) {
    briefingTexto = `Sua grade de amanhã está com horários livres. Aproveite para disparar os ${totalCicloRetorno} lembretes de ciclo de retorno e resgatar até ${formatarMoeda(potencialFaturamento)} em faturamento!`;
  } else if (totalCicloRetorno > 0) {
    briefingTexto = `Identifiquei ${totalCicloRetorno} pets no ciclo ideal de banho (potencial de ${formatarMoeda(potencialFaturamento)}) e ${totalAmanha} confirmações de véspera para amanhã.`;
  } else if (totalAmanha > 0) {
    briefingTexto = `Você tem ${totalAmanha} agendamento(s) para amanhã prontos para confirmação de horário e Leva & Traz no WhatsApp.`;
  } else {
    briefingTexto = `Central de Lembretes 100% sincronizada com a grade do Spa. Monitore o ciclo dos pets e envie mensagens com 1 clique.`;
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0F3622] via-[#164B30] to-[#0A2618] text-white p-4 md:p-5 shadow-md border border-[#C8A951]/40 mb-6 animate-in fade-in transition-all">
      {/* Cabeçalho do Copiloto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/50 flex items-center justify-center text-[#F5E6BE] shadow-sm shrink-0">
            <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-sm md:text-base text-white">
                Cockpit de Lembretes & Retorno Inteligente · Jessi IA
              </span>
              <Badge className="bg-[#C8A951]/25 text-[#F5E6BE] border-[#C8A951]/40 text-[10px] py-0 px-2 font-medium">
                Preditivo em Tempo Real
              </Badge>
            </div>
            <p className="text-[11px] md:text-xs text-white/70 mt-0.5">
              Engajamento ativo, resgate de ciclo de banho e confirmações inteligentes de agenda
            </p>
          </div>
        </div>

        {/* Badge de Potencial Financeiro */}
        {potencialFaturamento > 0 && (
          <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/30 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-semibold block">
                Potencial de Retorno
              </span>
              <span className="text-xs font-bold text-emerald-200">
                + {formatarMoeda(potencialFaturamento)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Métricas de Ação com Botões de Acesso Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3 text-xs">
        {/* Card 1: Ciclo de Retorno */}
        <div
          onClick={() => onSelectTab?.("ciclo")}
          className="p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-emerald-500/30 backdrop-blur-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-emerald-300/80 font-medium">Ciclo de Retorno</span>
            <Repeat className="h-3.5 w-3.5 text-emerald-400 group-hover:rotate-45 transition-transform" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base md:text-lg font-bold text-emerald-300">
              {totalCicloRetorno}
            </span>
            <span className="text-[10px] text-emerald-200/70 font-semibold flex items-center gap-0.5">
              Resgatar <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* Card 2: Lembretes 24h */}
        <div
          onClick={() => onSelectTab?.("amanha")}
          className="p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-blue-500/30 backdrop-blur-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-blue-300/80 font-medium">Véspera (24h)</span>
            <Clock className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base md:text-lg font-bold text-blue-300">
              {totalAmanha}
            </span>
            <span className="text-[10px] text-blue-200/70 font-semibold flex items-center gap-0.5">
              Confirmar <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* Card 3: Pós-Atendimento & Pré-Agendamento */}
        <div
          onClick={() => onSelectTab?.("pos")}
          className="p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-[#C8A951]/30 backdrop-blur-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#F5E6BE]/80 font-medium">Pós-Atendimento</span>
            <Heart className="h-3.5 w-3.5 text-[#C8A951]" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base md:text-lg font-bold text-[#F5E6BE]">
              {totalPosHoje}
            </span>
            <span className="text-[10px] text-[#F5E6BE]/70 font-semibold flex items-center gap-0.5">
              Encantar <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* Card 4: Clubinho & Planos */}
        <div
          onClick={() => onSelectTab?.("clubinho")}
          className="p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-purple-500/30 backdrop-blur-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-purple-300/80 font-medium">Clubinho Ativo</span>
            <Crown className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base md:text-lg font-bold text-purple-300">
              {totalClubinho}
            </span>
            <span className="text-[10px] text-purple-200/70 font-semibold flex items-center gap-0.5">
              Lembrar <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Briefing Dinâmico de Negócios da Jessi */}
      <div className="p-3 rounded-xl bg-black/35 border border-[#C8A951]/35 flex items-start sm:items-center gap-2.5 text-xs text-white/90">
        <div className="h-5 w-5 rounded-full bg-[#C8A951]/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
          <Zap className="h-3.5 w-3.5 text-[#C8A951]" />
        </div>
        <p className="leading-relaxed text-[11px] md:text-xs text-white/85">
          <strong className="text-[#F5E6BE] font-semibold">Insight da Jessi:</strong>{" "}
          {briefingTexto}
        </p>
      </div>
    </div>
  );
};
