# Matriz e Registro de Riscos — Jessi IA V2

Este documento estabelece os riscos identificados na evolução da IA Jessi e os mecanismos arquiteturais e de controle implementados para mitigá-los.

---

## Matriz de Riscos

| ID | Risco Identificado | Severidade | Probabilidade | Mitigação Arquitetural Implementada |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | Execução de mutação (criação/edição/exclusão) sem autorização humana explícita | **Crítica** | Baixa | Guardrail estrito: o agente só emite `pendingAction`. A escrita física só ocorre via endpoint de confirmação explícita com ID único e assinatura. |
| **R-02** | Duplicação de cobrança, agendamento ou baixa de créditos por duplo clique/repetição | **Alta** | Média | Geração obrigatória de Chave de Idempotência baseada em timestamp, ID do recurso e hash dos parâmetros antes de qualquer execução. |
| **R-03** | Divergência nos números financeiros reportados pela IA vs. Dashboard oficial | **Alta** | Baixa | Uso exclusivo do adaptador `FinanceiroRelatoriosAdapter` que consome as mesmas funções consolidadas do Dashboard e da Auditoria Financeira. |
| **R-04** | Alucinação na disponibilidade de horários da Agenda | **Alta** | Média | Validação em dois passos (*Read-Check-Write*): a Jessi verifica a grade em tempo real antes de propor e revalida a vaga no exato instante da confirmação. |
| **R-05** | Regressão da Jessi V1 em produção | **Crítica** | Baixa | A Jessi V1 permanece 100% intacta no diretório `src/lib/ia/`. A Jessi V2 opera em `src/lib/ia-v2/` com seletor e fallback automático imediato para a V1 em caso de erro. |
| **R-06** | Consumo indevido de créditos de Programas/Planos vencidos | **Média** | Média | Adaptador de Programas valida a data de vigência e saldo real antes de preparar qualquer ação de abatimento de crédito. |
| **R-07** | Falso positivo na gravação (retorno de sucesso sem persistência real no banco) | **Alta** | Baixa | Mecanismo obrigatório de *Read-Back*: toda operação executa uma releitura imediata do registro criado/alterado na tabela antes de emitir o status de sucesso. |
| **R-08** | Lentidão ou estouro de timeout em requisições complexas | **Média** | Média | Limite estrito de timeout (8.000ms), memória de contexto podada em 30 interações e fallback elegante com mensagem de orientação ao usuário. |

---

## Critérios de Bloqueio pelo Agente 3 (Veto Técnico)

Qualquer teste na suite de evals que evidencie a quebra de um dos pontos acima (especialmente **R-01**, **R-02**, **R-04** e **R-07**) resultará em **bloqueio imediato** da fase.
