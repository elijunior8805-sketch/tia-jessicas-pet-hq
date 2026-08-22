# Plano de Implementação: Assistente Operacional IA (Fase 1)

Este plano estabelece a base da Assistente IA para o Spa de Pet Tia Jéssica, focando na interface, processamento de voz/texto e classificação de intenções, sem realizar alterações no banco de dados nesta etapa.

## 1. Interface e Componentes (UI/UX)
- Criar `src/components/ia/AssistenteIaBotao.tsx`: Botão flutuante fixo "Assistente IA".
- Criar `src/components/ia/AssistenteIaModal.tsx`: Interface da assistente com:
  - Área de chat (mensagens do usuário e da IA).
  - Barra de ferramentas: Botão de microfone, transcrição editável, botão enviar.
  - Indicadores de estado: "Gravando...", "Processando...", "Aguardando Confirmação".
- Integrar o botão no `src/routes/__root.tsx` para disponibilidade global.

## 2. Entrada por Voz e Texto
- Implementar `src/lib/ia-voz.ts` utilizando a Web Speech API para:
  - Captura de áudio e conversão para texto (PT-BR).
  - Gestão de permissões de microfone.
- Permitir edição manual da transcrição antes do envio.

## 3. Classificação de Intenções e Extração (NLP)
- Criar `src/lib/ia-agente.server.ts` (ou expandir `ia-core`):
  - Definir o `IAIntentSchema` com Zod (conforme estrutura solicitada: intenção, cliente, pet, serviços, etc.).
  - Configurar prompt de sistema para o Gemini 1.5 Flash atuar como classificador estruturado.
  - Implementar lógica de contexto de curto prazo (sessão atual).

## 4. Fluxo de Operação e Segurança
- Implementar estados de operação: `RECEBIDO`, `INTERPRETADO`, `RESUMO_PENDENTE`, `CONFIRMADO`.
- Criar componente de "Resumo de Ação" para consultas e pré-confirmação humana.
- Validar permissões do usuário antes de processar intenções sensíveis.

## 5. Auditoria e Logs
- Criar `src/lib/ia-auditoria.functions.ts` para registrar cada interação (comando, transcrição, intenção, erros) em uma estrutura temporária/log para análise futura (sem alterar tabelas operacionais agora).

## Detalhes Técnicos
- **Model:** Gemini 1.5 Flash (via Lovable AI Gateway).
- **Voz:** Web Speech API (Browser-native).
- **Estado:** React `useState` e `useReducer` para gerenciar o complexo estado da conversa/contexto.
- **Segurança:** Verificação de roles via `useMyAccess` e validação no `handler` do Server Function.
