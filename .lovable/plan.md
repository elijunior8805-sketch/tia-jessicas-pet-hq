# Plano de Implementação: Central de Mensagens Inteligente (Fase 3)

Transformação da aba de Comunicação em uma central de atendimento 360°, integrando IA, histórico unificado e gestão de cobrança proativa.

## 1. Estrutura de Dados & Backend
- **Nova Tabela/View `mensagens_threads_v2`**: Já identificada no esquema. Ela agrupa mensagens por cliente e pet, trazendo contadores de não lidas e status da conversa.
- **Server Functions**:
  - `listarThreads`: Recupera a lista de conversas ativas com filtros (não lidas, cobranças, agendamentos).
  - `obterThreadDetalhada`: Retorna o histórico completo (mensagens, agendamentos, cobranças) para um cliente específico.
  - `processarRespostaCliente`: Endpoint para registrar manualmente ou via webhook a resposta do cliente, disparando a lógica de detecção de intenção (promessa, contestação, etc.).
  - `atualizarStatusConversa`: Permite mover conversas entre status (Nova, Atenção Humana, Resolvida).

## 2. UI: Nova Central de Mensagens (Layout 3 Colunas)
Substituir a atual visualização de histórico por uma interface de chat moderna:

### Coluna Esquerda: Lista de Conversas
- Busca global (Cliente/Pet/Tel).
- Filtros rápidos: "Não lidas", "Aguardando Resposta", "Cobranças", "Atenção Humana".
- Cards de conversa com badges de status e última mensagem.

### Coluna Central: Timeline & Ações
- Timeline cronológica unificada: Mensagens (Nossas vs Cliente), registros de Check-in, Pagamentos e Promessas.
- Balão de "Sugestão da IA" persistente baseado na última resposta do cliente.
- Compositor Integrado: Acesso rápido às 3 abordagens da IA e templates.
- Botão flutuante para abertura do WhatsApp Business.

### Coluna Direita: Dossiê em Tempo Real
- Widget de Cliente/Pet com fotos.
- Resumo Financeiro: Saldo devedor total, promessas ativas.
- Próximo Agendamento: Card visual com data/hora.
- Próxima Ação Recomendada pela IA.

## 3. Inteligência & Automação
- **Intenção do Cliente**: Ao registrar uma resposta, a IA classifica em:
  - `PAGO_AMANHA` -> Sugere registro de promessa.
  - `JA_PAGUEI` -> Alerta para validação financeira.
  - `CONTESTACAO` -> Pausa réguas de cobrança automáticas e marca "Atenção Humana".
- **Auditoria**: Garantir que cada mensagem no histórico tenha `aprovado_por` e `modelo_ia` gravados.

## 4. Mobile First
- Adaptar o layout de 3 colunas para um sistema de abas deslizantes: [Lista] <-> [Chat] <-> [Dossiê].

---
*Este plano substitui a lógica de "Histórico" simples por uma ferramenta ativa de CRM e Cobrança.*
