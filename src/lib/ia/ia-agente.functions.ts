import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IAIntentSchema, IAMessage } from "./ia-agente.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const classificarIntencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    texto: z.string(),
    contexto: z.any().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    // Importação dinâmica para evitar que o código de servidor vaze para o cliente
    const { classificarComandoIA } = await import("./ia-agente.server");
    
    // Buscar perfil do usuário para contexto
    const { data: profile } = await context.supabase
      .from('profiles')
      .select('nome, perfil')
      .eq('id', context.userId)
      .maybeSingle();

    const { carregarIaConfig } = await import("../ia-core.server");
    const config = await carregarIaConfig(context.supabase);

    return classificarComandoIA(
      data.texto, 
      {
        contexto: data.contexto,
        config: config,
        user: {
          id: context.userId,
          nome: (profile as any)?.nome || 'Usuário',
          cargo: (profile as any)?.perfil || 'user'
        }
      }
    );
  });
