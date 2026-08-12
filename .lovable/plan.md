# Plano de Correção: Ticket Médio e Aportes/Ajustes

O objetivo deste plano é corrigir a exibição do Ticket Médio (que está zerado) e a lógica de Aportes e Ajustes (que está incorretamente exibindo o total recebido) tanto no Dashboard quanto no Financeiro.

## Alterações Técnicas

### 1. Dashboard (`src/routes/_authenticated/dashboard.tsx`)
- **Ticket Médio**: Revisar o cálculo da variável `bilhete`. O valor está zerado provavelmente porque a lista `executados` está vindo vazia devido ao filtro de `encerrado_em` ou status `finalizado`. Vou garantir que o filtro seja resiliente a fusos horários e que considere atendimentos válidos.
- **Aportes e Ajustes**: Corrigir a query de `pagamentosRes`. Atualmente ela busca categorias que não sejam "servico", mas o usuário especificou que aportes devem ser apenas categorias específicas. Vou filtrar explicitamente por `aporte` e `ajuste`.

### 2. Financeiro (`src/routes/_authenticated/financeiro.tsx`)
- **Resumo Financeiro**: Ajustar as variáveis `ticketMedio` e `aportesAjustes` para seguirem as mesmas regras do Dashboard.
- **Filtro de Aportes**: Garantir que o cálculo de `aportesAjustes` utilize apenas as categorias `aporte` e `ajuste` definidas no sistema.

### 3. Sincronização de Fórmulas
- Garantir que `valorRealExecutado` seja consistente em ambos os arquivos, incluindo `taxa_leva_traz` e subtraindo `desconto` corretamente.

## Verificação
- Validar se o Ticket Médio reflete a média real dos atendimentos concluídos no período.
- Validar se o campo Aportes exibe apenas entradas manuais de capital/ajuste, sem misturar com vendas de serviços ou produtos.
