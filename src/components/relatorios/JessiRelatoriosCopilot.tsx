import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Award,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Zap,
  ChevronDown,
  ChevronUp,
  Receipt,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JessiRelatoriosCopilotProps {
  faturamento: number;
  ticketMedio: number;
  atendimentosFinalizados: number;
  clientesAtendidos: number;
  novosClientes: number;
  aReceber: number;
  periodoStr: string;
  onExportCsv?: () => void;
}

export const JessiRelatoriosCopilot: React.FC<JessiRelatoriosCopilotProps> = ({
  faturamento = 0,
  ticketMedio = 0,
  atendimentosFinalizados = 0,
  clientesAtendidos = 0,
  novosClientes = 0,
  aReceber = 0,
  periodoStr,
  onExportCsv,
}) => {
  const [expandido, setExpandido] = useState(true);

  const mediaPorCliente = clientesAtendidos > 0 ? (atendimentosFinalizados / clientesAtendidos).toFixed(1) : "1.0";

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
                Inteligência Gerencial & Análise · Jessi
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Relatório Consolidado
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Desempenho operacional, faturamento consolidado e métricas da carteira ({periodoStr})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onExportCsv && (
            <Button
              size="sm"
              onClick={onExportCsv}
              className="h-7 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-lg gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
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
          {/* Grid de Destaques de Performance */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Faturamento Consolidado</span>
              <span className="font-bold text-emerald-300 text-sm flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                {faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Ticket Médio por Execução</span>
              <span className="font-bold text-[#F5E6BE] text-sm flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5 text-[#C8A951]" />
                {ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Novos Clientes Cadastrados</span>
              <span className="font-bold text-white text-sm flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-emerald-300" />
                {novosClientes} no período
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Frequência Média</span>
              <span className="font-bold text-white text-sm flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-[#C8A951]" />
                {mediaPorCliente} banhos / cliente
              </span>
            </div>
          </div>

          {/* Parecer Gerencial da IA */}
          <div className="p-3 rounded-xl bg-black/30 border border-[#C8A951]/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#F5E6BE] flex items-center gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5 text-[#C8A951]" />
                Parecer Gerencial da Jessi:
              </span>
              <span className="text-[10px] text-white/60">Base unificada com Dashboard e Financeiro</span>
            </div>

            <p className="text-white/85 text-[11.5px] leading-relaxed">
              No período analisado ({periodoStr}), foram finalizados {atendimentosFinalizados} atendimentos gerando{" "}
              {faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em receita bruta por competência, com {novosClientes} novos clientes adicionados à carteira. O ticket médio se manteve saudável em{" "}
              {ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
