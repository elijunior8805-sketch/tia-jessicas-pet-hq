import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { AgendaAdapter } from "../adapters/agenda.adapter";
import { ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { ProgramasCreditosAdapter } from "../adapters/programas-creditos.adapter";
import { FinanceiroRelatoriosAdapter } from "../adapters/financeiro-relatorios.adapter";
import { MensagensWhatsAppAdapter, JessiV2WhatsAppPayload } from "../adapters/mensagens-whatsapp.adapter";

/**
 * Catálogo e Despachante Oficial de Ferramentas da Jessi V2
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export interface JessiV2ToolDefinition {
  nome: string;
  descricao: string;
  dominio: "agenda" | "clientes_pets" | "programas_creditos" | "financeiro_relatorios" | "comunicacao_mensagens";
  tipo: "consulta" | "mutacao_supervisionada";
  parametrosObrigatorios: string[];
}

export const JESSI_V2_TOOLS_CATALOG: Record<string, JessiV2ToolDefinition> = {
  consultar_agenda: {
    nome: "consultar_agenda",
    descricao: "Consulta os agendamentos e horários para uma data específica",
    dominio: "agenda",
    tipo: "consulta",
    parametrosObrigatorios: ["data"],
  },
  buscar_clientes_pets: {
    nome: "buscar_clientes_pets",
    descricao: "Busca clientes e pets por nome, telefone ou raça",
    dominio: "clientes_pets",
    tipo: "consulta",
    parametrosObrigatorios: [],
  },
  obter_ficha_pet: {
    nome: "obter_ficha_pet",
    descricao: "Obtém histórico e ficha médica/comportamental de um pet",
    dominio: "clientes_pets",
    tipo: "consulta",
    parametrosObrigatorios: ["petId"],
  },
  consultar_saldo_programas: {
    nome: "consultar_saldo_programas",
    descricao: "Consulta o saldo de créditos e planos ativos de um cliente",
    dominio: "programas_creditos",
    tipo: "consulta",
    parametrosObrigatorios: ["clienteId"],
  },
  consultar_financeiro_consolidado: {
    nome: "consultar_financeiro_consolidado",
    descricao: "Consulta faturamento, ticket médio e contas a receber oficial",
    dominio: "financeiro_relatorios",
    tipo: "consulta",
    parametrosObrigatorios: [],
  },
  gerar_mensagem_whatsapp: {
    nome: "gerar_mensagem_whatsapp",
    descricao: "Gera mensagem contextual para disparo supervisionado no WhatsApp",
    dominio: "comunicacao_mensagens",
    tipo: "consulta",
    parametrosObrigatorios: ["telefoneDestino", "nomeCliente", "tipoMensagem"],
  },
  executar_agendamento: {
    nome: "executar_agendamento",
    descricao: "Grava agendamento confirmado no banco de dados com verificação",
    dominio: "agenda",
    tipo: "mutacao_supervisionada",
    parametrosObrigatorios: ["clienteId", "petId", "dataHora", "valor"],
  },
  executar_cadastro_cliente: {
    nome: "executar_cadastro_cliente",
    descricao: "Grava novo cliente confirmado com verificação",
    dominio: "clientes_pets",
    tipo: "mutacao_supervisionada",
    parametrosObrigatorios: ["nome"],
  },
  executar_consumo_credito: {
    nome: "executar_consumo_credito",
    descricao: "Debita crédito de plano/programa confirmado",
    dominio: "programas_creditos",
    tipo: "mutacao_supervisionada",
    parametrosObrigatorios: ["creditoId", "quantidade"],
  },
};

/**
 * Despachante Central de Ferramentas da Jessi V2
 */
export async function despacharFerramentaV2(
  sb: SupabaseClient<Database>,
  toolNome: string,
  params: Record<string, any>,
  idempotencyKey?: string
): Promise<JessiV2QueryResult | JessiV2MutationResult | any> {
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
      return await ProgramasCreditosAdapter.consultarSaldoCreditos(sb, params.clienteId);

    case "consultar_financeiro_consolidado":
      return await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, params.periodo || "mes");

    case "gerar_mensagem_whatsapp":
      return MensagensWhatsAppAdapter.gerarMensagemWhatsApp(params as JessiV2WhatsAppPayload);

    case "executar_agendamento":
      return await AgendaAdapter.executarAgendamentoConfirmado(sb, params, chave);

    case "executar_cadastro_cliente":
      return await ClientesPetsAdapter.executarCadastroClienteConfirmado(sb, params as any, chave);

    case "executar_consumo_credito":
      return await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(sb, params as any, chave);

    default:
      return {
        success: false,
        source: "tools_registry",
        summary: `Ferramenta "${toolNome}" não encontrada no catálogo da Jessi V2.`,
        executed_at: new Date().toISOString(),
        error_code: "TOOL_NOT_FOUND",
      };
  }
}
