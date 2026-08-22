# Plano de Implementação - Fase 4: Financeiro e Comprovantes pela Assistente IA

Este plano descreve a implementação da Parte 4 da Assistente IA, focada em operações financeiras, baixa de pagamentos e processamento de comprovantes.

## 1. Expansão do Cérebro da IA (Agente)
- Atualizar o prompt do sistema em `ia-agente.server.ts` para incluir as regras de negócio da Fase 4.
- Adicionar novas intenções ao `IAIntentSchema`: `registrar_pagamento`, `analisar_comprovante`, `cancelar_pagamento`.
- Refinar a extração de parâmetros para incluir valores, formas de pagamento e datas.

## 2. Processamento de Comprovantes (OCR/Visão)
- Implementar suporte para upload de imagens no `AssistenteIaModal.tsx`.
- Criar `ia-comprovante.server.ts` para processar imagens de comprovantes PIX usando Gemini 1.5 Flash (capacidades de visão).
- Extrair automaticamente: Valor, Data/Hora, Pagador/Recebedor e ID da transação.

## 3. Ações Financeiras (Server-Side)
- Criar `registrarPagamentoIA` em `ia-acoes.server.ts` para processar a baixa no banco de dados.
- Implementar lógica de **Pagamento Parcial**:
  - Se o valor pago for menor que o total, atualizar `valor_pago` e manter status `pendente`.
  - Se o valor for igual, marcar como `pago`.
  - Se o valor for maior, solicitar confirmação extra ou decisão do gerente.
- Implementar `cancelarPagamentoIA` com exigência de motivo e registro em logs de auditoria.

## 4. Fluxo de Confirmação na Interface
- Atualizar o `AssistenteIaModal.tsx` para exibir um resumo detalhado da baixa antes da execução.
- O resumo incluirá: Cliente, Pet, Valor Original, Valor Recebido, Saldo Restante e Comprovante (se houver).
- Adicionar botões de ação para confirmação ou cancelamento da operação sugerida pela IA.

## 5. Auditoria e Sincronização
- Garantir que todas as baixas via IA sejam registradas na tabela `ia_auditoria`.
- Implementar gatilhos de atualização em tempo real para as telas de Financeiro e Cobrança após a baixa bem-sucedida.

## Detalhes Técnicos
- **Modelos**: Gemini 1.5 Flash para análise de imagens e texto.
- **Validação**: Verificação rigorosa de duplicidade de comprovantes (ID da transação PIX).
- **Segurança**: RLS do Supabase garantirá que apenas usuários autorizados realizem operações financeiras.
- **Auditoria**: Registro detalhado de quem, quando e por que realizou a operação.
