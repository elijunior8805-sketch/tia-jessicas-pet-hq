# Plano de Implementação: Importação e Reconhecimento de Comprovantes via IA

Implementação do fluxo completo de anexo, análise por Visão Computacional (Gemini 1.5 Flash) e baixa financeira automatizada com confirmação humana na Assistente IA.

## 1. Infraestrutura e Armazenamento
- Criar bucket `comprovantes` no Supabase Storage via migração SQL.
- Configurar políticas RLS para acesso privado (apenas usuários autenticados).
- Adicionar coluna `comprovante_url` e `meta_dados_ia` na tabela `pagamentos` para vincular o arquivo e os dados extraídos.

## 2. Interface da Assistente IA (Frontend)
- **Botão de Anexo**: Inserir ícone de clipe no campo de input da `AssistenteIaSidebar.tsx`.
- **Upload Progressivo**: Implementar lógica de seleção de arquivo (JPG, PNG, PDF), validação de tamanho (limite 5MB) e upload para o Storage.
- **Preview de Arquivo**: Mostrar miniatura do anexo acima do campo de texto com botão para remover ou visualizar.
- **Feedback Visual**: Estados de "Lendo comprovante...", "Identificando dados..." e "Procurando pendência...".

## 3. Inteligência de Visão e Análise (Backend)
- **ia-comprovante.server.ts**: Refatorar para suportar envio de imagens/PDFs para o Gemini 1.5 Flash.
- **Extração de Dados**: Capturar Valor, Data, Pagador, ID da Transação (Pix), Instituição e Nível de Confiança.
- **Segurança**: Sanitizar o texto extraído para evitar "Prompt Injection" (tratar como dado puro).

## 4. Fluxo de Operação e Baixa Financeira
- **Matching Inteligente**: Buscar automaticamente por clientes e pendências financeiras que coincidam com o valor e nome extraídos do comprovante.
- **Card de Conferência**: Exibir na conversa um card premium com os dados lidos vs. dados do sistema.
- **Tratamento de Divergências**: Identificar pagamentos parciais, excedentes ou duplicados (pelo hash do arquivo ou ID da transação).
- **Confirmação Humana**: Botão "Confirmar Baixa" obrigatório para efetivar a transação no banco de dados.

## Detalhes Técnicos
- Utilizar `createServerFn` para processamento seguro no servidor.
- Garantir atomicidade: a baixa financeira e o vínculo do comprovante devem ocorrer em uma única transação.
- Registro completo em log de auditoria para cada ação da IA.
- Suporte a PDF multi-página via processamento de visão.

## Testes e Validação
- Testar upload via mobile (câmera) e desktop (drag & drop).
- Validar reconhecimento de comprovantes Pix dos principais bancos (Nubank, Itaú, Bradesco, etc).
- Verificar sincronização em tempo real com o Dashboard e Financeiro após a baixa.
