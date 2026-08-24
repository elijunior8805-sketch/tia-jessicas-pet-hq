import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const validarAgendamentoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    data: z.string(),
    hora: z.string(),
    pet_id: z.string(),
    cliente_id: z.string(),
    profissional_id: z.string().optional(),
    servicos: z.array(z.string()),
    comando_original: z.string().optional().default("validar_agendamento"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { validarDisponibilidadeReal } = await import("./ia-acoes.server");
    return validarDisponibilidadeReal(context.supabase, data);
  });

export const executarCriacaoAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    cliente_id: z.string(),
    pet_id: z.string(),
    servicos: z.array(z.object({
      id: z.string(),
      nome: z.string(),
      valor: z.number(),
    })),
    data: z.string(),
    hora: z.string(),
    profissional_id: z.string().optional(),
    transporte: z.boolean().optional(),
    taxa_transporte: z.number().optional(),
    observacoes: z.string().optional(),
    comando_original: z.string().optional().default("criar_agendamento"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { criarAgendamentoIA } = await import("./ia-acoes.server");
    return criarAgendamentoIA(context.supabase, data);
  });

export const executarRemarcacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    agendamento_id: z.string(),
    nova_data: z.string(),
    nova_hora: z.string(),
    comando_original: z.string().optional().default("remarcar"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { remarcarAgendamentoIA } = await import("./ia-acoes.server");
    return remarcarAgendamentoIA(context.supabase, data.agendamento_id, data.nova_data, data.nova_hora);
  });

export const executarCancelamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    agendamento_id: z.string(),
    motivo: z.string().optional(),
    comando_original: z.string().optional().default("cancelar"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { cancelarAgendamentoIA } = await import("./ia-acoes.server");
    return cancelarAgendamentoIA(context.supabase, data.agendamento_id, data.motivo || "");
  });

export const executarCriacaoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    nome: z.string(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    observacoes: z.string().optional(),
    comando_original: z.string().optional().default("criar_cliente"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { criarClienteIA } = await import("./ia-acoes.server");
    return criarClienteIA(context.supabase, data);
  });

export const executarCriacaoPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    cliente_id: z.string(),
    nome: z.string(),
    especie: z.string().optional(),
    raca: z.string().optional(),
    porte: z.string().optional(),
    observacoes: z.string().optional(),
    comando_original: z.string().optional().default("criar_pet"),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { criarPetIA } = await import("./ia-acoes.server");
    return criarPetIA(context.supabase, data);
  });
