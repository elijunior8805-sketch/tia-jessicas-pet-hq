# Plano de Implementação - Parte 5: Contagem de Atendimentos e Consultas Financeiras

Esta fase transforma o Assistente IA em uma ferramenta de consulta operacional e financeira precisa, garantindo paridade total entre as respostas da IA, o Dashboard e o Financeiro.

## 1. Ferramentas de Contagem de Atendimentos
- **Aprimorar `contar_atendimentos`** em `ia-consultas.server.ts`:
    - Adicionar filtros por `status` (agendado, confirmado, em_atendimento, finalizado, cancelado, falta).
    - Adicionar filtros operacionais: `leva_e_traz` (boolean) e `servico_nome` (ex: "banho").
    - Implementar lógica robusta de períodos (hoje, ontem, esta semana, este mês, mês passado).
- **Aprimorar `listar_atendimentos`**:
    - Retornar metadados para permitir ações como "abra o primeiro" ou filtros subsequentes.

## 2. Unificação de Consultas Financeiras
- **Integrar `consultar_resumo_financeiro` com a Fonte de Verdade**:
    - Utilizar a lógica da função `getFinancialKPIs` (que consome `vw_financeiro_indicadores`).
    - Métricas obrigatórias: Faturamento (Competência), Recebido (Caixa), Despesas, Resultado (Lucro), Saldo (Caixa), Ticket Médio.
    - Novas métricas para IA: `vencidos` (pendências com data < hoje) e `a_receber`.
- **Garantir Timezone `America/Sao_Paulo`**:
    - Centralizar a interpretação de datas para evitar divergências de "hoje" entre o servidor e a UI.

## 3. Estruturação do Ciclo IA-Backend (Phase 5)
- **Prompt do Sistema**: Atualizar `ia-agente.server.ts` para instruir a IA a sempre consultar o backend antes de responder sobre quantidades ou valores.
- **Formatação de Resposta**: Garantir que a IA informe o período e os filtros aplicados na resposta final.

## 4. Segurança e Auditoria
- Registrar cada consulta financeira e de agenda na tabela `ia_auditoria`.
- Validar permissões: Garantir que a IA utilize o contexto do usuário autenticado.

## Detalhes Técnicos
- **Arquivos**:
    - `src/lib/ia/ia-consultas.server.ts`: Lógica de banco (SQL/Supabase).
    - `src/lib/ia/ia-agente.server.ts`: Definição de intenções e sistema de prompt.
    - `src/components/ia/AssistenteIaSidebar.tsx`: UI para exibição de listas e resumos.
