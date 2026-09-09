# Inventário e Análise Detalhada das Funções Atuais do Sistema

* **Data de Análise:** 2026-09-08 22:02:00-03:00
* **Responsável:** Agente 1 (Arquitetura) & Agente 2 (Integrações)

---

## 1. Análise Arquivo a Arquivo dos Componentes Solicitados

### Arquivo 1: `src/lib/ia/ia-agente.server.ts`

* **Função Principal:** `classificarComandoIA(texto, contexto)`
* **Responsabilidade:** Classificação de intenção via Gemini e mapeamento rápido de comandos fixos.
* **Entrada:** `texto: string`, `contexto?: any`
* **Saída:** `IAIntent` (intencao, especialista, tipo_operacao, parametros, exige_confirmacao, resposta_ia)
* **Tabelas / Serviços:** Edge Functions / Gemini API
* **Regras:** Identificar intenção e entidades (cliente, data, serviço, etc.).
* **Telas Consumidoras:** `src/components/jessi/JessiChat.tsx`, `src/components/ia/AssistenteIaSidebar.tsx`
* **Possibilidade de Reutilização:** Reutilizável com adaptador
* **Adaptador Necessário:** `src/lib/ia-v2/providers/jessi-v2-gemini.provider.ts`
* **Riscos:** Classificação imprecisa em mensagens longas; mitigado com pré-classificador e heurísticas determinísticas na V2.
* **Classificação:** **Reutilizável com adaptador**

---

### Arquivo 2: `src/lib/ia/ia-respostas.ts`

* **Função Principal:** `montarRespostaResumoOperacional(r)` e formatadores auxiliares
* **Responsabilidade:** Converter dados brutos de agenda, financeiro e leva-e-traz em texto natural em português brasileiro.
* **Entrada:** Objeto com totais de agenda, pendências e faturamento.
* **Saída:** `string` formatada sem termos técnicos.
* **Tabelas / Serviços:** N/A (formatação pura em memória).
* **Regras:** Ocultar IDs e detalhes técnicos, destacando prioridades do dia (cobranças vencidas, atendimentos sem confirmação).
* **Telas Consumidoras:** `JessiWelcome.tsx`, `AssistenteIaSidebar.tsx`
* **Possibilidade de Reutilização:** Reutilizável sem alteração
* **Adaptador Necessário:** Integrado aos adaptadores da V2 para formatação de saídas.
* **Riscos:** Valores nulos ou ausentes; mitigado por checagens defensivas (`Number(v || 0)`).
* **Classificação:** **Reutilizável sem alteração**

---

### Arquivo 3: `src/lib/ia/ia-fluxo-agendamento.ts`

* **Função Principal:** `iniciarDraft`, `buscarCliente`, `buscarPet`, `avancarDraft`
* **Responsabilidade:** Máquina de estados para condução de fluxo conversacional de agendamento por etapas.
* **Entrada:** Mensagem do operador, estado atual do rascunho (`AgendaDraft`).
* **Saída:** `PassoFluxo` com mensagem seguinte, dados faltantes e status de prontidão.
* **Tabelas / Serviços:** `clientes`, `pets`, `servicos`
* **Regras:** Coletar cliente -> pet -> serviço -> data -> hora -> transporte antes de emitir resumo para confirmação.
* **Telas Consumidoras:** `AssistenteIaSidebar.tsx`
* **Possibilidade de Reutilização:** Reutilizável com adaptador
* **Adaptador Necessário:** `src/lib/ia-v2/adapters/agenda.adapter.ts` e `src/lib/ia-v2/confirmation/jessi-v2-confirmation.manager.ts`
* **Riscos:** Desvio de contexto em diálogos longos; mitigado pelo `JessiV2Session` com stack de entidades.
* **Classificação:** **Reutilizável com adaptador**

---

### Arquivo 4: `src/lib/ia/ia-financeiro.server.ts`

* **Funções Principais:** `consultarKPIsFinanceirosIA`, `consultarInadimplenciaIA`, `compararPeriodosIA`
* **Responsabilidade:** Encaminhar consultas financeiras exclusivamente para a função consolidada oficial `getFinancialKPIs`.
* **Entrada:** Intervalos de datas (`from`, `to`) e filtros de inadimplência.
* **Saída:** KPIs consolidados (faturamento, despesas, ticket médio, contas a receber).
* **Tabelas / Serviços:** `vw_financeiro_indicadores`, `pagamentos`, `transacoes_financeiras`
* **Regras:** A IA nunca calcula valores financeiros por queries soltas. Consome a fonte única oficial.
* **Telas Consumidoras:** Dashboard, Jessi, Relatórios Gerenciais.
* **Possibilidade de Reutilização:** Reutilizável com adaptador
* **Adaptador Necessário:** `src/lib/ia-v2/adapters/financeiro-relatorios.adapter.ts`
* **Riscos:** Zero divergência em relação ao dashboard oficial.
* **Classificação:** **Reutilizável com adaptador**

---

### Arquivo 5: `src/components/ia/AssistenteIaSidebar.tsx`

* **Componente Principal:** `AssistenteIaSidebar`
* **Responsabilidade:** Painel lateral flutuante da assistente legado.
* **Entrada:** `isOpen: boolean`, `onClose: () => void`
* **Saída:** Interface visual React com mensagens, upload de comprovante e microfone.
* **Tabelas / Serviços:** Supabase Client, Server Functions.
* **Regras:** Interface alternativa que consome hooks legados.
* **Telas Consumidoras:** Layout legado do sistema.
* **Possibilidade de Reutilização:** Apenas visual / Preservada
* **Adaptador Necessário:** Mantido intacto no diretório legado sem conflitar com `src/components/jessi/`.
* **Riscos:** Manter isolado para garantir que apenas a Jessi oficial seja exibida ao usuário final conforme Seção 1.
* **Classificação:** **Apenas visual / Preservada para retrocompatibilidade**

---

## 2. Resumo da Classificação das Funções

| Função / Componente | Arquivo de Origem | Classificação | Destino na V2 |
| :--- | :--- | :--- | :--- |
| `classificarComandoIA` | `ia-agente.server.ts` | **Reutilizável com adaptador** | `src/lib/ia-v2/providers/jessi-v2-gemini.provider.ts` |
| `montarRespostaResumoOperacional` | `ia-respostas.ts` | **Reutilizável sem alteração** | Módulo de apresentação V2 |
| `iniciarDraft` / `avancarDraft` | `ia-fluxo-agendamento.ts` | **Reutilizável com adaptador** | `src/lib/ia-v2/adapters/agenda.adapter.ts` |
| `consultarKPIsFinanceirosIA` | `ia-financeiro.server.ts` | **Reutilizável com adaptador** | `src/lib/ia-v2/adapters/financeiro-relatorios.adapter.ts` |
| `AssistenteIaSidebar` | `AssistenteIaSidebar.tsx` | **Apenas visual** | Preservado intacto na V1 |
