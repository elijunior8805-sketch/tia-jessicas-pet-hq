# Metodologia de Desenvolvimento Superpowers

Este repositório integra as capacidades do framework [obra/superpowers](https://github.com/obra/superpowers) na pasta `.agents/skills/`.

## Visão Geral

O **Superpowers** padroniza a interação com agentes de IA através de fluxos de trabalho disciplinados de engenharia de software, garantindo código robusto, testado e de fácil manutenção.

---

## Skills Disponíveis (`.agents/skills/`)

| Skill | Finalidade |
| :--- | :--- |
| **`using-superpowers`** | Ponto de entrada central. Garante que os agentes consultem e executem as skills apropriadas antes de codificar. |
| **`brainstorming`** | Refinamento colaborativo de requisitos e design prévio com o usuário. |
| **`writing-plans`** | Criação de planos de implementação detalhados, focando em TDD, DRY e YAGNI. |
| **`executing-plans`** | Execução passo a passo de planos com rastreamento via checklists e validações. |
| **`test-driven-development`** | Ciclos rigorosos de Red-Green-Refactor para garantir cobertura e estabilidade. |
| **`systematic-debugging`** | Análise investigativa e de causa-raiz antes de aplicar correções pontuais. |
| **`subagent-driven-development`** | Orquestração e delegação de tarefas isoladas para subagentes com revisão contínua. |
| **`dispatching-parallel-agents`** | Execução paralela de tarefas desacopladas. |
| **`verification-before-completion`** | Bateria de testes e checagens finais antes de finalizar tarefas. |
| **`requesting-code-review`** | Solicitação e estruturação de revisões de código. |
| **`receiving-code-review`** | Processamento metódico e aplicação de feedbacks de revisão. |
| **`using-git-worktrees`** | Criação e gerenciamento de worktrees isolados para features e correções. |
| **`finishing-a-development-branch`** | Estratégia de fechamento, teste integrado e merge de branches. |
| **`writing-skills`** | Guia para criação de novas skills customizadas para o projeto. |

---

## Como os Agentes Utilizam as Skills

1. Ao receber um comando de nova funcionalidade ou refatoração, o agente invoca o **`brainstorming`** e **`writing-plans`**.
2. Ao receber um bug, o agente inicia com **`systematic-debugging`** para reproduzir e rastrear a causa antes de alterar o código.
3. Todas as implementações seguem o ciclo de **`test-driven-development`** e passam por **`verification-before-completion`** (`bun run test`).
