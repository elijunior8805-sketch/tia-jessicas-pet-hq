import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const getFinancialKPIs = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ from: z.string(), to: z.string() }).parse(data))
  .handler(async ({ data: { from, to } }) => {
    // 1. Fetch unified indicators from view
    const { data: indicators, error: indError } = await supabase
      .from("vw_financeiro_indicadores")
      .select("*")
      .gte("data_referencia", from)
      .lte("data_referencia", to);

    if (indError) throw indError;

    // 2. Aggregate
    let faturamentoCompetencia = 0;
    let recebidoPeriodo = 0;
    let despesasPagas = 0;
    let aportes = 0;
    let atendimentosCount = 0;

    indicators?.forEach((row: any) => {
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
    // Faturamento Competência - (Recebimentos vinculados a essa competência)
    // Note: To be perfect, we would need to know which 'receita_recebida' rows belong to which 'receita_servico' rows.
    // However, as per user requirement, let's keep it simple and unified.
    
    const saldoCaixa = recebidoPeriodo - despesasPagas + aportes;
    const lucroCompetencia = faturamentoCompetencia - despesasPagas; // Simplified as per "Resultado por Competência"

    const ticketMedio = atendimentosCount > 0 ? faturamentoCompetencia / atendimentosCount : 0;

    return {
      faturamento: faturamentoCompetencia,
      recebido: recebidoPeriodo,
      despesas: despesasPagas,
      lucro: lucroCompetencia, // Resultado por Competência
      saldoCaixa,
      ticketMedio,
      atendimentos: atendimentosCount,
      aportes
    };
  });
