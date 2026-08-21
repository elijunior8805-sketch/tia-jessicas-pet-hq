# Plano de Atualização - Central de Cobrança (Parte 2 de 3)

Transformar a Central de Cobrança em uma ferramenta intuitiva de recuperação de receita, com priorização inteligente, régua de contato, promessas, negociações e histórico completo.

## 1. Modos de Visualização
- **Funil Kanban**: Implementar visualização em colunas para as etapas de cobrança (Identificada, Lembrete, Objetiva, Firme, etc.).
- **Lista Operacional**: Refinar a listagem atual com foco em produtividade.

## 2. Priorização Inteligente (Fila do Dia)
- **Score de Prioridade**: Implementar lógica para classificar cobranças como Crítica, Alta, Média ou Baixa com base em dias de atraso, valor e promessas quebradas.
- **Explicação de Prioridade**: Exibir justificativa clara para a classificação.

## 3. Painel Lateral de Detalhes
- Ao clicar em uma cobrança, abrir um painel lateral (Sheet ou Dialog expandido) com dossiê completo: cliente, pet, histórico financeiro, histórico de mensagens e ações rápidas.

## 4. Ações Rápidas & Registro
- Botões para gerar sugestões de IA com tons variados (Gentil, Cordial, Firme, Incisivo).
- Registro estruturado de promessas de pagamento (valor, data) e negociações.
- Botão direto para abrir WhatsApp Business.

## 5. Régua Configurável
- Implementar interface para o administrador editar a régua de cobrança (intervalos, tons, templates).
- Gatilhos baseados em dias (Antes do vencimento, No vencimento, 1-3 dias, etc.).

## 6. Sincronização Financeira & Indicadores
- Garantir que pagamentos e exclusões no módulo Financeiro reflitam instantaneamente na Central de Cobrança.
- Cards de indicadores reais (Total em atraso, Valor recuperado, Promessas vencendo).

## Detalhes Técnicos
- Utilizar `createServerFn` para as novas lógicas de priorização e registro.
- Manter RLS rigoroso para permissões de alteração de valores e descontos.
- Design System: Manter a paleta "Spa de Pet Premium" (verdes floresta e dourados).
- Sincronização via `useRealtimeFinanceiro`.
