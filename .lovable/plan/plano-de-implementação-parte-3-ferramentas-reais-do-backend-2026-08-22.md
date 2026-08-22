# Plano de Implementação - Parte 3: Ferramentas Reais do Backend

Este plano detalha a implementação e correção das ferramentas da Assistente Operacional IA, garantindo que todas operem com dados reais, segurança e auditoria, conforme os requisitos da Fase 3.

## 1. Padronização de Retorno e Auditoria
- Criar um helper `src/lib/ia/ia-retorno.server.ts` para padronizar o objeto de resposta e automatizar o log na tabela `ia_auditoria`.
- Atualizar todas as funções em `ia-acoes.server.ts` e `ia-consultas.server.ts` para usar este padrão.

## 2. Implementação/Correção de Ferramentas de Consulta
- **`buscar_clientes`**: Corrigir `buscarDadosClientesPets` para separar claramente o retorno e permitir busca exata/parcial.
- **`buscar_pets_do_cliente`**: Implementar função específica para listar pets de um ID de cliente.
- **`buscar_servicos`**: Implementar consulta à tabela `servicos` (atualmente a IA não tem acesso direto).
- **`consultar_agenda`**: Refinar filtros de data e profissional.
- **`contar_atendimentos` / `listar_atendimentos`**: Implementar consulta à tabela `atendimentos` (diferente de agendamentos).
- **`consultar_disponibilidade`**: Garantir que verifica feriados ou bloqueios manuais se existirem.
- **`consultar_historico_cliente` / `pet`**: Implementar busca profunda em atendimentos e pagamentos passados.
- **`consultar_resumo_financeiro`**: Integrar com a `vw_financeiro_indicadores` para paridade total.
- **`consultar_pendencias`**: Buscar especificamente registros em `pagamentos` com status pendente/parcial.
- **`consultar_resumo_operacional`**: Adicionar métricas de ocupação da equipe.

## 3. Implementação/Correção de Ferramentas de Ação
- **`criar_cliente` / `criar_pet`**: Implementar funções de escrita real (atualmente a IA apenas "sugere" cadastrar).
- **`criar_agendamento`**: Validar se o pet pertence ao cliente informado.
- **`remarcar_agendamento` / `cancelar`**: Garantir que as triggers de sincronização financeira sejam disparadas.
- **`registrar_pagamento` / `parcial`**: Refinar a lógica de `valor_pago` acumulado.
- **`analisar_comprovante`**: Validar integridade do Base64 e limites de tamanho.

## 4. Segurança e Auditoria
- Aplicar `requireSupabaseAuth` em todos os entrypoints (`.functions.ts`).
- Garantir que `supabaseAdmin` seja usado apenas para auditoria ou consultas de sistema que exijam bypass de RLS controlado, preferindo `context.supabase` para ações do usuário.

## Detalhes Técnicos
- **Timezone**: Forçar `AT TIME ZONE 'America/Sao_Paulo'` em todas as queries SQL via RPC ou JS.
- **Erros**: Mapear códigos de erro do Supabase para mensagens estruturadas no campo `validation_errors`.
- **Confirmação**: Marcar `requires_confirmation: true` para todas as ferramentas de ação na resposta do backend.
