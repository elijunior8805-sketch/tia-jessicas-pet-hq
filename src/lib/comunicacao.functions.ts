import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  tipo: z.enum([
    "lembrete_agendamento",
    "confirmacao",
    "retorno_atrasado",
    "aniversario",
    "aviso_encerramento",
    "agradecimento",
    "reengajamento",
    "personalizado",
  ]),
  clienteNome: z.string().min(1),
  petNome: z.string().optional().nullable(),
  contexto: z.string().optional().nullable(),
  tom: z.enum(["cordial", "carinhoso", "formal", "descontraido"]).default("carinhoso"),
});

export const sugerirMensagemWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const tipoLabel: Record<string, string> = {
      lembrete_agendamento: "lembrete de agendamento próximo",
      confirmacao: "confirmação de agendamento",
      retorno_atrasado: "aviso amigável de que o pet está com retorno atrasado (banho/tosa)",
      aniversario: "mensagem de feliz aniversário para o pet",
      aviso_encerramento: "aviso de que o atendimento foi encerrado e o pet está pronto para retirada",
      agradecimento: "agradecimento pela preferência após o atendimento",
      reengajamento: "reengajamento de cliente que não visita há muito tempo",
      personalizado: "mensagem personalizada",
    };

    const prompt = `Você é a assistente de comunicação do "Spa de Pet Tia Jéssica", especializado em banho e tosa de cães.
Gere UMA mensagem curta de WhatsApp (máx. 4 linhas, em português do Brasil) para:

- Tipo: ${tipoLabel[data.tipo]}
- Cliente (tutor): ${data.clienteNome}
- Pet: ${data.petNome ?? "(não informado)"}
- Tom desejado: ${data.tom}
- Contexto adicional do usuário: ${data.contexto?.trim() || "(nenhum)"}

Regras:
- Comece com uma saudação usando o primeiro nome do tutor.
- Cite o nome do pet quando fizer sentido.
- Use no máximo 1 emoji sutil (🐾, ✨ ou 💛). Nunca mais de um.
- Não invente datas, valores, horários ou serviços que não estejam no contexto.
- Não use markdown, aspas ou prefixos. Devolva SOMENTE o texto puro da mensagem.`;

    const { chamarIATexto, carregarIaConfig } = await import("./ia-core.server");
    const config = await carregarIaConfig(context.supabase);
    const r = await chamarIATexto({
      system: "Você redige mensagens curtas, cordiais e humanas para um pet shop premium.",
      prompt,
      config,
      origem: `whatsapp:${data.tipo}`,
      sb: context.supabase,
    });
    if (!r.texto) throw new Error("A IA não retornou texto.");
    return { mensagem: r.texto, modelo: r.modelo };
  });

