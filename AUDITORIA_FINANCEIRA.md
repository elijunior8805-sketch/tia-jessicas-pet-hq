AUDITORIA E CONCILIAÇÃO FINANCEIRA DEFINITIVA NO BANCO DE DADOS

PROJETO

Spa de Pet Tia Jéssica.

NÍVEL DE PRIORIDADE

Crítico.

OBJETIVO PRINCIPAL

Uma única fonte financeira de verdade. Divergências futuras são detectadas automaticamente.

RESULTADO OBRIGATÓRIO

1. Dashboard = Financeiro (Centavo por centavo).
2. Auditoria = Relatório (Batimento 100%).

MAPA COMPLETO DA ORIGEM DOS VALORES

Cada atendimento possui um valor financeiro rastreável. A chave primária é o agendamento_id.

DICIONÁRIO FINANCEIRO OFICIAL

VALOR BRUTO: Soma de todos os serviços.
ACRÉSCIMOS: Taxas extras (Leva e Traz, Adicionais).
DEDUÇÕES: Descontos manuais ou cupons.
TICKET MÉDIO FATURADO: (Bruto + Acréscimos) - Deduções.
VALOR RECUPERADO: Entradas de dívidas antigas.
VALOR ESTORNADO: Devoluções de pagamentos.
SALDO BANCÁRIO: Entradas reais - Saídas reais.

REGRAS DE SEGURANÇA

1. Não apagar registros financeiros. Usar "Lixeira" com auditoria.
2. Não zerar saldos sem justificativa registrada.
3. Não inventar datas. Usar a data real da operação financeira.
4. Mapa de linhagem financeira obrigatório em todas as consultas.
