import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Wallet,
  Coins,
  Receipt,
  Scale,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JessiFinanceiroCopilotProps {
  receitaBruta: number;
  totalRecebido: number;
  totalAReceber: number;
  despesas: number;
  vencidos: number;
  lucroEstimado: number;
  ticketMedio: number;
  qtdPendentes: number;
  periodoLabel: string;
}

export const JessiFinanceiroCopilot: React.FC<JessiFinanceiroCopilotProps> = ({
  receitaBruta = 0,
  totalRecebido = 0,
  totalAReceber = 0,
  despesas = 0,
  vencidos = 0,
  lucroEstimado = 0,
  ticketMedio = 0,
  qtdPendentes = 0,
  periodoLabel,
}) => {
  const [expandido, setExpandido] = useState(true);

  // Cálculos de diagnósticos
  const margemLucro = receitaBruta > 0 ? Math.round((lucroEstimado / receitaBruta) * 100) : 0;
  const taxaInadimplencia = totalRecebido + vencidos > 0 ? Math.round((vencidos / (totalRecebido + vencidos)) * 100) : 0;

  // Classificação de saúde financeira pela Jessi
  const isSaudeExcelente = margemLucro >= 60 && vencidos === 0;
  const isAlertaInadimplencia = vencidos > 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-4 w-4 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Copiloto Financeiro Estratégico · Jessi
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Análise do Período
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Diagnóstico de liquidez, margem de lucratividade e auditoria de pendências ({periodoLabel})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {vencidos > 0 && (
            <Link to="/cobrancas">
              <Button
                size="sm"
                className="h-7 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-lg gap-1.5 shadow-2xs"
              >
                <AlertTriangle className="h-3 w-3" />
                Cobrar Vencidos ({vencidos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={expandido ? "Recolher" : "Expandir"}
          >
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="space-y-3 pt-1 text-xs">
          {/* Grid de Métricas de Inteligência Financeira */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Margem Líquida Estimada</span>
              <span className="font-bold text-emerald-300 text-sm flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                {margemLucro}% de lucro
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Ticket Médio por Atendimento</span>
              <span className="font-bold text-[#F5E6BE] text-sm flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5 text-[#C8A951]" />
                {ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Risco de Inadimplência</span>
              <span className={`font-bold text-sm flex items-center gap-1 ${vencidos > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {taxaInadimplencia}% ({vencidos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Pendências a Realizar</span>
              <span className="font-bold text-white text-sm flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-[#C8A951]" />
                {qtdPendentes} fatura(s) em aberto
              </span>
            </div>
          </div>

          {/* Parecer Executivo Narrado */}
          <div className="p-3 rounded-xl bg-black/30 border border-[#C8A951]/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#F5E6BE] flex items-center gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5 text-[#C8A951]" />
                Parecer Executivo da Jessi:
              </span>
              <span className="text-[10px] text-white/60">Análise baseada no período filtrado</span>
            </div>

            <p className="text-white/85 text-[11.5px] leading-relaxed">
              {isAlertaInadimplencia
                ? `Você arrecadou ${totalRecebido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} no período, com despesas controladas em ${despesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Atenção: existem ${vencidos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em cobranças vencidas aguardando recuperação na Central de Cobranças para maximizar seu lucro líquido.`
                : `Excelente desempenho financeiro! O caixa efetivo está em ${totalRecebido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} com margem estimada de ${margemLucro}%. Todas as cobranças do período estão em dia sem inadimplência crítica.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
