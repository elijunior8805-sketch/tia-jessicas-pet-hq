import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { JessiV2FeatureFlags } from "../config/jessi-v2-config";
import { AgendaAdapter } from "../adapters/agenda.adapter";
import { ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { ProgramasCreditosAdapter } from "../adapters/programas-creditos.adapter";
import { FinanceiroRelatoriosAdapter } from "../adapters/financeiro-relatorios.adapter";
import { MensagensWhatsAppAdapter, JessiV2WhatsAppPayload } from "../adapters/mensagens-whatsapp.adapter";

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
  executar_agendamento: {
    nomeInterno: "executar_agendamento",
    descricao: "Grava agendamento confirmado no banco de dados com revalidação de grade e verificação",
    intencoes: ["executar_agendamento", "confirmar_agendamento"],
    area: "agenda",
    parametros: {
      clienteId: { tipo: "string", obrigatorio: true, descricao: "ID do cliente" },
      petId: { tipo: "string", obrigatorio: true, descricao: "ID do pet" },
      dataHora: { tipo: "string", obrigatorio: true, descricao: "Data e hora ISO" },
      valor: { tipo: "number", obrigatorio: true, descricao: "Valor do serviço" },
    },
    retorno: "Registro do agendamento persistido e verificado no banco",
    permissoes: ["agenda", "admin"],
    tipo: "mutacao_supervisionada",
    nivelRisco: "alto",
    confirmacaoNecessaria: true,
    adaptador: "AgendaAdapter.executarAgendamentoConfirmado",
    featureFlag: "ai_v2_scheduling",
    timeoutMs: 8000,
    politicaRepeticao: "nenhuma",
    idempotencia: true,
    verificacaoPosterior: true,
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
      summary: "A operação solicitada não está disponível no catálogo de ferramentas autorizadas.",
      executed_at: new Date().toISOString(),
      error_code: "TOOL_NOT_REGISTERED",
      correlation_id: `tool_not_found_${Date.now()}`,
    };
  }

  const chave = idempotencyKey || `v2_exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  switch (toolNome) {
    case "consultar_agenda":
      return await AgendaAdapter.consultarAgendaPorData(
        sb,
        params.data || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
      );

    case "buscar_clientes_pets":
      return await ClientesPetsAdapter.buscarClientesPets(sb, params.termo || params.termoBusca || "");

    case "obter_ficha_pet":
      return await ClientesPetsAdapter.obterFichaPet(sb, params.petId);

    case "consultar_saldo_programas":
      return await ProgramasCreditosAdapter.consultarSaldoCreditos(sb, params.clienteId, params.petId);

    case "consultar_programas_ativos_geral":
      return await ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb);

    case "consultar_financeiro_consolidado":
      return await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, params.periodo || "mes");

    case "gerar_mensagem_whatsapp":
      return MensagensWhatsAppAdapter.gerarMensagemWhatsApp(params as JessiV2WhatsAppPayload);

    case "executar_agendamento":
      return await AgendaAdapter.executarAgendamentoConfirmado(sb, params, chave);

    case "executar_remarcacao":
      return await AgendaAdapter.executarRemarcacaoConfirmada(sb, params as any, chave);

    case "executar_cancelamento":
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
        summary: "Operação não autorizada.",
        executed_at: new Date().toISOString(),
        error_code: "TOOL_NOT_REGISTERED",
        correlation_id: `tool_not_found_${Date.now()}`,
      };
  }
}
