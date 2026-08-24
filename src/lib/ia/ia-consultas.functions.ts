import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarAgendaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    data: z.string().optional(),
    periodo_inicio: z.string().optional(),
    periodo_fim: z.string().optional(),
    status: z.string().optional(),
    pet_nome: z.string().optional(),
    cliente_nome: z.string().optional(),
    profissional: z.string().optional(),
    servico_nome: z.string().optional(),
    leva_e_traz: z.boolean().optional(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { buscarDadosAgenda } = await import("./ia-consultas.server");
    return buscarDadosAgenda(context.supabase, data);
  });

export const buscarClientesIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    termo: z.string(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { buscarClientesIA: buscarClientes } = await import("./ia-consultas.server");
    return buscarClientes(context.supabase, data.termo);
  });

export const buscarPetsDoClienteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    cliente_id: z.string(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { buscarPetsDoClienteIA: buscarPets } = await import("./ia-consultas.server");
    return buscarPets(context.supabase, data.cliente_id);
  });

export const consultarFinanceiroIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    cliente_id: z.string().optional(),
    apenas_pendentes: z.boolean().optional(),
    data: z.string().optional(),
    termo: z.string().optional(),
    period: z.enum(["hoje", "ontem", "semana", "mes", "mes_passado", "30dias"]).optional(),
    periodo_inicio: z.string().optional(),
    periodo_fim: z.string().optional(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { buscarDadosFinanceiros } = await import("./ia-consultas.server");
    return buscarDadosFinanceiros(context.supabase, data);
  });

export const consultarDisponibilidadeIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    servico: z.string().optional(),
    data: z.string(),
    profissional: z.string().optional(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { buscarDisponibilidade } = await import("./ia-consultas.server");
    return buscarDisponibilidade(context.supabase, data);
  });

export const consultarResumoOperacionalIA = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { consultarResumoOperacionalIA: consultarResumo } = await import("./ia-consultas.server");
    return consultarResumo(supabaseAdmin);
  });

export const analisarRiscoEvasaoIA = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analisarRiscoEvasaoIA: analisarEvasao } = await import("./ia-consultas.server");
    return analisarEvasao(supabaseAdmin);
  });

export const buscarServicosIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    termo: z.string().optional(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { buscarServicosIA: buscarServicos } = await import("./ia-consultas.server");
    return buscarServicos(context.supabase, data.termo);
  });

export const consultarHistoricoPetIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    pet_id: z.string(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { consultarHistoricoPetIA: consultarHistorico } = await import("./ia-consultas.server");
    return consultarHistorico(context.supabase, data.pet_id);
  });

export const consultarVisao360ClienteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    cliente_id: z.string(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { obterVisao360Cliente } = await import("./ia-consultas.server");
    return obterVisao360Cliente(context.supabase, data.cliente_id);
  });

export const consultarVisao360PetIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    pet_id: z.string(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { obterVisao360Pet } = await import("./ia-consultas.server");
    return obterVisao360Pet(context.supabase, data.pet_id);
  });

export const consultarRiscoFaltaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    cliente_id: z.string(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { consultarRiscoFaltaIA: consultarRisco } = await import("./ia-consultas.server");
    return consultarRisco(context.supabase, data.cliente_id);
  });

export const criarFilaEsperaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    cliente_id: z.string(),
    pet_id: z.string(),
    servico_id: z.string(),
    data_pretendida: z.string(),
    periodo: z.string().optional(),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { criarFilaEsperaIA: criarFila } = await import("./ia-consultas.server");
    return criarFila(context.supabase, data);
  });

export const consultarAuditoriaDadosIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { realizarAuditoriaDadosIA } = await import("./ia-auditoria.server");
    return realizarAuditoriaDadosIA();
  });

export const compararPeriodosFinanceirosIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    p1: z.object({ from: z.string(), to: z.string() }),
    p2: z.object({ from: z.string(), to: z.string() }),
  }).parse(input || {}))
  .handler(async ({ data, context }) => {
    const { compararPeriodosIA } = await import("./ia-financeiro.server");
    return compararPeriodosIA(context.supabase, data);
  });
