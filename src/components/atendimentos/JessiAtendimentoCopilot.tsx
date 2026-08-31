import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  HeartHandshake,
  Plus,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface JessiAtendimentoCopilotProps {
  petNome: string;
  raca?: string | null;
  porte?: string | null;
  alergias?: string | null;
  temperamento?: string | null;
  observacoesAnteriores?: string | null;
  possuiClubinho?: boolean;
  creditosDisponiveis?: number;
  servicosJaAdicionados?: string[];
  onAdicionarServico?: (nomeServico: string, valorSugerido: number) => void;
}

export const JessiAtendimentoCopilot: React.FC<JessiAtendimentoCopilotProps> = ({
  petNome,
  raca = "—",
  porte = "—",
  alergias,
  temperamento,
  observacoesAnteriores,
  possuiClubinho = false,
  creditosDisponiveis = 0,
  servicosJaAdicionados = [],
  onAdicionarServico,
}) => {
  const [expandido, setExpandido] = useState(true);

  // Sugestões inteligentes da Jessi baseadas em raça/porte/temperamento
  const racaLower = (raca || "").toLowerCase();
  const porteLower = (porte || "").toLowerCase();

  const sugestoes: { id: string; nome: string; motivo: string; valor: number }[] = [];

  if (
    racaLower.includes("poodle") ||
    racaLower.includes("shih tzu") ||
    racaLower.includes("maltes") ||
    racaLower.includes("golden") ||
    racaLower.includes("spitz") ||
    racaLower.includes("yorkshire")
  ) {
    if (!servicosJaAdicionados.some((s) => s.toLowerCase().includes("hidratação") || s.toLowerCase().includes("hidratacao"))) {
      sugestoes.push({
        id: "sug_hidra",
        nome: "Hidratação Profunda / Desembaraço",
        motivo: `Pelagem longa/fina típica de ${raca} se beneficia de hidratação para evitar nós.`,
        valor: 35,
      });
    }
  }

  if (!servicosJaAdicionados.some((s) => s.toLowerCase().includes("dente") || s.toLowerCase().includes("bucal") || s.toLowerCase().includes("escovação"))) {
    sugestoes.push({
      id: "sug_bucal",
      nome: "Higiene Bucal com Enxaguante Pet",
      motivo: "Prevenção de tártaro e hálito fresco para o pós-banho.",
      valor: 20,
    });
  }

  if (porteLower.includes("grande") || porteLower.includes("gigante")) {
    if (!servicosJaAdicionados.some((s) => s.toLowerCase().includes("corte de unha") || s.toLowerCase().includes("unha"))) {
      sugestoes.push({
        id: "sug_unha",
        nome: "Corte e Lixamento de Unhas",
        motivo: "Maior conforto na pisada para cães de grande porte.",
        valor: 15,
      });
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-4 w-4 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Copiloto Jessi · Atendimento de {petNome}
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                IA em Tempo Real
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Parecer comportamental, alertas de segurança e sugestões de protocolos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title={expandido ? "Recolher" : "Expandir"}
        >
          {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expandido && (
        <div className="space-y-3 pt-1 text-xs">
          {/* Grid de Alertas Rápidos de Saúde e Comportamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Temperamento</span>
              <span className="font-semibold text-white flex items-center gap-1.5">
                <HeartHandshake className="h-3.5 w-3.5 text-[#C8A951]" />
                {temperamento || "Dócil e tranquilo"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Alergias / Sensibilidade</span>
              <span className={`font-semibold flex items-center gap-1.5 ${alergias ? "text-amber-300" : "text-emerald-300"}`}>
                <ShieldAlert className="h-3.5 w-3.5" />
                {alergias || "Nenhuma registrada"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-white/60 block mb-0.5">Status do Clubinho</span>
              <span className="font-semibold text-[#F5E6BE] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
                {possuiClubinho ? `${creditosDisponiveis} crédito(s) disponível(is)` : "Sem plano ativo"}
              </span>
            </div>
          </div>

          {/* Observações de Atendimentos Anteriores */}
          {observacoesAnteriores && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-100 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-[11px] text-amber-200">Histórico de cuidados de {petNome}:</span>
                <p className="text-[11px] leading-relaxed text-amber-100/90">{observacoesAnteriores}</p>
              </div>
            </div>
          )}

          {/* Sugestões Fundamentadas com Revisão Humana */}
          {sugestoes.length > 0 && onAdicionarServico && (
            <div className="p-3 rounded-xl bg-black/30 border border-[#C8A951]/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#F5E6BE] flex items-center gap-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5 text-[#C8A951]" />
                  Sugestões da Jessi para este atendimento:
                </span>
                <span className="text-[10px] text-white/60">Revisão e aprovação humana necessária</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sugestoes.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-2.5 rounded-lg bg-white/10 border border-white/10 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-white text-xs">{sug.nome}</span>
                        <span className="font-bold text-[#C8A951] text-xs">
                          {sug.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/70 mt-0.5 leading-snug">{sug.motivo}</p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        onAdicionarServico(sug.nome, sug.valor);
                        toast.success(`${sug.nome} adicionado ao atendimento!`);
                      }}
                      className="h-7 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-md gap-1 w-full shadow-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar Serviço
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
