# Plano de Implementação: Módulo de Programas de Cuidado (Parte 1)

Este plano descreve a implementação da primeira fase do módulo "Programas de Cuidado", abrangendo a estrutura de banco de dados, catálogo e interface básica.

## 1. Banco de Dados (Supabase)

### Novas Tabelas
- **`public.programas_de_cuidado`**: Catálogo de programas pré-pagos.
  - Campos: `id`, `estabelecimento_id` (UUID), `nome`, `descricao`, `status` (enum: rascunho, ativo, inativo), `preco_do_programa` (numeric), `valor_normal_dos_servicos` (numeric), `economia` (numeric), `validade_em_dias` (int), `permite_parcelamento` (bool), `inclui_transporte` (bool), `modalidade_transporte` (text), `quantidade_transportes` (int), `valor_transporte` (numeric), `regras` (text), `criado_por` (uuid), `criado_em`, `updated_at`.
- **`public.programas_de_cuidado_itens`**: Itens que compõem cada programa.
  - Campos: `id`, `programa_id` (FK), `servico_id` (FK para `public.servicos`), `quantidade` (int), `valor_unitario_de_referencia` (numeric), `valor_alocado` (numeric), `ordem_de_exibição` (int).

### Segurança (RLS & Grants)
- Habilitar RLS em ambas as tabelas.
- Políticas:
  - `SELECT`: Usuários `authenticated` vinculados ao estabelecimento/empresa.
  - `INSERT/UPDATE/DELETE`: Apenas `proprietario` ou `admin`.
- Conceder privilégios `SELECT, INSERT, UPDATE, DELETE` para o role `authenticated` (conforme as políticas) e `ALL` para `service_role`.

### Semente (Seeds)
- Inserção dos 4 programas iniciais configuráveis:
  1. **Banho Essencial**: 2 banhos.
  2. **Rotina em Dia**: 4 banhos.
  3. **Cuidado & Hidratação**: 2 banhos + 1 hidratação.
  4. **Ritual Spa Tia Jéssica**: 4 banhos + 2 hidratações.

## 2. Lógica de Servidor (Server Functions)

Criar `src/lib/programas-cuidado.functions.ts` com:
- `getProgramasCatalogo`: Busca todos os programas do catálogo.
- `upsertPrograma`: Cria ou atualiza um programa e seus itens.
- `duplicarPrograma`: Clona um programa existente.
- `toggleProgramaStatus`: Ativa/Inativa um programa.

## 3. Interface do Usuário (Frontend)

### Navegação
- Atualizar `src/components/app-sidebar.tsx` e `src/components/mobile-nav.tsx`:
  - Mover **Serviços** e **Leva e Traz** do grupo "Operação" para "Gestão".
  - Adicionar **Programas de Cuidado** entre eles.

### Nova Rota: `/gestao/programas-cuidado`
- Local: `src/routes/_authenticated/gestao/programas-cuidado.tsx`.
- Estrutura de Abas:
  - **Catálogo** (Implementado): Listagem em cards e formulário.
  - **Configurações** (Implementado): Regras globais do módulo.
  - Outras abas (Desabilitadas): Programas ativos, Créditos, Vencimentos, Renovações, Histórico.

### Componentes
- `ProgramasCatalogo`: Grid de cards responsivos mostrando nome, composição, preço e status.
- `ProgramaForm`: Modal/Dialog para cadastro e edição, com seleção de serviços reais da tabela `servicos`.

## 4. Auditoria e Validação
- Validação rigorosa no formulário: nome obrigatório, preço não negativo, validade mínima, etc.
- Respeito ao isolamento de dados por estabelecimento (usando `estabelecimento_id`).
- Verificação de serviços ativos/inativos.

## Detalhes Técnicos
- Framework: TanStack Start.
- Estilização: Tailwind CSS + shadcn/ui.
- Ícone sugerido para o módulo: `HeartHandshake` ou `PackageCheck` (usarei `PackageCheck` ou similar para diferenciar).
