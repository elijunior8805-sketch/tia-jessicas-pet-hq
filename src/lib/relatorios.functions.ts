import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PeriodoSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type IndicadoresDTO = {
  periodo: { de: string; ate: string };
  faturamento: number;
  faturamento_planejado: number;
  ticket_medio: number;
  atendimentos_finalizados: number;
  atendimentos_cancelados: number;
  clientes_atendidos: number;
  novos_clientes: number;
  a_receber: number;
  em_atraso: number;
  taxa_leva_traz_total: number;
  descontos_total: number;
};

export type RankingItem = { nome: string; total: number; qtd: number };
export type SerieDia = { dia: string; faturamento: number; atendimentos: number };
export type ServicoItem = { nome: string; qtd: number; total: number };

const sel = (s: string): string => s;

export const carregarIndicadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const deIso = `${data.de}T00:00:00.000Z`;
    const ateIso = `${data.ate}T23:59:59.999Z`;

    // Atendimentos no período (por data_inicio) — inclui em andamento e finalizados,
    // para que os relatórios reflitam a realidade do dia mesmo sem encerramento.
    const { data: atendRows, error: atErr } = await supabase
      .from("atendimentos")
      .select(
        sel(
          "id, cliente_id, data_inicio, data_fim, valor_planejado, valor_executado, taxa_leva_traz, desconto, encerrado_em, finalizado, servicos_executados, servicos_planejados, clientes:cliente_id(nome)"
        )
      )
      .gte("data_inicio", deIso)
      .lte("data_inicio", ateIso)
      .returns<any[]>();
    if (atErr) throw new Error("Falha ao carregar atendimentos");


    // Pagamentos em aberto na data corrente (snapshot)
    const { data: pagRows, error: pgErr } = await supabase
      .from("pagamentos")
      .select(sel("valor_total, valor_pago, vencimento, status"))
      .in("status", ["pendente", "parcial", "atrasado"])
      .returns<any[]>();
    if (pgErr) throw new Error("Falha ao carregar pagamentos");

    // Clientes novos no período
    const { data: novosCli, error: cliErr } = await supabase
      .from("clientes")
      .select(sel("id"), { count: "exact", head: true })
      .gte("created_at", deIso)
      .lte("created_at", ateIso);
    if (cliErr) throw new Error("Falha ao carregar clientes");

    // Cancelados
    const { data: agRows } = await supabase
      .from("agendamentos")
      .select(sel("id, status, data_hora"))
      .gte("data_hora", deIso)
      .lte("data_hora", ateIso)
      .in("status", ["cancelado", "nao_compareceu"])
      .returns<any[]>();

    const rows = atendRows ?? [];
    // Ticket usa valor executado; se ausente/zero, cai para o valor planejado.
    const valorRow = (r: any) => {
      const exec = Number(r.valor_executado ?? 0);
      const plan = Number(r.valor_planejado ?? 0);
      return exec > 0 ? exec : plan;
    };
    const faturamento = rows.reduce((s, r) => s + valorRow(r), 0);
    const faturamentoPlan = rows.reduce((s, r) => s + Number(r.valor_planejado ?? 0), 0);
    const taxaLevaTraz = rows.reduce((s, r) => s + Number(r.taxa_leva_traz ?? 0), 0);
    const descontos = rows.reduce((s, r) => s + Number(r.desconto ?? 0), 0);
    const clientesSet = new Set(rows.map((r) => r.cliente_id).filter(Boolean));

    const aReceber = (pagRows ?? []).reduce(
      (s, p) => s + Math.max(0, Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)),
      0
    );
    const hoje = new Date().toISOString().slice(0, 10);
    const emAtraso = (pagRows ?? [])
      .filter((p) => p.vencimento && p.vencimento < hoje)
      .reduce((s, p) => s + Math.max(0, Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)), 0);

    // Série diária
    const serieMap = new Map<string, { faturamento: number; atendimentos: number }>();
    for (const r of rows) {
      const dia = String(r.encerrado_em ?? r.data_fim ?? "").slice(0, 10);
      if (!dia) continue;
      const cur = serieMap.get(dia) ?? { faturamento: 0, atendimentos: 0 };
      cur.faturamento += valorRow(r);
      cur.atendimentos += 1;
      serieMap.set(dia, cur);
    }
    const serie: SerieDia[] = Array.from(serieMap.entries())
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    // Ranking clientes
    const rankMap = new Map<string, { nome: string; total: number; qtd: number }>();
    for (const r of rows) {
      const k = r.cliente_id ?? "—";
      const nome = r.clientes?.nome ?? "—";
      const cur = rankMap.get(k) ?? { nome, total: 0, qtd: 0 };
      cur.total += valorRow(r);
      cur.qtd += 1;
      rankMap.set(k, cur);
    }
    const rankingClientes: RankingItem[] = Array.from(rankMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Serviços mais executados
    const svcMap = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const arr = Array.isArray(r.servicos_executados) ? r.servicos_executados : [];
      for (const s of arr) {
        const nome = String(s?.nome ?? "—").trim() || "—";
        const cur = svcMap.get(nome) ?? { qtd: 0, total: 0 };
        cur.qtd += Number(s?.quantidade ?? 1);
        cur.total += Number(s?.preco ?? s?.valor ?? 0);
        svcMap.set(nome, cur);
      }
    }
    const servicos: ServicoItem[] = Array.from(svcMap.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);

    const indicadores: IndicadoresDTO = {
      periodo: { de: data.de, ate: data.ate },
      faturamento,
      faturamento_planejado: faturamentoPlan,
      ticket_medio: rows.length ? faturamento / rows.length : 0,
      atendimentos_finalizados: rows.length,
      atendimentos_cancelados: (agRows ?? []).length,
      clientes_atendidos: clientesSet.size,
      novos_clientes: (novosCli as any)?.length ?? 0,
      a_receber: aReceber,
      em_atraso: emAtraso,
      taxa_leva_traz_total: taxaLevaTraz,
      descontos_total: descontos,
    };

    return { indicadores, serie, rankingClientes, servicos };
  });

