import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { JessiV2FeatureFlags, JESSI_V2_FLAGS_DEFAULT, checarFlagV2 } from "../config/jessi-v2-config";
import { AgendaAdapter } from "../adapters/agenda.adapter";
import { ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { ProgramasCreditosAdapter } from "../adapters/programas-creditos.adapter";
import { FinanceiroRelatoriosAdapter } from "../adapters/financeiro-relatorios.adapter";
import { MensagensWhatsAppAdapter, JessiV2WhatsAppPayload } from "../adapters/mensagens-whatsapp.adapter";
import { ProativoAdapter } from "../adapters/proativo.adapter";

/**
 * Registro e Catálogo Oficial de Ferramentas da Jessi V2 (Seções 10, 16 e 17)
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export interface JessiV2ToolDefinition {
  nomeInterno: string;
  descricao: string;
  intencoes: string[];
  area: "agenda" | "clientes_pets" | "programas_creditos" | "financeiro_relatorios" | "comunicacao_mensagens";
  parametros: Record<string, { tipo: string; obrigatorio: boolean; descricao: string }>;
  retorno: string;
  permissoes: string[];
  tipo: "consulta" | "mutacao_supervisionada";
  nivelRisco: "baixo" | "medio" | "alto";
  confirmacaoNecessaria: boolean;
  adaptador: string;
  featureFlag: keyof JessiV2FeatureFlags;
  timeoutMs: number;
  politicaRepeticao: "nenhuma" | "retry_1x_se_leitura";
  idempotencia: boolean;
  verificacaoPosterior: boolean;
}

export const JESSI_V2_TOOLS_CATALOG: Record<string, JessiV2ToolDefinition> = {
  consultar_agenda: {
    nomeInterno: "consultar_agenda",
    descricao: "Consulta os agendamentos e horários para uma data específica",
    intencoes: ["consultar_agenda", "ver_horarios", "consultar_vagas"],
    area: "agenda",
    parametros: {
      data: { tipo: "string", obrigatorio: false, descricao: "Data em formato YYYY-MM-DD" },
    },
    retorno: "Lista de agendamentos com pet, cliente, horário e status",
    permissoes: ["agenda", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "AgendaAdapter.consultarAgendaPorData",
    featureFlag: "ai_v2_queries",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  buscar_clientes_pets: {
    nomeInterno: "buscar_clientes_pets",
    descricao: "Busca clientes e pets com hierarquia de correspondência resiliente",
    intencoes: ["buscar_clientes_pets", "buscar_cliente", "buscar_pet", "localizar_tutor"],
    area: "clientes_pets",
    parametros: {
      termo: { tipo: "string", obrigatorio: false, descricao: "Nome, telefone, ID ou termo parcial" },
    },
    retorno: "Lista ranqueada de clientes e pets com score de confiança",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ClientesPetsAdapter.buscarClientesPets",
    featureFlag: "ai_v2_queries",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  obter_ficha_pet: {
    nomeInterno: "obter_ficha_pet",
    descricao: "Obtém ficha cadastral, histórico e restrições de um pet",
    intencoes: ["obter_ficha_pet", "ver_ficha_pet", "historico_pet"],
    area: "clientes_pets",
    parametros: {
      petId: { tipo: "string", obrigatorio: true, descricao: "ID do pet" },
    },
    retorno: "Ficha médica e comportamental detalhada do pet",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ClientesPetsAdapter.obterFichaPet",
    featureFlag: "ai_v2_queries",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  consultar_saldo_programas: {
    nomeInterno: "consultar_saldo_programas",
    descricao: "Consulta o saldo de créditos e planos ativos do Clubinho para o cliente",
    intencoes: ["consultar_saldo_programas", "saldo_clubinho", "ver_creditos"],
    area: "programas_creditos",
    parametros: {
      clienteId: { tipo: "string", obrigatorio: true, descricao: "ID do cliente" },
    },
    retorno: "Assinaturas ativas e total de créditos restantes por serviço",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProgramasCreditosAdapter.consultarSaldoCreditos",
    featureFlag: "ai_v2_programs",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  consultar_programas_ativos_geral: {
    nomeInterno: "consultar_programas_ativos_geral",
    descricao: "Consulta todos os contratos reais de programas ativos no sistema",
    intencoes: ["consultar_programas_ativos_geral", "quais_programas_estao_ativos", "programas_ativos"],
    area: "programas_creditos",
    parametros: {},
    retorno: "Lista de contratos reais com tutor, pet, plano, validade, utilizados e saldo",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProgramasCreditosAdapter.consultarProgramasAtivosGeral",
    featureFlag: "ai_v2_programs",
    timeoutMs: 6000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  gerar_termo_programa_pdf: {
    nomeInterno: "gerar_termo_programa_pdf",
    descricao: "Prepara o termo de contratação do programa em PDF com link para download e WhatsApp",
    intencoes: ["gerar_termo_programa_pdf", "termo_pdf", "pdf_clubinho"],
    area: "programas_creditos",
    parametros: {
      contratoId: { tipo: "string", obrigatorio: true, descricao: "ID do contrato do programa" },
    },
    retorno: "Estrutura do termo com direitos, deveres e opções de compartilhamento",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProgramasCreditosAdapter.prepararTermoPdf",
    featureFlag: "ai_v2_programs",
    timeoutMs: 4000,
    politicaRepeticao: "nenhuma",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  consultar_financeiro_consolidado: {
    nomeInterno: "consultar_financeiro_consolidado",
    descricao: "Consulta a base oficial consolidada de faturamento e recebíveis",
    intencoes: ["consultar_faturamento", "ver_financeiro", "ticket_medio", "contas_a_receber"],
    area: "financeiro_relatorios",
    parametros: {
      periodo: { tipo: "string", obrigatorio: false, descricao: "'hoje', 'semana' ou 'mes'" },
    },
    retorno: "Resumo oficial de faturamento, ticket médio e contas a receber",
    permissoes: ["financeiro", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "FinanceiroRelatoriosAdapter.consultarResumoConsolidado",
    featureFlag: "ai_v2_finance",
    timeoutMs: 6000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  gerar_mensagem_whatsapp: {
    nomeInterno: "gerar_mensagem_whatsapp",
    descricao: "Gera mensagem contextual formatada para disparo supervisionado no WhatsApp",
    intencoes: ["gerar_mensagem_whatsapp", "lembrete_whatsapp", "avisar_pet_pronto", "cobranca_whatsapp"],
    area: "comunicacao_mensagens",
    parametros: {
      telefoneDestino: { tipo: "string", obrigatorio: true, descricao: "Telefone do cliente" },
      nomeCliente: { tipo: "string", obrigatorio: true, descricao: "Nome do cliente" },
      tipoMensagem: { tipo: "string", obrigatorio: true, descricao: "Tipo do template" },
    },
    retorno: "Mensagem formatada e link wa.me pronto para envio",
    permissoes: ["agenda", "clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "MensagensWhatsAppAdapter.gerarMensagemWhatsApp",
    featureFlag: "ai_v2_messages",
    timeoutMs: 3000,
    politicaRepeticao: "nenhuma",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  criar_agendamento: {
    nomeInterno: "criar_agendamento",
    descricao: "Grava agendamento confirmado no banco de dados com revalidação de grade e verificação",
    intencoes: ["criar_agendamento", "preparar_agendamento", "executar_agendamento", "confirmar_agendamento"],
    area: "agenda",
    parametros: {
      clienteId: { tipo: "string", obrigatorio: true, descricao: "ID do cliente" },
      petId: { tipo: "string", obrigatorio: true, descricao: "ID do pet" },
      data: { tipo: "string", obrigatorio: false, descricao: "Data YYYY-MM-DD" },
      hora: { tipo: "string", obrigatorio: false, descricao: "Hora HH:mm" },
      dataHora: { tipo: "string", obrigatorio: false, descricao: "Data e hora ISO" },
      valor: { tipo: "number", obrigatorio: false, descricao: "Valor do serviço" },
    },
    retorno: "Registro do agendamento persistido e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "medio",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarAgendamentoConfirmado",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_agendamento: {
    nomeInterno: "executar_agendamento",
    descricao: "Grava agendamento confirmado no banco de dados com revalidação de grade e verificação",
    intencoes: ["executar_agendamento", "confirmar_agendamento", "criar_agendamento"],
    area: "agenda",
    parametros: {
      clienteId: { tipo: "string", obrigatorio: true, descricao: "ID do cliente" },
      petId: { tipo: "string", obrigatorio: true, descricao: "ID do pet" },
      dataHora: { tipo: "string", obrigatorio: false, descricao: "Data e hora ISO" },
      valor: { tipo: "number", obrigatorio: false, descricao: "Valor do serviço" },
    },
    retorno: "Registro do agendamento persistido e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "medio",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarAgendamentoConfirmado",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  cancelar_agendamento: {
    nomeInterno: "cancelar_agendamento",
    descricao: "Cancela agendamento confirmado no banco de dados e libera a grade",
    intencoes: ["cancelar_agendamento", "preparar_cancelamento", "executar_cancelamento", "desmarcar"],
    area: "agenda",
    parametros: {
      agendamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do agendamento a cancelar" },
      motivo: { tipo: "string", obrigatorio: false, descricao: "Motivo do cancelamento" },
    },
    retorno: "Registro do agendamento cancelado e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarCancelamentoConfirmado",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_cancelamento: {
    nomeInterno: "executar_cancelamento",
    descricao: "Cancela agendamento confirmado no banco de dados e libera a grade",
    intencoes: ["cancelar_agendamento", "executar_cancelamento"],
    area: "agenda",
    parametros: {
      agendamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do agendamento a cancelar" },
      motivo: { tipo: "string", obrigatorio: false, descricao: "Motivo do cancelamento" },
    },
    retorno: "Registro do agendamento cancelado e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarCancelamentoConfirmado",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  reagendar_agendamento: {
    nomeInterno: "reagendar_agendamento",
    descricao: "Remarca data e horário de um agendamento com revalidação de grade",
    intencoes: ["reagendar_agendamento", "preparar_reagendamento", "remarcar_agendamento", "executar_remarcacao"],
    area: "agenda",
    parametros: {
      agendamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do agendamento" },
      novaData: { tipo: "string", obrigatorio: true, descricao: "Nova data YYYY-MM-DD" },
      novaHora: { tipo: "string", obrigatorio: true, descricao: "Nova hora HH:mm" },
    },
    retorno: "Registro atualizado e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "medio",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarRemarcacaoConfirmada",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_remarcacao: {
    nomeInterno: "executar_remarcacao",
    descricao: "Remarca data e horário de um agendamento com revalidação de grade",
    intencoes: ["reagendar_agendamento", "executar_remarcacao", "remarcar_agendamento"],
    area: "agenda",
    parametros: {
      agendamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do agendamento" },
      novaData: { tipo: "string", obrigatorio: true, descricao: "Nova data YYYY-MM-DD" },
      novaHora: { tipo: "string", obrigatorio: true, descricao: "Nova hora HH:mm" },
    },
    retorno: "Registro atualizado e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "medio",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarRemarcacaoConfirmada",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  verificar_agendamento_id: {
    nomeInterno: "verificar_agendamento_id",
    descricao: "Verifica a integridade e estado de um agendamento por ID",
    intencoes: ["verificar_agendamento_id"],
    area: "agenda",
    parametros: {
      agendamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do agendamento" },
    },
    retorno: "Dados completos do agendamento verificado",
    permissoes: ["agenda", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "AgendaAdapter.verificarAgendamentoPorId",
    featureFlag: "ai_v2_queries",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  executar_cadastro_cliente: {
    nomeInterno: "executar_cadastro_cliente",
    descricao: "Grava novo cliente confirmado com verificação pós-escrita",
    intencoes: ["executar_cadastro_cliente", "confirmar_cadastro_cliente"],
    area: "clientes_pets",
    parametros: {
      nome: { tipo: "string", obrigatorio: true, descricao: "Nome completo do cliente" },
      telefone: { tipo: "string", obrigatorio: false, descricao: "Telefone de contato" },
      email: { tipo: "string", obrigatorio: false, descricao: "E-mail de contato" },
    },
    retorno: "Cliente cadastrado e verificado no banco",
    permissoes: ["clientes", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "medio",
    confirmacaoNecessaria: true,
    adaptador: "ClientesPetsAdapter.executarCadastroClienteConfirmado",
    featureFlag: "ai_v2_supervised_actions",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_consumo_credito: {
    nomeInterno: "executar_consumo_credito",
    descricao: "Debita sessão de crédito do plano do Clubinho confirmado pelo operador",
    intencoes: ["executar_consumo_credito", "confirmar_consumo_credito"],
    area: "programas_creditos",
    parametros: {
      creditoId: { tipo: "string", obrigatorio: true, descricao: "ID do registro de crédito" },
      quantidade: { tipo: "number", obrigatorio: true, descricao: "Quantidade de sessões a abater" },
    },
    retorno: "Saldo atualizado e verificado no banco",
    permissoes: ["clientes", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "ProgramasCreditosAdapter.executarConsumoCreditoConfirmado",
    featureFlag: "ai_v2_programs",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_recebimento: {
    nomeInterno: "executar_recebimento",
    descricao: "Registra baixa e recebimento financeiro confirmado pelo operador",
    intencoes: ["executar_recebimento", "confirmar_recebimento"],
    area: "financeiro_relatorios",
    parametros: {
      pagamentoId: { tipo: "string", obrigatorio: true, descricao: "ID da conta/pagamento" },
      valor: { tipo: "number", obrigatorio: true, descricao: "Valor recebido" },
      metodo: { tipo: "string", obrigatorio: true, descricao: "Método de pagamento" },
    },
    retorno: "Recebimento confirmado e registrado no financeiro",
    permissoes: ["financeiro", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "FinanceiroRelatoriosAdapter.executarRecebimentoConfirmado",
    featureFlag: "ai_v2_finance",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_pagamento_parcial: {
    nomeInterno: "executar_pagamento_parcial",
    descricao: "Registra pagamento parcial de conta/fatura",
    intencoes: ["executar_pagamento_parcial"],
    area: "financeiro_relatorios",
    parametros: {
      pagamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do pagamento" },
      valorParcial: { tipo: "number", obrigatorio: true, descricao: "Valor parcial" },
      metodo: { tipo: "string", obrigatorio: true, descricao: "Método" },
    },
    retorno: "Pagamento parcial registrado e saldo recalculado",
    permissoes: ["financeiro", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "FinanceiroRelatoriosAdapter.executarPagamentoParcialConfirmado",
    featureFlag: "ai_v2_finance",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_estorno: {
    nomeInterno: "executar_estorno",
    descricao: "Registra estorno financeiro supervisionado",
    intencoes: ["executar_estorno"],
    area: "financeiro_relatorios",
    parametros: {
      pagamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do pagamento" },
      motivo: { tipo: "string", obrigatorio: true, descricao: "Motivo do estorno" },
    },
    retorno: "Estorno concluído",
    permissoes: ["financeiro", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "FinanceiroRelatoriosAdapter.executarEstornoConfirmado",
    featureFlag: "ai_v2_finance",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  executar_conciliacao: {
    nomeInterno: "executar_conciliacao",
    descricao: "Executa conciliação de extrato",
    intencoes: ["executar_conciliacao"],
    area: "financeiro_relatorios",
    parametros: {},
    retorno: "Resultado da conciliação",
    permissoes: ["financeiro", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "FinanceiroRelatoriosAdapter.executarConciliacaoAutorizada",
    featureFlag: "ai_v2_finance",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  consultar_horarios_disponiveis: {
    nomeInterno: "consultar_horarios_disponiveis",
    descricao: "Verifica horários e encaixes disponíveis para agendamento",
    intencoes: ["consultar_horarios_disponiveis", "verificar_disponibilidade", "identificar_encaixes"],
    area: "agenda",
    parametros: {
      data: { tipo: "string", obrigatorio: true, descricao: "Data no formato YYYY-MM-DD" },
      porte: { tipo: "string", obrigatorio: false, descricao: "Porte do pet (pequeno, medio, grande, gigante)" },
    },
    retorno: "Lista de horários e vagas livres",
    permissoes: ["agenda", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "AgendaAdapter.identificarEncaixesDisponiveis",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  consultar_saldo_creditos: {
    nomeInterno: "consultar_saldo_creditos",
    descricao: "Consulta o saldo de créditos e contratos do Clubinho",
    intencoes: ["consultar_saldo_creditos", "saldo_creditos", "ver_creditos"],
    area: "programas_creditos",
    parametros: {
      clienteId: { tipo: "string", obrigatorio: false, descricao: "ID do cliente" },
      petId: { tipo: "string", obrigatorio: false, descricao: "ID do pet" },
    },
    retorno: "Saldo detalhado de créditos por serviço",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProgramasCreditosAdapter.consultarSaldoCreditos",
    featureFlag: "ai_v2_programs",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  reagendar_horario: {
    nomeInterno: "reagendar_horario",
    descricao: "Remarca um agendamento existente para nova data/hora",
    intencoes: ["reagendar_horario", "remarcar_horario"],
    area: "agenda",
    parametros: {
      agendamentoId: { tipo: "string", obrigatorio: true, descricao: "ID do agendamento" },
      novaData: { tipo: "string", obrigatorio: true, descricao: "Nova data YYYY-MM-DD" },
      novaHora: { tipo: "string", obrigatorio: true, descricao: "Novo horário HH:mm" },
    },
    retorno: "Agendamento remarcado e verificado",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "medio",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarRemarcacaoConfirmada",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
  },
  gerar_relatorio_financeiro: {
    nomeInterno: "gerar_relatorio_financeiro",
    descricao: "Consulta o faturamento consolidado e resumo financeiro",
    intencoes: ["gerar_relatorio_financeiro", "consultar_faturamento", "relatorio_financeiro"],
    area: "financeiro_relatorios",
    parametros: {
      periodo: { tipo: "string", obrigatorio: false, descricao: "dia | semana | mes" },
    },
    retorno: "Quadro financeiro consolidado",
    permissoes: ["financeiro", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "FinanceiroRelatoriosAdapter.consultarResumoConsolidado",
    featureFlag: "ai_v2_finance",
    timeoutMs: 6000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  obter_ficha_cliente: {
    nomeInterno: "obter_ficha_cliente",
    descricao: "Obtém ficha cadastral consolidada do cliente e seus pets",
    intencoes: ["obter_ficha_cliente", "ver_cliente_completo"],
    area: "clientes_pets",
    parametros: {
      clienteId: { tipo: "string", obrigatorio: true, descricao: "ID do cliente" },
    },
    retorno: "Ficha cadastral completa do cliente",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ClientesPetsAdapter.obterFichaClienteCompleta",
    featureFlag: "ai_v2_queries",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  gerar_central_proativa: {
    nomeInterno: "gerar_central_proativa",
    descricao: "Gera a central operacional com os 8 vetores proativos",
    intencoes: ["gerar_central_proativa", "resumo_operacional", "painel_proativo"],
    area: "agenda",
    parametros: {},
    retorno: "Resumo diário consolidado e alertas proativos",
    permissoes: ["agenda", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProativoAdapter.gerarCentralProativa",
    featureFlag: "ai_v2_proactive",
    timeoutMs: 8000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  identificar_horarios_vagos: {
    nomeInterno: "identificar_horarios_vagos",
    descricao: "Identifica horários ociosos na grade",
    intencoes: ["identificar_horarios_vagos", "vagas_ociosas"],
    area: "agenda",
    parametros: {
      data: { tipo: "string", obrigatorio: false, descricao: "Data YYYY-MM-DD" },
    },
    retorno: "Lista de horários livres",
    permissoes: ["agenda", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProativoAdapter.identificarHorariosVagos",
    featureFlag: "ai_v2_proactive",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  identificar_clientes_retorno: {
    nomeInterno: "identificar_clientes_retorno",
    descricao: "Identifica clientes inativos para reativação",
    intencoes: ["identificar_clientes_retorno", "clientes_saudade", "reativacao_clientes"],
    area: "clientes_pets",
    parametros: {},
    retorno: "Lista de clientes para retorno",
    permissoes: ["clientes", "admin"],
    tipo: "consulta",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "ProativoAdapter.identificarClientesParaRetorno",
    featureFlag: "ai_v2_proactive",
    timeoutMs: 5000,
    politicaRepeticao: "retry_1x_se_leitura",
    idempotencia: false,
    verificacaoPosterior: false,
  },
  registrar_envio_whatsapp: {
    nomeInterno: "registrar_envio_whatsapp",
    descricao: "Registra auditoria de mensagem enviada via WhatsApp",
    intencoes: ["registrar_envio_whatsapp", "log_whatsapp"],
    area: "comunicacao_mensagens",
    parametros: {
      destinatario: { tipo: "string", obrigatorio: true, descricao: "Número ou nome" },
      conteudoAprovado: { tipo: "string", obrigatorio: true, descricao: "Texto da mensagem" },
      canal: { tipo: "string", obrigatorio: true, descricao: "whatsapp | sms | email" },
    },
    retorno: "Log de envio registrado",
    permissoes: ["clientes", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "baixo",
    confirmacaoNecessaria: false,
    adaptador: "MensagensWhatsAppAdapter.registrarEnvioComunicacao",
    featureFlag: "ai_v2_messages",
    timeoutMs: 5000,
    politicaRepeticao: "nenhuma",
    idempotencia: false,
    verificacaoPosterior: false,
  },
};

/**
 * Despachante Central com Whitelist Estrita e Tratamento de Erros
 */
export async function despacharFerramentaV2(
  sb: SupabaseClient<Database>,
  toolNome: string,
  params: Record<string, any>,
  idempotencyKey?: string
): Promise<JessiV2QueryResult | JessiV2MutationResult | any> {
  const toolDef = JESSI_V2_TOOLS_CATALOG[toolNome];

  if (!toolDef) {
    return {
      success: false,
      source: "tools_registry",
      summary: `A operação solicitada "${toolNome}" não está disponível no catálogo de ferramentas autorizadas.`,
      executed_at: new Date().toISOString(),
      error_code: "TOOL_NOT_REGISTERED",
      correlation_id: `tool_not_found_${Date.now()}`,
    };
  }

  if (toolDef.tipo === "mutacao_supervisionada") {
    const flagHabilitada = checarFlagV2(JESSI_V2_FLAGS_DEFAULT, toolDef.featureFlag);
    if (!flagHabilitada || !JESSI_V2_FLAGS_DEFAULT.ai_v2_supervised_actions) {
      return {
        success: false,
        source: "tools_registry_hard_lock",
        summary: `Ação de alteração "${toolNome}" bloqueada: O sistema está em Modo Consultivo / Somente Leitura. Mutações físicas no banco de dados estão estritamente desativadas nesta fase.`,
        error_code: "MUTATION_BLOCKED_BY_CONTROLLED_ACTIVATION",
        executed_at: new Date().toISOString(),
        correlation_id: `lock_${Date.now()}`,
      };
    }
  }

  const chave = idempotencyKey || `v2_exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  switch (toolNome) {
    case "consultar_agenda":
      return await AgendaAdapter.consultarAgendaPorData(
        sb,
        params.data || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
      );

    case "consultar_horarios_disponiveis":
    case "verificar_disponibilidade":
    case "identificar_encaixes":
      return await AgendaAdapter.identificarEncaixesDisponiveis(
        sb,
        params.data || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
        params.porte || "medio"
      );

    case "buscar_clientes_pets":
      return await ClientesPetsAdapter.buscarClientesPets(sb, params.termo || params.termoBusca || "");

    case "obter_ficha_pet":
      return await ClientesPetsAdapter.obterFichaPet(sb, params.petId);

    case "obter_ficha_cliente":
      return await ClientesPetsAdapter.obterFichaClienteCompleta(sb, params.clienteId);

    case "consultar_saldo_programas":
    case "consultar_saldo_creditos":
      return await ProgramasCreditosAdapter.consultarSaldoCreditos(sb, params.clienteId, params.petId);

    case "consultar_programas_ativos_geral":
      return await ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb);

    case "gerar_termo_programa_pdf":
      return await ProgramasCreditosAdapter.prepararTermoPdf(sb, params.contratoId);

    case "consultar_financeiro_consolidado":
    case "gerar_relatorio_financeiro":
    case "consultar_faturamento":
      return await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, params.periodo || "mes");

    case "gerar_central_proativa":
      return await ProativoAdapter.gerarCentralProativa(sb);

    case "identificar_horarios_vagos":
      return await ProativoAdapter.identificarHorariosVagos(sb, params.data);

    case "identificar_clientes_retorno":
      return await ProativoAdapter.identificarClientesParaRetorno(sb);

    case "gerar_mensagem_whatsapp":
      return MensagensWhatsAppAdapter.gerarMensagemWhatsApp(params as JessiV2WhatsAppPayload);

    case "registrar_envio_whatsapp":
      await MensagensWhatsAppAdapter.registrarEnvioComunicacao(sb, params as any);
      return {
        success: true,
        source: "mensagens_whatsapp",
        summary: "Disparo de comunicação registrado na auditoria com sucesso.",
        executed_at: new Date().toISOString(),
      };

    case "executar_agendamento":
    case "criar_agendamento":
      return await AgendaAdapter.executarAgendamentoConfirmado(sb, params, chave);

    case "executar_remarcacao":
    case "reagendar_agendamento":
    case "remarcar_agendamento":
    case "reagendar_horario":
      return await AgendaAdapter.executarRemarcacaoConfirmada(sb, params as any, chave);

    case "executar_cancelamento":
    case "cancelar_agendamento":
      return await AgendaAdapter.executarCancelamentoConfirmado(sb, params as any, chave);

    case "verificar_agendamento_id":
      return await AgendaAdapter.verificarAgendamentoPorId(sb, params.agendamentoId);

    case "executar_cadastro_cliente":
      return await ClientesPetsAdapter.executarCadastroClienteConfirmado(sb, params as any, chave);

    case "executar_consumo_credito":
      return await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(sb, params as any, chave);

    case "executar_recebimento":
      return await FinanceiroRelatoriosAdapter.executarRecebimentoConfirmado(sb, params as any, chave);

    case "executar_pagamento_parcial":
      return await FinanceiroRelatoriosAdapter.executarPagamentoParcialConfirmado(sb, params as any, chave);

    case "executar_estorno":
      return await FinanceiroRelatoriosAdapter.executarEstornoConfirmado(sb, params as any, chave);

    case "executar_conciliacao":
      return await FinanceiroRelatoriosAdapter.executarConciliacaoAutorizada(sb, params as any, chave);

    default:
      return {
        success: false,
        source: "tools_registry",
        summary: `Operação "${toolNome}" não autorizada.`,
        executed_at: new Date().toISOString(),
        error_code: "TOOL_NOT_REGISTERED",
        correlation_id: `tool_not_found_${Date.now()}`,
      };
  }
}
