# Plano de Implementação: Lixeira Financeira e Conciliação

Este plano detalha a implementação do sistema de "Lixeira" (Soft Delete) para lançamentos financeiros (Receitas e Despesas), permitindo a restauração de registros e a sincronização automática com a Central de Cobrança, além de uma rotina de conciliação diária para auditoria.

## Alterações de Banco de Dados

1. **Soft Delete para Pagamentos (Receitas):**
   - Adicionar colunas `arquivado_em`, `arquivado_por` e `arquivado_motivo` à tabela `public.pagamentos`.
   - Criar políticas de RLS para filtrar registros arquivados por padrão nas consultas comuns.

2. **Soft Delete para Compras/Parcelas (Despesas):**
   - Adicionar as mesmas colunas (`arquivado_em`, `arquivado_por`, `arquivado_motivo`) às tabelas `public.compras` e `public.compras_parcelas`.

3. **Triggers e Funções:**
   - Atualizar a trigger `trg_pag_delete_cobranca` para que, ao arquivar um pagamento, a cobrança associada também seja arquivada automaticamente (já ocorre via `handle_pagamento_deletion`, mas garantiremos a consistência).
   - Criar uma nova trigger para a restauração: quando um registro financeiro for restaurado, a cobrança correspondente deve sair da lixeira se o pagamento voltar a estar "pendente" ou "atrasado".

4. **Tabela de Relatórios de Conciliação:**
   - Criar `public.conciliacao_logs` para registrar o resultado da rotina diária de conferência entre lançamentos financeiros e cobranças ativas.

## Backend (Server Functions)

1. **Novas Funções em `src/lib/pagamentos.functions.ts`:**
   - `arquivarPagamento`: Move um pagamento para a lixeira.
   - `restaurarPagamento`: Recupera um pagamento da lixeira e dispara a revalidação da cobrança.
   - `listarPagamentosArquivados`: Retorna a lista para a UI da Lixeira.

2. **Rotina de Conciliação em `src/lib/financeiro.functions.ts` (ou similar):**
   - `executarConciliacaoDiaria`: Função que compara `pagamentos` pendentes com registros em `cobrancas`. Identifica órfãos, duplicados ou valores divergentes.

## Frontend (UI)

1. **Aba "Lixeira" em Pagamentos em Aberto:**
   - Adicionar uma aba "Lixeira" em `src/routes/_authenticated/pagamentos-abertos.tsx`.
   - Permitir visualizar detalhes do que foi excluído e o botão "Restaurar".

2. **Indicador de Divergência:**
   - Se a conciliação detectar erros, exibir um banner de alerta no Dashboard ou no Financeiro para o administrador.

3. **Integração Realtime:**
   - Garantir que a restauração de um pagamento dispare o `useRealtimeFinanceiro`, atualizando a lista de "Pagamentos em Aberto" instantaneamente.

## Detalhes Técnicos

- **Prioridade de Coleta:** A restauração de um pagamento deve recalcular o score de prioridade da cobrança imediatamente.
- **Segurança:** Apenas usuários com `role = 'admin'` podem ver ou restaurar itens da lixeira.
- **Lógica de Órfãos:** A limpeza automática já existente (`clean_orphaned_cobrancas`) será mantida para garantir que exclusões físicas (se ocorrerem por script admin) não deixem lixo, mas a UI priorizará o Soft Delete.

