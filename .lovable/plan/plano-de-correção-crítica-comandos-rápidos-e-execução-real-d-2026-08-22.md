# Plano de Correção Crítica — Comandos Rápidos e Execução Real da Assistente IA

Este plano visa transformar os "Comandos Rápidos" da Assistente IA em execuções reais de ferramentas, garantindo que os dados sejam consultados no banco de dados e apresentados diretamente na conversa, sem redirecionamentos desnecessários ou estados de carregamento infinito.

## Objetivos
- Transformar botões de sugestão em disparadores de intenção estruturada.
- Corrigir o fluxo de "Agenda de hoje" para exibir registros reais formatados.
- Implementar busca aproximada (fuzzy search) para clientes e pets.
- Garantir que todas as ações financeiras utilizem a "Fonte da Verdade" unificada.
- Melhorar o feedback visual e botões contextuais na sidebar da IA.

## Mudanças Técnicas

### 1. Frontend: Sidebar da IA (`src/components/ia/AssistenteIaSidebar.tsx`)
- Alterar `handleSend` para detectar se o texto vem de uma sugestão e aplicar um pré-processamento de intenção se necessário.
- Melhorar a renderização de mensagens para suportar listas detalhadas de agendamentos e resumos financeiros.
- Implementar botões contextuais dinâmicos (ex: "Confirmar Agendamento", "Ver Detalhes do Cliente", "Cadastrar Novo").
- Adicionar tratamento de *timeout* real na interface.

### 2. Backend: Lógica do Agente (`src/lib/ia/ia-agente.server.ts`)
- Refinar o prompt do sistema para garantir que a IA entenda que "Agenda de hoje" deve resultar na ferramenta `consulta_agenda` com a data atual.
- Adicionar instruções de formatação de resposta para que a IA gere a tabela/lista solicitada pelo usuário.

### 3. Backend: Consultas e Ações (`src/lib/ia/ia-consultas.server.ts` & `ia-acoes.server.ts`)
- **`buscarDadosAgenda`**: Garantir suporte a filtros de `status`, `servico` e `leva_e_traz`.
- **`buscarClientesIA`**: Implementar busca aproximada usando `ilike` e processamento de strings (remoção de acentos/espaços) para lidar com "Eli" vs "Elis".
- **`consultarResumoOperacionalIA`**: Consolidar múltiplos dados (agenda, financeiro, promessas) em um único retorno atômico.
- **`validarAgendamentoIA`**: Melhorar a verificação de disponibilidade para sugerir horários próximos em caso de conflito.

### 4. Auditoria e Logs
- Garantir que cada clique em comando rápido seja registrado na tabela `ia_auditoria` com os parâmetros reais utilizados.

## Etapas de Implementação

1. **Correção do Fluxo de Comandos Rápidos**: Modificar a sidebar para que o clique não apenas envie o texto, mas já possa sugerir a intenção correta para diminuir a latência.
2. **Implementação da "Agenda de Hoje" Real**: Ajustar o handler de consulta para retornar os dados formatados conforme o exemplo do usuário.
3. **Refatoração da Busca de Clientes**: Implementar a lógica de busca aproximada no servidor.
4. **Unificação Financeira**: Validar se as consultas da IA estão batendo 100% com os novos indicadores `vw_financeiro_indicadores`.
5. **Polimento da UI**: Substituir botões genéricos por ações específicas e testar responsividade mobile.

## Testes de Validação
- Executar os 24 casos de teste descritos na solicitação (Agenda com/sem registros, nomes parecidos, faturamento do mês, etc).
- Validar se o botão "Abrir Sistema" só aparece como complemento.
- Verificar integridade de dados entre Mobile e Desktop.
