# Plano de Implementação — Parte 4: Agenda, Atendimentos, Encaixes e Leva e Traz

Implementação do motor operacional de agenda, controle de disponibilidade, recorrência e gestão de transporte via IA.

## 1. Agendamento Robusto e Idempotente (Backend)
- **Arquivos:** `src/lib/ia/ia-acoes.server.ts` e `src/lib/ia/ia-agente.server.ts`
- **Ações:**
    - Implementar `idempotency_key` no processo de criação para evitar duplicidade.
    - Garantir fluxo completo: Localizar -> Validar -> Disponibilidade -> Conflitos -> Taxa -> Confirmar -> Salvar -> Retornar ID real.
    - Proibir a IA de confirmar agendamentos sem sucesso no banco de dados.

## 2. Disponibilidade e Alternativas Inteligentes
- **Arquivo:** `src/lib/ia/ia-consultas.server.ts`
- **Ações:**
    - Refinar `buscarDisponibilidade` para considerar: Feriados, Profissional (se especificado), Intervalos e Leva e Traz.
    - **Regra:** Se o horário pedido estiver ocupado, a IA deve sugerir exatamente 3 alternativas reais próximas.

## 3. Gestão de Leva e Traz e Taxas
- **Ações:**
    - Implementar lógica de cálculo de taxa baseado na modalidade (Busca, Entrega, Ambos).
    - Distinguir explicitamente "Taxa Zerada" de "Sem Transporte" no contexto da IA.

## 4. Recorrência e Fila de Espera
- **Ações:**
    - Criar função para expansão de datas recorrentes (semanal, quinzenal, mensal).
    - Exibir resumo de todas as datas futuras para aprovação do usuário antes de persistir.
    - Implementar "Fila de Espera": Tabela no banco para registrar interesses quando não há vaga, com notificação proativa na Sidebar se abrir uma vaga compatível.

## 5. Risco de Falta e Encaixes
- **Ações:**
    - Analisar histórico de `no-show` do cliente e atribuir um score de risco.
    - Motor de encaixe considerando porte do pet e duração do serviço para otimizar vácuos na agenda.

## 6. Remarcação e Cancelamento (Segurança)
- **Ações:**
    - Exigir motivo explícito e auditoria em cada alteração de status.
    - Validação de permissões antes de qualquer `update`.

## Detalhes Técnicos
- **Timezone:** Estrito `America/Sao_Paulo`.
- **Integridade:** Uso de transações Supabase para operações recorrentes ou múltiplas.
