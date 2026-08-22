import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarAgendaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    data: z.string().optional(),
    pet_nome: z.string().optional(),
    cliente_nome: z.string().optional(),
    profissional: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { buscarDadosAgenda } = await import("./ia-consultas.server");
    return buscarDadosAgenda(context.supabase, data);
  });

export const consultarClientesPetsIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    termo: z.string(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { buscarDadosClientesPets } = await import("./ia-consultas.server");
    return buscarDadosClientesPets(context.supabase, data.termo);
  });

export const consultarFinanceiroIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    cliente_id: z.string().optional(),
    apenas_pendentes: z.boolean().optional(),
    data: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { buscarDadosFinanceiros } = await import("./ia-consultas.server");
    return buscarDadosFinanceiros(context.supabase, data);
  });

export const consultarDisponibilidadeIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    servico: z.string().optional(),
    data: z.string(),
    profissional: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { buscarDisponibilidade } = await import("./ia-consultas.server");
    return buscarDisponibilidade(context.supabase, data);
  });
