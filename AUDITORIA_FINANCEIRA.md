CORREÇÃO FINANCEIRA CONTROLADA — UTILIZAR O DIAGNÓSTICO ANTERIOR

Utilize exclusivamente as evidências apresentadas na auditoria financeira forense do período de 01/07/2026 a 31/07/2026.

OBJETIVO

Corrigir a causa comprovada da divergência entre Dashboard e Financeiro, centralizar os indicadores no backend e garantir sincronização permanente.

PROTEÇÃO

Antes da alteração:
- Criar backup;
- Registrar totais anteriores;
- Registrar quantidade de registros;
- Salvar a lista dos IDs afetados;
- Preparar reversão;
- Não apagar históricos;
- Não alterar registros não relacionados ao problema.

CORREÇÃO MÍNIMA

Aplicar somente as correções comprovadas pelo diagnóstico.
Dar prioridade a corrigir:
- Consulta;
- View;
- Função;
- Status;
- Filtro;
- Relacionamento;
- Duplicidade comprovada;
- Data de referência.

Não recriar toda a estrutura financeira sem necessidade.

FONTE ÚNICA

Centralizar no backend:
- Faturamento por competência;
- Atendimentos realizados;
- Ticket médio faturado;
- Recebido no período;
- Saldo em aberto;
- Saldo vencido;
- Despesas;
- Resultado por competência;
- Saldo de caixa.

Dashboard, Financeiro, Caixa, Cobrança, relatórios e Assistente IA deverão consumir essa mesma fonte.

NOMES CORRETOS

Utilizar:
- Faturamento por competência;
- Recebido no período;
- Resultado por competência;
- Saldo de caixa do período;
- Saldo em aberto;
- Saldo vencido;
- Ticket médio faturado.

Não chamar conceitos diferentes pelo mesmo nome.

REGRA DO FATURAMENTO

Somar apenas atendimentos válidos e realizados no período de competência.
Não incluir:
- Agendamentos futuros;
- Não realizados;
- Cancelados;
- Faltas sem cobrança válida;
- Duplicados;
- Testes;
- Pagamentos como nova receita;
- Registros de outros períodos.

COMPETÊNCIA E CAIXA

Não obrigar: Faturamento = Recebido no período.
Faturamento utiliza competência.
Recebimento utiliza data do pagamento.
Se os valores forem diferentes por esse motivo, manter a diferença e explicar claramente na interface.

OPERAÇÃO ATÔMICA

A correção deverá ocorrer integralmente.
Se qualquer etapa falhar:
- Reverter a operação;
- Não deixar valores parciais;
- Não deixar módulos divergentes;
- Registrar o erro.

ATUALIZAÇÃO

Depois da correção:
- Invalidar cache;
- Recalcular pela fonte central;
- Atualizar todas as abas;
- Atualizar desktop;
- Atualizar mobile;
- Atualizar relatórios;
- Atualizar Assistente IA.

TESTE DE JULHO

Aplicar o período: 01/07/2026 até 31/07/2026.
Comparar em todas as telas:
- Faturamento;
- Recebido;
- Despesas;
- Resultado;
- Saldo de caixa;
- Em aberto;
- Vencido;
- Ticket médio;
- Atendimentos;
- Pendências.

O mesmo conceito deverá mostrar exatamente o mesmo valor.

TESTES DE REGRESSÃO

Testar:
- Pagamento integral;
- Pagamento parcial;
- Estorno;
- Cancelamento;
- Desconto;
- Taxa;
- Filtros;
- Relatórios;
- Desktop;
- Mobile;
- Atualização em tempo real.

Executar testes em transação reversível ou ambiente isolado. Não deixar dados de teste nos indicadores reais.

RELATÓRIO FINAL

Apresentar:
- Causa confirmada;
- Correção realizada;
- Arquivos, funções, views ou consultas alteradas;
- Registros corrigidos;
- Valores anteriores;
- Valores posteriores;
- Resultado de cada teste;
- Confirmação de que todas as telas utilizam a fonte central.

Não declarar concluído se Dashboard e Financeiro continuarem utilizando consultas ou fórmulas independentes.
