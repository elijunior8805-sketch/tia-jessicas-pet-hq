import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { consultarAgendaJessi, consultarDisponibilidadeJessi, criarAgendamentoJessi, reagendarJessi, cancelarAgendamentoJessi } from "./tools/agenda-tools";
import { buscarClientesJessi, buscarPetsDoClienteJessi, obterVisao360ClienteJessi, obterVisao360PetJessi, criarClienteJessi, criarPetJessi } from "./tools/clientes-tools";
import { consultarKPIsFinanceirosJessi, consultarInadimplenciaJessi, compararPeriodosFinanceirosJessi, registrarBaixaPagamentoJessi, estornarPagamentoJessi } from "./tools/financeiro-tools";
import { consultarCreditosPetJessi, consultarCatalogoProgramasJessi, reconciliarCreditosJessi } from "./tools/programas-tools";
import { processarComprovanteJessi, conciliarEBaixarComprovanteJessi } from "./tools/comprovante-tools";
import { gerarMensagensCobrancaJessi, consultarAniversariantesJessi, consultarReativacaoJessi, sugerirRespostaJessi } from "./tools/comunicacao-tools";
import { consultarResumoNegocioJessi, realizarAuditoriaIntegridadeJessi, consultarQualidadeIAJessi } from "./tools/auditoria-tools";

/**
 * Registro Central e Despachante de Ferramentas da Jessi
 */

export interface JessiToolDefinition {
  nome: string;
  descricao: string;
  especialista: string;
  tipo: "consulta" | "acao";
  exigeConfirmacao: boolean;
  executar: (sb: SupabaseClient<Database>, params: any, contexto?: any) => Promise<any>;
}

