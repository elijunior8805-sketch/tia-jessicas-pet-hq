# Plano de Implementação — Parte 3: Clientes, Pets, Serviços e Visão 360°

Implementação do motor de busca em camadas, resolução de ambiguidades e visões consolidadas para a Assistente IA.

## 1. Busca em Camadas e Normalização (Backend)
- **Arquivo:** `src/lib/ia/ia-consultas.server.ts`
- **Ações:**
    - Criar função `normalizarTermo(termo: string)` para remover acentos, caracteres especiais e espaços extras.
    - Atualizar `buscarClientesIA` para executar buscas sequenciais:
        1. ID exato.
        2. Telefone normalizado (removendo máscaras).
        3. Nome exato e nome parcial (fuzzy search com `ilike`).
        4. Busca por nome do pet associado.
    - Garantir que a busca nunca retorne "não encontrado" sem antes tentar todas as camadas.

## 2. Resolução de Nomes Duplicados (UI/UX)
- **Arquivo:** `src/components/ia/AssistenteIaSidebar.tsx`
- **Ações:**
    - Detectar quando a busca retorna > 1 resultado.
    - Exibir componente de seleção (`SelectionCard`) com:
        - Nome completo do cliente.
        - Telefone mascarado (ex: (11) 9****-1234).
        - Bairro (se disponível).
        - Lista de pets vinculados.
    - Bloquear prosseguimento automático até a escolha do usuário.

## 3. Visão 360° do Cliente e Pet
- **Arquivos:** `src/lib/ia/ia-consultas.server.ts` e `src/lib/ia/ia-agente.server.ts`
- **Ações:**
    - Criar `obterDados360Cliente(id: string)`: Retorna cadastro, histórico de gastos, serviços habituais, pets e pendências.
    - Criar `obterDados360Pet(id: string)`: Retorna raça, porte, temperamento, última visita e restrições.
    - Integrar esses dados no prompt do sistema para que a IA responda com contexto total.

## 4. Especialista em Serviços e NBA (Next Best Action)
- **Ações:**
    - Refinar `consultarServicosIA` para filtrar apenas serviços ativos e retornar detalhes técnicos reais.
    - Implementar "Próxima Melhor Ação": Após um agendamento ou consulta, a IA sugere ações contextuais (ex: "Vi que o Pet X tem uma vacina pendente, deseja agendar?").

## 5. Relatório Fotográfico e Segurança
- **Ações:**
    - Integrar análise visual de fotos de banho e tosa (antes/depois) sem emitir diagnósticos médicos.
    - Adicionar camada de confirmação para qualquer alteração em dados de clientes/pets.

## Detalhes Técnicos
- **Timezone:** Manter `America/Sao_Paulo` em todas as operações.
- **Segurança:** Respeitar as permissões de RLS do Supabase em todas as chamadas de servidor.
