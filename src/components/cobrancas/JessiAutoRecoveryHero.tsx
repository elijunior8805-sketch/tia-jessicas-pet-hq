import React, { useState } from "react";
import { Sparkles, Bot, Zap, Volume2, VolumeX, ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type CobrancasKPIs } from "@/lib/cobrancas.functions";

interface JessiAutoRecoveryHeroProps {
  kpis?: CobrancasKPIs;
  totalFila: number;
  onExecutarRegua: () => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export function JessiAutoRecoveryHero({
  kpis,
  totalFila,
  onExecutarRegua,
  onRefresh,
  isRefreshing = false,
}: JessiAutoRecoveryHeroProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const totalAtraso = kpis?.total_atraso ?? 0;
  const inadimplentes = kpis?.qtd_inadimplentes ?? 0;
  const recuperadoMes = kpis?.recuperado_mes ?? 0;
  const taxaRecuperacao = Math.round((kpis?.taxa_recuperacao ?? 0) * 100);

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const diagnosticoTexto = totalAtraso > 0
    ? `Identifiquei ${inadimplentes} tutores com pendências totalizando ${brl(totalAtraso)}. Minha régua autônoma já preparou mensagens personalizadas com Pix Copia e Cola para recuperação imediata.`
    : `Parabéns! Sua carteira está 100% equilibrada, sem débitos críticos pendentes na fila hoje.`;

  const handleToggleAudio = () => {
    if (!("speechSynthesis" in window)) {
      alert("Seu navegador não suporta síntese de voz.");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(diagnosticoTexto);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#C8A951]/40 bg-gradient-to-br from-[#123328] via-[#1a4a3b] to-[#0c241c] p-5 text-white shadow-xl">
      {/* Glow e Detalhes de Fundo */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#C8A951]/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Lado Esquerdo: Identidade do Agente IA & Diagnóstico */}
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full border border-[#C8A951]/50 bg-[#C8A951]/15 px-3 py-1 text-xs font-semibold text-[#F1E5C4] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-[#C8A951] animate-pulse" />
              <span>Jessi IA 2.0 • Piloto de Recuperação Ativa</span>
            </div>

            <Badge
              variant="outline"
              className="border-emerald-400/40 bg-emerald-500/15 text-[11px] font-medium text-emerald-200"
            >
              <ShieldCheck className="h-3 w-3 mr-1 text-emerald-300" />
              Sincronia Financeira em Tempo Real
            </Badge>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-[#C8A951] to-[#F1E5C4] text-[#123328] shadow-lg">
                <Bot className="h-7 w-7" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-[#123328]"></span>
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl font-display">
                Mesa Autônoma de Recuperação & Reativação
              </h2>
              <p className="mt-1 text-sm text-emerald-100/85 leading-relaxed">
                {diagnosticoTexto}
              </p>
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="rounded-lg bg-black/25 px-2.5 py-1 border border-white/10">
              <span className="text-emerald-300/80">Recuperado Mês: </span>
              <strong className="text-emerald-300 font-bold">{brl(recuperadoMes)}</strong>
            </div>
            <div className="rounded-lg bg-black/25 px-2.5 py-1 border border-white/10">
              <span className="text-amber-200/80">Taxa de Conversão: </span>
              <strong className="text-[#F1E5C4] font-bold">{taxaRecuperacao}%</strong>
            </div>
            <div className="rounded-lg bg-black/25 px-2.5 py-1 border border-white/10">
              <span className="text-emerald-200/80">Contatos Prontos na Fila: </span>
              <strong className="text-white font-bold">{totalFila}</strong>
            </div>

            <button
              onClick={handleToggleAudio}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 px-2.5 py-1 text-xs text-white/90 transition-all border border-white/10"
              title="Ouvir análise em áudio"
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-[#C8A951]" />
                  <span>Pausar voz</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-[#C8A951]" />
                  <span>Ouvir briefing</span>
                </>
              )}
            </button>

            {onRefresh && (
              <button
                onClick={() => onRefresh()}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 px-2 py-1 text-xs text-white/70 transition-all border border-white/5"
                title="Sincronizar com pagamentos"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin text-[#C8A951]" : ""}`} />
                <span>Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: Ação de Disparo em Lote / Piloto Automático */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
          <Button
            size="lg"
            onClick={onExecutarRegua}
            className="group relative overflow-hidden bg-gradient-to-r from-[#C8A951] via-[#d8bb66] to-[#C8A951] text-[#123328] font-bold text-sm shadow-xl hover:brightness-105 transition-all border border-[#F1E5C4]/40 h-12 px-5 rounded-xl cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 fill-current text-[#123328]" />
              <span>Executar Régua Inteligente do Dia</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Button>

          <span className="text-[11px] text-emerald-200/75 text-center lg:text-right">
            {totalFila > 0
              ? `Revisar & disparar WhatsApp para ${totalFila} tutores em 1 clique`
              : "Nenhuma pendência na régua hoje"}
          </span>
        </div>
      </div>
    </div>
  );
}
