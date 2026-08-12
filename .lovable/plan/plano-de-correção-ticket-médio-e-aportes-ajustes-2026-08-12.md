# Plano de Correção: Ticket Médio e Aportes/Ajustes

O usuário identificou que o **Ticket Médio** e a aba **Aportes e Ajustes** estão zerados nos resumos do Dashboard e Financeiro. Com base nas respostas interativas, as regras de negócio foram definidas.

## Alterações

### 1. Dashboard (`src/routes/_authenticated/dashboard.tsx`)
- **Problema**: O ticket médio ignora taxas e o KPI de Aportes/Ajustes não existe no card inicial.
- **Solução**:
    - Atualizar o cálculo de `bilhete` para usar `valorRealExecutado(a)` (que já inclui taxas e subtrai descontos).
    - Adicionar a busca e o cálculo de **Aportes e Ajustes** na `queryFn` do dashboard, buscando na tabela `pagamentos` registros com categoria diferente de `servico`.
    - Adicionar um novo card de KPI ou integrar o valor de Aportes no resumo de faturamento para visibilidade.

### 2. Financeiro (`src/routes/_authenticated/financeiro.tsx`)
- **Problema**: O cálculo de `aportesAjustes` está restrito apenas às categorias literais "aporte" e "ajuste".
- **Solução**:
    - Alterar o filtro para incluir qualquer `categoria_receita` que **não** seja `servico` (conforme resposta: "Entradas Diversas").
    - Ajustar o cálculo do `ticketMedio` para garantir que ele use o valor total recebido (incluindo taxas) dos atendimentos.

### 3. Lib de Totais (`src/lib/atendimento-totais.ts`)
- **Refinamento**: Garantir que as funções de soma sejam usadas consistentemente para evitar discrepâncias.

## Detalhes Técnicos
- A correção é focada na lógica de `useMemo` e `queryFn` dentro dos componentes de rota.
- Nenhuma alteração de esquema de banco de dados é necessária, apenas ajuste nos filtros e fórmulas de agregação em tempo de execução.

---
**Deseja prosseguir com a implementação destas correções?**