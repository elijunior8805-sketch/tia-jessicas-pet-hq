# Plano de Implementação - Parte 7: Pagamentos e Comprovantes pela Assistente IA

Esta fase foca na automação segura da baixa de pagamentos e no processamento inteligente de comprovantes (IA Vision), garantindo integridade financeira e prevenindo duplicidades.

## 1. Processamento de Comprovantes (IA Vision)
- **Importação Multimodal**: Suporte a JPG, PNG, WEBP e PDF (via upload, câmera ou arrastar/soltar).
- **Extração de Dados**:
    - Campos obrigatórios: Valor, Data, Instituição, Pagador, Identificador (End-to-End).
    - Regra: Nunca inventar dados ilegíveis.
- **Detecção de Duplicidade**:
    - Verificar `id_transacao_bancaria` e `hash` do arquivo contra registros existentes para impedir reuso de comprovantes.

## 2. Inteligência de Correspondência
- **Localização de Pendências**:
    - Busca automática por Valor Exato + Nome do Cliente.
    - Se houver múltiplos resultados (ex: cliente com 2 dívidas iguais), a IA deve solicitar a escolha manual na UI.
- **Tratamento de Pagamentos Parciais/Excedentes**:
    - **Parcial**: Registrar baixa parcial, manter saldo e manter cobrança aberta.
    - **Excedente**: Não criar crédito automático; sinalizar para intervenção humana autorizada.

## 3. Fluxo de Baixa e Confirmação
- **Resumo de Baixa**: Exibir comparativo (Saldo Anterior vs. Saldo Posterior) antes da confirmação.
- **Gravação Segura**: Vincular o comprovante ao registro de pagamento no banco de dados.

## 4. Auditoria e Sincronização
- Log detalhado em `ia_auditoria` incluindo IDs de pagamento e comprovante.
- Invalidação automática de cache via `useRealtimeFinanceiro` para atualizar Dashboard e Financeiro instantaneamente.

## Detalhes Técnicos
- **Arquivos**:
    - `src/lib/ia/ia-comprovante.server.ts`: Lógica de visão computacional e extração.
    - `src/lib/ia/ia-financeiro.functions.ts`: Funções de interface para o componente.
    - `src/components/ia/AssistenteIaSidebar.tsx`: UI de upload, pré-visualização e seleção de pendência.
