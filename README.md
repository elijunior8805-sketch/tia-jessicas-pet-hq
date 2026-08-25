# Pet Spa Manager (83)

PROMPT RESUMIDO — ERP PREMIUM SPA DE PET TIA JÉSSICA

Crie do zero um sistema web completo de gestão para o Spa de Pet Tia Jéssica, especializado exclusivamente em banho e tosa de cães.

O sistema deve ser um ERP profissional, integrado, seguro, rápido, simples de operar e totalmente responsivo. Antes de criar as telas, planeje banco de dados, relacionamentos, autenticação, permissões, regras de negócio e integração entre os módulos.

Não criar módulos veterinários, prontuário clínico, gatos, reprodução, inseminação, “Sêmen” ou funcionalidades fora deste escopo.

1. Objetivo e integração

O ERP deve economizar tempo, reduzir erros, organizar a operação, melhorar o atendimento, controlar o financeiro e ajudar na fidelização e tomada de decisões.

Fluxo principal:

Cliente → Pet → Agendamento → Check-in → Atendimento → Pagamento → Relatório → Histórico → Financeiro → Dashboard → Relacionamento.

Uma informação deve ser cadastrada uma única vez e reutilizada. Não desenvolver módulos isolados nem duplicar dados.

Ao encerrar um atendimento, atualizar automaticamente o histórico do cliente e pet, última e próxima visita, pagamento ou pendência, financeiro, Dashboard, relatórios, fotos e relatório final.

2. Segurança

Utilizar corretamente o Supabase Auth:

 Login real por e-mail e senha.

 Nunca liberar acesso somente pelo e-mail.

 Senhas protegidas e nunca salvas em texto puro.

 Recuperação de senha, sessão persistente e logout.

 Rotas protegidas.

 Perfis Administrador e Usuário.

 Validação de permissões para ações sensíveis.

 Login funcionando no computador e celular.

3. Visual premium

Criar visual imponente, sofisticado, profissional e acolhedor, semelhante a um SaaS premium.

Utilizar verde profundo/floresta, branco, off-white, neutros sofisticados e detalhes discretos em dourado ou champagne. Aplicar tipografia moderna, ícones consistentes, excelente espaçamento, contraste e hierarquia visual.

Evitar aparência de planilha, template genérico, visual infantil, excesso de cores, emojis, gradientes chamativos, sombras pesadas e cards sem função.

Menu:

Operação: Painel, Agenda, Atendimentos, Clientes/Pets, Serviços e Leva e Traz.

Gestão: Financeiro, Pagamentos em Aberto, Estoque, Compras, Fornecedores e Relatórios.

Sistema: Comunicação/IA e Configurações.

Usar sidebar elegante no desktop e navegação própria no celular. Não criar telas, menus ou botões falsos.

4. Dashboard como central de decisão

O Dashboard deve responder: “O que precisa da minha atenção hoje?”

Mostrar indicadores clicáveis:

 Agendamentos, confirmados, aguardando, em atendimento, finalizados e cancelados.

 Faturamento diário e mensal.

 Valores recebidos e pendentes.

 Inadimplência acima de 30 dias.

 Pagamentos de clientes atrasados.

 Contas a pagar vencidas e próximas do vencimento.

 Compromissos financeiros e próximas parcelas.

 Próximos retornos e clientes atrasados ou inativos.

 Ocorrências importantes.

 Produtos com estoque baixo.

Ao clicar em um indicador, abrir exatamente os registros correspondentes e permitir executar as ações relacionadas. Não criar gráficos decorativos.

5. Clientes e pets

Criar cadastro integrado de cliente e primeiro pet, permitindo concluir rapidamente:

Cliente → Pet → Agendamento.

Cliente:

 Nome, CPF, nascimento, telefone, WhatsApp e e-mail.

 CEP, rua, número, complemento, bairro opcional, cidade e estado.

 Observações, VIP, indicação e data automática do cadastro.

 Pets vinculados, última/próxima visita, histórico e total de atendimentos.

 Ações: WhatsApp, Google Maps, novo pet, novo agendamento e histórico.

 Pesquisa por nome, telefone, WhatsApp e bairro.

Pet:

 Foto, nome, raça, sexo, peso, porte, cor e nascimento.

 Castrado, alergias, cuidados ou problemas de saúde informados pelo tutor.

 Temperamento, observações e necessidade de focinheira.

 Último banho, última tosa e próxima visita.

 Fotos antes/depois e histórico.

