import React from "react";
import {
  Sparkles,
  Calendar,
  Heart,
  Gift,
  Send,
  MessageCircle,
  Clock,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface JessiLembretesCopilotProps {
  totalAmanha: number;
  totalPosHoje: number;
  totalAniversariantes: number;
  onDispararTodos?: () => void;
}

export const JessiLembretesCopilot: React.FC<JessiLembretesCopilotProps> = ({
  totalAmanha = 0,
  totalPosHoje = 0,
  totalAniversariantes = 0,
}) => {
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
                Central Ativa de Comunicação & Lembretes · Jessi
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Conectado à Agenda
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Lembretes de 24h, pós-atendimento de hoje e aniversários prontos para envio no WhatsApp
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1 text-xs">
        {/* Grid de Destaques de Comunicação */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/60 block mb-0.5">Lembretes para Amanhã</span>
              <span className="font-bold text-emerald-300 text-sm flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {totalAmanha} agendamento(s)
              </span>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">
              Confirmar Horários
            </Badge>
          </div>

          <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/60 block mb-0.5">Pós-Atendimento de Hoje</span>
              <span className="font-bold text-[#F5E6BE] text-sm flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-[#C8A951]" />
                {totalPosHoje} pet(s) atendidos
              </span>
            </div>
            <Badge className="bg-[#C8A951]/20 text-[#F5E6BE] border-0 text-[10px]">
              Encantar Tutor
            </Badge>
          </div>

          <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/60 block mb-0.5">Aniversários da Semana</span>
              <span className="font-bold text-pink-300 text-sm flex items-center gap-1">
                <Gift className="h-3.5 w-3.5" />
                {totalAniversariantes} aniversariante(s)
              </span>
            </div>
            <Badge className="bg-pink-500/20 text-pink-300 border-0 text-[10px]">
              Felicitações
            </Badge>
          </div>
        </div>

        {/* Parecer Narrado */}
        <div className="p-2.5 rounded-xl bg-black/30 border border-[#C8A951]/30 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#C8A951] shrink-0" />
          <p className="text-white/85 text-[11px] leading-relaxed">
            A Jessi sincronizou sua agenda em tempo real. Selecione uma das abas abaixo para disparar confirmações de horários e mensagens de carinho com 1 clique para o WhatsApp dos tutores.
          </p>
        </div>
      </div>
    </div>
  );
};
