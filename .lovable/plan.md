# Plano de Atualização Visual - Assistente Operacional IA

Este plano descreve a reestruturação visual completa da Assistente IA para torná-la um painel lateral sofisticado no desktop e em tela cheia no mobile, integrado à identidade visual premium do Spa de Pet Tia Jéssica.

## Alterações Funcionais e de Layout

### 1. Estrutura do Painel (Layout)
- **Desktop**: Transformar de modal central em painel lateral fixo à direita.
  - Largura: 480px.
  - Altura: 100% da tela útil (vh).
  - Comportamento: Overlay suave ou deslocamento de conteúdo (preferencialmente overlay sobre o conteúdo da página).
  - Funcionalidade de minimizar/fechar.
- **Mobile**: Abrir em tela cheia (full screen).
  - Cabeçalho fixo no topo.
  - Campo de mensagem fixo no rodapé.
  - Otimização para safe-areas e teclado virtual.

### 2. Cabeçalho Refinado
- Ícone de "Sparkles" animado.
- Título "Assistente Operacional IA".
- Status dinâmico: "Disponível", "Consultando dados...", "Aguardando confirmação...", "Executando...", "Falha".
- Botões de fechar e minimizar elegantes.

### 3. Interface de Conversa (Chat)
- **Mensagens do Usuário**: Alinhadas à direita, fundo dourado (#C99845), texto branco, bordas arredondadas (canto superior direito reto).
- **Mensagens da IA**: Alinhadas à esquerda, fundo branco, bordas sutis, identificação discreta.
- **Cards Financeiros**: Design compacto com indicadores claros (Faturamento, Recebido, Período, Fonte).
- **Cards de Confirmação**: Destaque visual para ações críticas (Agendamento, Pagamento) com botões "Confirmar", "Alterar" e "Cancelar".

### 4. Ações Rápidas e Estados
- Sugestões compactas na abertura: "Agenda de hoje", "Próximos banhos", "Resumo financeiro".
- Estados visuais de processamento humanizados: "Verificando a agenda...", "Consultando faturamento...".
- Ocultar detalhes técnicos (JSON, logs, nomes de funções) de todas as mensagens.

### 5. Campo de Mensagem (Input)
- Campo compacto com botões de microfone (áudio), anexo e enviar.
- Botão "Enviar" ativo apenas com conteúdo válido.
- Placeholder atualizado: "Pergunte sobre agenda, clientes ou financeiro...".

### 6. Identidade Visual Premium
- Uso das cores: Verde Profundo (#123F2A), Creme (#F5F2EA), Dourado (#C99845).
- Sombras elegantes e bordas suaves (radius-2xl).
- Tipografia "Fraunces" para títulos e "Plus Jakarta Sans" para mensagens.

## Detalhes Técnicos
- Utilização de `framer-motion` para animações de entrada/saída do painel lateral.
- Refatoração do componente `src/components/ia/AssistenteIaModal.tsx` para suportar o novo layout.
- Implementação de sub-componentes para Cards Financeiros e Confirmações para manter o código limpo.
- Garantir que a lógica da IA (`ia-agente.server.ts` e `functions.ts`) permaneça intacta, alterando apenas a apresentação dos dados.
- Uso de `shadcn/ui` (ScrollArea, Button, etc.) customizados com a identidade do projeto.
- Implementação de hooks para detectar mobile e ajustar o layout dinamicamente.

## Critérios de Sucesso
- A janela não obstrui a visão do sistema no desktop mais do que o necessário (apenas lateral).
- O layout mobile está perfeitamente funcional, sem cortes.
- Nenhuma informação técnica vaza para o usuário final.
- O visual está em total harmonia com o restante do ERP Premium.
