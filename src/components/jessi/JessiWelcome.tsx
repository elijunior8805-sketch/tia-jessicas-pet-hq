import React, { useState } from "react";
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
  Sparkle,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  PhoneCall
} from "lucide-react";
import { JessiProactiveCentral } from "@/lib/ia/jessi-contracts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { JessiAudioBriefing } from "./JessiAudioBriefing";


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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hojeFormatado = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Mensagem copiada para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenWhatsApp = (url?: string, textFallback?: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (textFallback) {
      navigator.clipboard.writeText(textFallback);
      toast.info("Texto copiado! Adicione o telefone do cliente para abrir o WhatsApp.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-5xl mx-auto w-full">
      {/* 1. Header com Saudação Contextual da Jessi */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1B5E20] via-[#144718] to-[#0D3311] text-white p-4 sm:p-5 md:p-7 shadow-lg border border-[#C8A951]/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 sm:w-64 sm:h-64 text-[#C8A951]" />
        </div>

        <div className="relative z-10 space-y-2.5 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-[#C8A951]/20 text-[#F5E6BE] border border-[#C8A951]/40 text-[11px] sm:text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#C8A951] animate-pulse" />
            <span>Jessi V2 · Central Operacional Inteligente</span>
          </div>

          <h1 className="text-lg sm:text-xl md:text-2xl font-bold font-display tracking-tight leading-snug">
            {centralData?.saudacaoPersonalizada || `Olá, Eli. Preparei sua central operacional. Por onde você quer começar hoje?`}
          </h1>

          <p className="text-[11px] sm:text-xs md:text-sm text-white/80 capitalize">
            {hojeFormatado} • Spa de Pet Tia Jéssica
          </p>
        </div>
      </div>

      {/* 2. Briefing Executivo em Áudio (Podcast da Jessi) */}
      <JessiAudioBriefing centralData={centralData} />

      {/* 3. Grid de 4 Blocos Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-5">

        
        {/* BLOCO 1: HOJE */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs space-y-3.5 sm:space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 sm:pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-semibold text-xs sm:text-sm text-foreground truncate">Operação de Hoje</h2>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate block">Atendimentos e logística</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onQuickAction("consultar agenda de hoje")}
              className="text-[11px] sm:text-xs h-7 px-2 text-emerald-800 hover:bg-emerald-50 gap-1 font-semibold shrink-0"
            >
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/50 border border-border/50 min-w-0 overflow-hidden">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Agendados</span>
              <span className="text-base sm:text-lg font-bold text-emerald-800 block truncate">
                {centralData?.hoje.totalAgendamentos ?? "—"}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/50 border border-border/50 min-w-0 overflow-hidden">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Leva e Traz</span>
              <span className="text-base sm:text-lg font-bold text-foreground block truncate">
                {centralData?.hoje.levaTrazCount ?? "—"}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/50 border border-border/50 min-w-0 overflow-hidden">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Previsto</span>
              <span className="text-xs sm:text-sm md:text-base font-bold text-emerald-700 block truncate">
                {centralData?.hoje.faturamentoPrevisto
                  ? `R$ ${centralData.hoje.faturamentoPrevisto.toFixed(0)}`
                  : "R$ 0"}
              </span>
            </div>
          </div>

          {centralData?.hoje.proximoAtendimento ? (
            <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex items-center justify-between gap-2 text-xs min-w-0">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-emerald-800 block truncate">
                  Próximo Atendimento
                </span>
                <span className="font-bold text-foreground block truncate text-xs sm:text-sm">
                  {centralData.hoje.proximoAtendimento.hora} — {centralData.hoje.proximoAtendimento.pet} ({centralData.hoje.proximoAtendimento.servico})
                </span>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">
                  Tutor: {centralData.hoje.proximoAtendimento.tutor}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => onQuickAction(`Localize o cliente ${centralData.hoje.proximoAtendimento?.tutor}`)}
                className="h-7 px-2 text-[11px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg shrink-0"
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
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium block">
                Horários livres para encaixe hoje:
              </span>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {centralData.hoje.horariosLivres.slice(0, 5).map((hora) => (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => onQuickAction(`Agendar horário hoje às ${hora}`)}
                    className="px-2 py-0.5 rounded-lg border border-border bg-background hover:bg-emerald-50 hover:border-emerald-600/40 text-[10px] sm:text-[11px] font-semibold text-foreground transition-all"
                  >
                    {hora}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 2: AMANHÃ COM LEMBRETES DIRETOS */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs space-y-3.5 sm:space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 sm:pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-semibold text-xs sm:text-sm text-foreground truncate">Rotina de Amanhã</h2>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate block">Previsão e confirmações</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onQuickAction("consultar agenda de amanhã")}
              className="text-[11px] sm:text-xs h-7 px-2 text-blue-800 hover:bg-blue-50 gap-1 font-semibold shrink-0"
            >
              Ver amanhã <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/50 border border-border/50 min-w-0 overflow-hidden">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Agendados</span>
              <span className="text-base sm:text-lg font-bold text-foreground block truncate">
                {centralData?.amanha.totalAgendamentos ?? "—"}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/50 border border-border/50 min-w-0 overflow-hidden">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">1º Horário</span>
              <span className="text-xs sm:text-sm md:text-base font-bold text-blue-800 block truncate">
                {centralData?.amanha.primeiroHorario ?? "—"}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-muted/50 border border-border/50 min-w-0 overflow-hidden">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Leva e Traz</span>
              <span className="text-base sm:text-lg font-bold text-foreground block truncate">
                {centralData?.amanha.levaTrazCount ?? "—"}
              </span>
            </div>
          </div>

          {centralData?.amanha.agendamentosNaoConfirmados && centralData.amanha.agendamentosNaoConfirmados.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60">
                <span>{centralData.amanha.agendamentosNaoConfirmados.length} agendamento(s) sem confirmação:</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onQuickAction("preparar lembretes de confirmacao para amanha")}
                  className="h-6 px-2 text-[10px] text-amber-900 hover:bg-amber-100 font-bold"
                >
                  Lembrar Todos
                </Button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {centralData.amanha.agendamentosNaoConfirmados.slice(0, 3).map((ag) => (
                  <div
                    key={ag.id}
                    className="p-2 rounded-xl bg-background border border-border flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate min-w-0">
                      <span className="font-semibold text-foreground truncate block">{ag.hora} — {ag.petNome}</span>
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">Tutor: {ag.clienteNome}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMessage(ag.id, ag.mensagemWhatsapp || "")}
                        className="h-6 w-6 p-0 rounded-md border-border text-muted-foreground hover:text-foreground"
                        title="Copiar mensagem"
                      >
                        {copiedId === ag.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenWhatsApp(ag.whatsappUrl, ag.mensagemWhatsapp)}
                        className="h-6 px-2 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-md gap-1 font-medium"
                      >
                        <MessageSquare className="h-3 w-3" /> WhatsApp
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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

        {/* BLOCO 3: PRECISA DE ATENÇÃO (COM DISPARO DE COBRANÇA E RESOLUÇÃO) */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs space-y-3 min-w-0">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2.5 sm:pb-3">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-semibold text-xs sm:text-sm text-foreground truncate">Precisa de Atenção</h2>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate block">Cobranças, créditos e pendências</span>
            </div>
          </div>

          <div className="space-y-2">
            {centralData?.precisaAtencao && centralData.precisaAtencao.length > 0 ? (
              centralData.precisaAtencao.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 sm:p-3 rounded-xl border border-amber-200/70 bg-amber-50/40 space-y-2 text-xs min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-foreground block truncate text-xs sm:text-sm">{item.titulo}</span>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2">{item.descricao}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuickAction(item.comando)}
                      className="h-6 px-2 text-[11px] border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg shrink-0 font-medium"
                    >
                      Resolver
                    </Button>
                  </div>

                  {/* Detalhes de cobranças individuais se houver */}
                  {item.detalhes && item.detalhes.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-amber-200/60">
                      {item.detalhes.slice(0, 2).map((det) => (
                        <div key={det.id} className="flex items-center justify-between p-1.5 rounded-lg bg-background/80 border border-amber-100 text-[11px]">
                          <span className="font-medium text-foreground truncate max-w-[140px]">
                            {det.clienteNome} {det.valor ? `(R$ ${det.valor.toFixed(2)})` : ""}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyMessage(det.id, det.mensagemWhatsapp || "")}
                              className="h-5 w-5 p-0 text-muted-foreground"
                              title="Copiar mensagem Pix"
                            >
                              {copiedId === det.id ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleOpenWhatsApp(det.whatsappUrl, det.mensagemWhatsapp)}
                              className="h-5 px-1.5 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white rounded gap-1"
                            >
                              <MessageSquare className="h-2.5 w-2.5" /> Cobrar Pix
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 sm:p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/50 text-xs text-emerald-800 text-center font-medium">
                Tudo em ordem! Nenhuma divergência ou pendência urgente no momento.
              </div>
            )}
          </div>
        </div>

        {/* BLOCO 4: OPORTUNIDADES & REATIVAÇÃO EM 1 CLIQUE */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs space-y-3 min-w-0">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2.5 sm:pb-3">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-semibold text-xs sm:text-sm text-foreground truncate">Oportunidades & Vendas</h2>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate block">Reativação, renovações e encaixes</span>
            </div>
          </div>

          <div className="space-y-2">
            {centralData?.oportunidades && centralData.oportunidades.length > 0 ? (
              centralData.oportunidades.map((op) => (
                <div
                  key={op.id}
                  className="p-2.5 sm:p-3 rounded-xl border border-purple-200/70 bg-purple-50/30 space-y-2 text-xs min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-foreground block truncate text-xs sm:text-sm">{op.titulo}</span>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2">{op.descricao}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuickAction(op.comando)}
                      className="h-6 px-2 text-[11px] border-purple-300 text-purple-900 hover:bg-purple-100 rounded-lg shrink-0 font-medium"
                    >
                      Aproveitar
                    </Button>
                  </div>

                  {/* Sugestões de clientes para reativação nos horários vagos */}
                  {op.detalhes && op.detalhes.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-purple-200/60">
                      <span className="text-[10px] font-semibold text-purple-950 uppercase tracking-wider block">
                        Clientes sugeridos para encaixe:
                      </span>
                      {op.detalhes.slice(0, 2).map((cli) => (
                        <div key={cli.id} className="flex items-center justify-between p-1.5 rounded-lg bg-background/80 border border-purple-100 text-[11px]">
                          <span className="font-medium text-foreground truncate max-w-[130px]">
                            {cli.clienteNome} ({cli.petNome})
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleOpenWhatsApp(cli.whatsappUrl, cli.mensagemWhatsapp)}
                            className="h-5 px-1.5 text-[10px] bg-purple-700 hover:bg-purple-800 text-white rounded gap-1"
                          >
                            <MessageSquare className="h-2.5 w-2.5" /> Convidar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground text-center">
                Nenhuma oportunidade no momento.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. Atalhos Rápidos com Inteligência da Jessi */}
      <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs space-y-3 min-w-0">
        <span className="text-xs font-semibold text-foreground block font-display">
          Comandos Rápidos Operacionais:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onQuickAction("Quais os horários livres de hoje?")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group min-w-0"
          >
            <Clock className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate">Horários Livres Hoje</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction("Otimizar rotas do Leva e Traz")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group min-w-0"
          >
            <Car className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate">Rotas Leva & Traz</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction("Quem são os clientes sumidos?")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-purple-50/50 hover:border-purple-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group min-w-0"
          >
            <Users className="h-4 w-4 text-purple-700 shrink-0" />
            <span className="truncate">Reativar Clientes</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction("Como está o financeiro deste mês?")}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-background hover:bg-emerald-50/50 hover:border-emerald-600/40 text-left text-xs font-medium text-foreground transition-all shadow-2xs group min-w-0"
          >
            <DollarSign className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="truncate">Diagnóstico Financeiro</span>
          </button>
        </div>
      </div>
    </div>
  );
};