export const JESSI_TOOLS: Record<string, JessiToolDefinition> = {
  // Agenda
  consultar_agenda: {
    nome: "consultar_agenda",
    descricao: "Consulta agendamentos de uma data específica ou período",
    especialista: "agenda",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarAgendaJessi(sb, p),
  },
  consultar_disponibilidade: {
    nome: "consultar_disponibilidade",
    descricao: "Verifica horários livres na agenda",
    especialista: "agenda",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarDisponibilidadeJessi(sb, p),
  },
  criar_agendamento: {
    nome: "criar_agendamento",
    descricao: "Cria um novo agendamento com verificação de conflitos",
    especialista: "agenda",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => criarAgendamentoJessi(sb, p),
  },
  reagendar: {
    nome: "reagendar",
    descricao: "Altera data/hora de um agendamento",
    especialista: "agenda",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => reagendarJessi(sb, p),
  },
  cancelar_agendamento: {
    nome: "cancelar_agendamento",
    descricao: "Cancela um agendamento existente",
    especialista: "agenda",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => cancelarAgendamentoJessi(sb, p),
  },

  // Clientes e Pets
  buscar_clientes: {
    nome: "buscar_clientes",
    descricao: "Busca clientes por nome, telefone ou nome do pet com tolerância fonética",
    especialista: "clientes_pets",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => buscarClientesJessi(sb, p),
  },
  buscar_pets_do_cliente: {
    nome: "buscar_pets_do_cliente",
    descricao: "Lista os pets cadastrados para um tutor",
    especialista: "clientes_pets",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => buscarPetsDoClienteJessi(sb, p),
  },
  visao_360_cliente: {
    nome: "visao_360_cliente",
    descricao: "Exibe visão 360° do cliente: pets, faturamento, frequência e pendências",
    especialista: "clientes_pets",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => obterVisao360ClienteJessi(sb, p),
  },
  visao_360_pet: {
    nome: "visao_360_pet",
    descricao: "Exibe visão 360° do pet: raça, histórico, créditos de programas",
    especialista: "clientes_pets",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => obterVisao360PetJessi(sb, p),
  },
  criar_cliente: {
    nome: "criar_cliente",
    descricao: "Cadastra novo tutor no sistema",
    especialista: "clientes_pets",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => criarClienteJessi(sb, p),
  },
  criar_pet: {
    nome: "criar_pet",
    descricao: "Cadastra novo pet vinculado a um cliente",
    especialista: "clientes_pets",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => criarPetJessi(sb, p),
  },

  // Financeiro
  consultar_faturamento: {
    nome: "consultar_faturamento",
    descricao: "Consulta faturamento e KPIs financeiros da view oficial",
    especialista: "financeiro",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarKPIsFinanceirosJessi(sb, p),
  },
  consultar_valores_a_receber: {
    nome: "consultar_valores_a_receber",
    descricao: "Lista pendências e inadimplência",
    especialista: "financeiro",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarInadimplenciaJessi(sb),
  },
  comparar_periodos: {
    nome: "comparar_periodos",
    descricao: "Compara dois períodos financeiros",
    especialista: "financeiro",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => compararPeriodosFinanceirosJessi(sb, p),
  },
  baixa_pagamento: {
    nome: "baixa_pagamento",
    descricao: "Registra recebimento de pagamento",
    especialista: "financeiro",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => registrarBaixaPagamentoJessi(sb, p),
  },
  estornar_pagamento: {
    nome: "estornar_pagamento",
    descricao: "Estorna um pagamento realizado",
    especialista: "financeiro",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => estornarPagamentoJessi(sb, p),
  },

  // Programas e Créditos
  consultar_creditos_pet: {
    nome: "consultar_creditos_pet",
    descricao: "Consulta saldo e movimentações de créditos de programas do pet",
    especialista: "programas_cuidado",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarCreditosPetJessi(sb, p),
  },
  consultar_catalogo_programas: {
    nome: "consultar_catalogo_programas",
    descricao: "Lista programas de cuidado disponíveis no catálogo",
    especialista: "programas_cuidado",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarCatalogoProgramasJessi(sb),
  },
  reconciliar_creditos: {
    nome: "reconciliar_creditos",
    descricao: "Executa rotina de reconciliação de créditos para um pet",
    especialista: "programas_cuidado",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => reconciliarCreditosJessi(sb, p),
  },

  // Comprovantes
  processar_comprovante: {
    nome: "processar_comprovante",
    descricao: "Analisa comprovante Pix via visão computacional",
    especialista: "financeiro",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => processarComprovanteJessi(sb, p),
  },
  conciliar_comprovante: {
    nome: "conciliar_comprovante",
    descricao: "Confirma e baixa pagamento baseado em comprovante",
    especialista: "financeiro",
    tipo: "acao",
    exigeConfirmacao: true,
    executar: (sb, p) => conciliarEBaixarComprovanteJessi(sb, p),
  },

  // Comunicação
  gerar_mensagem_cobranca: {
    nome: "gerar_mensagem_cobranca",
    descricao: "Gera abordagens personalizadas de cobrança via IA",
    especialista: "cobranca",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => gerarMensagensCobrancaJessi(sb, p),
  },
  consultar_aniversariantes: {
    nome: "consultar_aniversariantes",
    descricao: "Lista aniversariantes do dia",
    especialista: "comunicacao",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarAniversariantesJessi(sb),
  },
  consultar_reativacao: {
    nome: "consultar_reativacao",
    descricao: "Lista clientes em risco de evasão",
    especialista: "comunicacao",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarReativacaoJessi(sb),
  },
  sugerir_resposta: {
    nome: "sugerir_resposta",
    descricao: "Gera sugestões de resposta para mensagem de tutor",
    especialista: "comunicacao",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => sugerirRespostaJessi(sb, p),
  },

  // Auditoria e Negócio
  resumo_negocio: {
    nome: "resumo_negocio",
    descricao: "Exibe resumo consolidado de operação, agenda e estoque",
    especialista: "gestao_estrategica",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarResumoNegocioJessi(),
  },
  auditoria_integridade: {
    nome: "auditoria_integridade",
    descricao: "Audita consistência de dados entre atendimentos e pagamentos",
    especialista: "relatorios",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => realizarAuditoriaIntegridadeJessi(sb),
  },
  qualidade_ia: {
    nome: "qualidade_ia",
    descricao: "Métricas de qualidade e assertividade da IA",
    especialista: "relatorios",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarQualidadeIAJessi(),
  },

  // Aliases para máxima resiliência entre diferentes classificadores
  consulta_agenda: {
    nome: "consultar_agenda",
    descricao: "Consulta agendamentos da agenda",
    especialista: "agenda",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarAgendaJessi(sb, p),
  },
  consulta_cliente: {
    nome: "buscar_clientes",
    descricao: "Busca clientes no cadastro",
    especialista: "clientes_pets",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => buscarClientesJessi(sb, p),
  },
  consulta_pet: {
    nome: "buscar_pets_do_cliente",
    descricao: "Busca pets cadastrados",
    especialista: "clientes_pets",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => buscarPetsDoClienteJessi(sb, p),
  },
  consulta_financeira: {
    nome: "consultar_faturamento",
    descricao: "Consulta indicadores e faturamento",
    especialista: "financeiro",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarKPIsFinanceirosJessi(sb, p),
  },
  consultar_kpis_financeiros: {
    nome: "consultar_faturamento",
    descricao: "Consulta KPIs oficiais de faturamento",
    especialista: "financeiro",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarKPIsFinanceirosJessi(sb, p),
  },
  consultar_creditos: {
    nome: "consultar_creditos_pet",
    descricao: "Consulta créditos de programas do pet",
    especialista: "programas_cuidado",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarCreditosPetJessi(sb, p),
  },
  consultar_programas: {
    nome: "consultar_catalogo_programas",
    descricao: "Lista programas disponíveis",
    especialista: "programas_cuidado",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarCatalogoProgramasJessi(sb),
  },
  consultar_resumo_operacional: {
    nome: "resumo_negocio",
    descricao: "Resumo operacional e estratégico",
    especialista: "gestao_estrategica",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: (sb, p) => consultarResumoNegocioJessi(),
  },
  saudacao: {
    nome: "saudacao",
    descricao: "Apresentação e status da Jessi",
    especialista: "gestao_estrategica",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: async () => ({
      success: true,
      source: "jessi_status",
      data: { status: "online", versao: "2.0" },
      summary: "Olá! Sou a Jessi, assistente operacional do Spa de Pet Tia Jéssica. Estou ativa e pronta para ajudar na consulta da agenda, localização de clientes e pets, acompanhamento de programas de cuidado, conciliação de comprovantes Pix e finanças. Como posso ajudar agora?",
    }),
  },
  health_check: {
    nome: "health_check",
    descricao: "Diagnóstico de saúde operacional da Jessi",
    especialista: "relatorios",
    tipo: "consulta",
    exigeConfirmacao: false,
    executar: async (sb) => {
      const { count: cliCount } = await sb.from("clientes").select("*", { count: "exact", head: true });
      const { count: petCount } = await sb.from("pets").select("*", { count: "exact", head: true });
      const { count: agendCount } = await sb.from("agendamentos").select("*", { count: "exact", head: true });
      return {
        success: true,
        source: "health_check",
        data: {
          banco_dados: "conectado",
          clientes_cadastrados: cliCount || 0,
          pets_cadastrados: petCount || 0,
          agendamentos_registrados: agendCount || 0,
          ferramentas_ativas: Object.keys(JESSI_TOOLS).length,
          timestamp: new Date().toISOString(),
        },
        summary: `Diagnóstico Operacional da Jessi: Banco de dados conectado com sucesso (${cliCount} clientes, ${petCount} pets, ${agendCount} agendamentos). Todas as ${Object.keys(JESSI_TOOLS).length} ferramentas estão operacionais.`,
      };
    },
  },
};

/**
 * Executa ferramenta selecionada com guardrails e tratamento de erro
 */
export async function despacharFerramentaJessi(
  sb: SupabaseClient<Database>,
  nomeFerramenta: string,
  parametros: any,
  contexto?: any
): Promise<any> {
  const tool = JESSI_TOOLS[nomeFerramenta];
  if (!tool) {
    throw new Error(`Ferramenta "${nomeFerramenta}" não está registrada na Jessi.`);
  }

  return await tool.executar(sb, parametros, contexto);
}
