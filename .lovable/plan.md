# Plano de Implementação: Central de Mensagens Inteligente (Fase 3)

Transformação da aba de Comunicação em uma central de atendimento 360°, integrando IA, histórico unificado e gestão de cobrança proativa.

## 1. Estrutura de Dados & Backend
- **Thread Management**: Utilizar a view `mensagens_threads_v2` para consolidar a lista de conversas.
- **Novas Server Functions em `comunicacao-central.functions.ts`**:
  - `listarConversas`: Listagem com filtros de status e busca.
  - `obterDossieConversa`: Dados unificados de cliente, pet, financeiro e histórico para a conversa selecionada.
  - `registrarRespostaIA`: Processa a resposta do cliente usando IA para detectar intenções (Promessa, Pagamento, Contestação, Insatisfação).

## 2. Interface (UI) - Layout de 3 Colunas
Refatorar a aba de Histórico/Comunicação para um layout tipo "Inbox":
- **Coluna Esquerda (Conversas)**: Lista de clientes com contadores de mensagens e badges de status (Nova, Atenção Humana, Cobrança).
- **Área Central (Timeline)**: Chat cronológico integrando mensagens enviadas e recebidas, além de eventos de sistema (Check-in, Pagamentos).
- **Painel Direito (Contexto)**: Widget fixo com dados do pet, saldo devedor, promessas ativas e botões de ação rápida.

## 3. Fluxo Inteligente
- **Detecção de Resposta**: Quando o operador registra uma resposta, a IA sugere automaticamente:
  - Registro de Promessa (se o cliente disser que paga amanhã).
  - Pausa de cobrança (se houver contestação).
  - Alerta de "Atenção Humana" (em caso de insatisfação).
- **Histórico Auditável**: Cada mensagem registrará quem aprovou, o modelo da IA usado e se houve edição manual do texto sugerido.

## 4. Mobile
- Implementar navegação por abas ou drawer lateral para garantir que as 3 colunas sejam acessíveis em telas pequenas sem perda de funcionalidade.

---
Este plano foca na integração definitiva entre a comunicação e o financeiro, transformando a "Central de Mensagens" no coração operacional do Spa.
