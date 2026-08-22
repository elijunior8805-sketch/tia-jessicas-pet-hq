# Plano de Implementação - Parte 3 de 5: Agenda e Cadastros pela Assistente IA

Este plano descreve a implementação da Fase 3 da Assistente IA, permitindo a criação, remarcação e cancelamento de agendamentos, além de integração com cadastros de clientes e pets, seguindo fluxos de confirmação e segurança.

## Objetivos
- Habilitar ações de escrita (CREATE, UPDATE, DELETE) via IA.
- Implementar fluxo de confirmação humana para ações críticas.
- Garantir integridade dos dados (validação de disponibilidade, duplicidade e vínculos).
- Prover interface de feedback em tempo real para o usuário validar as intenções da IA.

## Etapas de Implementação

### 1. Backend e Lógica de IA (Servidor)
- **Atualizar Classificador (`src/lib/ia/ia-agente.server.ts`)**:
    - Expandir o System Prompt para incluir regras de criação de agendamento, remarcação e cancelamento.
    - Adicionar instruções detalhadas para extração de parâmetros (transporte, serviços, datas, horários).
    - Implementar lógica de detecção de "informações faltantes" para que a IA peça o que falta antes de tentar salvar.
- **Novas Funções de Ação (`src/lib/ia/ia-acoes.server.ts`)**:
    - `validarAgendamentoIA`: Verifica disponibilidade de horário, profissional e transporte.
    - `executarCriacaoAgendamentoIA`: Efetua o insert na tabela `agendamentos` e `agendamento_servicos`.
    - `executarRemarcacaoIA`: Atualiza data/hora de um agendamento existente.
    - `executarCancelamentoIA`: Altera status para 'cancelado' com motivo.
- **Integração de Cadastros**:
    - Criar helper para verificar duplicidade de clientes/pets durante o fluxo.

### 2. Funções de Servidor (TanStack Start)
- Criar `src/lib/ia/ia-acoes.functions.ts` exportando as funções acima com `createServerFn` e middleware de autenticação.

### 3. Interface da Assistente (`src/components/ia/AssistenteIaModal.tsx`)
- **Fluxo de Confirmação (UI)**:
    - Criar sub-componentes visuais para "Cards de Confirmação" (Resumo do Agendamento).
    - Adicionar botões "Confirmar" e "Corrigir/Cancelar" dentro do chat.
- **Seleção de Entidades**:
    - Se a IA encontrar múltiplos clientes/pets, renderizar uma lista de botões para escolha manual do usuário.
- **Tratamento de Erros**:
    - Exibir avisos claros de "Horário Ocupado" com sugestões alternativas.
- **Retorno de Cadastro**:
    - Lógica para detectar quando um cliente não existe e oferecer o botão de cadastro, retomando o fluxo após o sucesso.

### 4. Segurança e Regras de Negócio
- Implementar verificação de duplicidade estrita (Mesmo cliente + pet + data + hora + serviço).
- Garantir que a IA nunca salve sem o clique de confirmação do usuário (segurança transacional).

## Detalhes Técnicos
- **Modelos**: Gemini 1.5 Flash para processamento de linguagem natural.
- **Banco de Dados**: Transações via Supabase (PostgreSQL) para garantir que agendamento e serviços sejam criados atomicamente.
- **Validação**: Zod para todos os inputs de ações.
