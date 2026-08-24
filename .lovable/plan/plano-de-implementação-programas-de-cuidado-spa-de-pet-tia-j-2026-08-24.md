# Plano de Implementação — Programas de Cuidado (Spa de Pet Tia Jéssica)

Este plano visa corrigir e expandir o módulo de "Programas de Cuidado", garantindo a criação, edição e gestão completa de programas e serviços, com foco em usabilidade, segurança e integridade de dados.

## 1. Auditoria e Correção do Botão "Novo Programa"
- **Investigação:** Verificar no arquivo `src/routes/_authenticated/gestao/programas-cuidado.tsx` por que o botão dispara apenas um `toast.info`.
- **Correção:** Implementar o estado `isDialogOpen` e o componente `ProgramaFormDialog` (ou similar) para abrir ao clicar no botão.
- **Permissões:** Garantir que o botão/ação só esteja disponível para perfis `admin` ou `proprietario` (via RLS e verificações no frontend).

## 2. Gestão de Serviços Integrada
- **Conceito:** Manter a distinção entre **Serviço** (item individual do catálogo) e **Programa** (pacote de serviços).
- **Novo Fluxo de Serviço:** 
    - Adicionar modal para criação de serviço dentro do formulário de programa.
    - Campos: Nome, Categoria, Descrição (curta/completa), Itens inclusos (lista), Valor, Duração, Porte.
- **Edição:** Permitir editar serviços existentes, com arquivamento em vez de exclusão se houver histórico.

## 3. Formulário de "Novo Programa" (Step-by-Step)
Implementar um formulário multi-etapas no `ProgramaFormDialog`:
- **Etapa 1: Identificação:** Nome, descrições, categoria e status.
- **Etapa 2: Composição:** Seleção de serviços do catálogo, definição de quantidades e ordenação.
- **Etapa 3: Regras e Transporte:** Validade, agendamento pós-vencimento, regras de cancelamento e configuração de transporte (incluso/taxa).
- **Etapa 4: Financeiro:** Cálculo automático de economia baseada na soma dos serviços vs. preço do programa.
- **Etapa 5: Revisão:** Resumo final antes de salvar.

## 4. Edição e Persistência de Dados
- **Upsert:** Refatorar a função `upsertPrograma` para suportar todas as novas propriedades e garantir que snapshots sejam criados para contratos já vendidos (preservando o histórico).
- **Duplicação:** Implementar a funcionalidade de "Duplicar" programa para agilizar a criação de novos planos.
- **Soft Delete:** Impedir a exclusão de programas/serviços com movimentações financeiras ou créditos gerados, utilizando status `arquivado`.

## 5. Modernização do Layout (Premium Design)
- **Visual:** Aplicar a paleta da marca (Verde-escuro, Dourado, Creme) com alto contraste.
- **Cards:** Redesenhar os cards dos programas para destacar: Nome (Verde-escuro), Preço (Dourado), Economia (Verde), e Lista de Serviços (Background suave).
- **Responsividade:** Ajustar layout para 3 colunas (desktop), 2 (tablet) e 1 (mobile), garantindo que botões e preços não quebrem ou fiquem sobrepostos (especialmente pelo botão da Assistente IA).

## 6. Segurança e Auditoria
- **RLS:** Revisar e aplicar políticas de `GRANT` e `POLICY` para as tabelas `programas_de_cuidado` e `programas_de_cuidado_itens`.
- **Logs:** Integrar a função `registrarAuditoriaPrograma` em todas as ações de escrita.

## Detalhes Técnicos
- **Tabelas Afetadas:** `public.programas_de_cuidado`, `public.programas_de_cuidado_itens`, `public.servicos`.
- **Funções TanStack:** `upsertPrograma`, `getProgramasCatalogo`, `duplicarPrograma`.
- **UI:** Shadcn/ui (Dialog, Tabs, Card, Button, Input, Select, Badge) + Lucide React.
