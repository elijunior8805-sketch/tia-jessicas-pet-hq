# Plano de Auditoria Forense e Contenção - Assistente IA (Parte 1)

Este plano foca na reprodução técnica dos erros, auditoria completa das camadas Frontend/Backend e implementação de mecanismos de contenção para garantir a estabilidade do ERP.

## 1. Reprodução Técnica de Erros
Documentar o comportamento exato para cada comando:
- **Agenda de hoje**: Validar retorno de tabela Markdown e tempo de resposta.
- **Quantos atendimentos**: Break-down por status.
- **Fluxo de Agendamento**: Testar timeout e duplicidade.
- **Faturamento/Receber**: Validar fonte SSOT (`vw_financeiro_indicadores`).
- **Entrada de Voz**: Testar pausas, ruídos e nomes longos.

## 2. Auditoria de Frontend (`src/components/ia/`)
- **Concorrência**: Verificar `processingRef` e `AbortController` em `useAssistenteActions.ts`.
- **Estado de Voz**: Validar separação entre `interim` e `final` transcript em `IaInputArea.tsx`.
- **Error Boundary**: Garantir que falhas na IA não afetem o layout principal.

## 3. Auditoria de Backend (`src/lib/ia/`)
- **Zod Validation**: Revisar esquemas em `ia-consultas.functions.ts` para tolerar campos ausentes com defaults.
- **Idempotência**: Verificar uso de `id_transacao_bancaria` e logs em `ia-auditoria.server.ts`.
- **Timezone**: Garantir `America/Sao_Paulo` em todas as conversões de "hoje/amanhã".

## 4. Contenção e Bloqueios
- **Revisão Obrigatória**: Manter fluxo de "Confirmar/Re-gravar" para áudio.
- **Bloqueio de Escrita**: Impedir `executarCriacaoAgendamento` se houver dúvida sobre o estado do banco após erro de rede.
- **Correlation ID**: Injetar UUID em cada comando para rastreio na tabela `auditoria_ia`.

## Detalhes Técnicos
- **Frontend**: Inclusão de log detalhado no console em ambiente de desenvolvimento.
- **Backend**: Proteção de validadores com `.parse(input || {})`.
- **Segurança**: RLS reforçado na tabela `auditoria_ia`.

---
**Critério de Conclusão**: Documentação completa da causa raiz de todos os problemas reportados e implementação da camada de contenção (Error Boundary + Idempotência).
