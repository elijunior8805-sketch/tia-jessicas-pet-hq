import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getFinancialKPIs = createServerFn({ method: "GET" })
    .validator((data) => z.object({ from: z.string(), to: z.string() }).parse(data))
    .handler(async ({ data: { from, to } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 1. Fetch unified indicators from view
    const { data: indicators, error: indError } = await supabaseAdmin
        .from("vw_financeiro_indicadores")
        .select("*")
        .gte("data_referencia", from)
        .lte("data_referencia", to);
    if (indError) {
        console.error("[getFinancialKPIs] Error fetching indicators:", indError);
        throw indError;
    }
    // 2. Aggregate
    let faturamentoCompetencia = 0;
    let recebidoPeriodo = 0;
    let despesasPagas = 0;
    let aportes = 0;
    let atendimentosCount = 0;
    indicators?.forEach((row) => {
        const val = Number(row.valor || 0);
        switch (row.tipo) {
            case 'receita_servico':
                faturamentoCompetencia += val;
                atendimentosCount += Number(row.quantidade_atendimentos || 0);
                break;
            case 'receita_recebida':
                recebidoPeriodo += val;
                break;
            case 'despesa_paga':
                despesasPagas += val;
                break;
            case 'aporte_recebido':
                aportes += val;
                break;
        }
    });
    // 3. Pending values (Accrual balance)
    const { data: pendingReceivables, error: pendingError } = await supabaseAdmin
        .from("pagamentos")
        .select("valor_total, valor_pago, vencimento")
        .neq("status", "pago")
        .neq("status", "cancelado")
        .is("arquivado_em", null)
        .or("is_teste.is.null,is_teste.eq.false")
        .or(`categoria_receita.is.null,and(categoria_receita.neq.aporte,categoria_receita.neq.ajuste)`);
    if (pendingError) {
        console.error("[getFinancialKPIs] Error fetching pending receivables:", pendingError);
        throw pendingError;
    }
    let aReceber = 0;
    let vencido = 0;
    const timezone = "America/Sao_Paulo";
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    pendingReceivables?.forEach((p) => {
        const saldo = Number(p.valor_total || 0) - Number(p.valor_pago || 0);
        if (saldo > 0) {
            aReceber += saldo;
            if (p.vencimento && p.vencimento < today) {
                vencido += saldo;
            }
        }
    });
    const saldoCaixa = recebidoPeriodo - despesasPagas + aportes;
    const lucroCompetencia = faturamentoCompetencia - despesasPagas;
    const ticketMedio = atendimentosCount > 0 ? faturamentoCompetencia / atendimentosCount : 0;
    const result = {
        faturamento: faturamentoCompetencia,
        recebido: recebidoPeriodo,
        despesas: despesasPagas,
        lucro: lucroCompetencia,
        saldoCaixa,
        ticketMedio,
        atendimentos: atendimentosCount,
        aportes,
        aReceber,
        vencido
    };
    // 4. Log audit data (fire and forget for performance)
    supabaseAdmin.from("auditoria_financeira").insert({
        periodo_de: from,
        periodo_ate: to,
        fuso_horario: timezone,
        resultado: result
    }).then(({ error }) => {
        if (error)
            console.error("[getFinancialKPIs] Audit log error:", error);
    });
    return result;
});
