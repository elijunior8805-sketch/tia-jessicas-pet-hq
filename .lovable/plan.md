# Plano de Transformação: Assistente IA para Agente Operacional

Este plano visa converter a assistente atual em uma agente robusta e confiável, seguindo a arquitetura de "Agente com Ferramentas" e garantindo sincronia total com os dados do sistema.

## 1. Auditoria e Diagnóstico de Falhas
- **Causa da Falha:** A IA atua como um classificador de intenção passivo, sem um loop de raciocínio (ReAct) ou ferramentas integradas que permitam "pensar" antes de responder. Ela extrai dados do prompt mas não valida a existência real de clientes/pets antes de sugerir ações.
- **Modelo:** Mantendo Gemini 1.5 Flash (via Gateway Lovable) para baixa latência e suporte multimodal.
- **Correção:** Implementar um prompt de sistema rigoroso que force a IA a usar ferramentas de consulta antes de qualquer resposta definitiva.

## 2. Refatoração da Arquitetura (Agente Operacional)
- **Backend (Tools):** Unificar `ia-consultas.server.ts` e `ia-acoes.server.ts` sob um esquema de ferramentas consumível pelo prompt de sistema.
- **Intencionalidade Estruturada:** Atualizar `IAIntentSchema` para incluir metadados de confiança, rastreamento de confirmação e estados de rascunho.
- **Loop de Confirmação:** Garantir que ações de escrita (agendar, cancelar, pagar) SEMPRE passem por um estado de "Aguardando Aprovação" na UI, impedindo execuções silenciosas.

## 3. Implementação de Fluxos Críticos
- **Agendamento Inteligente:** Fluxo em etapas (Buscar Cliente -> Buscar Pet -> Verificar Disponibilidade -> Resumo -> Confirmar).
- **Tratamento de Ambiguidade:** Lógica para lidar com nomes duplicados e clientes não encontrados, oferecendo ações claras (Cadastrar, Re-pesquisar).
- **Sincronia Financeira:** Vincular as consultas de IA diretamente às views unificadas (`vw_financeiro_indicadores`).

## 4. Auditoria e Lixeira
- **Tabela de Auditoria:** Criar `public.ia_auditoria` para logar cada interação, intenção detectada e ferramenta chamada.
- **Área Administrativa:** Dashboard de monitoramento de performance da IA.

## Detalhes Técnicos
- **Sistema de Ferramentas:** Uso de um dicionário de ferramentas no `systemPrompt` para que a IA saiba *como* consultar.
- **Segurança:** Todas as funções de Agente validam RLS e permissões do usuário via Supabase.
- **Multimodalidade:** Otimizar o processamento de comprovantes para vincular automaticamente a transações bancárias (quando disponível) ou pendências exatas.

