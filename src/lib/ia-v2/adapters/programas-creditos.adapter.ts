import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

/**
 * Adaptador Oficial de Programas de Cuidados & Clubinho para a Jessi V2
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export class ProgramasCreditosAdapter {
  /**
   * Consulta os programas e saldos de créditos ativos de um cliente ou pet
   */
  static async consultarSaldoCreditos(
    sb: SupabaseClient<Database>,
    clienteId: string
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    try {
      // 1. Busca assinaturas de programas ativas do cliente
      const { data: assinaturas, error } = await sb
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

      if (error) throw error;

      // 2. Busca créditos disponíveis associados
      const { data: creditos } = await sb
        .from("cliente_programa_creditos")
        .select("*")
        .eq("cliente_id", clienteId)
        .gt("saldo", 0);

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
        correlation_id: `query_programas_${inicio}`,
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
      };
    }
  }

  /**
   * Executa o abatimento de crédito pós-confirmação humana com validação e Read-Back
   */
  static async executarConsumoCreditoConfirmado(
    sb: SupabaseClient<Database>,
    params: { creditoId: string; quantidade: number; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    try {
      // 1. Verifica saldo atual
      const { data: creditoAtual, error: errFetch } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo, servico_nome")
        .eq("id", params.creditoId)
        .single();

      if (errFetch || !creditoAtual) throw new Error("Registro de crédito não localizado.");

      if ((creditoAtual.saldo || 0) < params.quantidade) {
        return {
          success: false,
          source: "tabela_creditos",
          summary: `Saldo insuficiente: disponível ${creditoAtual.saldo}, solicitado ${params.quantidade}.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "SALDO_INSUFICIENTE",
          verified: false,
        };
      }

      const novoSaldo = (creditoAtual.saldo || 0) - params.quantidade;

      // 2. Atualiza saldo
      const { data: atualizado, error: errUpdate } = await sb
        .from("cliente_programa_creditos")
        .update({ saldo: novoSaldo } as any)
        .eq("id", params.creditoId)
        .select("id, saldo, servico_nome")
        .single();

      if (errUpdate || !atualizado) throw errUpdate || new Error("Falha ao atualizar saldo.");

      // 3. Read-Back Verification
      const { data: readBack } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo")
        .eq("id", params.creditoId)
        .maybeSingle();

      const verificado = readBack?.saldo === novoSaldo;

      return {
        success: true,
        source: "tabela_creditos",
        affected_record_id: params.creditoId,
        before: creditoAtual,
        after: atualizado,
        summary: `Crédito de "${creditoAtual.servico_nome}" consumido com sucesso. Novo saldo: ${novoSaldo}.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_creditos",
        summary: `Erro ao consumir crédito: ${err.message}`,
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        error_code: err.code || "ERRO_CONSUMO_CREDITO",
        verified: false,
      };
    }
  }
}
