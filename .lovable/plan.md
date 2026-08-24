# Plano de Implementação: Assistente IA Operacional - Parte 2

Este plano detalha a transição para a Parte 2 da implementação da Assistente IA, focando em streaming de áudio, processamento em tempo real e resposta por voz.

## O que será construído

### Fluxo de Voz e Streaming (Tempo Real)
- Implementação de streaming de áudio bidirecional para reduzir a latência entre a fala do usuário e a resposta da IA.
- Feedback visual de "pensando" e "processando" sincronizado com o fluxo de dados.
- Resposta por voz (Text-to-Speech) integrada para confirmar ações críticas sem necessidade de leitura.

### Inteligência Preditiva e Contexto
- Refinamento do motor de contexto para prever o próximo comando com base no horário do dia e histórico do usuário.
- Mapeamento de intenções complexas (ex: "Remarcar todos os banhos de hoje à tarde para amanhã").

### Integração Profunda com Backend
- Novas ferramentas de servidor para manipulação em lote de agendamentos.
- Validação cruzada de estoque vs agenda (ex: alertar se não há shampoo suficiente para os agendamentos do dia).

## Detalhes Técnicos

### Frontend (React/TanStack)
- Atualização do `useAssistenteActions` para suportar `ReadableStream` na resposta da IA.
- Integração da Web Speech API para síntese de voz (TTS) com sotaque brasileiro natural.
- Otimização do componente `IaMessageList` para renderização progressiva de tabelas e dados.

### Backend (Server Functions)
- Criação de `ia-streaming.functions.ts` para gerenciar o fluxo de tokens do Gemini.
- Expansão de `ia-acoes.server.ts` com suporte a transações em lote (bulk operations).
- Implementação de cache de contexto de curto prazo para sessões de voz ativas.

### Banco de Dados
- Nenhuma alteração estrutural necessária; aproveitamento da tabela `ia_transcricoes` para logs de performance de áudio.

## Próximos Passos
1. Habilitar o modo de streaming no cliente IA.
2. Implementar o serviço de resposta por voz (TTS).
3. Desenvolver as ferramentas de processamento em lote na agenda.
