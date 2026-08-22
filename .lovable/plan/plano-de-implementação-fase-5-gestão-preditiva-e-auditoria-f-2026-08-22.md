# Plano de Implementação - Fase 5: Gestão Preditiva e Auditoria Final

Este plano detalha a implementação da última etapa da Assistente IA, focada em inteligência gerencial, análise de risco de evasão e auditoria completa do sistema.

## 1. Expansão das Intenções (Cérebro IA)
- Atualizar o `IAIntentSchema` em `src/lib/ia/ia-agente.server.ts` para incluir:
    - `solicitar_resumo_operacional` (Status do dia, prioridades, alertas).
    - `analisar_risco_evasao` (Identificação de clientes sumidos).
    - `sugerir_otimizacao_agenda` (Encaixes e distribuição).
- Refinar o prompt do sistema para interpretar comandos gerenciais complexos.

## 2. Implementação do Resumo Operacional
- Criar `consultarResumoIA` em `src/lib/ia/ia-consultas.server.ts`:
    - Total de agendamentos do dia (confirmados, atrasados, cancelados).
    - Status do Leva e Traz.
    - Pendências financeiras críticas.
    - Promessas de pagamento vencendo hoje.

## 3. Análise de Risco de Evasão (Predição)
- Criar `analisarEvasaoIA` em `src/lib/ia/ia-consultas.server.ts`:
    - Calcular frequência histórica por pet.
    - Identificar pets com atraso superior a 50% do intervalo médio.
    - Classificar níveis de risco (Baixo, Médio, Alto).
    - Gerar justificativas baseadas em dados reais ("Há 45 dias sem retorno, média de 30").

## 4. Otimização e Reativação na UI
- Atualizar `AssistenteIaModal.tsx`:
    - Adicionar suporte a visualização de cards de risco.
    - Botão de ação "Gerar Mensagem de Reativação" (integrado com WhatsApp).
    - Sugestões de encaixe em horários vagos identificados.

## 5. Auditoria Final e Polimento
- Revisão de RLS em todas as tabelas acessadas pela IA.
- Testes de concorrência (ex: dois agendamentos no mesmo segundo via IA).
- Verificação de compatibilidade mobile (responsividade dos cards de resumo).
- Validação final de permissões (Manager/Admin apenas para financeiro).

## Detalhes Técnicos
- **Algoritmo de Evasão**: Baseado em desvio padrão dos intervalos entre atendimentos finalizados.
- **Segurança**: Uso estrito de `supabaseAdmin` apenas para leituras analíticas em ambiente seguro, respeitando a privacidade dos dados.
- **UX**: Respostas markdown com formatação rica para facilitar a leitura gerencial.
