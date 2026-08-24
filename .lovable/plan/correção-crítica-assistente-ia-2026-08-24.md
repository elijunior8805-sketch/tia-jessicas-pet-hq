# Correção Crítica - Assistente IA

Este plano detalha a reestruturação da Assistente IA para resolver duplicidade de áudio, interrupções de resposta e restauração de comandos rápidos.

## Auditoria e Causa Raiz
A causa principal da duplicidade é que a função `handleSend` é disparada automaticamente dentro do evento `onresult` do reconhecimento de voz assim que o texto atinge 10 caracteres, sem distinguir entre transcrição parcial e final. As interrupções de streaming ocorrem devido a múltiplas chamadas simultâneas ao backend para a mesma intenção.

## Mudanças Técnicas

### 1. Núcleo de Voz (`src/lib/ia/ia-voz.ts`)
- Refatorar `VoiceRecognizer` para emitir eventos distintos para transcrições parciais (`interim`) e finais (`final`).
- Adicionar suporte a `maxAlternatives` e limpeza de ruído básica.

### 2. Estados e Lógica (`src/components/ia/hooks/useAssistenteActions.ts`)
- Implementar novos estados: `interimTranscript`, `finalTranscript` e `confirmedTranscript`.
- Implementar fluxo de estados da voz: `idle` -> `listening` -> `reviewing` -> `sending`.
- Remover o envio automático no `onResult`.
- Introduzir `command_id` e controle de idempotência para evitar execuções duplicadas.
- Restaurar a lógica de exibição de comandos rápidos nos estados apropriados.

### 3. Interface de Usuário (`src/components/ia/ui/IaInputArea.tsx` e `IaMessageList.tsx`)
- **InputArea**: Adicionar preview visual da transcrição intermediária.
- **InputArea**: Implementar botões de "Confirmar", "Gravar Novamente" e "Cancelar" após a captação do áudio.
- **MessageList**: Restaurar os "Quick Commands" (Agenda de hoje, Faturamento, etc.) na base do chat.
- **MessageList**: Impedir a criação de bolhas para resultados parciais.

### 4. Estabilidade do Streaming
- Garantir que o `AbortController` seja gerenciado por comando, não por evento de voz.
- Assegurar que tool calls completem sua execução antes da resposta final da IA.

## Detalhes Técnicos para o Usuário
- **Áudio Único**: A voz agora requer confirmação ou pausa clara para ser enviada, evitando múltiplas mensagens.
- **Comandos Rápidos**: Os botões de atalho (ex: "Agenda de hoje") voltarão a aparecer sempre que a IA não estiver processando.
- **Mobile**: Otimização de layout para que os botões não fiquem escondidos pelo teclado ou campo de texto.