Um cliente pode possuir vários pets.

Pré-cadastrar as principais raças de cães, incluindo SRD e “Outro”, utilizando autocomplete pesquisável. Raças, portes e demais listas devem ser editáveis nas Configurações, não fixadas somente no código.

6. Ficha Operacional do Pet — prioridade

Ao abrir o agendamento ou atendimento, mostrar em uma única tela:

 Foto, nome, raça, peso e porte.

 Tutor e contato.

 Último atendimento, banho e tosa.

 Serviços anteriores importantes.

 Temperamento, alergias e cuidados de saúde informados.

 Focinheira e observações importantes.

 Preferências recorrentes do tutor.

 Resultado anterior e ocorrências relevantes.

Destacar visualmente alergias, agressividade, necessidade de focinheira, condições importantes e ocorrências anteriores. A profissional não deve precisar consultar várias telas.

7. Agenda, check-in e atendimento

Agenda integrada com cliente, pet, serviço, profissional, data, horário, valor previsto e observações.

Status:

Agendado, Confirmado, Aguardando, Em atendimento, Finalizado, Cancelado e Não compareceu.

Permitir reagendamento, cancelamento e acesso rápido à Ficha Operacional, WhatsApp, check-in e atendimento.

No check-in, registrar chegada, confirmação do serviço, alterações informadas pelo tutor, alergias/restrições, machucados visíveis, solicitação especial, foto de entrada e observação.

Organizar o fluxo:

Check-in → Atendimento → Finalização.

Durante o atendimento, permitir consultar a Ficha Operacional, visualizar o serviço planejado, registrar serviços executados e adicionais, fotos antes/depois, comportamento, observações, ocorrências, recomendações opcionais e próxima visita.

8. Serviço planejado x executado — prioridade

Nunca substituir o serviço originalmente agendado.

Manter separadamente:

Planejado: serviço contratado no agendamento.

Executado: serviço realmente realizado, incluindo adicionais.

Essa diferença deve atualizar corretamente o valor final, relatório, histórico, financeiro, Dashboard e relatórios.

9. Ocorrências e comportamento — prioridade

Criar a ação Registrar Ocorrência para machucados, irritações, pulgas/carrapatos, agressividade, serviço interrompido, acidente ou situação inesperada.

Registrar data/hora, cliente, pet, atendimento, tipo, descrição, fotos, profissional, observações e se o tutor foi informado.

Vincular ao histórico e mostrar ocorrências importantes como alerta nos próximos atendimentos.

Comportamentos disponíveis:

Muito tranquilo, Tranquilo, Agitado, Muito agitado, Ansioso, Medroso, Agressivo, Necessitou focinheira e Necessitou pausa.

Salvar para consultas futuras.

10. Encerramento e relatório final

Criar o botão central Encerrar Atendimento.

Ao confirmar:

 Salvar serviços planejados e executados.

 Salvar fotos, comportamento, observações e ocorrências.

 Salvar recomendações opcionais.

 Atualizar última e próxima visita.

 Registrar pagamento ou pendência.

 Atualizar histórico, financeiro, Dashboard e relatórios.

 Gerar Relatório Final Premium.

O relatório deve incluir identidade da empresa, data, cliente, pet, profissional, serviços executados, fotos antes/depois, comportamento, observação e recomendação opcionais e próxima visita.

Ações obrigatórias:

 Visualizar.

 Baixar/salvar PDF.

 Imprimir opcionalmente.

 Preparar envio.

Não obrigar impressão. Criar um PDF profissional próprio, e não uma captura da tela. Nome automático:

Relatorio_NomePet_Data.pdf

Salvar o documento no histórico.

11. WhatsApp e IA

Permitir criar mensagens de conclusão, agradecimento, feedback, retorno e cobrança. A IA pode sugerir textos e resumir indicadores, clientes inativos e pendências.

Toda mensagem deve ser editável, revisável e copiável. Nunca enviar automaticamente.

A IA nunca poderá excluir dados, alterar valores, realizar cobranças, enviar mensagens ou tomar decisões sem confirmação do usuário.

12. Serviços, Leva e Traz e pagamentos

Serviços configuráveis com nome, categoria, descrição, valor, duração e status ativo/inativo. Incluir banho simples/Premium, hidratações, desembolo, remoção de subpelo, tosas, unhas, pata, rosto e pata + rosto.

