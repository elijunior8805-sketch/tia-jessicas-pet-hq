import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TomEnum = z.enum([
  "amigavel",
  "profissional",
  "acolhedor",
  "cobranca_educada",
  "confirmacao_objetiva",
]);

const Input = z.object({
  texto: z.string().trim().min(1).max(3500),
  tom: TomEnum.default("amigavel"),
  modo: z.enum(["ortografia", "melhorar"]).default("ortografia"),
});

const TOM_INSTRUCAO: Record<z.infer<typeof TomEnum>, string> = {
  amigavel: "amigável, próximo e caloroso, sem gírias.",
  profissional: "profissional e objetivo, cortês mas sem frieza.",
  acolhedor: "acolhedor, gentil e empático.",
  cobranca_educada:
    "cobrança educada e respeitosa, sem pressionar nem constranger o cliente.",
  confirmacao_objetiva:
    "confirmação objetiva e clara, com poucas palavras, sem enfeites.",
};

export const revisarMensagemWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const instrucaoModo =
      data.modo === "ortografia"
        ? "Corrija somente ortografia, acentuação e pontuação. Ajuste a clareza apenas quando estritamente necessário. Mantenha ao máximo a redação e a ordem das frases do autor."
        : "Melhore a clareza e a fluidez, mantendo a mensagem curta, natural e humana. Não invente informações.";

    const system =
      "Você é um revisor de mensagens de WhatsApp em português do Brasil para um spa de pets premium (Spa da Tia Jéssica). " +
      "Devolva SOMENTE o texto revisado, sem aspas, sem markdown, sem prefixos como 'Versão revisada:'. " +
      "Nunca envie nada — só devolva o texto.";

    const regras = [
      "Regras invioláveis:",
      "1) NÃO altere nomes de pessoas, nomes de pets, datas, horários, valores em R$, serviços, chave Pix ou qualquer número.",
      "2) Preserve o sentido original e o nível de intimidade (não formalize demais).",
      "3) Tom desejado: " + TOM_INSTRUCAO[data.tom],
      "4) Máximo 1 emoji sutil (🐾 ✨ 💛 ✅ 🎉) apenas se o original já tiver emoji ou pedir tom carinhoso — nunca acrescente novos emojis em mensagens de cobrança.",
      "5) Preserve quebras de linha do original quando fizer sentido.",
      "6) Responda apenas com o texto final, nada mais.",
    ].join("\n");

    const prompt = `${instrucaoModo}\n\n${regras}\n\n--- TEXTO ORIGINAL ---\n${data.texto}\n--- FIM ---`;

    const { chamarIATexto, carregarIaConfig } = await import("./ia-core.server");
    const config = await carregarIaConfig(context.supabase);
    const r = await chamarIATexto({ system, prompt, config, temperatura: 0.2 });

    const revisado = r.texto
      .replace(/^\s*(vers[aã]o revisada|texto revisado|revisado)\s*:\s*/i, "")
      .trim();

    if (!revisado) throw new Error("A IA não retornou texto.");

    return {
      original: data.texto,
      revisado,
      mudou: revisado.trim() !== data.texto.trim(),
      modelo: r.modelo,
    };
  });
