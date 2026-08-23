import { createIAResponse } from "./ia-retorno.server";
import { getFinancialKPIs } from "../financial-kpis.functions";
/**
 * Especialista Financeiro da IA
 * Garante que todos os valores venham da fonte única (vw_financeiro_indicadores)
 */
export async function consultarKPIsFinanceirosIA(sb, params) {
    // A IA NUNCA calcula por conta própria. Chama a função oficial.
    const kpis = await getFinancialKPIs({ data: params });
    return createIAResponse({
        source: 'consultar_kpis_financeiros',
        data: {
            periodo: params,
            indicadores: kpis,
            fonte: "vw_financeiro_indicadores"
        }
    });
}
/**
 * Identifica inadimplentes e pendências
 */
export async function consultarInadimplenciaIA(sb, params) {
    const timezone = "America/Sao_Paulo";
    const hoje = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    let query = sb
        .from("pagamentos")
        .select(`
      id,
      valor_total,
      valor_pago,
      vencimento,
      descricao,
      clientes(id, nome, telefone)
    `)
        .neq("status", "pago")
        .neq("status", "cancelado")
        .is("arquivado_em", null)
        .or("is_teste.is.null,is_teste.eq.false");
    if (params.apenas_vencidos) {
        query = query.lt("vencimento", hoje);
    }
    const { data, error } = await query.order("vencimento", { ascending: true });
    if (error)
        throw error;
    return createIAResponse({
        source: 'consultar_inadimplencia',
        data: {
            total_registros: data?.length || 0,
            registros: data,
            vencidos_apenas: !!params.apenas_vencidos
        }
    });
}
/**
 * Compara faturamento entre dois períodos
 */
export async function compararPeriodosIA(sb, params) {
    const kpi1 = await getFinancialKPIs({ data: params.p1 });
    const kpi2 = await getFinancialKPIs({ data: params.p2 });
    return createIAResponse({
        source: 'comparar_periodos_financeiros',
        data: {
            periodo_1: { ...params.p1, kpis: kpi1 },
            periodo_2: { ...params.p2, kpis: kpi2 },
            variacao_faturamento: kpi1.faturamento > 0 ? ((kpi2.faturamento - kpi1.faturamento) / kpi1.faturamento) * 100 : 0
        }
    });
}
