# Plano de Melhoria da Assistente IA - Interatividade e Visual Premium

O usuário relatou dificuldades em selecionar clientes/pets na interface da IA ("não consegui clicar e selecionar qual cliente") e solicitou uma melhoria visual para alinhar o componente ao "layout sofisticado do nosso sistema".

## 1. Melhoria da Interatividade (Seleção de Entidades)
A Assistente IA atualmente retorna texto em Markdown que lista clientes e pets, mas esses itens não são clicáveis. Vamos implementar um sistema de "Cartões de Seleção" interativos.

- **Detecção de Entidades:** O componente `AssistenteIaModal` será atualizado para identificar quando a resposta da IA contém uma lista de candidatos (clientes ou pets).
- **Cartões Clicáveis:** Em vez de apenas texto, os resultados de busca serão renderizados como cartões estilizados dentro do chat.
- **Ação de Seleção:** Ao clicar em um cartão, a entidade (Cliente ou Pet) será selecionada automaticamente no estado do componente, preenchendo os campos necessários para a intenção atual (ex: `criar_agendamento`).

## 2. Refinamento Visual Premium
O visual atual foi descrito como "grosseiro". Vamos aplicar os tokens de design do sistema para torná-lo mais sofisticado.

- **Paleta de Cores e Tipografia:** Uso mais refinado do `gold` (ouro) em detalhes, bordas sutis e fontes `font-display` para títulos.
- **Micro-interações:** Adição de animações suaves (`framer-motion`) para a entrada de mensagens e transições de estado.
- **Layout de Chat Moderno:**
    - Bolhas de chat com gradientes sutis.
    - Glassmorphism no fundo do modal.
    - Ícones mais elegantes e consistentes.
    - Scroll suave e feedback visual claro de processamento.

## 3. Fluxo de Confirmação Aprimorado
- Quando uma entidade for selecionada, a IA confirmará visualmente: "Ótimo! Selecionei o cliente **Eli Júnior**. Deseja prosseguir com o agendamento para o pet **Belinha**?"
- Botões de ação primária (Confirmar) e secundária (Trocar seleção) com design premium.

## 4. Auditoria e Logs
- Manter o registro de todas as interações no banco de dados para garantir a rastreabilidade das ações tomadas via IA.

---

**Nota sobre o texto solicitado:** O usuário incluiu um pedido de alteração de texto literal ("Abri essa nova tela de IA..."). Conforme a diretriz de segurança, esse texto será escrito como texto literal de exibição no sistema (ex: em uma seção de 'Notas de Feedback' ou 'Histórico de Auditoria'), mas o foco principal desta implementação é a correção funcional e visual solicitada.
