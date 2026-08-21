# Plano de Atualização - Fila Inteligente e Compositor IA (Parte 1)

Transformar a aba "Comunicação e IA" em uma central inteligente com priorização real e geração de mensagens hiper-personalizadas baseadas em contexto.

## Ações Realizadas
- Auditoria de rotas e stack: TanStack Start + Supabase + Tailwind v4 + Recharts.
- Verificação do esquema de banco de dados (`mensagem_sugestoes`, `cobrancas`, `mensagens`).
- Análise do núcleo de IA (`ia-core.server.ts`, `ia-geracao.server.ts`, `comunicacao-central.server.ts`).

## Mudanças Necessárias

### 1. Fila Inteligente (FilaProativaTab)
- **Interface:** Substituir o grid/lista simples por uma tabela ou lista rica com campos de: Motivo, Prioridade (Badge), Tom Sugerido, Último Contato e Ações Rápidas.
- **Enriquecimento:** Melhorar `listarFilaEnriquecida` para incluir análise de promessas quebradas e silêncio do cliente (>48h/72h).
- **Ações:** Implementar botões de "Adiar", "Resolver" e "Gerar Mensagem" diretamente na linha.

### 2. Compositor Inteligente (Novo Componente)
- Criar um novo fluxo de composição que permita:
  - Selecionar objetivo (Cobrança, Lembrete, Reativação).
  - Orientação livre para a IA ("Fale que o pet estava muito feliz hoje").
  - Geração de 3 abordagens simultâneas (Direta, Firme, Incisiva).
  - Refino rápido (Mais acolhedor, Mais firme, etc.).
  - Comparação visual com a última mensagem enviada para evitar repetição.

### 3. Lógica de Geração IA (ia-geracao.server.ts)
- **Prompt Expandido:** Incluir histórico de mensagens anteriores no prompt para a IA não repetir a mesma abordagem.
- **Validação:** Reforçar a guarda de saída para impedir tons inadequados ou termos proibidos.
- **Diversidade:** Garantir que o modelo gere 3 versões estruturalmente diferentes.

### 4. Registro e Auditoria
- Garantir que cada geração e edição seja salva em `mensagens` (audit log) com metadados de IA.

## Detalhes Técnicos
- Utilizar `createServerFn` para novas ações de geração múltipla.
- Sincronizar estados com `useRealtimeFinanceiro` ou invalidação de queries do TanStack.
- Manter o foco 100% no WhatsApp Business através do helper `abrirWhatsAppBusiness`.

Não haverá alterações no cadastro de clientes ou pets, apenas no fluxo de comunicação.
