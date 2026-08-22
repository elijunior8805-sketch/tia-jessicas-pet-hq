# Project Memory

## Core
Domain: Service management system with Pick-up/Drop-off (Leva e Traz) and financial KPI tracking.
Language: Business rules and UI terminology are in Portuguese.
Financeiro: fonte única = vw_financeiro_indicadores via getFinancialKPIs. Nunca calcular indicadores financeiros direto no frontend.
Datas financeiras sempre no fuso America/Sao_Paulo, nunca UTC.

## Memories
- [KPI Ticket Médio e Aportes](mem://features/kpi-ticket-medio-aportes) — Regras de cálculo para Ticket Médio (Serviços + Taxas) e Aportes/Ajustes (Entradas não-serviço)
- [Check-in e Relatório de Banho](mem://features/regras-checkin-relatorio.md) — Regras de isolamento e exibição de dados de pets no fluxo de atendimento
- [Texto Auditoria Financeira](mem://preference/texto-auditoria-financeira.md) — Atualização de texto literal para auditoria e respostas de IA.
- [Fonte financeira única](mem://features/fonte-financeira-unica) — Definições oficiais de faturamento, recebido, despesas, a receber, ticket médio e fuso horário
