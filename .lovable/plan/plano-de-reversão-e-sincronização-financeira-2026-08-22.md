# Plano de Reversão e Sincronização Financeira

O usuário solicitou a reversão das alterações recentes no módulo financeiro (que incluíam novas abas e uma lógica complexa de auditoria) e a correção definitiva da divergência entre os saldos do Dashboard e do Financeiro.

## Ações a serem realizadas

### 1. Limpeza de UI e Reversão de Abas
- Remover as notas de auditoria (`AuditNote`) e textos forenses excessivos das páginas de Dashboard e Financeiro.
- Simplificar a visualização do Financeiro, removendo as distinções complexas de "Faturamento por Competência" vs "Recebido em Caixa" se isso estiver confundindo, mantendo apenas o que é essencial para o usuário: Faturamento, Recebido, Despesas e Lucro.
- Remover o botão "Recalcular KPIs" se for desnecessário ou confuso.

### 2. Sincronização Técnica de Dados
- Garantir que tanto o Dashboard quanto o Financeiro usem exatamente a mesma função de servidor (`getFinancialKPIs`).
- Revisar a lógica de `getFinancialKPIs` para que o "Lucro" seja calculado de forma intuitiva: `Recebido - Despesas`.
- Ajustar a view `vw_financeiro_indicadores` (via migração se necessário) para garantir que a soma dos valores bata exatamente com o que o usuário vê nos registros individuais.

### 3. Ajuste de Nomenclatura
- Utilizar termos simples:
  - **Faturamento**: Total de serviços realizados no período (independente de pago ou não).
  - **Recebido**: Total que efetivamente entrou no caixa no período.
  - **Despesas**: Total pago em compras/parcelas.
  - **Lucro**: Saldo real (Recebido - Despesas).

## Detalhes Técnicos

- **Arquivos afetados**:
  - `src/routes/_authenticated/dashboard.tsx`: Remover `AuditNote`, simplificar indicadores.
  - `src/routes/_authenticated/financeiro.tsx`: Remover `AuditNote`, simplificar indicadores.
  - `src/lib/financial-kpis.functions.ts`: Ajustar cálculo do lucro para `recebido - despesas`.
- **Banco de Dados**:
  - Validar a view `vw_financeiro_indicadores` para garantir que `receita_servico` e `receita_recebida` estejam corretos conforme a expectativa do usuário.

A correção focará na unificação total dos saldos sem adicionar camadas de complexidade visual.
