# Plano de Correção Financeira Controlada e Centralizada

Este plano estabelece a transição da fase de diagnóstico para a fase de correção ativa, centralizando toda a lógica financeira no backend e unificando a exibição em todas as interfaces.

## 1. Centralização no Backend (Single Source of Truth)

*   **Implementação de View Consolidada**: Criar `public.vw_financeiro_unificado` que combine `atendimentos`, `pagamentos` e `compras_parcelas`.
*   **Regras de Faturamento**: A view filtrará apenas atendimentos com `finalizado = true` ou `status = 'concluido'`, excluindo explicitamente cancelamentos e registros de teste.
*   **Diferenciação Competência vs. Caixa**:
    *   `valor_faturamento`: Baseado na data do atendimento (competência).
    *   `valor_recebido`: Baseado na data de pagamento (caixa).

## 2. Unificação das Interfaces

*   **Dashboard**: Refatorar o componente de carregamento de dados para consumir a nova view centralizada, garantindo que "Faturamento" em julho/2026 seja idêntico ao valor no Financeiro.
*   **Painel Financeiro**: Atualizar os KPIs de topo para utilizar os mesmos campos da view centralizada.
*   **Assistente IA**: Atualizar `ia-consultas.server.ts` para ler da fonte unificada, garantindo que as respostas da IA batam com o que o usuário vê na tela.

## 3. Atualização da Nota de Auditoria e Fallback IA

*   **Financeiro**: Substituir a nota de diagnóstico atual pela nova nota de "CORREÇÃO FINANCEIRA CONTROLADA" detalhando os objetivos e proteções.
*   **IA Agente**: Atualizar o fallback de erro para refletir a transição da auditoria para a execução da correção.

## Detalhes Técnicos

*   **Tabelas Afetadas**: `atendimentos`, `pagamentos`, `compras_parcelas`.
*   **Migração SQL**: Criação da view e permissões de `GRANT` para a função de auditoria.
*   **Frontend**: 
    *   `src/routes/_authenticated/dashboard.tsx`
    *   `src/routes/_authenticated/financeiro.tsx`
    *   `src/lib/ia/ia-consultas.server.ts`
*   **Validação**: Teste rigoroso do período 01/07/2026 a 31/07/2026 comparando Dashboard vs Financeiro.

## Proteção e Reversão

*   Operações realizadas dentro de transações DB quando possível.
*   Backup dos totais atuais antes de qualquer `UPDATE` em massa (se necessário).
