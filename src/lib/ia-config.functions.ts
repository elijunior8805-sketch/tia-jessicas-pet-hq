import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


export const obterIaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [cfg, regras] = await Promise.all([
      context.supabase.from("ia_config").select("*").maybeSingle(),
      context.supabase.from("ia_regras_tom").select("*").order("ordem"),
    ]);
    if (cfg.error) throw new Error(cfg.error.message);
    return { config: cfg.data, regras: regras.data ?? [] };
  });

const ConfigSchema = z.object({
  ia_ativa: z.boolean(),
  provedor: z.string().max(40),
  modelo_principal: z.string().max(120),
  modelo_alternativo: z.string().max(120),
  criatividade: z.number().min(0).max(1),
  limite_caracteres: z.number().int().min(120).max(4000),
  timeout_ms: z.number().int().min(5000).max(60000),
  max_tentativas_ia: z.number().int().min(1).max(3),
  horario_inicio: z.string(),
  horario_fim: z.string(),
  intervalo_min_horas: z.number().int().min(1).max(720),
  max_tentativas_contato: z.number().int().min(1).max(20),
  instrucoes_empresa: z.string().max(3000),
  assinatura: z.string().max(300),
  pix_chave: z.string().max(200).optional().nullable(),
  link_pagamento: z.string().max(500).optional().nullable(),
  palavras_proibidas: z.array(z.string().max(60)).max(60),
  permitir_mencao_juridica: z.boolean(),
});

export const salvarIaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existente } = await context.supabase
      .from("ia_config")
      .select("id")
      .maybeSingle();
    if (existente) {
      const { error } = await context.supabase
        .from("ia_config")
        .update(data)
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
      return { id: existente.id };
    }
    const { data: row, error } = await context.supabase
      .from("ia_config")
      .insert({ ...data, singleton: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const salvarRegraTom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        tom: z.string().max(60),
        nivel_firmeza: z.number().int().min(1).max(5),
        bloquear_ia: z.boolean(),
        ativo: z.boolean(),
        observacao: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...resto } = data;
    const { error } = await context.supabase.from("ia_regras_tom").update(resto).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Teste seguro da geração — não grava nada e não envia nada. */
export const testarGeracaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cenario: z.string().min(3).max(600) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const core = await import("./ia-core.server");
    const { CONTRATO_JSON, REGRAS_INVIOLAVEIS } = await import("./comunicacao-central.server");
    const config = await core.carregarIaConfig(context.supabase);
    const r = await core.chamarIAEstruturada({
      system:
        "Você redige mensagens de cobrança humanas e respeitosas para um spa de pets premium. Responde exclusivamente em JSON válido.",
      prompt: `Cenário de teste fornecido pelo administrador (dados fictícios, apenas para conferir o comportamento):
${data.cenario}

${REGRAS_INVIOLAVEIS}

${CONTRATO_JSON}`,
      config,
    });
    return r;
  });