Criar Taxa de Entrega/Leva e Traz opcional:

 Sem taxa.

 Valor fixo.

 Valor personalizado.

Registrar separadamente e refletir no atendimento, pagamento, financeiro, histórico e relatórios.

Formas de pagamento:

Pix, crédito, débito, dinheiro e pendente.

Preparar arquitetura para futura integração com QR Code Pix, Pix Copia e Cola e link de pagamento, sempre sob controle do usuário.

13. Financeiro

Criar os módulos:

 Receitas.

 Despesas.

 Contas a pagar.

 Contas a receber.

 Pagamentos de clientes em aberto.

 Compras de fornecedores.

 Fluxo de caixa.

Atendimentos pagos devem alimentar automaticamente as receitas e o fluxo de caixa, sem gerar lançamentos duplicados.

Separar claramente:

Contas a receber: valores devidos pelos clientes.

Contas a pagar: compras, despesas e valores devidos aos fornecedores.

14. Pagamentos de clientes em aberto

Mostrar:

 Cliente e pet.

 Atendimento.

 Valor.

 Data e vencimento.

 Dias em atraso.

 Status.

 Último contato.

Destacar atrasos superiores a 30 dias.

Permitir:

 Registrar pagamento total ou parcial.

 Alterar vencimento.

 Adicionar observação.

 Gerar e copiar mensagem de cobrança.

 Abrir WhatsApp.

15. Fornecedores, compras e contas a pagar

Criar cadastro de fornecedores com:

 Nome ou razão social.

 CPF/CNPJ.

 Telefone e WhatsApp.

 E-mail.

 Endereço.

 Tipo de produto fornecido.

 Observações.

 Status ativo/inativo.

 Histórico de compras e pagamentos.

Ao registrar uma compra, permitir:

 Selecionar o fornecedor.

 Informar número da nota, pedido ou documento.

 Descrição e categoria.

 Produtos comprados.

 Quantidade e custo.

 Data da compra.

 Data de recebimento.

 Valor total.

 Forma de pagamento.

 Condição à vista ou parcelada.

 Quantidade de parcelas.

 Valor das parcelas.

 Primeiro vencimento.

 Vencimentos seguintes.

 Centro de custo.

 Observação.

 Anexar nota fiscal ou comprovante.

Quando a compra for parcelada, gerar automaticamente todas as parcelas, identificadas como 1/3, 2/3 e 3/3, por exemplo.

Cada parcela deve conter:

 Fornecedor e compra de origem.

 Número da parcela.

 Valor.

 Vencimento.

 Status: Pendente, Pago, Parcial, Atrasado ou Cancelado.

 Data do pagamento.

 Valor pago.

 Saldo restante.

 Juros, multa e desconto.

 Forma de pagamento.

 Comprovante e observação.

Permitir pagamento total ou parcial, antecipação de parcelas e alteração do vencimento.

Regras obrigatórias:

 Criar apenas uma compra principal com suas parcelas relacionadas.

 A soma das parcelas deve ser igual ao valor total da compra.

 Não duplicar valores entre Compras, Contas a Pagar e Fluxo de Caixa.

 Somente parcelas pagas devem representar saída realizada no caixa.

 Parcelas pendentes devem aparecer na previsão do fluxo de caixa.

 Compras recebidas de produtos devem atualizar o estoque.

 Pagamentos parciais devem manter corretamente o saldo pendente.

 Alterações, cancelamentos e pagamentos devem entrar no Log de Auditoria.

Filtros:

 Fornecedor.

 Período.

 Categoria.

 Vencimento.

 Status.

 Pagas, vencidas ou a vencer.

No Dashboard financeiro, mostrar indicadores clicáveis:

 Total a pagar.

 Contas vencidas.

 Contas que vencem nos próximos dias.

 Compromissos financeiros do mês.

 Próximas parcelas.

 Fornecedores com pagamentos atrasados.

16. Estoque e compras

Criar estoque simples com:

 Produto.

 Categoria.

 Unidade.

 Quantidade.

 Estoque mínimo.

 Entradas e saídas.

 Fornecedor.

 Custo.

Alertar estoque baixo.

Uma compra somente deve atualizar o estoque quando os produtos forem marcados como recebidos. O pagamento e o recebimento da mercadoria devem funcionar de forma independente: uma compra pode ser recebida antes de ser totalmente paga.

17. Histórico e relatórios

Histórico cronológico:

