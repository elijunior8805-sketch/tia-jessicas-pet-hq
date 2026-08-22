# Plano de Correção e Unificação Financeira Premium

Este plano visa remover imediatamente o texto técnico exposto na interface, restaurar a integridade visual da página Financeiro e unificar a lógica de indicadores entre Dashboard e Financeiro, seguindo as diretrizes de competência e caixa.

## Ações Imediatas

### 1. Remoção de Texto Técnico e "Auditoria"
- **Assistente IA**: Remover a nota técnica no estado inicial de mensagens em `src/components/ia/AssistenteIaModal.tsx`.
- **Prompt de Sistema**: Limpar as instruções de fallback sobre "CORREÇÃO FINANCEIRA CONTROLADA" em `src/lib/ia/ia-agente.server.ts`.
- **Páginas**: Garantir que nenhum componente como `AuditNote` (se ainda existir referenciado dinamicamente) seja renderizado.

### 2. Restauração e Melhoria da Página Financeiro
- **Filtros de Período**: Implementar seletor visível (Hoje, Semana, Mês, 30 dias, Personalizado) com exibição clara do intervalo analisado abaixo do título.
- **Conceitos Financeiros**:
    - Renomear "Faturamento" para "Faturamento por Competência".
    - Renomear "Recebido" para "Recebido no Período".
    - Renomear "Lucro Real" para "Resultado por Competência" (Lucro Competência).
    - Adicionar Tooltips explicativos para cada card.
- **Saldo de Caixa**: Adicionar um novo indicador/card para "Saldo de Caixa do Período" (Recebidos - Despesas Pagas + Aportes).

### 3. Sincronização e Fonte Única
- **Backend (View)**: Revisar a view `vw_financeiro_indicadores` para garantir que os valores de R$ 25,00 (competência) e R$ 1.885,00 (caixa) sejam explicáveis por data de atendimento vs data de pagamento.
- **Server Function**: Atualizar `getFinancialKPIs` para retornar a estrutura completa exigida pela nova interface.

## Detalhes Técnicos

### Interface (UI)
- Utilização de `shadcn/ui` (Cards, Tooltips, Select) com o design system premium (oklch).
- Organização responsiva (grid) para evitar espaços vazios após a remoção do texto técnico.

### Lógica de Dados
- **Faturamento**: Baseado na data de fim do atendimento (`encerrado_em` ou `data`).
- **Recebido**: Baseado na `data_pagamento` dos registros em `pagamentos`.
- **Despesas**: Baseado na `data_pagamento` em `compras_parcelas`.

## Testes e Validação
- Comparação manual entre Dashboard e Financeiro para o período de Julho/2026.
- Validação de layout mobile (sem quebras).
- Verificação de que o botão da IA não sobrepõe ações críticas.

