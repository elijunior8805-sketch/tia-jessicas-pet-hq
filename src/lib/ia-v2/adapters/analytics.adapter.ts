import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult } from "../contracts/jessi-v2-contracts";

export interface AnalyticsItemRanking {
  nome: string;
  totalAtendimentos: number;
  faturamentoTotal: number;
  ticketMedio: number;
  percentual: number;
  destaque?: string;
}

export interface AnalyticsResultPayload {
  tipoAnalise: "porte_raca" | "bairro" | "dia_semana" | "cancelamentos" | "top_clientes" | "geral";
  titulo: string;
  subtitulo: string;
  periodoReferencia: string;
  totalGeral: number;
  faturamentoGeral: number;
  ticketMedioGeral: number;
  itens: AnalyticsItemRanking[];
  insightEstrategico: string;
  acaoRecomendada: {
    texto: string;
    comando: string;
  };
}

export class AnalyticsAdapter {
  private static brl(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  /**
   * 1. Análise de Faturamento por Porte e Raça do Pet
   */
  static async analisarFaturamentoPorPorteERaca(
    sb: SupabaseClient<Database>
  ): Promise<JessiV2QueryResult<AnalyticsResultPayload>> {
    const { data: agendamentos, error } = await sb
      .from("agendamentos")
      .select(`
        id,
        valor_previsto,
        status,
        pets (
          id,
          nome,
          porte,
          raca
        )
      `)
      .in("status", ["confirmado", "concluido", "finalizado"]);

    if (error || !agendamentos || agendamentos.length === 0) {
      return {
        success: false,
        source: "analytics_porte_raca",
        summary: "Não foi possível carregar dados suficientes de atendimentos para a análise por porte e raça.",
        executed_at: new Date().toISOString(),
      };
    }

    const mapaPorte: Record<string, { total: number; count: number }> = {
      Pequeno: { total: 0, count: 0 },
      Médio: { total: 0, count: 0 },
      Grande: { total: 0, count: 0 },
      Gigante: { total: 0, count: 0 },
    };

    let faturamentoTotal = 0;
    let atendimentosValidos = 0;

    agendamentos.forEach((ag: any) => {
      const pet = Array.isArray(ag.pets) ? ag.pets[0] : ag.pets;
      const porteBruto = pet?.porte || "Médio";
      const porte = porteBruto.charAt(0).toUpperCase() + porteBruto.slice(1).toLowerCase();
      const val = Number(ag.valor_previsto || 0);

      if (!mapaPorte[porte]) {
        mapaPorte[porte] = { total: 0, count: 0 };
      }

      mapaPorte[porte].total += val;
      mapaPorte[porte].count += 1;
      faturamentoTotal += val;
      atendimentosValidos += 1;
    });

    const itens: AnalyticsItemRanking[] = Object.entries(mapaPorte)
      .filter(([_, v]) => v.count > 0)
      .map(([porte, v]) => ({
        nome: `Porte ${porte}`,
        totalAtendimentos: v.count,
        faturamentoTotal: v.total,
        ticketMedio: v.count > 0 ? v.total / v.count : 0,
        percentual: faturamentoTotal > 0 ? (v.total / faturamentoTotal) * 100 : 0,
      }))
      .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);

    const porteLider = itens[0]?.nome || "Porte Médio";
    const ticketGeral = atendimentosValidos > 0 ? faturamentoTotal / atendimentosValidos : 0;

    const payload: AnalyticsResultPayload = {
      tipoAnalise: "porte_raca",
      titulo: "Análise de Desempenho por Porte & Raça",
      subtitulo: `Baseado em ${atendimentosValidos} atendimento(s) realizados`,
      periodoReferencia: "Histórico Consolidado",
      totalGeral: atendimentosValidos,
      faturamentoGeral: faturamentoTotal,
      ticketMedioGeral: ticketGeral,
      itens,
      insightEstrategico: `O segmento **${porteLider}** é o líder de receita, representando **${itens[0]?.percentual.toFixed(1)}%** do faturamento total.`,
      acaoRecomendada: {
        texto: "Ofertar combos de hidratação para pets deste porte",
        comando: "sugerir clientes inativos para encaixe",
      },
    };

    return {
      success: true,
      source: "analytics_porte_raca",
      data: payload,
      summary: `Análise concluída: ${itens.length} categorias de porte processadas. Líder: ${porteLider} (${this.brl(itens[0]?.faturamentoTotal || 0)}).`,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * 2. Análise de Desempenho e Concentração por Bairro
   */
  static async analisarDesempenhoPorBairro(
    sb: SupabaseClient<Database>
  ): Promise<JessiV2QueryResult<AnalyticsResultPayload>> {
    const { data: agendamentos, error } = await sb
      .from("agendamentos")
      .select(`
        id,
        valor_previsto,
        status,
        clientes (
          id,
          nome,
          bairro
        )
      `)
      .in("status", ["confirmado", "concluido", "finalizado"]);

    if (error || !agendamentos || agendamentos.length === 0) {
      return {
        success: false,
        source: "analytics_bairro",
        summary: "Não foi possível carregar os dados geográficos dos clientes.",
        executed_at: new Date().toISOString(),
      };
    }

    const mapaBairro: Record<string, { total: number; count: number }> = {};
    let faturamentoTotal = 0;
    let totalAtendimentos = 0;

    agendamentos.forEach((ag: any) => {
      const cli = Array.isArray(ag.clientes) ? ag.clientes[0] : ag.clientes;
      const bairro = (cli?.bairro || "Outros / Não informado").trim();
      const val = Number(ag.valor_previsto || 0);

      if (!mapaBairro[bairro]) {
        mapaBairro[bairro] = { total: 0, count: 0 };
      }

      mapaBairro[bairro].total += val;
      mapaBairro[bairro].count += 1;
      faturamentoTotal += val;
      totalAtendimentos += 1;
    });

    const itens: AnalyticsItemRanking[] = Object.entries(mapaBairro)
      .map(([bairro, v]) => ({
        nome: bairro,
        totalAtendimentos: v.count,
        faturamentoTotal: v.total,
        ticketMedio: v.count > 0 ? v.total / v.count : 0,
        percentual: faturamentoTotal > 0 ? (v.total / faturamentoTotal) * 100 : 0,
      }))
      .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal)
      .slice(0, 6);

    const bairroLider = itens[0]?.nome || "Centro";
    const ticketGeral = totalAtendimentos > 0 ? faturamentoTotal / totalAtendimentos : 0;

    const payload: AnalyticsResultPayload = {
      tipoAnalise: "bairro",
      titulo: "Concentração Geográfica & Faturamento por Bairro",
      subtitulo: `Top 6 bairros por volume financeiro gerado`,
      periodoReferencia: "Histórico Consolidado",
      totalGeral: totalAtendimentos,
      faturamentoGeral: faturamentoTotal,
      ticketMedioGeral: ticketGeral,
      itens,
      insightEstrategico: `O bairro **${bairroLider}** concentra **${itens[0]?.percentual.toFixed(1)}%** da demanda. Excelente polo para otimização do Leva & Traz.`,
      acaoRecomendada: {
        texto: `Otimizar rotas do Leva e Traz em ${bairroLider}`,
        comando: "otimizar rotas do Leva e Traz",
      },
    };

    return {
      success: true,
      source: "analytics_bairro",
      data: payload,
      summary: `Análise geográfica: ${bairroLider} é o bairro com maior faturamento (${this.brl(itens[0]?.faturamentoTotal || 0)}).`,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * 3. Análise de Ocupação por Dia da Semana (Diagnóstico de Dias de Pico e Dias Fracos)
   */
  static async analisarOcupacaoPorDiaSemana(
    sb: SupabaseClient<Database>
  ): Promise<JessiV2QueryResult<AnalyticsResultPayload>> {
    const { data: agendamentos, error } = await sb
      .from("agendamentos")
      .select("id, data, valor_previsto, status")
      .in("status", ["confirmado", "concluido", "finalizado", "agendado"]);

    if (error || !agendamentos || agendamentos.length === 0) {
      return {
        success: false,
        source: "analytics_dia_semana",
        summary: "Dados de grade insuficientes para análise semanal.",
        executed_at: new Date().toISOString(),
      };
    }

    const diasNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const mapaDias: Record<number, { total: number; count: number }> = {
      1: { total: 0, count: 0 },
      2: { total: 0, count: 0 },
      3: { total: 0, count: 0 },
      4: { total: 0, count: 0 },
      5: { total: 0, count: 0 },
      6: { total: 0, count: 0 },
    };

    let faturamentoTotal = 0;
    let totalAtendimentos = 0;

    agendamentos.forEach((ag) => {
      if (!ag.data) return;
      const [y, m, d] = ag.data.split("-").map(Number);
      const dataObj = new Date(y, m - 1, d);
      const diaSemana = dataObj.getDay();
      const val = Number(ag.valor_previsto || 0);

      if (mapaDias[diaSemana]) {
        mapaDias[diaSemana].total += val;
        mapaDias[diaSemana].count += 1;
        faturamentoTotal += val;
        totalAtendimentos += 1;
      }
    });

    const itens: AnalyticsItemRanking[] = Object.entries(mapaDias)
      .map(([diaNum, v]) => ({
        nome: diasNomes[Number(diaNum)],
        totalAtendimentos: v.count,
        faturamentoTotal: v.total,
        ticketMedio: v.count > 0 ? v.total / v.count : 0,
        percentual: totalAtendimentos > 0 ? (v.count / totalAtendimentos) * 100 : 0,
      }))
      .sort((a, b) => b.totalAtendimentos - a.totalAtendimentos);

    const diaPico = itens[0]?.nome || "Sábado";
    const diaFraco = itens[itens.length - 1]?.nome || "Terça-feira";

    const payload: AnalyticsResultPayload = {
      tipoAnalise: "dia_semana",
      titulo: "Distribuição da Demanda por Dia da Semana",
      subtitulo: `Identificação de picos operacionais e janelas de ociosidade`,
      periodoReferencia: "Histórico Consolidado",
      totalGeral: totalAtendimentos,
      faturamentoGeral: faturamentoTotal,
      ticketMedioGeral: totalAtendimentos > 0 ? faturamentoTotal / totalAtendimentos : 0,
      itens,
      insightEstrategico: `**${diaPico}** é o dia de pico (**${itens[0]?.percentual.toFixed(1)}%** do volume). Já **${diaFraco}** apresenta a menor ocupação, ideal para campanhas promocionais de banho.`,
      acaoRecomendada: {
        texto: `Criar campanha de desconto para ${diaFraco}`,
        comando: "sugerir encaixes de reativação para a semana",
      },
    };

    return {
      success: true,
      source: "analytics_dia_semana",
      data: payload,
      summary: `Pico de atendimentos: ${diaPico} (${itens[0]?.totalAtendimentos} atendimentos). Dia mais ocioso: ${diaFraco}.`,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * 4. Análise de Cancelamentos e No-Shows
   */
  static async analisarCancelamentosENoShow(
    sb: SupabaseClient<Database>
  ): Promise<JessiV2QueryResult<AnalyticsResultPayload>> {
    const { data: todos, error } = await sb
      .from("agendamentos")
      .select("id, status, valor_previsto, created_at, observacoes");

    if (error || !todos || todos.length === 0) {
      return {
        success: false,
        source: "analytics_cancelamentos",
        summary: "Sem dados suficientes para cálculo de taxa de cancelamento.",
        executed_at: new Date().toISOString(),
      };
    }

    const cancelados = todos.filter((a) => a.status === "cancelado");
    const concluidos = todos.filter((a) => a.status === "concluido" || a.status === "finalizado" || a.status === "confirmado");
    const total = todos.length;

    const taxaCancelamento = total > 0 ? (cancelados.length / total) * 100 : 0;
    const perdaEstimada = cancelados.reduce((acc, c) => acc + Number(c.valor_previsto || 0), 0);

    const itens: AnalyticsItemRanking[] = [
      {
        nome: "Atendimentos Concluídos / Confirmados",
        totalAtendimentos: concluidos.length,
        faturamentoTotal: concluidos.reduce((acc, c) => acc + Number(c.valor_previsto || 0), 0),
        ticketMedio: concluidos.length > 0 ? concluidos.reduce((acc, c) => acc + Number(c.valor_previsto || 0), 0) / concluidos.length : 0,
        percentual: total > 0 ? (concluidos.length / total) * 100 : 0,
        destaque: "Operação Realizada",
      },
      {
        nome: "Cancelamentos / Desistências",
        totalAtendimentos: cancelados.length,
        faturamentoTotal: perdaEstimada,
        ticketMedio: cancelados.length > 0 ? perdaEstimada / cancelados.length : 0,
        percentual: taxaCancelamento,
        destaque: "Receita Não Realizada",
      },
    ];

    const payload: AnalyticsResultPayload = {
      tipoAnalise: "cancelamentos",
      titulo: "Auditoria de Cancelamentos & No-Shows",
      subtitulo: `Taxa global de desistências e impacto financeiro`,
      periodoReferencia: "Histórico Geral",
      totalGeral: total,
      faturamentoGeral: perdaEstimada,
      ticketMedioGeral: cancelados.length > 0 ? perdaEstimada / cancelados.length : 0,
      itens,
      insightEstrategico: `A taxa de cancelamento está em **${taxaCancelamento.toFixed(1)}%**, representando um impacto estimado de **${this.brl(perdaEstimada)}** em horários não aproveitados.`,
      acaoRecomendada: {
        texto: "Ativar confirmação de lembrete no WhatsApp 24h antes",
        comando: "preparar lembretes de confirmacao para amanha",
      },
    };

    return {
      success: true,
      source: "analytics_cancelamentos",
      data: payload,
      summary: `Taxa de cancelamento: ${taxaCancelamento.toFixed(1)}% (${cancelados.length} ocorrências). Perda estimada: ${this.brl(perdaEstimada)}.`,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * 5. Despachante Central de Análise Dinâmica
   */
  static async executarAnaliseDinamica(
    sb: SupabaseClient<Database>,
    perguntaOuTipo: string
  ): Promise<JessiV2QueryResult<AnalyticsResultPayload>> {
    const t = perguntaOuTipo.toLowerCase();

    if (t.includes("bairro") || t.includes("região") || t.includes("regiao") || t.includes("endereço") || t.includes("endereco") || t.includes("geogr")) {
      return await this.analisarDesempenhoPorBairro(sb);
    }
    if (t.includes("dia da semana") || t.includes("dia fraco") || t.includes("dia de pico") || t.includes("ocupação") || t.includes("ocupacao") || t.includes("semanal")) {
      return await this.analisarOcupacaoPorDiaSemana(sb);
    }
    if (t.includes("cancelamento") || t.includes("cancelamentos") || t.includes("desistência") || t.includes("desistencia") || t.includes("no show") || t.includes("no-show") || t.includes("perda")) {
      return await this.analisarCancelamentosENoShow(sb);
    }

    // Default: Análise de Porte e Raça
    return await this.analisarFaturamentoPorPorteERaca(sb);
  }
}
