---
name: Fonte financeira única
description: Todos os módulos financeiros devem consumir vw_financeiro_indicadores via getFinancialKPIs; definições oficiais de competência x caixa
type: feature
---
FONTE ÚNICA: `public.vw_financeiro_indicadores` (banco) consumida por `src/lib/financial-kpis.functions.ts` (`getFinancialKPIs`).
Financeiro, Painel Inicial, Dashboard, Caixa, Cobrança, Relatórios e Assistente IA devem usar essa fonte. Nunca criar cálculo financeiro paralelo no frontend.

Definições oficiais:
- Faturamento (competência) = soma de `max(0, valor_executado + taxa_leva_traz - desconto)` dos atendimentos com `finalizado = true`, pela data de início no fuso America/Sao_Paulo.
- Recebido (caixa) = pagamentos com status `pago` ou `parcial`, `valor_pago > 0`, pela `data_pagamento`; exclui arquivados, testes, aportes e ajustes.
- Despesas = `compras_parcelas` pagas/parciais pela `data_pagamento`; exclui arquivadas e testes.
- Resultado por competência = Faturamento − Despesas. Saldo do período = Recebido − Despesas + Aportes.
- A Receber = saldo (`valor_total − valor_pago`) > 0 de pagamentos não pagos/não cancelados, não arquivados, não teste. Vencidos = os com vencimento < hoje (São Paulo).
- Ticket Médio = Faturamento ÷ quantidade de atendimentos válidos (1 por atendimento, não por serviço).

Todas as datas de corte usam o fuso America/Sao_Paulo, nunca UTC.
