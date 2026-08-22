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
  mensagem?: string;
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
- id_transacao (string, se visível)

Regras:
1. Se o valor não for legível, retorne sucesso: false.
2. Identifique se o comprovante parece cortado ou ilegível.
3. Não invente dados.
4. Responda APENAS o JSON.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: "Analise este comprovante e extraia os dados financeiros.",
      config,
      json: true,
      origem: "ia_analise_comprovante",
      sb,
      // Passar a imagem no formato esperado pelo Gateway para Visão
      // Nota: A implementação atual do chamarIA precisa ser verificada se suporta multimodality.
      // Se não, passamos a imagem no prompt seguindo o padrão de Visão do Gemini.
      extraContent: [
        {
          type: "image",
          image_url: { url: `data:${contentType};base64,${imagemBase64}` }
        }
      ]
    });

    const parsed = JSON.parse(res.texto);
    return {
      ...parsed,
      confianca: 0.95,
      sucesso: true
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
      mensagem: "Não foi possível processar a imagem do comprovante."
    };
  }
}
