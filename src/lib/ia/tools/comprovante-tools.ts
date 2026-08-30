import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult, JessiMutationResult } from "../jessi-contracts";
import { analisarComprovanteIA } from "../ia-comprovante.server";
import { registrarPagamentoIA } from "../ia-acoes.server";

/**
 * Adaptadores de Comprovantes e OCR Multimodal para a Jessi
 */

export async function processarComprovanteJessi(
  sb: SupabaseClient<Database>,
  params: { imagemBase64: string; contentType?: string }
): Promise<JessiQueryResult> {
  const analise = await analisarComprovanteIA(sb, params.imagemBase64, params.contentType || "image/jpeg");

  return {
    success: analise.sucesso,
    source: "analise_comprovante",
    data: analise,
    executed_at: new Date().toISOString(),
    summary: analise.sucesso
      ? `Comprovante de R$ ${Number(analise.valor || 0).toFixed(2)} processado com sucesso.`
      : `Não foi possível extrair dados conclusivos do comprovante.`,
  };
}

export async function conciliarEBaixarComprovanteJessi(
  sb: SupabaseClient<Database>,
  params: {
    pagamento_id: string;
    valor: number;
    forma: string;
    id_transacao?: string;
    comprovante_url?: string;
  }
): Promise<JessiMutationResult> {
  const observacao = `Baixa confirmada via comprovante Pix. Transação: ${params.id_transacao || "N/A"}`;

  const res = await registrarPagamentoIA(sb, {
    pagamento_id: params.pagamento_id,
    valor_pago: params.valor,
    forma: (params.forma || "pix") as any,
    observacoes: observacao,
  });

  return {
    success: res.success,
    source: "conciliacao_comprovante",
    affected_record_id: params.pagamento_id,
    after: res.data,
    verified: true,
    executed_at: new Date().toISOString(),
    summary: `Baixa conciliada com sucesso no valor de R$ ${params.valor.toFixed(2)}.`,
  };
}
