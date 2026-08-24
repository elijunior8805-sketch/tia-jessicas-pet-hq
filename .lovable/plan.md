# Correção definitiva — Agendamento por voz/texto e comprovante Pix

Escopo restrito à Assistente IA (voz, interpretação, busca de clientes, agendamento) e ao fluxo de comprovante Pix → conciliação → baixa financeira. Nada de layout geral, nada de dados simulados.

## Causas encontradas na auditoria

1. **Agendamento nunca é gravado.** A tabela de liberação da IA está com a fase `observacao`. Nesse modo o código responde "Modo Observação — nenhum registro foi gravado" e sai antes de salvar. Ou seja, mesmo quando tudo é entendido, nada chega na Agenda.
2. **A transcrição some ao encerrar a gravação.** Em `ia-voz.ts`, o `stop()` já marca o estado como `reviewing` antes de parar o microfone; quando o navegador dispara o `onend`, a condição que levaria à tela de revisão não é satisfeita e o estado cai para `idle`, escondendo o painel "Revisar Transcrição". Além disso, ao iniciar uma nova gravação o texto anterior é apagado sem aviso.
3. **Interpretação frágil.** Só existe atalho literal para o texto exato "criar_agendamento" (botão rápido). Frases naturais ("agendar Eli Júnior dia 28 do 8 às 14h", "marca um banho pro Eli às duas da tarde") dependem 100% do modelo e não há normalizador local de datas/horas em português nem fuso America/Sao_Paulo aplicado.
4. **Busca de cliente sem tolerância a erro.** A busca compara apenas nome contendo/contido; não trata abreviações (JR/Júnior), nem erro de transcrição ("Elis"), nem correspondência fonética, e não há fluxo de escolha entre homônimos além de listar.
5. **Comprovante Pix é só leitura de imagem.** O anexo aceita PDF na UI, mas o backend envia o arquivo como imagem para o modelo (PDF quebra). Não há detecção de "Pix agendado", não há hash de arquivo, não há conciliação com pendências, nem baixa financeira — apenas uma mensagem "Li o comprovante" e um upload solto no storage.
6. **Sem trava de duplicidade real na baixa.** A tabela de pagamentos tem `id_transacao_bancaria` e `comprovante_path`, mas não tem hash do arquivo nem chave de idempotência.

## O que será feito

### A. Áudio (um comando por gravação)
- Reescrever a máquina de estados do reconhecedor: `idle → listening → finalizing → reviewing`, com um único listener, trava contra clique duplo e bloqueio de duas gravações simultâneas.
- Transcrição provisória é apenas visual: nunca dispara busca, mensagem ou backend.
- Ao encerrar: consolidar o texto final, remover repetições, manter no campo editável e exibir "Usar transcrição". Encerrar nunca apaga o texto; iniciar nova gravação preserva o rascunho existente.

### B. Interpretação (voz e texto pelo mesmo caminho)
- Pré-processador em português antes do modelo, extraindo: intenção, cliente, pet, serviço, data, hora, profissional, transporte, observações, faltantes e confiança.
- Datas/horas suportadas: "28 do 8", "28/08", "28 de agosto", "dia 28", "amanhã", "próxima terça", "14h", "14 horas", "duas da tarde" — sempre em America/Sao_Paulo, sem inventar valores ausentes.
- Se a intenção de agendar estiver clara, nunca responder "comando não reconhecido": perguntar apenas o que falta, um item por vez.

### C. Busca inteligente de clientes
- Consulta na base real do estabelecimento autenticado, com normalização de acentos, caixa, pontuação e espaços.
- Camadas: telefone → nome normalizado exato → abreviações equivalentes (JR/Júnior/Jr.) → nome parcial → aproximada (distância de edição) → fonética como apoio.
- Nunca escolher sozinha um resultado aproximado. Resultado único: mostrar nome, telefone parcialmente oculto, bairro e pets e perguntar "É este cliente?". Vários: listar e aceitar respostas como "o primeiro", "o do pet Thor", "final 1234".
- Antes de dizer que não existe, verificar sessão/permissão e erro de consulta; só então oferecer "Cliente não cadastrado. Deseja cadastrar agora?" (sem cadastrar automaticamente).

