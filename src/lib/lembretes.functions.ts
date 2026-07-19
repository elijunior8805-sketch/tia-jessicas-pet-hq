import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LembreteTipo =
  | "lembrete_24h"
  | "pos_atendimento"
  | "aniversario_pet"
  | "aniversario_tutor"
  | "petversario"
  | "data_especial";
export type LembreteStatus = "pendente" | "enviado" | "falhou" | "cancelado";

export type LembreteRow = {
  id: string;
  tipo: LembreteTipo;
  idempotency_key: string;
  cliente_id: string | null;
  pet_id: string | null;
  agendamento_id: string | null;
  atendimento_id: string | null;
  telefone: string | null;
  cliente_nome: string | null;
  pet_nome: string | null;
  mensagem: string;
  status: LembreteStatus;
  tentativas: number;
  max_tentativas: number;
  proximo_envio: string;
  ultima_tentativa: string | null;
  enviado_em: string | null;
  erro: string | null;
  created_at: string;
};

export type LembreteConfig = {
  id: string;
  lembrete_24h_ativo: boolean;
  lembrete_24h_hora: string;
  lembrete_24h_template: string;
  pos_atendimento_ativo: boolean;
  pos_atendimento_horas: number;
  pos_atendimento_template: string;
  aniversario_pet_ativo: boolean;
  aniversario_hora: string;
  aniversario_template: string;
  aniversario_tutor_ativo: boolean;
  aniversario_tutor_template: string;
  petversario_ativo: boolean;
  petversario_template: string;
  datas_especiais_ativo: boolean;
  updated_at: string;
};

export const getLembretesConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lembretes_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as LembreteConfig | null;
  });

const ConfigSchema = z.object({
  id: z.string().uuid(),
  lembrete_24h_ativo: z.boolean(),
  lembrete_24h_hora: z.string(),
  lembrete_24h_template: z.string().min(5).max(2000),
  pos_atendimento_ativo: z.boolean(),
  pos_atendimento_horas: z.number().int().min(1).max(240),
  pos_atendimento_template: z.string().min(5).max(2000),
  aniversario_pet_ativo: z.boolean(),
  aniversario_hora: z.string(),
  aniversario_template: z.string().min(5).max(2000),
});

export const salvarLembretesConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("lembretes_config")
      .update(rest)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListaSchema = z
  .object({
    status: z.enum(["pendente", "enviado", "falhou", "cancelado", "todos"]).optional().default("pendente"),
    tipo: z.enum(["lembrete_24h", "pos_atendimento", "aniversario_pet", "todos"]).optional().default("todos"),
    busca: z.string().trim().max(120).optional().default(""),
  })
  .default({});

export const listarLembretes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListaSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("lembretes_fila")
      .select("*")
      .order("proximo_envio", { ascending: true })
      .limit(500);
    if (data.status !== "todos") q = q.eq("status", data.status);
    if (data.tipo !== "todos") q = q.eq("tipo", data.tipo);
    if (data.busca) q = q.or(`cliente_nome.ilike.%${data.busca}%,pet_nome.ilike.%${data.busca}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as LembreteRow[];
  });

export const getLembretesKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lembretes_fila")
      .select("tipo,status,proximo_envio");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
    const pendentes = rows.filter((r) => r.status === "pendente").length;
    const proximas24h = rows.filter(
      (r) => r.status === "pendente" && new Date(r.proximo_envio) <= in24h
    ).length;
    const enviados = rows.filter((r) => r.status === "enviado").length;
    const falhas = rows.filter((r) => r.status === "falhou").length;
    return { pendentes, proximas24h, enviados, falhas, total: rows.length };
  });

const IdSchema = z.object({ id: z.string().uuid() });

export const marcarLembreteEnviado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lembretes_fila")
      .update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        enviado_por: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelarLembrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lembretes_fila")
      .update({ status: "cancelado" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reenfileirarLembrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lembretes_fila")
      .update({
        status: "pendente",
        tentativas: 0,
        erro: null,
        proximo_envio: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Roda enfileiramento sob demanda (via botão "Gerar lembretes de hoje")
export const gerarLembretesAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      const { data: isUser } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "user",
      });
      if (!isUser) throw new Error("Sem permissão");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("enfileirar_lembretes");
    if (error) throw new Error(error.message);
    return data as Record<string, number | string>;
  });
