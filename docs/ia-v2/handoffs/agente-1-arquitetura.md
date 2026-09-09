# Documento de Entrega — Handoff 1: Arquitetura e Fundação V2

* **Agente Responsável:** Agente 1 (Arquitetura, Preservação e Coordenação)
* **Fase:** Fase 1 — Fundação Paralela, Contratos e Governança
* **Checkpoint Base:** Commit `3f96fa4` (Branch `connect_pet_hq_repository`, árvore limpa)
* **Data / Horário:** 2026-09-08 21:55:00-03:00

---

## 1. Arquivos Analisados

* `src/lib/ia/jessi-agent.server.ts`
* `src/lib/ia/jessi-contracts.ts`
* `src/lib/ia/jessi-guardrails.ts`
* `src/lib/ia/jessi-session.ts`
* `src/lib/ia/jessi-config.ts`
* `src/components/jessi/JessiLayout.tsx`

---

## 2. Arquivos Criados

* `docs/ia-v2/inventario-funcoes-atuais.md` (Inventário de funções do backend)
* `docs/ia-v2/registro-de-riscos.md` (Matriz de riscos e mitigação)
* `src/lib/ia-v2/contracts/jessi-v2-contracts.ts` (Contratos Zod para mensagens, ações, resultados de consulta e mutação com *read-back*)
* `src/lib/ia-v2/config/jessi-v2-config.ts` (Configurações, feature flags, limites operacionais e system prompt V2)
* `src/lib/ia-v2/session/jessi-v2-session.ts` (Gestão de sessão, memória de curto/médio prazo e expiração de ações)
* `src/lib/ia-v2/providers/jessi-v2-provider.interface.ts` (Interface abstrata de provedores de IA)
* `src/lib/ia-v2/providers/jessi-v2-gemini.provider.ts` (Provedor Gemini com classificação resiliente)
* `src/lib/ia-v2/providers/jessi-v2-fallback.provider.ts` (Provedor determinístico de contingência)
* `src/lib/ia-v2/agent/jessi-v2-agent.core.ts` (Motor core de orquestração V2)
* `src/lib/ia-v2/agent/jessi-v2-bridge.ts` (Ponte de despacho com seletor V1/V2 e fallback automático)

---

## 3. Decisões Tomadas

1. **Preservação Absoluta da V1:** Nenhum arquivo do diretório `src/lib/ia/` foi modificado ou excluído.
2. **Autonomia Supervisionada Estrita:** Qualquer intenção de mutação gera uma `pendingAction` temporária (15 min) com payload para confirmação visual, sem escrita física no primeiro passo.
3. **Ponte com Fallback Automático:** Caso a V2 falhe ou a flag esteja desligada, a requisição é transferida instantaneamente para a V1 sem interrupção do serviço.

---

## 4. Contratos Disponibilizados para os Agentes 2 e 3

* `JessiV2Message` e `JessiV2PendingAction`
* `JessiV2QueryResult<T>` e `JessiV2MutationResult<T>`
* `JessiV2Intent` e `JessiV2ProcessInput` / `JessiV2ProcessOutput`

---

## 5. Próximo Responsável

* **Próximo:** **Agente 2 (Integrações e Regras do Sistema)**
* **Missão:** Implementar os adaptadores oficiais em `src/lib/ia-v2/adapters/` (Agenda, Clientes/Pets, Programas/Créditos, Financeiro/Relatórios e Mensagens/WhatsApp) e conectá-los ao catálogo de ferramentas em `src/lib/ia-v2/tools/`.
