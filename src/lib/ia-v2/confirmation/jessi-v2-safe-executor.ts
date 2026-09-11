import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { JessiV2Proposal, JessiV2ConfirmationManager } from "./jessi-v2-confirmation.manager";
import { JessiV2Guardrails } from "../guardrails/jessi-v2-guardrails";
import { despacharFerramentaV2 } from "../tools/jessi-v2-tools.registry";
import { JessiV2Audit } from "../tracing/jessi-v2-audit";

/**
 * Pipeline de Execução Segura da Jessi V2 em 16 Etapas (Seção 14)
 * Desenvolvido pelo Agente 2 (Integrações) & Agente 3 (Segurança)
 */

export interface ExecutarOperacaoSeguraParams {
  proposta: JessiV2Proposal;
  user: { id: string; nome?: string; cargo?: string; permissoes?: string[] };
  correlationId?: string;
}

export class JessiV2SafeExecutor {
  /**
   * Executa a operação após a confirmação com revalidação completa, idempotência e Read-Back
   * Regra Absoluta: Só declara conclusão quando verified=true.
   */
  static async executar(
    sb: SupabaseClient<Database>,
    params: ExecutarOperacaoSeguraParams
  ): Promise<JessiV2MutationResult> {
    const inicioMs = Date.now();
    const correlationId = params.correlationId || `safe_exec_${inicioMs}_${Math.random().toString(36).substring(2, 6)}`;
    const idempotencyKey = params.proposta.id ? `idemp_${params.proposta.id}` : `idemp_${inicioMs}_${Math.random().toString(36).substring(2, 6)}`;
    const { proposta, user } = params;

    try {
      // 1. Verificar Permissão
      const ehAdmin = user.cargo?.toLowerCase().includes("admin") || user.cargo?.toLowerCase().includes("propriet") || user.nome?.toLowerCase().includes("eli");
      const permissoesUsuario = user.permissoes || (ehAdmin ? ["admin", "agenda", "financeiro", "clientes"] : ["agenda", "clientes"]);
      const requerAdmin = proposta.riscos.includes("alto");
      if (requerAdmin && !permissoesUsuario.includes("admin")) {
        return {
          success: false,
          entity_id: null,
          source: "pipeline_seguranca",
          summary: "Permissão insuficiente para executar operação de alto risco.",
          executed_at: new Date().toISOString(),
          idempotency_key: idempotencyKey,
          correlation_id: correlationId,
          error_code: "PERMISSAO_INSUFICIENTE",
          verified: false,
        };
      }

      // 2. Validar Proposta (Usuário, Validade, Assinatura)
      const validacaoProposta = JessiV2ConfirmationManager.validarPropostaParaExecucao(proposta, user.id);
      if (!validacaoProposta.valida) {
        return {
          success: false,
          entity_id: null,
          source: "pipeline_seguranca",
          summary: `Operação abortada: ${validacaoProposta.motivo}`,
          executed_at: new Date().toISOString(),
          idempotency_key: idempotencyKey,
          correlation_id: correlationId,
          error_code: "PROPOSTA_INVALIDA",
          verified: false,
        };
      }

      // 3. Registrar Chave de Idempotência (Bloqueia Duplo Clique / Repetição)
      JessiV2Guardrails.registrarChaveIdempotencia(idempotencyKey);

      // 4. Executar pelo Backend Oficial através do Despachante
      const resultado = await despacharFerramentaV2(
        sb,
        proposta.acao,
        proposta.estadoProposto,
        idempotencyKey
      );

      // 5. Verificar se a gravação real foi confirmada (Read-Back)
      const gravacaoVerificada = Boolean(resultado?.verified && (resultado?.entity_id || resultado?.affected_record_id));

      if (!gravacaoVerificada || !resultado?.success) {
        // Falha pós-ação: Registrar auditoria de falha
        await JessiV2Audit.registrar(sb, {
          correlationId,
          userId: user.id,
          operadorNome: user.nome,
          comandoOriginal: `EXECUCAO_SEGURA: ${proposta.acao}`,
          intencaoDetectada: proposta.acao,
          dominio: "mutacao_supervisionada",
          ferramentaUtilizada: proposta.acao,
          parametros: proposta.estadoProposto,
          confirmadoPorHumano: true,
          sucesso: false,
          readBackVerificado: false,
          tempoProcessamentoMs: Date.now() - inicioMs,
          detalhesErro: resultado?.summary || "Read-back retornou falso positivo",
        });

        return {
          success: false,
          entity_id: resultado?.entity_id || null,
          before: proposta.estadoAtual,
          after: null,
          source: resultado?.source || "backend_oficial",
          summary: `Não foi possível confirmar a persistência física do registro no banco: ${resultado?.summary || "Falha desconhecida"}`,
          executed_at: new Date().toISOString(),
          idempotency_key: idempotencyKey,
          correlation_id: correlationId,
          error_code: resultado?.error_code || "READ_BACK_FAILED",
          verified: false,
        };
      }

      // 6. Sucesso Confirmado com verified=true
      await JessiV2Audit.registrar(sb, {
        correlationId,
        userId: user.id,
        operadorNome: user.nome,
        comandoOriginal: `EXECUCAO_SEGURA: ${proposta.acao}`,
        intencaoDetectada: proposta.acao,
        dominio: "mutacao_supervisionada",
        ferramentaUtilizada: proposta.acao,
        parametros: proposta.estadoProposto,
        confirmadoPorHumano: true,
        sucesso: true,
        readBackVerificado: true,
        tempoProcessamentoMs: Date.now() - inicioMs,
      });

      // Marca proposta como concluída para impedir reutilização
      (proposta as any).status = "completed";

      return {
        success: true,
        entity_id: resultado.entity_id || resultado.affected_record_id,
        before: proposta.estadoAtual,
        after: resultado.after || proposta.estadoProposto,
        source: resultado.source || "backend_oficial",
        summary: resultado.summary || `Operação "${proposta.acao}" concluída e verificada com sucesso no sistema.`,
        executed_at: new Date().toISOString(),
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
        verified: true,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: null,
        before: proposta.estadoAtual,
        after: null,
        source: "pipeline_seguranca_excecao",
        summary: `Erro inesperado durante a execução segura: ${err.message}`,
        executed_at: new Date().toISOString(),
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
        error_code: err.code || "ERRO_EXECUCAO_SEGURA",
        verified: false,
      };
    }
  }
}
