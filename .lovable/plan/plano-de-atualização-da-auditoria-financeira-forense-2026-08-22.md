# Plano de Atualização da Auditoria Financeira Forense

O objetivo é substituir o texto de auditoria atual na página Financeiro e no arquivo de documentação pelo novo texto literal solicitado, que detalha os problemas de divergência e os objetivos da etapa de diagnóstico forense.

## Alterações Sugeridas

### 1. Documentação de Auditoria
- **Arquivo:** `AUDITORIA_FINANCEIRA.md`
- **Ação:** Substituir todo o conteúdo do arquivo pelo novo texto da "AUDITORIA FINANCEIRA FORENSE — NÃO ALTERAR DADOS".

### 2. Interface do Usuário (Painel Financeiro)
- **Arquivo:** `src/routes/_authenticated/financeiro.tsx`
- **Ação:** Atualizar o componente `AuditNote` para exibir o novo texto completo.
- **Detalhe:** Como o texto é extenso, ele será renderizado dentro de um container com scroll ou área de destaque para manter a legibilidade sem comprometer o layout da página.

## Detalhes Técnicos
- Utilização da propriedade `whitespace-pre-wrap` para preservar as quebras de linha do texto original.
- Garantia de que o texto seja tratado como literal de exibição, sem interferir na lógica de dados do sistema.

