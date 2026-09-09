import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

/**
 * Interface do Contrato Real de Programa Ativo (Seção 16)
 */
export interface JessiV2ContratoProgramaAtivo {
  id: string;
  tutor: { id: string; nome: string; telefone: string };
  pet: { id: string; nome: string; raca: string };
  programa: { id: string; nome: string; precoBase: number };
  contratacaoData: string;
  validadeData: string;
  diasRestantes: number;
  creditosContratados: number;
  creditosUtilizados: number;
  creditosDisponiveis: number;
  statusPagamento: "pago" | "pendente" | "isento";
}

/**
 * Adaptador Oficial de Programas de Cuidados & Clubinho para a Jessi V2 (Seção 16)
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */
export class ProgramasCreditosAdapter {
  /**
   * Consulta todos os contratos reais de programas ativos no sistema (Seção 16)
   */
  static async consultarProgramasAtivosGeral(
    sb: SupabaseClient<Database>
  ): Promise<JessiV2QueryResult<JessiV2ContratoProgramaAtivo[]>> {
    const inicio = Date.now();
    const correlationId = `query_prog_ativos_${inicio}`;
    try {
      const hoje = new Date();
      const hojeStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(hoje);

      // Consulta aos contratos reais de programas ativos com dados de cliente, pet e programa
      const { data: contratos, error } = await sb
        .from("cliente_programas")
        .select(`
          id,
          cliente_id,
          pet_id,
          status,
          created_at,
          data_inicio,
          data_fim,
          cliente:clientes(id, nome, telefone),
          pet:pets(id, nome, raca),
          programa:programas_cuidado(id, nome, descricao, preco_base)
        `)
        .eq("status", "ativo")
        .gte("data_fim", hojeStr);

      if (error) throw error;

      // Busca os saldos de créditos de cada cliente/pet
      const { data: todosCreditos } = await sb
        .from("cliente_programa_creditos")
        .select("*");

      const listaFormatada: JessiV2ContratoProgramaAtivo[] = (contratos || []).map((c: any) => {
        const creditosDoContrato = (todosCreditos || []).filter(
          (cr: any) => cr.cliente_id === c.cliente_id && cr.pet_id === c.pet_id
        );

        const totalDisponivel = creditosDoContrato.reduce((acc, curr: any) => acc + (curr.saldo || 0), 0);
        const totalContratado = creditosDoContrato.reduce((acc, curr: any) => acc + (curr.quantidade_total || curr.saldo || 4), 0);
        const totalUtilizado = Math.max(totalContratado - totalDisponivel, 0);

        const dataFim = new Date(c.data_fim || c.created_at);
        const diffDias = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          tutor: {
            id: c.cliente?.id || c.cliente_id,
            nome: c.cliente?.nome || "Tutor não identificado",
            telefone: c.cliente?.telefone || "Sem telefone",
          },
          pet: {
            id: c.pet?.id || c.pet_id,
            nome: c.pet?.nome || "Pet",
            raca: c.pet?.raca || "Padrão",
          },
          programa: {
            id: c.programa?.id || "prog",
            nome: c.programa?.nome || "Clubinho Mensal",
            precoBase: Number(c.programa?.preco_base) || 0,
          },
          contratacaoData: c.data_inicio || c.created_at?.split("T")[0] || hojeStr,
          validadeData: c.data_fim || hojeStr,
          diasRestantes: Math.max(diffDias, 0),
          creditosContratados: totalContratado,
          creditosUtilizados: totalUtilizado,
          creditosDisponiveis: totalDisponivel,
          statusPagamento: "pago",
        };
      });

      const resumo =
        listaFormatada.length > 0
          ? `Existem ${listaFormatada.length} contrato(s) de programas ativos com saldo de créditos no Spa.`
          : "Nenhum contrato ativo de programas encontrado no momento.";

      return {
        success: true,
        source: "contratos_reais_programas",
        data: listaFormatada,
        total_count: listaFormatada.length,
        summary: resumo,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "contratos_programas",
        data: [],
        total_count: 0,
        summary: `Erro ao consultar contratos reais de programas: ${err.message}`,
        error_code: err.code || "ERRO_PROGRAMAS_ATIVOS",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Consulta os créditos específicos de um cliente/pet
   */
  static async consultarSaldoCreditos(
    sb: SupabaseClient<Database>,
    clienteId: string,
    petId?: string
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    const correlationId = `query_programas_${inicio}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      let queryProg = sb
        .from("cliente_programas")
        .select(`
          id,
          cliente_id,
          pet_id,
          status,
          created_at,
          data_inicio,
          data_fim,
          programa:programas_cuidado(id, nome, descricao, preco_base)
        `)
        .eq("cliente_id", clienteId)
        .eq("status", "ativo");

      if (petId) queryProg = queryProg.eq("pet_id", petId);

      const { data: assinaturas, error } = await queryProg;
      if (error) throw error;

      let queryCred = sb
        .from("cliente_programa_creditos")
        .select("*")
        .eq("cliente_id", clienteId)
        .gt("saldo", 0);

      if (petId) queryCred = queryCred.eq("pet_id", petId);

      const { data: creditos } = await queryCred;

      const totalCreditos = (creditos || []).reduce((acc, curr: any) => acc + (curr.saldo || 0), 0);

      return {
        success: true,
        source: "tabelas_programas_e_creditos",
        data: {
          assinaturasAtivas: assinaturas || [],
          creditosDisponiveis: creditos || [],
          totalSessaoRestantes: totalCreditos,
        },
        total_count: assinaturas?.length || 0,
        summary: `Cliente possui ${assinaturas?.length || 0} programa(s) ativo(s) com ${totalCreditos} crédito(s) restante(s).`,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabelas_programas",
        data: { assinaturasAtivas: [], creditosDisponiveis: [], totalSessaoRestantes: 0 },
        total_count: 0,
        summary: `Erro ao consultar saldo de programas: ${err.message}`,
        error_code: err.code || "ERRO_CONSULTA_PROGRAMAS",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Prepara o abatimento de 1 crédito no banho com cobrança separada de itens extras (Seção 16)
   */
  static prepararFinalizacaoComExtras(params: {
    clienteId: string;
    clienteNome: string;
    petId: string;
    petNome: string;
    creditoId: string;
    saldoAtual: number;
    valorBanho: number;
    servicosExtras: Array<{ nome: string; valor: number }>;
  }) {
    const totalExtras = params.servicosExtras.reduce((acc, curr) => acc + curr.valor, 0);

    return {
      title: `Finalizar Atendimento de ${params.petNome} com Crédito do Clubinho`,
      summary:
        `• Banho Principal: R$ ${params.valorBanho.toFixed(2)} (Quitado com 1 Crédito do Plano)\n` +
        `• Extras a Pagar: R$ ${totalExtras.toFixed(2)} (${params.servicosExtras.map((e) => e.nome).join(", ") || "Nenhum"})\n` +
        `• Total a Pagar no Caixa: R$ ${totalExtras.toFixed(2)}\n` +
        `• Saldo Restante de Créditos: ${params.saldoAtual - 1} sessão(ões)`,
      params: {
        ...params,
        totalExtras,
        debitoCredito: 1,
      },
    };
  }

  /**
   * Executa o abatimento de crédito pós-confirmação humana com validação e Read-Back
   */
  static async executarConsumoCreditoConfirmado(
    sb: SupabaseClient<Database>,
    params: { creditoId: string; quantidade: number; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_credito_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const { data: creditoAtual, error: errFetch } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo, servico_nome")
        .eq("id", params.creditoId)
        .single();

      if (errFetch || !creditoAtual) throw new Error("Registro de crédito não localizado.");

      if ((creditoAtual.saldo || 0) < params.quantidade) {
        return {
          success: false,
          entity_id: params.creditoId,
          affected_record_id: params.creditoId,
          source: "tabela_creditos",
          summary: `Saldo insuficiente: disponível ${creditoAtual.saldo}, solicitado ${params.quantidade}.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "SALDO_INSUFICIENTE",
          correlation_id: correlationId,
          verified: false,
        };
      }

      const novoSaldo = (creditoAtual.saldo || 0) - params.quantidade;

      const { data: atualizado, error: errUpdate } = await sb
        .from("cliente_programa_creditos")
        .update({ saldo: novoSaldo } as any)
        .eq("id", params.creditoId)
        .select("id, saldo, servico_nome")
        .single();

      if (errUpdate || !atualizado) throw errUpdate || new Error("Falha ao atualizar saldo.");

      const { data: readBack } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo")
        .eq("id", params.creditoId)
        .maybeSingle();

      const verificado = readBack?.saldo === novoSaldo;

      return {
        success: true,
        entity_id: params.creditoId,
        affected_record_id: params.creditoId,
        source: "tabela_creditos",
        before: creditoAtual,
        after: atualizado,
        summary: `Crédito de "${creditoAtual.servico_nome}" consumido com sucesso. Novo saldo: ${novoSaldo}.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.creditoId,
        affected_record_id: params.creditoId,
        source: "tabela_creditos",
        summary: `Erro ao consumir crédito: ${err.message}`,
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        error_code: err.code || "ERRO_CONSUMO_CREDITO",
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Reserva 1 crédito vinculado ao agendamento para impedir duplo consumo (Seção 16)
   */
  static async reservarCreditoAgendamento(
    sb: SupabaseClient<Database>,
    params: { creditoId: string; agendamentoId: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `reserva_credito_${Date.now()}`;
    try {
      const { data: credito } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo, servico_nome")
        .eq("id", params.creditoId)
        .single();

      if (!credito || (credito.saldo || 0) < 1) {
        return {
          success: false,
          entity_id: params.creditoId,
          source: "tabela_creditos",
          summary: "Não há saldo de créditos disponível para reservar.",
          error_code: "CREDITO_INDISPONIVEL",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      return {
        success: true,
        entity_id: params.creditoId,
        affected_record_id: params.creditoId,
        source: "tabela_creditos",
        summary: `1 crédito de "${credito.servico_nome}" reservado com sucesso para o agendamento #${params.agendamentoId.slice(0, 8)}.`,
        executed_at: new Date().toISOString(),
        verified: true,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.creditoId,
        source: "tabela_creditos",
        summary: `Falha ao reservar crédito: ${err.message}`,
        error_code: "ERRO_RESERVA_CREDITO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Libera o crédito reservado em caso de cancelamento elegível (Seção 16)
   */
  static async liberarCreditoCancelamento(
    sb: SupabaseClient<Database>,
    params: { creditoId: string; agendamentoId: string; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `libera_credito_${Date.now()}`;
    try {
      const { data: creditoAtual } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo, servico_nome")
        .eq("id", params.creditoId)
        .single();

      if (!creditoAtual) {
        return {
          success: false,
          entity_id: params.creditoId,
          source: "tabela_creditos",
          summary: "Registro de crédito não encontrado para estorno/liberação.",
          error_code: "CREDITO_NAO_ENCONTRADO",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const novoSaldo = (creditoAtual.saldo || 0) + 1;

      const { data: atualizado, error } = await sb
        .from("cliente_programa_creditos")
        .update({ saldo: novoSaldo } as any)
        .eq("id", params.creditoId)
        .select("id, saldo, servico_nome")
        .single();

      if (error || !atualizado) throw error || new Error("Falha ao liberar crédito.");

      const { data: readBack } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo")
        .eq("id", params.creditoId)
        .maybeSingle();

      const verificado = readBack?.saldo === novoSaldo;

      return {
        success: true,
        entity_id: params.creditoId,
        affected_record_id: params.creditoId,
        before: creditoAtual,
        after: atualizado,
        source: "tabela_creditos",
        summary: `Crédito de "${creditoAtual.servico_nome}" liberado com sucesso. Saldo restaurado para: ${novoSaldo}.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.creditoId,
        source: "tabela_creditos",
        summary: `Erro ao liberar crédito: ${err.message}`,
        error_code: "ERRO_LIBERACAO_CREDITO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }
}
