# Plano de Correção e Auditoria — Assistente IA Operacional

Este plano visa auditar e corrigir os comandos rápidos da Assistente IA, garantindo que executem intenções reais, consultem dados do backend em tempo real e forneçam respostas estruturadas dentro do chat, conforme as regras de negócio do Spa de Pet Tia Jéssica.

## Problemas Identificados
- Comandos rápidos (Agenda de hoje, Faturamento, etc.) ficam em processamento infinito ou pedem para abrir o sistema manualmente.
- A IA não retorna a lista de agendamentos ou dados financeiros formatados diretamente na conversa.
- A busca de clientes é rígida (exige nome exato) e não oferece sugestões aproximadas.
- O fluxo de agendamento não é conversacional e falta validação de dados incompletos (datas sem ano/mês).

## Ações Propostas

### 1. Auditoria e Roteamento de Intenções (Backend)
- **Refinar o Classificador**: Atualizar `src/lib/ia/ia-agente.server.ts` para garantir que comandos rápidos mapeiem para intenções estruturadas com parâmetros de data injetados dinamicamente (usando `America/Sao_Paulo`).
- **Implementar Busca Aproximada (Fuzzy Search)**: Ajustar `buscarClientesIA` em `src/lib/ia/ia-consultas.server.ts` para utilizar `ilike` com curingas e, se necessário, uma lógica de ranking de similaridade básica para sugerir nomes como "Eli" quando o usuário buscar "Elis".

### 2. Ferramentas Operacionais e Respostas (Frontend & Backend)
- **Agenda de Hoje**: Garantir que `consultarAgendaIA` retorne os dados reais e a `AssistenteIaSidebar.tsx` renderize uma tabela Markdown (Horário | Pet | Serviço | Status).
- **Contagem de Atendimentos**: Implementar quebra por status (Confirmados, Finalizados, etc.) diretamente na resposta.
- **Resumo Financeiro**: Unificar a consulta à `vw_financeiro_indicadores` para que "Faturamento do mês" e "Valores a receber" batam exatamente com o Dashboard.
- **Resumo Operacional**: Consolidar agenda, próximo pet, indicadores financeiros e promessas de pagamento em uma única resposta prioritária.

### 3. Fluxo de Conversa e Ações (UI/UX)
- **Agendamento Conversacional**: Alterar a lógica para que, ao clicar em "Criar agendamento", a IA inicie perguntando os dados e valide passo a passo (Cliente -> Pet -> Serviço -> Data/Hora).
- **Tratamento de Datas**: Implementar a lógica de "próxima ocorrência" para datas incompletas (ex: "dia 28" -> "28 de Agosto de 2026").
- **Botões Contextuais**: Substituir botões genéricos por ações específicas como "Cadastrar Cliente", "Confirmar Data", "Abrir Cobrança", etc.
- **Prevenção de Duplicidade**: Desabilitar botões durante o processamento para evitar cliques duplos e timeouts.

### 4. Auditoria e Logs
- **Registro Detalhado**: Garantir que `ia_auditoria` capture o tempo de resposta, a ferramenta chamada e o resultado final (ID do registro criado ou erro).
- **Tratamento de Erros**: Exibir mensagens claras em caso de timeout ou falha de banco, oferecendo o botão "Tentar novamente".

## Detalhes Técnicos
- **Frontend**: `src/components/ia/AssistenteIaSidebar.tsx`.
- **Backend (Server Functions)**: `src/lib/ia/ia-consultas.server.ts`, `src/lib/ia/ia-acoes.server.ts`, `src/lib/ia/ia-agente.server.ts`.
- **Timezone**: Fixo em `America/Sao_Paulo` para todas as conversões de "hoje", "amanhã" e períodos financeiros.
- **Segurança**: RLS mantido; as ferramentas de IA respeitam o `userId` do contexto autenticado.
