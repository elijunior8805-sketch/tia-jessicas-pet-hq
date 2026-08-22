import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export interface ComprovanteAnalise {
  valor: number;
  data: string;
  horario: string;
  pagador: string;
  recebedor: string;
  instituicao: string;
  id_transacao?: string;
  confianca: number;
  sucesso: boolean;
  success: boolean; // Add compatibility for structured return
  mensagem?: string;
  result?: any;
}

export async function analisarComprovanteIA(
  sb: SupabaseClient<Database>,
  imagemBase64: string,
  contentType: string = "image/jpeg"
): Promise<ComprovanteAnalise> {
  const { chamarIA, carregarIaConfig } = await import("../ia-core.server");
  const config = await carregarIaConfig(sb);

  const systemPrompt = `Você é um especialista em análise de comprovantes bancários (especialmente PIX).
Analise a imagem fornecida e extraia as seguintes informações em formato JSON:
- valor (number)
- data (string: YYYY-MM-DD)
- horario (string: HH:MM)
- pagador (string)
- recebedor (string)
- instituicao (string)
- id_transacao (string, se visível) - Extraia o Identificador, ID da Transação ou Código End-to-End.

Regras:
1. Se o valor não for legível, retorne sucesso: false.
2. Identifique se o comprovante parece cortado ou ilegível.
3. Não invente dados. Se um campo não existir, retorne null.
4. Responda APENAS o JSON.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: "Analise este comprovante e extraia os dados financeiros.",
      config,
      json: true,
      origem: "ia_analise_comprovante",
      sb,
      extraContent: [
        {
          type: "image",
          image_url: { url: `data:${contentType};base64,${imagemBase64}` }
        }
      ]
    });

    const parsed = JSON.parse(res.texto);

    // Verificação de duplicidade no banco
    if (parsed.id_transacao) {
      const { data: existente } = await sb
        .from("pagamentos")
        .select("id, status, data_pagamento")
        .eq("id_transacao_bancaria", parsed.id_transacao)
        .is("arquivado_em", null)
        .maybeSingle();

      if (existente) {
        return {
          ...parsed,
          confianca: 1,
          sucesso: false,
          success: false,
          mensagem: `Este comprovante já foi utilizado em outro pagamento (ID: ${existente.id}) em ${existente.data_pagamento}.`
        };
      }
    }

    return {
      ...parsed,
      confianca: 0.95,
      sucesso: true,
      success: true,
      result: parsed
    };
  } catch (error) {
    console.error("Erro ao analisar comprovante:", error);
    return {
      valor: 0,
      data: "",
      horario: "",
      pagador: "",
      recebedor: "",
      instituicao: "",
      confianca: 0,
      sucesso: false,
      success: false,
      mensagem: "Não foi possível processar a imagem do comprovante."
    };
  }
}
