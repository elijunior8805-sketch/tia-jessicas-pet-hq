AUDITORIA FINANCEIRA FORENSE — NÃO ALTERAR DADOS

PROJETO

Spa de Pet Tia Jéssica.

PERÍODO ANALISADO

01/07/2026 até 31/07/2026, considerando o fuso horário oficial do sistema.

PROBLEMA

Com o mesmo período selecionado:

DASHBOARD

Faturamento: R$ 607,00;

Despesas: R$ 90,00;

Lucro: R$ 517,00;

Ticket médio: R$ 67,44;

Atendimentos: 9;

Aportes: R$ 0,00.

FINANCEIRO

Receita bruta: R$ 1.682,00;

Total recebido: R$ 707,00;

Despesas: R$ 90,00;

Lucro estimado: R$ 1.592,00;

Saldo do período: R$ 617,00;

A receber: R$ 730,00;

Vencidos: R$ 730,00;

Ticket médio: R$ 67,44;

Pendências: 7.

OBJETIVO DESTA ETAPA

Identificar exatamente a origem das divergências sem modificar dados, fórmulas, consultas, componentes, tabelas ou registros.

PROIBIDO NESTA ETAPA

Alterar valores;

Corrigir status;

Excluir duplicidades;

Modificar consultas;

Criar tabelas;

Criar views;

Modificar o frontend;

Alterar os cards;

Recalcular e gravar valores;

Executar migração;

Corrigir automaticamente.

Esta etapa é exclusivamente de diagnóstico.

MAPEAR A ORIGEM DOS INDICADORES

Para cada indicador das duas telas, apresentar:

Componente ou card;

Consulta utilizada;

Tabela ou view;

Campos;

Relacionamentos;

Fórmula;

Data utilizada;

Status incluídos;

Filtros;

Tratamento de cancelamentos;

Tratamento de exclusão lógica;

Tratamento de pagamentos e estornos.

EXPLICAR OS R$ 607,00

Listar os nove atendimentos que formam os R$ 607,00:

ID;

Data;

Cliente;

Pet;

Serviços;

Valor bruto;

Desconto;

Taxa;

Valor líquido;

Status;

Pagamentos vinculados.

Confirmar matematicamente:

Soma dos atendimentos;

Quantidade;

Ticket médio.

EXPLICAR OS R$ 1.682,00

Listar cada registro que compõe os R$ 1.682,00:

ID;

Tabela;

Tipo;

Data usada pelo filtro;

Cliente;

Atendimento;

Valor;

Status;

Motivo de inclusão.

EXPLICAR OS R$ 1.075,00 DE DIFERENÇA

Comparar as duas listas e identificar exatamente os registros presentes nos R$ 1.682,00, mas ausentes nos R$ 607,00.

Classificar cada registro:

Atendimento realizado;

Agendamento não realizado;

Futuro;

Cancelado;

Duplicado;

Registro de teste;

Pagamento contabilizado como faturamento;

Outro período;

Excluído logicamente;

Sem vínculo;

Necessita validação humana.

A soma desses registros deverá explicar exatamente R$ 1.075,00.

EXPLICAR OS R$ 707,00 RECEBIDOS

Listar todos os pagamentos:

ID;

Cliente;

Atendimento;

Competência;

Data do pagamento;

Valor;

Forma;

Status;

Estorno;

Comprovante.

Separar:

Pagamentos de atendimentos de julho;

Pagamentos recebidos em julho referentes a outras competências.

EXPLICAR OS R$ 730,00 PENDENTES

Listar as sete pendências:

ID;

Cliente;

Atendimento;

Valor líquido;

Valor recebido;

Saldo;

Vencimento;

Status.

Confirmar:

Soma dos saldos;

Se todas estão realmente vencidas;

Se alguma está duplicada;

Se pertencem à competência de julho ou ao total geral da carteira.

VERIFICAR A DATA DO FILTRO

Confirmar se cada tela utiliza:

Data do atendimento;

Data de competência;

Data de criação;

Data de vencimento;

Data de pagamento.

Informar se o filtro termina em:

31/07/2026 23:59:59 no fuso do sistema;

ou se existe erro de limite ou fuso horário.

APRESENTAR A CAUSA

Ao concluir, informar:

Qual fonte o Dashboard utiliza;

Qual fonte o Financeiro utiliza;

Qual regra gera os R$ 607,00;

Qual regra gera os R$ 1.682,00;

Qual regra está incorreta;

Quais registros são afetados;

Qual é a correção mínima recomendada;

Quais módulos serão impactados.

RELATÓRIO OBRIGATÓRIO

Apresentar:

Indicador Dashboard Financeiro Fonte Dashboard Fonte Financeiro Causa da diferença Valor correto proposto

PONTO DE PARADA OBRIGATÓRIO

Depois de apresentar o relatório, interromper a execução.

Não aplicar nenhuma correção.

Aguardar autorização expressa para modificar o banco, as consultas ou os componentes.
