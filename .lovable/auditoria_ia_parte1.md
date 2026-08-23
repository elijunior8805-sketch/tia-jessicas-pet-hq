# Auditoria da Assistente IA e Módulos Operacionais - Spa de Pet Tia Jéssica

## Matriz de Auditoria e Conexão Backend

| Módulo | Função | Ferramenta | Conectado ao Backend? | Fonte (Tabela/Função) | Status | Recomendação |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IA Core** | Classificação de Intenção | `classificarComandoIA` | Sim | `chamarIA` (Gemini API) | ✅ Operacional | Monitorar custo de tokens. |
| **Agenda** | Consulta de horários | `buscarDadosAgenda` | Sim | Tabela `agendamentos` | ✅ Operacional | Otimizar busca por "hoje" no fuso local. |
| **Agenda** | Contagem atendimentos | `contar_atendimentos` | Sim | Tabela `agendamentos` | ✅ Operacional | Unificar com `vw_financeiro_indicadores`. |
| **Clientes** | Busca (Fuzzy) | `buscarClientesIA` | Sim | Tabela `clientes` | ⚠️ Parcial | Falha em nomes compostos sem ranking. |
| **Financeiro** | Resumo de KPIs | `buscarDadosFinanceiros` | Sim | `vw_financeiro_indicadores` | ✅ Operacional | Garantir paridade com Dashboard. |
| **Pagamentos** | Baixa de pagamento | `registrarPagamentoIA` | Sim | Tabela `pagamentos` | ✅ Operacional | Implementar rollback em caso de erro. |
| **IA Vision** | Analisar comprovante | `processarComprovanteIA` | Sim | Gemini Vision API | ✅ Operacional | Adicionar detecção de duplicidade por ID. |
| **Auditoria** | Log de IA | `logIAAuditoria` | Sim | Tabela `ia_auditoria` | ✅ Operacional | Adicionar metadados de performance. |

---

## Diagnóstico de Falhas Identificadas

### 1. Causa da falha de busca de clientes
A busca utiliza `ilike` simples ou quebra por palavras, mas carece de um ranking de similaridade (Trigrams). Nomes comuns ou com variações de escrita (ex: "Eli Jr" vs "Eli Junior") podem não retornar o registro exato no primeiro resultado se houver muitos registros similares.

### 2. Causa da falha de agendamento (Processamento Infinito)
Identificamos que em fluxos de "remarcar" ou "cancelar", a IA às vezes aguarda uma entidade (`selectedEntity`) que não foi injetada corretamente no estado do componente, gerando um loop de espera. Além disso, a conversão de datas como "dia 28" pode falhar se não houver agendamentos futuros para validar.

### 3. Causa das respostas financeiras incorretas
Embora a `vw_financeiro_indicadores` seja a fonte da verdade, consultas por períodos curtos (ex: "ontem") podem sofrer com o truncamento de datas no fuso horário UTC em vez de `America/Sao_Paulo` na camada da IA.

### 4. Divergências entre telas (Dashboard vs IA)
A IA utiliza `getFinancialKPIs` que soma registros da view, enquanto o Dashboard pode estar cacheado ou usando uma RPC de agregação diferente (`recalcular_agregados`).

---

## Análise de Riscos e Segurança
*   **RLS:** As políticas estão bem configuradas (`is_staff`, `has_role`), mas a tabela `cobranca_promessas` possui uma política `true` que permite acesso a qualquer usuário autenticado sem filtro de cargo.
*   **Performance:** Consultas de agenda não possuem limite estrito de retorno na IA, o que pode causar latência em dias com alto volume (50+ atendimentos).
*   **Tokens:** O histórico de 5 mensagens enviado ao Gemini é adequado, mas prompts de sistema muito longos aumentam a latência.

**A auditoria da Parte 1 está concluída. Aguardando autorização para iniciar a Parte 2 (Correções e Estabilização).**