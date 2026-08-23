# Plano de Correção do Erro de Build e Refatoração da Assistente IA

O projeto está enfrentando um erro crítico de build (`Unexpected token` no Vite) na `AssistenteIaSidebar.tsx`. Isso geralmente ocorre quando um componente ou função se torna excessivamente complexo para o transformador de produção. O plano consiste em refatorar o componente em partes menores.

## Ações Técnicas

1. **Extração de Tipos**: Mover as definições de tipos para `src/components/ia/types.ts`.
2. **Hook de Lógica**: Criar o hook `useAssistenteActions` em `src/components/ia/hooks/useAssistenteActions.ts` para conter toda a lógica de handlers, voz e chamadas de API.
3. **Componentização da UI**:
   - `IaHeader.tsx`: Cabeçalho premium.
   - `IaMessageList.tsx`: Área de scroll e renderização de mensagens.
   - `IaInputArea.tsx`: Campo de texto, upload e botões de ação.
4. **Simplificação do Componente Principal**: `AssistenteIaSidebar.tsx` passará a ser apenas um orquestrador leve que utiliza o hook e os sub-componentes.

## Detalhes de Implementação

- Garantir que todas as importações em `useAssistenteActions.ts` apontem corretamente para os arquivos `.functions.ts` e `.server.ts`.
- Manter a compatibilidade com `framer-motion` para animações suaves.
- Verificar o build com `bun run build` após cada etapa significativa.

O objetivo final é reduzir o tamanho do arquivo `AssistenteIaSidebar.tsx` de ~1500 linhas para menos de 200, resolvendo o problema do transpiler.
