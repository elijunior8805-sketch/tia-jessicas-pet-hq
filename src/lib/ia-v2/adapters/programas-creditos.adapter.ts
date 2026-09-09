import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { calcularSaldoContrato } from "@/lib/programas-contratos.server";

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
    const hoje = new Date();
    const hojeStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(hoje);

    try {
      const { data: contratos, error } = await sb
        .from("programas_contratados")
        .select(`
          id,
          cliente_id,
          pet_id,
          nome_snapshot,
          preco_vendido,
          data_da_venda,
          data_de_inicio,
          data_de_validade,
          status_do_pagamento,
          status_do_programa,
          clientes(id, nome, whatsapp),
          pets(id, nome, raca)
        `)
        .eq("status_do_programa", "ativo")
        .gte("data_de_validade", hojeStr);

      if (error) throw error;

      const ids = (contratos || []).map((c: any) => c.id);
      const { data: movs } = ids.length
        ? await sb
            .from("programas_creditos_movimentacoes")
            .select("programa_contratado_id, tipo, quantidade, servico_id")
            .in("programa_contratado_id", ids)
        : { data: [] as any[] };

      const listaFormatada: JessiV2ContratoProgramaAtivo[] = (contratos || []).map((c: any) => {
        const movsContrato = (movs || []).filter((m: any) => m.programa_contratado_id === c.id);
        const saldos = calcularSaldoContrato(movsContrato);
        const totais = Object.values(saldos).reduce(
          (acc, s) => ({
            contratados: acc.contratados + s.criado,
            utilizados: acc.utilizados + s.consumido,
            disponiveis: acc.disponiveis + s.disponivel,
          }),
          { contratados: 0, utilizados: 0, disponiveis: 0 }
        );

        const dataFim = new Date(`${c.data_de_validade}T23:59:59`);
        const diffDias = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          tutor: {
            id: c.clientes?.id || c.cliente_id,
            nome: c.clientes?.nome || "Tutor não identificado",
            telefone: c.clientes?.whatsapp || "Sem telefone",
          },
          pet: {
            id: c.pets?.id || c.pet_id,
            nome: c.pets?.nome || "Pet",
            raca: c.pets?.raca || "Padrão",
          },
          programa: {
            id: c.id,
            nome: c.nome_snapshot || "Programa de Cuidado",
            precoBase: Number(c.preco_vendido) || 0,
          },
          contratacaoData: c.data_da_venda || c.data_de_inicio || hojeStr,
          validadeData: c.data_de_validade || hojeStr,
          diasRestantes: Math.max(diffDias, 0),
          creditosContratados: totais.contratados,
          creditosUtilizados: totais.utilizados,
          creditosDisponiveis: totais.disponiveis,
          statusPagamento: (c.status_do_pagamento === "pago" ? "pago" : "pendente") as "pago" | "pendente",
        };
      });

      const resumo =
        listaFormatada.length > 0
          ? `Existem ${listaFormatada.length} contrato(s) de programas ativos com saldo de créditos no Spa.`
          : "Nenhum contrato ativo de programas encontrado no momento.";

      return {
        success: true,
        source: "programas_contratados",
        data: listaFormatada,
        total_count: listaFormatada.length,
        summary: resumo,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "programas_contratados",
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
        .from("programas_contratados")
        .select("id, cliente_id, pet_id, nome_snapshot, preco_vendido, data_de_inicio, data_de_validade, status_do_programa")
        .eq("cliente_id", clienteId)
        .eq("status_do_programa", "ativo");

      if (petId) queryProg = queryProg.eq("pet_id", petId);

      const { data: assinaturas, error } = await queryProg;
      if (error) throw error;

      const ids = (assinaturas || []).map((a: any) => a.id);
      const { data: movs } = ids.length
        ? await sb
            .from("programas_creditos_movimentacoes")
            .select("programa_contratado_id, tipo, quantidade, servico_id")
            .in("programa_contratado_id", ids)
        : { data: [] as any[] };

      const creditosDisponiveis = (assinaturas || []).map((a: any) => ({
        contratoId: a.id,
        programa: a.nome_snapshot,
        validade: a.data_de_validade,
        saldos: Object.values(calcularSaldoContrato((movs || []).filter((m: any) => m.programa_contratado_id === a.id))),
      }));

      const totalCreditos = creditosDisponiveis.reduce(
        (acc, c: any) => acc + c.saldos.reduce((s: number, x: any) => s + x.disponivel, 0),
        0
      );

      return {
        success: true,
        source: "programas_contratados",
        data: {
          assinaturasAtivas: assinaturas || [],
          creditosDisponiveis,
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
        source: "programas_contratados",
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
   * Registra o consumo de crédito pós-confirmação humana com Read-Back
   */
  static async executarConsumoCreditoConfirmado(
    sb: SupabaseClient<Database>,
    params: { contratoId: string; servicoId: string; quantidade: number; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_credito_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const { data: movsAntes, error: errFetch } = await sb
        .from("programas_creditos_movimentacoes")
        .select("programa_contratado_id, tipo, quantidade, servico_id")
        .eq("programa_contratado_id", params.contratoId);

      if (errFetch) throw errFetch;

      const saldosAntes = calcularSaldoContrato(movsAntes || []);
      const disponivel = saldosAntes[params.servicoId]?.disponivel || 0;

      if (disponivel < params.quantidade) {
        return {
          success: false,
          entity_id: params.contratoId,
          affected_record_id: params.contratoId,
          source: "programas_creditos_movimentacoes",
          summary: `Saldo insuficiente: disponível ${disponivel}, solicitado ${params.quantidade}.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "SALDO_INSUFICIENTE",
          correlation_id: correlationId,
          verified: false,
        };
      }

      const { data: movimentacao, error: errInsert } = await sb
        .from("programas_creditos_movimentacoes")
        .insert({
          programa_contratado_id: params.contratoId,
          servico_id: params.servicoId,
          tipo: "credito_consumido",
          quantidade: params.quantidade,
          motivo: params.motivo || "Consumo autorizado pela assistente",
          idempotency_key: idempotencyKey,
        } as any)
        .select("id, programa_contratado_id, servico_id, quantidade, tipo")
        .single();

      if (errInsert || !movimentacao) throw errInsert || new Error("Falha ao registrar consumo de crédito.");

      const { data: movsDepois } = await sb
        .from("programas_creditos_movimentacoes")
        .select("programa_contratado_id, tipo, quantidade, servico_id")
        .eq("programa_contratado_id", params.contratoId);

      const saldosDepois = calcularSaldoContrato(movsDepois || []);
      const novoSaldo = saldosDepois[params.servicoId]?.disponivel ?? disponivel;

      return {
        success: true,
        entity_id: movimentacao.id,
        affected_record_id: params.contratoId,
        source: "programas_creditos_movimentacoes",
        before: { disponivel },
        after: { disponivel: novoSaldo },
        summary: `Crédito consumido com sucesso. Novo saldo: ${novoSaldo}.`,
        executed_at: new Date().toISOString(),
        verified: novoSaldo === disponivel - params.quantidade,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.contratoId,
        affected_record_id: params.contratoId,
        source: "programas_creditos_movimentacoes",
        summary: `Erro ao consumir crédito: ${err.message}`,
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        error_code: err.code || "ERRO_CONSUMO_CREDITO",
        correlation_id: correlationId,
        verified: false,
      };
    }
  }
}
