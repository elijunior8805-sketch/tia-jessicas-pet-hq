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
    const { gerarMensagemRelacionamentoIa } = await import("./ia-geracao.server");
    const r = await gerarMensagemRelacionamentoIa(context.supabase, {
      tipo: data.tipo,
      clienteNome: data.clienteNome,
      petNome: data.petNome ?? null,
      contexto: data.contexto ?? null,
      tom: data.tom,
    });
    return { mensagem: r.texto, modelo: r.modelo, doCache: r.doCache };
  });


