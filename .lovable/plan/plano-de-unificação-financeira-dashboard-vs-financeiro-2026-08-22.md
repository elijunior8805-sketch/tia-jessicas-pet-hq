# Plano de Unificação Financeira (Dashboard vs Financeiro)

O objetivo é eliminar a divergência de valores entre o Painel Inicial (Dashboard) e a aba Financeiro, garantindo que ambos utilizem a mesma lógica de "Fluxo de Caixa" e os mesmos critérios de filtragem para receitas, despesas e KPIs.

## Problema Identificado
O Dashboard e o Financeiro possuem consultas independentes que, embora tentem seguir a mesma lógica, apresentam pequenas variações na forma como lidam com datas locais (America/Sao_Paulo) e filtragem de categorias (serviços vs aportes).

## Ações

### 1. Centralização da Lógica de Receita Bruta (Faturamento)
- O Dashboard atualmente calcula o faturamento somando `valor_pago` de `pagamentos` com status 'pago' no período.
- O Financeiro possui uma query chamada `faturamentoCompetencia` que olha para `atendimentos` finalizados.
- **Mudança**: Vamos padronizar ambos para usar a visão de **Fluxo de Caixa** (pagamentos efetivamente recebidos) para o KPI de Faturamento, pois é o que reflete o dinheiro em caixa no período.

### 2. Ajuste de Ticket Médio
- Garantir que o cálculo de Ticket Médio em ambas as telas utilize a mesma base: `(Soma de Receitas de Serviços no período) / (Quantidade de Atendimentos Únicos pagos no período)`.

### 3. Sincronização de Filtros de Despesas
- Unificar a lógica de despesas para considerar parcelas pagas no período E parcelas vencidas no período que ainda estão pendentes, garantindo que o "Lucro" (Receitas - Despesas) seja consistente.

### 4. Correção Visual e Auditoria
- Incluir o texto de auditoria solicitado no rodapé da página Financeira para documentar a validação realizada.
- Implementar a página de auditoria dedicada para consulta técnica.

## Detalhes Técnicos
- Arquivos afetados:
  - `src/routes/_authenticated/dashboard.tsx`: Ajustar queries de KPIs para espelhar o Financeiro.
  - `src/routes/_authenticated/financeiro.tsx`: Simplificar queries redundantes e adicionar texto de auditoria.
  - `supabase/migrations/20240822_fix_financial_views.sql`: Criar uma VIEW ou RPC que centralize esses cálculos para evitar futuras divergências no frontend.
