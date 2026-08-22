# Plano de Implementação - Parte 6: Agendamento Real pela Assistente IA

Esta fase garante que o Agente IA execute agendamentos reais e seguros, com validações rigorosas de disponibilidade, duplicidade e integridade de dados.

## 1. Refinamento do Fluxo de Agendamento
- **Busca e Resolução de Entidades**:
    - Se o nome do cliente for ambíguo, a IA deve apresentar opções.
    - Seleção obrigatória do pet vinculado ao cliente.
    - Resolução de serviços: buscar no banco, calcular valor total e duração.
- **Validações Críticas**:
    - **Disponibilidade**: Verificar se o horário está ocupado antes de propor. Se ocupado, sugerir 3 alternativas próximas.
    - **Duplicidade**: Bloquear agendamentos idênticos (mesmo pet, data, hora e serviço).
    - **Confirmação**: Exibição de resumo claro (Valor, Pet, Profissional, Transporte) antes da gravação.

## 2. Cadastro Dinâmico no Fluxo
- Se o cliente não existir, a IA deve perguntar: "Não encontrei esse cliente, deseja cadastrá-lo agora?".
- Integração com o fluxo de `cadastrar_cliente` e retorno imediato ao agendamento.

## 3. UI e Feedback Operacional
- **Apresentação do ID**: Após o sucesso, exibir o ID do agendamento.
- **Integração Visual**: Botão "Ver na Agenda" no chat após a criação.
- **Sincronização**: Garantir que o agendamento apareça instantaneamente na Agenda (Desktop/Mobile).

## 4. Segurança e Auditoria
- Cada passo (Tentativa -> Validação -> Gravação) registrado em `ia_auditoria`.
- Revalidação de disponibilidade no servidor no exato momento da gravação (prevenir race conditions).

## Detalhes Técnicos
- **Arquivos**:
    - `src/lib/ia/ia-acoes.server.ts`: Lógica de validação e escrita no banco.
    - `src/lib/ia/ia-consultas.server.ts`: Aprimoramento da busca de slots e duplicidade.
    - `src/components/ia/AssistenteIaSidebar.tsx`: Fluxo de confirmação e tratamento de erros visuais.
