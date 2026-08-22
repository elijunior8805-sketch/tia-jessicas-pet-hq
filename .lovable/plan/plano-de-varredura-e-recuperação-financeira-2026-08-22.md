# Plano de Varredura e Recuperação Financeira

## Objetivo
Localizar dados financeiros que deixaram de aparecer nas telas, auditar a integridade do banco de dados e sincronizar todos os módulos (Dashboard, Financeiro, IA) utilizando uma fonte única de verdade, sem alterações visuais.

## Ações imediatas (Auditoria)

### 1. Inventário de Dados e Tabelas
Executar consultas diretas no banco para confirmar a existência e o volume de dados históricos:
- `clientes`, `pets`, `servicos`, `agendamentos`, `atendimentos` (status `finalizado`), `pagamentos` (vínculos, `is_teste`, `arquivado_em`), `compras_parcelas` (despesas).
- Identificar se há registros órfãos ou inconsistências de status (ex: atendimento finalizado sem pagamento vinculado).

### 2. Auditoria da View Central (`vw_financeiro_indicadores`)
Validar a lógica da view SQL contra os dados brutos:
- Verificar se o filtro de `finalizado = true` em `atendimentos` está correto.
- Validar o cálculo de `valor_executado + taxa_leva_traz - desconto`.
- Confirmar se o fuso horário `America/Sao_Paulo` está sendo aplicado consistentemente em todos os agrupamentos.

## Ações de Recuperação e Sincronização

### 1. Correção do Backend (Funções e SQL)
- Se a view estiver omitindo dados, corrigi-la para incluir todos os status válidos (incluindo status antigos se necessário).
- Garantir que `is_teste` e `arquivado_em` sejam filtrados globalmente em todos os indicadores.
- Corrigir qualquer falha na função `getFinancialKPIs` que possa estar retornando `undefined` ou `0`.

### 2. Sincronização da Assistente IA
- Atualizar `src/lib/ia/ia-consultas.server.ts` para consumir `getFinancialKPIs` ou a view `vw_financeiro_indicadores` diretamente em `consultarFinanceiroIA` e `consultarResumoOperacionalIA`.
- Remover consultas manuais ad-hoc que divergem da lógica central.

### 3. Validação de Interface
- Confirmar que `src/routes/_authenticated/financeiro.tsx` e `dashboard.tsx` utilizam a mesma chave de query e função servidor.
- Validar o `useRealtimeFinanceiro` para garantir invalidação de cache em todos os módulos simultaneamente.

## Detalhes Técnicos
- **Faturamento**: `atendimentos` finalizados (Competência).
- **Recebido**: `pagamentos` com status `pago` ou `parcial` (Caixa).
- **Despesas**: `compras_parcelas` com status `pago` ou `parcial`.
- **Fuso Horário**: Oficial `America/Sao_Paulo`.
- **Integridade**: Manter auditoria via `public.ia_auditoria`.