### D. Execução do agendamento
- Após confirmar o cliente: pets do cliente → serviço ativo → duração/profissional/disponibilidade → conflitos → transporte e taxa → valor → resumo completo → botões Confirmar / Alterar / Cancelar.
- Na confirmação: revalidar disponibilidade no servidor, salvar pela função oficial com `command_id` e `idempotency_key`, obter o ID, reler o registro no banco e só então responder "Agendamento realizado", com o código.
- Ajustar a fase de liberação para que ações confirmadas gravem de verdade (mantendo o registro de auditoria já existente).

### E. Comprovante Pix
- Anexo funcional para JPG, JPEG, PNG e PDF, com visualizar, remover e substituir antes de analisar. PDF passa a ser enviado no formato correto ao modelo.
- Extração: valor, data/hora, pagador, recebedor, banco, identificador da transação, código de autenticação e situação.
- Classificação explícita: concluído, agendado, ilegível, incompleto, não é comprovante. Pix agendado nunca gera baixa.
- Duplicidade bloqueada por hash do arquivo, identificador da transação e comprovante já vinculado.

### F. Conciliação e baixa
- Buscar pendências compatíveis (cliente, pagador, valor, data, atendimento, saldo). Uma correspondência: exibir cliente, pet, atendimento, valor original, já recebido, saldo, valor do comprovante e dados extraídos, e perguntar "Deseja confirmar esta baixa?". Várias: listar. Nenhuma segura: busca manual. Nunca escolher em silêncio.
- Regras de valor: igual ao saldo → pago; menor → parcial mantendo o restante; maior → decisão do usuário; duplicado ou sem permissão → bloquear.
- Após confirmar: registrar pagamento com chave de idempotência, vincular comprovante/cliente/atendimento, atualizar saldo, status, Financeiro, Pagamentos em Aberto, Central de Cobrança, histórico e Dashboard pela mesma fonte financeira já usada hoje. Retornar payment_id, vínculo, valor pago, saldo anterior, saldo restante e status, e só declarar "Pagamento baixado" após reler o pagamento no banco.

## Detalhes técnicos

- Alterações concentradas em `src/lib/ia/ia-voz.ts`, `src/components/ia/hooks/useAssistenteActions.ts`, `src/components/ia/ui/IaInputArea.tsx`, `src/components/ia/AssistenteIaSidebar.tsx`, `src/lib/ia/ia-agente.server.ts`, `src/lib/ia/ia-consultas.server.ts`, `src/lib/ia/ia-acoes.server.ts`, `src/lib/ia/ia-comprovante.server.ts` e `src/lib/ia/ia-financeiro.functions.ts`.
- Novos módulos: interpretador de data/hora pt-BR, matcher de nomes (normalização + distância + fonética), e serviço de conciliação de comprovantes.
- Migração de banco: colunas de hash do comprovante e chave de idempotência em pagamentos, com índices únicos para impedir baixa duplicada, mais os GRANTs correspondentes. Idempotência do agendamento deixa de ser gravada dentro de observações e passa a ter coluna própria.
- Nada de dado simulado; todos os testes usam registros reais e o resultado é comprovado por leitura no banco.

## Testes e evidências

Agendamento: áudio e texto, comando completo e incompleto, "Eli Júnior/Eli Junior/Eli JR/Eli", homônimos, cliente com vários pets, horário livre e ocupado, confirmar/alterar/cancelar, clique duplo, desktop e mobile.
Comprovantes: Pix concluído e agendado, imagem e PDF, ilegível, duplicado, uma e várias pendências, integral, parcial, valor maior, atendimento já pago, desktop e mobile.

Ao final entrego: causa dos erros, arquivos e funções corrigidos, testes executados, appointment_ids, payment_ids e a evidência da releitura no banco. Depois disso, paro e aguardo sua aprovação antes de tocar em qualquer outra funcionalidade.
