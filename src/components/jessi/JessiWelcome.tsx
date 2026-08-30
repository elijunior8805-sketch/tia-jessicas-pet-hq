import React from "react";
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  Car, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  ChevronRight, 
  CheckCircle2, 
  Gift, 
  Users, 
  ArrowRight,
  ShieldAlert,
  Sparkle
} from "lucide-react";
import { JessiProactiveCentral } from "@/lib/ia/jessi-proactive.server";
import { Button } from "@/components/ui/button";

interface JessiWelcomeProps {
  onQuickAction: (command: string) => void;
  centralData?: JessiProactiveCentral | null;
  isLoadingCentral?: boolean;
}

export const JessiWelcome: React.FC<JessiWelcomeProps> = ({
  onQuickAction,
  centralData,
  isLoadingCentral,
}) => {
  const hojeFormatado = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* 1. Header com Saudação Contextual da Jessi */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1B5E20] via-[#144718] to-[#0D3311] text-white p-5 md:p-7 shadow-lg border border-[#C8A951]/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
          <Sparkles className="w-64 h-64 text-[#C8A951]" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8A951]/20 text-[#F5E6BE] border border-[#C8A951]/40 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-[#C8A951] animate-pulse" />
            <span>Jessi · Central Operacional Inteligente</span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight leading-snug">
            {centralData?.saudacaoPersonalizada || `Olá, Eli. Preparei sua central operacional. Por onde você quer começar hoje?`}
          </h1>

          <p className="text-xs md:text-sm text-white/80 capitalize">
            {hojeFormatado} • Spa de Pet Tia Jéssica
          </p>
        </div>
      </div>

      {/* 2. Grid de 4 Blocos Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        
        {/* BLOCO 1: HOJE */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 md:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                <Calendar className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-sm text-foreground">Operação de Hoje</h2>
                <span className="text-[11px] text-muted-foreground">Atendimentos e logística</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onQuickAction("consultar agenda de hoje")}
              className="text-xs h-7 px-2.5 text-emerald-800 hover:bg-emerald-50 gap-1 font-semibold"
            >
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">Agendados</span>
              <span className="text-lg font-bold text-emerald-800">
                {centralData?.hoje.totalAgendamentos ?? "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">Leva e Traz</span>
              <span className="text-lg font-bold text-foreground">
                {centralData?.hoje.levaTrazCount ?? "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">Previsto</span>
              <span className="text-sm md:text-base font-bold text-emerald-700">
                {centralData?.hoje.faturamentoPrevisto
                  ? `R$ ${centralData.hoje.faturamentoPrevisto.toFixed(0)}`
                  : "R$ 0"}
              </span>
            </div>
          </div>

          {centralData?.hoje.proximoAtendimento ? (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 block">
                  Próximo Atendimento
                </span>
                <span className="font-bold text-foreground">
                  {centralData.hoje.proximoAtendimento.hora} — {centralData.hoje.proximoAtendimento.pet} ({centralData.hoje.proximoAtendimento.servico})
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Tutor: {centralData.hoje.proximoAtendimento.tutor}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onQuickAction(`Localize o cliente ${centralData.hoje.proximoAtendimento?.tutor}`)}
                className="h-7 px-2.5 text-[11px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg"
              >
                Abrir Ficha
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground text-center">
              Nenhum agendamento pendente para hoje.
            </div>
          )}

          {/* Horários Livres */}
          {centralData?.hoje.horariosLivres && centralData.hoje.horariosLivres.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium block">
                Horários livres para encaixe hoje:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {centralData.hoje.horariosLivres.slice(0, 5).map((hora) => (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => onQuickAction(`Agendar horário hoje às ${hora}`)}
                    className="px-2 py-0.5 rounded-lg border border-border bg-background hover:bg-emerald-50 hover:border-emerald-600/40 text-[11px] font-semibold text-foreground transition-all"
                  >
                    {hora}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 2: AMANHÃ */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 md:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                <Clock className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-sm text-foreground">Rotina de Amanhã</h2>
                <span className="text-[11px] text-muted-foreground">Previsão e confirmações</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onQuickAction("consultar agenda de amanhã")}
              className="text-xs h-7 px-2.5 text-blue-800 hover:bg-blue-50 gap-1 font-semibold"
            >
              Ver amanhã <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">Agendados</span>
              <span className="text-lg font-bold text-foreground">
                {centralData?.amanha.totalAgendamentos ?? "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">1º Horário</span>
              <span className="text-sm md:text-base font-bold text-blue-800">
                {centralData?.amanha.primeiroHorario ?? "—"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">Leva e Traz</span>
              <span className="text-lg font-bold text-foreground">
                {centralData?.amanha.levaTrazCount ?? "—"}
              </span>
            </div>
          </div>

          {centralData?.amanha.naoConfirmados ? (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-amber-900 block">
                  {centralData.amanha.naoConfirmados} agendamento(s) sem confirmação
                </span>
                <span className="text-[11px] text-amber-800/80 block">
                  Dispare lembretes para garantir presença.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onQuickAction("preparar lembretes de confirmacao para amanha")}
                className="h-7 px-2.5 text-[11px] bg-amber-700 hover:bg-amber-800 text-white rounded-lg"
              >
                Lembrar
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground text-center">
              Nenhum conflito encontrado na agenda de amanhã.
            </div>
          )}

          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Horários vagos amanhã:</span>
            <span className="font-semibold text-foreground">
              {centralData?.amanha.horariosDisponiveisCount ?? 0} disponíveis
            </span>
          </div>
        </div>

        {/* BLOCO 3: PRECISA DE ATENÇÃO (ALERTAS REAIS) */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 md:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm text-foreground">Precisa de Atenção</h2>
              <span className="text-[11px] text-muted-foreground">Cobranças, créditos e divergências</span>
            </div>
          </div>

          <div className="space-y-2">
            {centralData?.precisaAtencao && centralData.precisaAtencao.length > 0 ? (
              centralData.precisaAtencao.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-amber-200/70 bg-amber-50/40 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">{item.titulo}</span>
                    <p className="text-[11px] text-muted-foreground">{item.descricao}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickAction(item.comando)}
                    className="h-7 px-2 text-[11px] border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg shrink-0 font-medium"
                  >
                    Resolver
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/50 text-xs text-emerald-800 text-center font-medium">
                Tudo em ordem! Nenhuma divergência ou pendência urgente no momento.
              </div>
            )}
          </div>
        </div>

        {/* BLOCO 4: OPORTUNIDADES */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 md:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
              <TrendingUp className="h-4 w-4 text-purple-700" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm text-foreground">Oportunidades</h2>
              <span className="text-[11px] text-muted-foreground">Reativação, renovações e encaixes</span>
            </div>
          </div>

          <div className="space-y-2">
            {centralData?.oportunidades && centralData.oportunidades.length > 0 ? (
              centralData.oportunidades.map((op) => (
                <div
                  key={op.id}
                  className="p-3 rounded-xl border border-purple-200/70 bg-purple-50/30 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">{op.titulo}</span>
                    <p className="text-[11px] text-muted-foreground">{op.descricao}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickAction(op.comando)}
                    className="h-7 px-2 text-[11px] border-purple-300 text-purple-900 hover:bg-purple-100 rounded-lg shrink-0 font-medium"
                  >
                    Aproveitar
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground text-center">
                Nenhuma oportunidade no momento.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. Atalhos Rápidos com Inteligência da Jessi */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 md:p-5 shadow-xs space-y-3">
        <span className="text-xs font-semibold text-foreground block font-display">
          Comandos Rápidos Operacionais:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onQuickAction("Localize o cliente Eli Júnior")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group"
          >
            <Users className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate">Buscar Eli Júnior</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction("Quais são os pets do Eli Júnior?")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group"
          >
            <Gift className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate">Pets do Eli Júnior</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction("consultar valores a receber")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group"
          >
            <DollarSign className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate">Contas a Receber</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction("consultar catalogo de programas")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group"
          >
            <Sparkles className="h-4 w-4 text-[#C8A951] shrink-0" />
            <span className="truncate">Programas & Banhos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
