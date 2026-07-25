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

// America/Sao_Paulo local day helper (matches Dashboard/Financeiro)
function toLocalDay(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

export const carregarIndicadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Amplia a janela em ±1 dia para captar registros que ficam do "outro lado"
    // do meio-dia UTC mas pertencem a um dia local em America/Sao_Paulo.
    const deWide = new Date(`${data.de}T00:00:00.000Z`);
    deWide.setUTCDate(deWide.getUTCDate() - 1);
    const ateWide = new Date(`${data.ate}T23:59:59.999Z`);
    ateWide.setUTCDate(ateWide.getUTCDate() + 1);
    const deIsoWide = deWide.toISOString();
    const ateIsoWide = ateWide.toISOString();

    // Atendimentos em janela ampliada — filtramos depois por dia local.
    const { data: atendRowsRaw, error: atErr } = await supabase
      .from("atendimentos")
      .select(
        sel(
          "id, cliente_id, data_inicio, data_fim, valor_planejado, valor_executado, taxa_leva_traz, desconto, encerrado_em, finalizado, servicos_executados, servicos_planejados, clientes:cliente_id(nome)",
        ),
      )
      .or(
        `and(data_inicio.gte.${deIsoWide},data_inicio.lte.${ateIsoWide}),and(encerrado_em.gte.${deIsoWide},encerrado_em.lte.${ateIsoWide})`,
      )
      .returns<any[]>();
    if (atErr) throw new Error("Falha ao carregar atendimentos");

    // Determina o dia de referência de cada linha (local SP):
    // - finalizados: encerrado_em (data real do faturamento)
    // - demais: data_inicio (data do agendamento)
    const rowsAll = (atendRowsRaw ?? []).map((r) => {
      const isFinalized = r.finalizado === true && !!r.encerrado_em;
      const dia = toLocalDay(isFinalized ? r.encerrado_em : (r.data_inicio ?? r.data_fim));
      return { ...r, __dia: dia, __final: isFinalized };
    });
    const rows = rowsAll.filter((r) => r.__dia >= data.de && r.__dia <= data.ate);

    // Pagamentos em aberto — snapshot atual (independe do período)
    const { data: pagRows, error: pgErr } = await supabase
      .from("pagamentos")
      .select(sel("valor_total, valor_pago, vencimento, status"))
      .in("status", ["pendente", "parcial", "atrasado"])
      .returns<any[]>();
    if (pgErr) throw new Error("Falha ao carregar pagamentos");

    // Clientes novos no período (count exato)
    const deIsoDay = `${data.de}T00:00:00.000Z`;
    const ateIsoDay = `${data.ate}T23:59:59.999Z`;
    const { count: novosCliCount, error: cliErr } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", deIsoDay)
      .lte("created_at", ateIsoDay);
    if (cliErr) throw new Error("Falha ao carregar clientes");

    // Cancelados / Não compareceu no período
    const { data: agRows } = await supabase
      .from("agendamentos")
      .select(sel("id, status, data_hora"))
      .gte("data_hora", deIsoDay)
      .lte("data_hora", ateIsoDay)
      .in("status", ["cancelado", "nao_compareceu"])
      .returns<any[]>();

    // Faturamento/ticket/contagem: SOMENTE finalizados com valor_executado > 0.
    // Regra única (igual Dashboard/Financeiro/Histórico):
    //   total = max(0, valor_executado + taxa_leva_traz - desconto)
    const isExecutado = (r: any) =>
      Number(r.valor_executado ?? 0) > 0 && r.__final === true;
    const rowsExecutados = rows.filter(isExecutado);
    const totalRow = (r: any) =>
      Math.max(
        0,
        Number(r.valor_executado ?? 0) +
          Number(r.taxa_leva_traz ?? 0) -
          Number(r.desconto ?? 0),
      );
    const faturamento = rowsExecutados.reduce((s, r) => s + totalRow(r), 0);
    const faturamentoPlan = rows.reduce(
      (s, r) => s + Number(r.valor_planejado ?? 0),
      0,
    );
    const taxaLevaTraz = rowsExecutados.reduce(
      (s, r) => s + Number(r.taxa_leva_traz ?? 0),
      0,
    );
    const descontos = rowsExecutados.reduce(
      (s, r) => s + Number(r.desconto ?? 0),
      0,
    );
    const clientesSet = new Set(
      rowsExecutados.map((r) => r.cliente_id).filter(Boolean),
    );

    const aReceber = (pagRows ?? []).reduce(
      (s, p) => s + Math.max(0, Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)),
      0,
    );
    const hoje = toLocalDay(new Date().toISOString());
    const emAtraso = (pagRows ?? [])
      .filter((p) => p.vencimento && p.vencimento < hoje)
      .reduce(
        (s, p) => s + Math.max(0, Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)),
        0,
      );

    // Série diária (contagem = qualquer atendimento no dia; faturamento = só executado)
    const serieMap = new Map<string, { faturamento: number; atendimentos: number }>();
    for (const r of rows) {
      const dia = r.__dia;
      if (!dia) continue;
      const cur = serieMap.get(dia) ?? { faturamento: 0, atendimentos: 0 };
      if (isExecutado(r)) cur.faturamento += totalRow(r);
      cur.atendimentos += 1;
      serieMap.set(dia, cur);
    }
    const serie: SerieDia[] = Array.from(serieMap.entries())
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    // Ranking clientes (apenas executados contam para total)
    const rankMap = new Map<string, { nome: string; total: number; qtd: number }>();
    for (const r of rowsExecutados) {
      const k = r.cliente_id ?? "—";
      const nome = r.clientes?.nome ?? "—";
      const cur = rankMap.get(k) ?? { nome, total: 0, qtd: 0 };
      cur.total += totalRow(r);
      cur.qtd += 1;
      rankMap.set(k, cur);
    }
    const rankingClientes: RankingItem[] = Array.from(rankMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Serviços — considera executados; se vazio, cai para planejados
    const svcMap = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const execArr = Array.isArray(r.servicos_executados) ? r.servicos_executados : [];
      const arr = execArr.length > 0
        ? execArr
        : (Array.isArray(r.servicos_planejados) ? r.servicos_planejados : []);
      for (const s of arr) {
        const nome = String(s?.nome ?? "—").trim() || "—";
        const cur = svcMap.get(nome) ?? { qtd: 0, total: 0 };
        cur.qtd += Number(s?.quantidade ?? 1);
        cur.total += Number(s?.valor_total ?? s?.preco ?? s?.valor ?? s?.valor_unit ?? 0);
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
      ticket_medio: rowsExecutados.length ? faturamento / rowsExecutados.length : 0,
      atendimentos_finalizados: rowsExecutados.length,
      atendimentos_cancelados: (agRows ?? []).length,
      clientes_atendidos: clientesSet.size,
      novos_clientes: novosCliCount ?? 0,
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
    const deWide = new Date(`${data.de}T00:00:00.000Z`);
    deWide.setUTCDate(deWide.getUTCDate() - 1);
    const ateWide = new Date(`${data.ate}T23:59:59.999Z`);
    ateWide.setUTCDate(ateWide.getUTCDate() + 1);
    const deIsoWide = deWide.toISOString();
    const ateIsoWide = ateWide.toISOString();

    const { data: rows, error } = await supabase
      .from("atendimentos")
      .select(
        sel(
          "data_inicio, encerrado_em, data_fim, finalizado, valor_planejado, valor_executado, desconto, taxa_leva_traz, pagamento_status, servicos_executados, servicos_planejados, clientes:cliente_id(nome), pets:pet_id(nome)",
        ),
      )
      .or(
        `and(data_inicio.gte.${deIsoWide},data_inicio.lte.${ateIsoWide}),and(encerrado_em.gte.${deIsoWide},encerrado_em.lte.${ateIsoWide})`,
      )
      .order("data_inicio", { ascending: true })
      .limit(5000)
      .returns<any[]>();
    if (error) throw new Error("Falha ao carregar linhas");

    const linhas: LinhaExport[] = (rows ?? [])
      .map((r) => {
        const isFinalized = r.finalizado === true && !!r.encerrado_em;
        const dia = toLocalDay(isFinalized ? r.encerrado_em : (r.data_inicio ?? r.data_fim));
        return { ...r, __dia: dia };
      })
      .filter((r: any) => r.__dia >= data.de && r.__dia <= data.ate)
      .map((r: any) => {
        const execArr = Array.isArray(r.servicos_executados) ? r.servicos_executados : [];
        const arr = execArr.length > 0
          ? execArr
          : (Array.isArray(r.servicos_planejados) ? r.servicos_planejados : []);
        const servicos = arr.map((s: any) => s?.nome).filter(Boolean).join(" + ");
        return {
          data: r.__dia,
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
