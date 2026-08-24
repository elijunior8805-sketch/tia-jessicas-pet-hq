# Plano de Implementação — Programas de Cuidado (Parte 2)

Este plano detalha a implementação da **Parte 2** do módulo de Programas de Cuidado, focando na contratação (venda), gestão de créditos e integração com a Agenda.

## 1. Banco de Dados (Lovable Cloud)

Criar a estrutura para suportar a persistência das contratações e o livro de movimentação de créditos.

### Tabelas
- `public.programas_contratados`: Registro da venda/contratação com snapshots da composição no momento da venda.
- `public.programas_creditos_movimentacoes`: Livro de razão para controle de créditos (entradas, saídas, reservas).
- `public.programa_contratado_status` (enum): `aguardando_pagamento`, `ativo`, `suspenso`, `vencido`, `concluído`, `cancelado`.
- `public.credito_movimentacao_tipo` (enum): `credito_criado`, `credito_reservado`, `credito_consumido`, `reserva_liberada`, `ajuste_manual`, `credito_expirado`, `cancelamento`, `estorno`.

### Segurança (RLS)
- Habilitar RLS em ambas as tabelas.
- Políticas de `SELECT` para usuários autenticados do mesmo estabelecimento.
- Políticas de `INSERT/UPDATE` restritas a `admin` e `proprietario`.
- `GRANT` de acesso para as roles `authenticated` e `service_role`.

## 2. Lógica de Servidor (Server Functions)

Desenvolver as funções em `src/lib/programas-cuidado.functions.ts`.

- `contratarPrograma`: Valida cliente/pet, cria o registro de contratação com snapshots e gera os créditos iniciais no livro de movimentações.
- `getCreditosDisponiveis`: Calcula o saldo atual de créditos de um pet baseado no histórico de movimentações.
- `reservarCredito`: Cria uma movimentação do tipo `credito_reservado` vinculada a um agendamento.
- `consumirCredito`: Converte uma reserva em consumo definitivo ao finalizar o atendimento.
- `liberarReserva`: Devolve o crédito se o agendamento for cancelado.
- `prorrogarValidade`: Atualiza a data de validade com auditoria e motivo.

## 3. Interface do Usuário (UI)

### Fluxo de Venda (`/gestao/programas-cuidado`)
- Modal/Wizard de contratação:
  - Busca de cliente (resolvendo homônimos).
  - Filtro de pets vinculados.
  - Seleção de programa ativo.
  - Exibição da composição, valor, validade e regras.
  - Confirmação de transporte e forma de pagamento.
  - Resumo final e confirmação com proteção contra clique duplo (idempotência).

### Integração com a Agenda (`/agenda`)
- Ao selecionar um pet:
  - Indicador visual de programa ativo ("Thor possui o programa X").
  - Botão para "Usar Crédito" no formulário de agendamento.
  - Exibição de saldo (Disponível vs. Reservado).
- Resumo do agendamento:
  - Valor coberto por créditos.
  - Adicionais a pagar (tosa, transporte extra, etc.).

## 4. Proteções e Regras de Negócio

- **Idempotência**: Uso de `idempotency_key` em todas as operações de crédito para evitar duplicidade por lentidão ou múltiplos cliques.
- **Isolamento**: Créditos vinculados estritamente ao pet selecionado; transferência exige permissão especial e auditoria.
- **Validade**: Bloqueio automático de uso para programas vencidos ou não pagos (com override para proprietário).

## Detalhes Técnicos
- Utilização de `createServerFn` para garantir que a lógica de crédito (livro de razão) seja processada no servidor.
- Uso de `z.coerce.date()` no Zod para tratar datas vindas do frontend.
- Implementação de auditoria em cada alteração manual ou prorrogação.
