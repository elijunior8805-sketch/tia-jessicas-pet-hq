# Plano de Implementação - Parte 7: Central de Cobrança Inteligente

Implementação da Central de Cobrança integrada à Assistente IA, com foco em priorização inteligente, geração de mensagens personalizadas com múltiplos tons e gestão de promessas de pagamento.

## 1. Backend e Especialista de IA
- **Novo Arquivo `src/lib/ia/ia-cobranca.server.ts`**:
  - Criar o Especialista de Cobrança.
  - Implementar `consultarFilaCobrancaIA`: Busca inadimplentes e ordena por um score de prioridade (Valor, Dias de atraso, Tentativas, Promessas quebradas).
  - Implementar `gerarMensagensCobrancaIA`: Utiliza o Gemini para gerar 3 versões de mensagens (Direta, Firme, Extra Firme) baseadas no histórico do cliente e regras de conduta.
  - Implementar `registrarPromessaPagamentoIA`: Salva a intenção de pagamento no banco de dados (tabela `notificacoes` ou nova `cobranca_promessas`).

## 2. Esquemas e Tipos
- **`src/lib/ia/ia-agente.server.ts`**:
  - Adicionar regras rígidas no `systemPrompt` para o tom de voz "Firme" e "Extra Firme".
  - Proibir termos proibidos (ex: "medidas administrativas").
  - Definir o fluxo de "Revisão Humana" como obrigatório.

## 3. Interface da Assistente (UI)
- **`src/components/ia/AssistenteIaSidebar.tsx`**:
  - Criar um componente de visualização para a "Fila de Cobrança".
  - Implementar o carrossel de 3 versões de mensagens geradas pela IA.
  - Adicionar interface de edição de mensagem antes do envio.
  - Integrar botão de "Aprovar e Enviar" (via WhatsApp Business).
  - Adicionar formulário rápido para "Registrar Promessa" durante a conversa.

## 4. Banco de Dados (Migração SQL)
- Criar a tabela `cobranca_promessas` para rastrear compromissos financeiros.
- Adicionar colunas de controle de tentativas de contato na tabela `pagamentos`.

## Detalhes Técnicos
- **Score de Prioridade**: Algoritmo ponderado combinando `valor_total` e `vencimento`.
- **Prevenção de Plágio**: Filtro na IA para garantir que as 3 versões sejam estruturalmente diferentes (>50% de variação).
- **Segurança**: RLS para garantir que apenas usuários com cargo administrativo possam acessar ferramentas de cobrança.
