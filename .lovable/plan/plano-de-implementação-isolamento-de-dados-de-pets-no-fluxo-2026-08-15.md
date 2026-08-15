# Plano de Implementação: Isolamento de Dados de Pets no Fluxo de Banho

Este plano descreve as alterações necessárias para garantir que as informações do cadastro geral do pet não sejam automaticamente importadas ou exibidas no check-in e nos relatórios de banho, conforme as novas regras de privacidade.

## Alterações Propostas

### 1. Painel de Atendimentos (`src/routes/_authenticated/atendimentos.index.tsx`)
- Remover o componente `AlertChips` dos cards de "Aguardando check-in", "Em andamento" e "Finalizados hoje".
- Isso evita a exibição automática de alergias, temperamento e outras informações do cadastro antes/durante o atendimento.

### 2. Detalhes do Atendimento (`src/routes/_authenticated/atendimentos.$atendId.tsx`)
- Remover a seção de alertas que exibe dados do cadastro do pet no topo da página.
- Ajustar a inicialização do estado local para que campos como `focinheira` e `pausa` dependam apenas do que foi registrado no atendimento (`usou_focinheira`, `precisou_pausa`), sem referência aos dados do cadastro geral.
- Garantir que as observações e recomendações sejam limpas se não houver registro prévio no atendimento.

### 3. Gerador de PDF de Atendimento (`src/lib/atendimento-pdf.ts`)
- Alterar a seção "Registro do check-in" para remover referências automáticas aos dados do cadastro do pet (`pet.alergias`, `pet.necessita_focinheira`).
- A seção passará a exibir apenas:
  - `Usou focinheira` (se registrado no atendimento).
  - `Precisou de pausa` (se registrado no atendimento).
- Remover a seção específica "Alergias do pet" que puxava dados diretamente do cadastro geral.
- Manter "Comportamento observado", "Observações de check-in" e "Recomendações ao tutor" como fontes exclusivas de informação para o relatório.

## Detalhes Técnicos
- Utilizar `atendimento.usou_focinheira` em vez de `pet.necessita_focinheira`.
- Garantir que as observações de check-in e recomendações ao tutor sejam as únicas fontes de texto livre para o relatório.
- Não haverá remoção de colunas no banco de dados, apenas alteração na lógica de exibição e fluxo de dados na UI e PDF.