Cliente: pets, atendimentos, pagamentos, pendências, relatórios e visitas.

Pet: banhos, tosas, planejado/executado, fotos, comportamento, observações, ocorrências, recomendações e relatórios.

Fornecedor: compras, parcelas, pagamentos, atrasos e saldo pendente.

Criar relatórios com filtros por período:

 Faturamento.

 Serviços realizados.

 Formas de pagamento.

 Clientes e pets atendidos.

 Contas a receber.

 Inadimplência de clientes.

 Contas a pagar.

 Compras por fornecedor.

 Parcelas vencidas e futuras.

 Despesas por categoria.

 Fluxo de caixa realizado e previsto.

 Serviços mais vendidos.

 Leva e Traz.

 Retorno de clientes.

18. Log de Auditoria — prioridade

Registrar automaticamente:

 Usuário.

 Data e hora.

 Ação realizada.

 Informação anterior.

 Nova informação.

Auditar especialmente:

 Alterações financeiras.

 Alterações de valores e vencimentos.

 Pagamentos totais e parciais.

 Compras e parcelas.

 Cancelamentos e exclusões.

 Alterações de atendimentos.

 Serviços removidos.

 Pendências baixadas.

 Alterações de cadastros.

 Edição de ocorrências.

Usuários comuns não podem apagar o histórico. O log deve ficar disponível para consulta administrativa sem poluir as telas operacionais.

19. Mobile-first e experiência de uso

Construir desde o início para celular, e não apenas diminuir o desktop.

Testar em 360px, 390px, 430px, tablet e desktop. Garantir funcionamento de login, menu, formulários, agenda, cadastros, Ficha Operacional, check-in, fotos, atendimento, pagamento, financeiro, contas parceladas, PDF e WhatsApp.

Não permitir elementos cortados, sobreposição, rolagem lateral desnecessária ou modais fora da tela.

Tarefas comuns devem exigir no máximo três etapas. Aplicar feedback ao salvar, loading, skeleton, confirmações, estados vazios e transições discretas, sem prejudicar o desempenho.

20. Configurações

Permitir administrar:

 Raças.

 Serviços e valores.

 Portes e temperamentos.

 Formas de pagamento.

 Categorias financeiras.

 Centros de custo.

 Taxa de entrega.

 Usuários e permissões.

 Dados da empresa.

Evitar listas e valores fixos no código.

21. Validação e ordem de implementação

Nenhum módulo estará pronto apenas porque a tela existe. Todos os cadastros, filtros, pesquisas, vínculos, botões e integrações devem funcionar de verdade.

Testar no computador e no celular:

Login → Cliente/Pet → Agendamento → Ficha Operacional → Check-in → Fotos → Atendimento → Planejado/Executado → Ocorrência → Comportamento → Pagamento/Pendência → Encerramento → PDF → WhatsApp → Histórico → Financeiro → Dashboard → Log de Auditoria.

Testar também:

Fornecedor → Compra → Parcelamento → Recebimento dos produtos → Atualização do estoque → Contas a pagar → Pagamento parcial/total → Fluxo de caixa → Dashboard → Log de Auditoria.

Ordem de implementação:

 Banco de dados e arquitetura.

 Login e segurança.

 Visual premium e responsividade.

 Clientes e Pets.

 Ficha Operacional.

 Agenda.

 Check-in e Atendimento.

 Planejado x Executado.

 Ocorrências.

 Pagamentos e Financeiro.

 Fornecedores, Compras e Contas a Pagar.

 Encerramento e PDF.

 Dashboard.

 Histórico.

 Auditoria.

 WhatsApp e IA.

 Estoque, Leva e Traz e relatórios.

 Teste completo desktop e mobile.

INSTRUÇÃO FINAL

Os cinco diferenciais prioritários são:

 Ficha Operacional do Pet.

 Registro de Ocorrências.

 Serviço Planejado x Serviço Executado.

 Dashboard como Central de Decisão.

 Rastreabilidade de Alterações.

Eles devem estar profundamente integrados ao fluxo, e não funcionar como telas isoladas.

Construa um produto real, não uma demonstração visual. Priorize segurança, integração, simplicidade, velocidade, controle financeiro, visual premium e excelente experiência no celular.

Não invente funcionalidades, não sacrifique o funcionamento pela aparência e não aumente o escopo antes de validar todo o fluxo.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tia-jessicas-pet-hq.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2b2a58cf-a314-412d-9e4d-44a12b29f02d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
