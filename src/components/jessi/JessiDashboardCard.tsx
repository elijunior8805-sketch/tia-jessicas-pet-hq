import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Calendar, DollarSign, Gift, ArrowRight, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function JessiDashboardCard() {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<{
    agendamentosHoje: number;
    faturamentoPrevisto: number;
    pendenciasRecebimento: number;
    programasVencendo: number;
  }>({
    agendamentosHoje: 0,
    faturamentoPrevisto: 0,
    pendenciasRecebimento: 0,
    programasVencendo: 0,
  });

  useEffect(() => {
    async function carregarPanorama() {
      try {
        const hoje = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

        const [agendRes, pagamentosRes, progRes] = await Promise.all([
          supabase.from("agendamentos").select("id, status, servicos(preco)").eq("data", hoje),
          supabase.from("pagamentos").select("id, valor_total, valor_pago").in("status", ["pendente", "atrasado"]).is("arquivado_em", null),
          supabase.from("programas_contratados").select("id").eq("status_do_programa", "ativo"),
        ]);

        const faturamento = (agendRes.data || []).reduce(
          (acc: number, curr: any) => acc + Number(curr.servicos?.preco || 0),
          0
        );

        setResumo({
          agendamentosHoje: (agendRes.data || []).length,
          faturamentoPrevisto: faturamento,
          pendenciasRecebimento: (pagamentosRes.data || []).length,
          programasVencendo: (progRes.data || []).length,
        });
      } catch (err) {
        console.error("Erro ao carregar dados da Jessi:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarPanorama();
  }, []);

  return (
    <div className="rounded-2xl border border-emerald-800/20 bg-gradient-to-br from-[#1B5E20]/5 via-background to-[#C8A951]/10 p-4 sm:p-5 mb-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/10 pb-3.5 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="h-5 w-5 text-[#C8A951]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground font-display">
                Jessi · Inteligência Operacional do Spa
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Ativa em tempo real
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Monitorando agenda, financeiro, créditos de programas e comprovantes Pix
            </p>
          </div>
        </div>

        <Link to="/jessi">
          <Button
            size="sm"
            className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs h-9 px-4 gap-1.5 font-semibold rounded-xl shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
            Abrir Central da Jessi
            <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
            <Calendar className="h-3.5 w-3.5 text-emerald-700" /> Agenda Hoje
          </span>
          <span className="text-base font-bold text-foreground">
            {loading ? "..." : `${resumo.agendamentosHoje} agendamento(s)`}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-700" /> Faturamento Previsto
          </span>
          <span className="text-base font-bold text-emerald-800">
            {loading
              ? "..."
              : `R$ ${resumo.faturamentoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> A Receber / Pendências
          </span>
          <span className="text-base font-bold text-amber-600">
            {loading ? "..." : `${resumo.pendenciasRecebimento} registro(s)`}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
            <Gift className="h-3.5 w-3.5 text-[#C8A951]" /> Programas Ativos
          </span>
          <span className="text-base font-bold text-foreground">
            {loading ? "..." : `${resumo.programasVencendo} pacotes`}
          </span>
        </div>
      </div>
    </div>
  );
}
