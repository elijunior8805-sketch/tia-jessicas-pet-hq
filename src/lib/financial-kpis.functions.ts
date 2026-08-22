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
    let faturamento = 0;
    let recebido = 0;
    let despesas = 0;
    let aportes = 0;
    let atendimentosCount = 0;

    indicators?.forEach((row: any) => {
      const val = Number(row.valor || 0);
      switch (row.tipo) {
        case 'receita_servico':
          faturamento += val;
          atendimentosCount += Number(row.quantidade_atendimentos || 0);
          break;
        case 'receita_recebida':
          recebido += val;
          break;
        case 'despesa_paga':
          despesas += val;
          break;
        case 'aporte_recebido':
          aportes += val;
          break;
      }
    });

    // 3. Pending values (requires specific table read as view only tracks realized cash flow)
    const { data: pendingReceivables } = await supabase
      .from("pagamentos")
      .select("valor_total, valor_pago, vencimento")
      .neq("status", "pago")
      .neq("status", "cancelado")
      .or(`categoria_receita.is.null,and(categoria_receita.neq.aporte,categoria_receita.neq.ajuste)`);

    let aReceber = 0;
    let vencido = 0;
    const today = new Date().toISOString().split('T')[0];

    pendingReceivables?.forEach((p: any) => {
      const saldo = Number(p.valor_total || 0) - Number(p.valor_pago || 0);
      if (saldo > 0) {
        aReceber += saldo;
        if (p.vencimento && p.vencimento < today) {
          vencido += saldo;
        }
      }
    });

    const ticketMedio = atendimentosCount > 0 ? faturamento / atendimentosCount : 0;

    return {
      faturamento,
      recebido,
      despesas,
      lucro: faturamento + aportes - despesas,
      ticketMedio,
      atendimentos: atendimentosCount,
      aportes,
      aReceber,
      vencido
    };
  });
