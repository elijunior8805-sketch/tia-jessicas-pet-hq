import React from "react";
import { Sparkles, Calendar, Users, DollarSign, Gift, FileText, CheckCircle2 } from "lucide-react";
import { JESSI_CONFIG } from "@/lib/ia/jessi-config";

interface JessiWelcomeProps {
  onQuickAction: (command: string) => void;
  resumoDia?: {
    atendimentosHoje: number;
    faturamentoPrevisto: number;
    pendenciasRecebimento: number;
  };
}

export const JessiWelcome: React.FC<JessiWelcomeProps> = ({ onQuickAction, resumoDia }) => {
  const saudacao = JESSI_CONFIG.saudacao();
  const hojeFormatado = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const acoesRapidas = [
    { label: "Consultar agenda de hoje", cmd: "consultar agenda de hoje", icon: Calendar },
    { label: "Verificar faturamento do mês", cmd: "consultar faturamento do mês", icon: DollarSign },
    { label: "Programas de Cuidado ativos", cmd: "consultar catalogo de programas", icon: Gift },
    { label: "Contas a receber pendentes", cmd: "consultar valores a receber", icon: FileText },
    { label: "Buscar cliente ou pet", cmd: "buscar clientes", icon: Users },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-2xl mx-auto text-center space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/70 text-emerald-900 border border-emerald-300/60 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
          <span>Jessi · Assistente Operacional</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">
          {saudacao}
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground capitalize">
          Hoje é {hojeFormatado}
        </p>
      </div>

      {resumoDia && (
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full text-left">
          <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block">Agendados Hoje</span>
            <span className="text-lg font-bold text-emerald-700">
              {resumoDia.atendimentosHoje} atendimentos
            </span>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block">Faturamento Previsto</span>
            <span className="text-lg font-bold text-foreground">
              R$ {resumoDia.faturamentoPrevisto.toFixed(2)}
            </span>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block">Pendências</span>
            <span className="text-lg font-bold text-amber-600">
              {resumoDia.pendenciasRecebimento} registros
            </span>
          </div>
        </div>
      )}

      <div className="w-full space-y-2 text-left">
        <span className="text-xs font-semibold text-muted-foreground px-1">
          Ações Rápidas Disponíveis:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {acoesRapidas.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onQuickAction(item.cmd)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group"
              >
                <div className="p-1.5 rounded-lg bg-emerald-100/50 text-emerald-800 group-hover:bg-emerald-200/60 transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
