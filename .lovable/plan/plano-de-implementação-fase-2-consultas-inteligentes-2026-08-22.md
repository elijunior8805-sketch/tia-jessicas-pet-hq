# Plano de Implementação - Fase 2: Consultas Inteligentes

Implementação da capacidade de consulta a dados reais para a Assistente IA, abrangendo agenda, clientes, pets e financeiro, seguindo o fluxo de "Somente Leitura" para esta etapa.

## 1. Infraestrutura de Servidor (Server Functions)

Criar novos helpers de servidor para extrair dados estruturados que a IA possa consumir facilmente.

- **src/lib/ia/ia-consultas.server.ts**:
  - `buscarDadosAgenda(filtros)`: Consulta `agendamentos` com joins em `pets` e `clientes`.
  - `buscarDadosClientesPets(termo)`: Busca difusa em `clientes` e `pets`.
  - `buscarDadosFinanceiros(filtros)`: Consulta `pagamentos` e `cobrancas`.
  - `buscarDisponibilidade(servico, data, profissional)`: Lógica para encontrar slots livres.

- **src/lib/ia/ia-consultas.functions.ts**:
  - Wrappers `createServerFn` para as funções acima, garantindo segurança e RLS.

## 2. Refinamento do Cérebro (NLP & Prompt)

Atualizar a `classificarComandoIA` em `src/lib/ia/ia-agente.server.ts` para integrar com o Gemini e usar o contexto real.

- Substituir a lógica de palavras-chave por uma chamada ao Gemini via `ia-core.server.ts`.
- Alimentar o prompt com metadados do sistema (ex: data atual, profissionais disponíveis) para aumentar a precisão.
- Garantir que a IA retorne a intenção correta e os parâmetros para a consulta.

## 3. Fluxo de Execução da Assistente

Alterar o handler principal para seguir o padrão de "Busca -> Resposta":

1. **Interpretação**: IA identifica a intenção de consulta e extrai parâmetros.
2. **Execução Técnica**: Chamada ao `ia-consultas.server.ts` para buscar dados reais.
3. **Formatação de Resposta**: IA recebe os dados brutos e gera uma resposta natural e interativa (Markdown).
4. **Interatividade**: Adicionar links/botões na resposta para "Abrir agendamento" ou "Ver telefone".

## 4. UI e Experiência do Usuário

- Atualizar `AssistenteIaModal.tsx`:
  - Renderização de Markdown para as respostas da IA.
  - Exibição de tabelas ou listas formatadas para resultados financeiros/agenda.
  - Lógica de "Continuidade": manter o contexto da última consulta (ex: "E o próximo?").

## Detalhes Técnicos

- **Segurança**: As consultas usarão o cliente Supabase do contexto autenticado, respeitando RLS.
- **Confiabilidade**: A IA será instruída explicitamente a dizer "Não encontrei" em vez de inventar dados.
- **Performance**: Uso de cache curto para consultas frequentes de disponibilidade.

## Critérios de Aceite

- [ ] Consulta de agenda retorna dados reais e permite navegação.
- [ ] Busca de clientes lida com nomes duplicados pedindo clarificação.
- [ ] Dados financeiros (pendências, recebimentos) batem com o módulo Financeiro.
- [ ] IA não executa nenhuma alteração (Insert/Update/Delete) nesta fase.
