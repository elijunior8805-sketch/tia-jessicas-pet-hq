# Plano de Implementação: Exportação Financeira (PDF/CSV) com Auditoria

Este plano descreve a adição da funcionalidade de exportação de relatórios financeiros em formatos PDF e CSV, garantindo que os dados exportados incluam as notas de auditoria e os totais por categoria, utilizando a mesma fonte de dados unificada do sistema.

## Alterações

### 1. Backend & Types
- Nenhuma alteração de esquema necessária (utilizaremos a view `vw_financeiro_indicadores` e a função `getFinancialKPIs` já existentes).
- Atualizar `FinPdfData` em `src/lib/financeiro-pdf.ts` para incluir um campo opcional para as notas de auditoria.

### 2. PDF & CSV Generation (`src/lib/`)
- **PDF**: Modificar `generateFinanceiroPDF` em `src/lib/financeiro-pdf.ts` para renderizar a seção de "Notas de Auditoria" no final do documento, caso fornecida.
- **CSV**: Criar `src/lib/financeiro-csv.ts` para gerar um arquivo CSV estruturado contendo os KPIs, Entradas e Saídas do período.

### 3. UI Components (`src/components/`)
- Criar `src/components/RelatorioFinanceiroExport.tsx`: Um componente que renderiza botões de exportação (PDF/CSV) e gerencia a coleta de dados necessários para a exportação.

### 4. Financeiro & Dashboard Integration (`src/routes/_authenticated/`)
- **Financeiro**: Integrar o novo componente de exportação na barra de ações da página `financeiro.tsx`.
- **Dashboard**: Adicionar a opção de exportação na seção financeira do Dashboard para acesso rápido.

## Detalhes Técnicos
- O CSV será gerado manualmente via string builder para evitar dependências extras, garantindo compatibilidade com Excel (usando BOM e delimitador `;`).
- A nota de auditoria será extraída da constante já definida no componente `AuditNote`.
- A exportação respeitará o período (`from`, `to`) selecionado pelo usuário na interface.

## Verificação
- Testar exportação PDF em desktop e mobile (via Blob URL).
- Verificar se os valores no PDF/CSV batem exatamente com os exibidos na tela.
- Confirmar que a nota de auditoria de Julho/2026 está presente no documento gerado.
