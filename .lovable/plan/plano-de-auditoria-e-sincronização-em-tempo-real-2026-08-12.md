# Plano de Auditoria e Sincronização em Tempo Real

Este plano visa resolver a divergência de valores entre o Dashboard e o Financeiro, além de eliminar o delay na atualização de dados (como vendas a crédito) através de uma infraestrutura robusta de Realtime e padronização de fórmulas.

## Diagnóstico Técnico
O delay e as divergências ocorrem por três motivos principais:
1. **Cache de Consulta**: O Dashboard usa `staleTime` e filtros amplos que podem reter dados antigos em memória.
2. **Dependência de Triggers**: Alguns valores (como o saldo na Cobrança) dependem de triggers no banco que, se falharem ou demorarem, causam atraso na percepção do usuário.
3. **Fórmulas Descentralizadas**: Embora exista o `atendimento-totais.ts`, algumas telas ainda calculam o "Total Executado" de forma manual na consulta SQL, o que gera diferenças de arredondamento ou lógica (ex: taxas de Leva e Traz).

## Etapas de Implementação

### 1. Padronização de Fórmulas e Realtime Global
*   **Ação**: Atualizar o `useRealtimeFinanceiro` para incluir escuta em todas as tabelas críticas (pagamentos, atendimentos, compras_parcelas, cobrancas).
*   **Ação**: Garantir que o Dashboard e o Financeiro usem a mesma função de invalidação de cache do TanStack Query ao detectar mudanças no banco.

### 2. Otimização do Dashboard (KPIs)
*   **Ação**: Refatorar a query do Dashboard para ser mais reativa.
*   **Ação**: Adicionar um indicador visual de "Sincronizando..." para dar feedback imediato ao usuário enquanto os dados são recalculados após uma venda.

### 3. Segurança e Auditoria de Valores
*   **Ação**: Criar um script de auditoria (server function) que o administrador pode rodar para verificar inconsistências entre `pagamentos` e `atendimentos`.
*   **Ação**: Corrigir a trigger de sincronização de cobranças para garantir que qualquer alteração no `valor_pago` de um pagamento reflita instantaneamente na tabela de `cobrancas`.

### 4. Correção do Fluxo de Cartão (Crédito/Débito)
*   **Ação**: Investigar o delay específico em vendas de crédito mencionado (pode ser uma regra de data de pagamento vs data de venda).
*   **Ação**: Garantir que vendas a crédito apareçam no faturamento na data da venda, e no fluxo de caixa na data prevista de recebimento (se aplicável).

## Benefícios
- **Valores Iguais**: O que você vê no Dashboard será exatamente o que está no Financeiro.
- **Atualização Instantânea**: Ao salvar uma venda, os gráficos mudam na hora.
- **Confiança nos Dados**: Sem mais "conferências manuais" para saber qual valor está certo.