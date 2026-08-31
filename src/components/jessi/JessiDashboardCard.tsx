import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Calendar,
  DollarSign,
  Gift,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function JessiDashboardCard() {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<{
    agendamentosHoje: number;
    faturamentoPrevisto: number;
    pendenciasRecebimento: number;
    programasVencendo: number;
    aguardandoConfirmacao: number;
    estoqueCritico: number;
  }>({
    agendamentosHoje: 0,
    faturamentoPrevisto: 0,
    pendenciasRecebimento: 0,
    programasVencendo: 0,
    aguardandoConfirmacao: 0,
    estoqueCritico: 0,
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

        const [agendRes, pagamentosRes, progRes, estoqueRes] = await Promise.all([
          supabase.from("agendamentos").select("id, status, servicos(valor)").eq("data", hoje),
          supabase.from("pagamentos").select("id, valor_total, valor_pago").in("status", ["pendente", "atrasado"]).is("arquivado_em", null),
          supabase.from("programas_contratados").select("id").eq("status_do_programa", "ativo"),
          supabase.from("produtos_estoque").select("id, quantidade, estoque_minimo").eq("ativo", true),
        ]);

        const agends = agendRes.data || [];
        const faturamento = agends.reduce((acc: number, curr: any) => {
          const s = curr.servicos;
          if (Array.isArray(s)) return acc + s.reduce((a: number, x: any) => a + Number(x?.valor || 0), 0);
          return acc + Number(s?.valor || 0);
        }, 0);

        const aguardando = agends.filter((a: any) => a.status === "agendado" || a.status === "aguardando").length;
        const criticos = (estoqueRes.data || []).filter((p: any) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;

        setResumo({
          agendamentosHoje: agends.length,
          faturamentoPrevisto: faturamento,
          pendenciasRecebimento: (pagamentosRes.data || []).length,
          programasVencendo: (progRes.data || []).length,
          aguardandoConfirmacao: aguardando,
          estoqueCritico: criticos,
        });
      } catch (err) {
        console.error("Erro ao carregar dados da Jessi no Dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarPanorama();
  }, []);

  return (
    <div className="rounded-2xl border border-emerald-800/20 bg-gradient-to-br from-[#123F2A]/10 via-background to-[#C8A951]/10 p-4 sm:p-5 mb-6 shadow-xs animate-in fade-in">
      {/* Topo do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/10 pb-3.5 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground font-display">
                Jessi · Centro de Decisões Estratégicas
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                IA Operacional Ativa
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Monitorando em tempo real: Agenda, Clubinho, Financeiro, Estoque e Mensagens
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

      {/* Grid de KPIs Rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-3.5">
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
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Cobranças Pendentes
          </span>
          <span className="text-base font-bold text-amber-600">
            {loading ? "..." : `${resumo.pendenciasRecebimento} registro(s)`}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
            <Gift className="h-3.5 w-3.5 text-[#C8A951]" /> Clubinhos Ativos
          </span>
          <span className="text-base font-bold text-foreground">
            {loading ? "..." : `${resumo.programasVencendo} pacotes`}
          </span>
        </div>
      </div>

      {/* Feed de 3 Decisões Prioritárias da Jessi */}
      <div className="rounded-xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-3.5 space-y-2 text-xs border border-[#C8A951]/40">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#F5E6BE] flex items-center gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5 text-[#C8A951]" />
            Ações Recomendadas da Jessi para Hoje (Revisão Humana):
          </span>
          <span className="text-[10px] text-white/60">3 prioridades do dia</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {/* Ação 1: Agenda */}
          <div className="p-2.5 rounded-lg bg-white/10 border border-white/10 flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-white block text-xs flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-300" /> Confirmações de Presença
              </span>
              <p className="text-[10px] text-white/70 mt-1 leading-tight">
                {resumo.aguardandoConfirmacao > 0
                  ? `${resumo.aguardandoConfirmacao} pet(s) ainda aguardam confirmação de presença para hoje.`
                  : "Todos os agendamentos de hoje estão confirmados!"}
              </p>
            </div>
            <Link to="/agenda">
              <Button size="sm" className="h-6 w-full text-[10px] bg-white/20 hover:bg-white/30 text-white gap-1">
                Ver na Agenda <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {/* Ação 2: Cobranças */}
          <div className="p-2.5 rounded-lg bg-white/10 border border-white/10 flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-white block text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-300" /> Recuperação Financeira
              </span>
              <p className="text-[10px] text-white/70 mt-1 leading-tight">
                {resumo.pendenciasRecebimento > 0
                  ? `${resumo.pendenciasRecebimento} cobrança(s) pendente(s) aguardam abordagem amigável.`
                  : "Nenhuma inadimplência crítica registrada hoje."}
              </p>
            </div>
            <Link to="/cobrancas">
              <Button size="sm" className="h-6 w-full text-[10px] bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold gap-1">
                Central de Cobrança <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {/* Ação 3: Suprimentos / Clubinho */}
          <div className="p-2.5 rounded-lg bg-white/10 border border-white/10 flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-white block text-xs flex items-center gap-1">
                <ShoppingCart className="h-3 w-3 text-[#C8A951]" /> Insumos &amp; Suprimentos
              </span>
              <p className="text-[10px] text-white/70 mt-1 leading-tight">
                {resumo.estoqueCritico > 0
                  ? `${resumo.estoqueCritico} produto(s) atingiram o estoque mínimo de segurança.`
                  : "Estoque em nível seguro para os próximos atendimentos."}
              </p>
            </div>
            <Link to="/estoque">
              <Button size="sm" className="h-6 w-full text-[10px] bg-white/20 hover:bg-white/30 text-white gap-1">
                Ver Estoque <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