// Export detalhado seguro (linhas para CSV)
export type LinhaExport = {
  data: string;
  cliente: string;
  pet: string;
  servicos: string;
  valor_planejado: number;
  valor_executado: number;
  desconto: number;
  taxa_leva_traz: number;
  pagamento_status: string;
};

export const listarLinhasExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const deIso = `${data.de}T00:00:00.000Z`;
    const ateIso = `${data.ate}T23:59:59.999Z`;
    const { data: rows, error } = await supabase
      .from("atendimentos")
      .select(
        sel(
          "encerrado_em, data_fim, valor_planejado, valor_executado, desconto, taxa_leva_traz, pagamento_status, servicos_executados, clientes:cliente_id(nome), pets:pet_id(nome)"
        )
      )
      .gte("encerrado_em", deIso)
      .lte("encerrado_em", ateIso)
      .not("encerrado_em", "is", null)
      .order("encerrado_em", { ascending: true })
      .limit(5000)
      .returns<any[]>();
    if (error) throw new Error("Falha ao carregar linhas");

    const linhas: LinhaExport[] = (rows ?? []).map((r) => {
      const servicos = Array.isArray(r.servicos_executados)
        ? r.servicos_executados.map((s: any) => s?.nome).filter(Boolean).join(" + ")
        : "";
      return {
        data: String(r.encerrado_em ?? r.data_fim ?? "").slice(0, 10),
        cliente: r.clientes?.nome ?? "",
        pet: r.pets?.nome ?? "",
        servicos,
        valor_planejado: Number(r.valor_planejado ?? 0),
        valor_executado: Number(r.valor_executado ?? 0),
        desconto: Number(r.desconto ?? 0),
        taxa_leva_traz: Number(r.taxa_leva_traz ?? 0),
        pagamento_status: r.pagamento_status ?? "",
      };
    });
    return { linhas };
  });
