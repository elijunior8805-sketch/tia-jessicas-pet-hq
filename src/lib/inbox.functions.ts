import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ThreadDTO = {
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  ultima_mensagem: string | null;
  ultima_direcao: "in" | "out" | null;
  ultima_em: string | null;
  nao_lidas: number;
  total_mensagens: number;
};

export type MensagemDTO = {
  id: string;
  cliente_id: string;
  direcao: "in" | "out";
  canal: string;
  corpo: string;
  status: string;
  autor_email: string | null;
  atendimento_id: string | null;
  cobranca_id: string | null;
  pagamento_id: string | null;
  tags: string[];
  lida_em: string | null;
  created_at: string;
};

export const listarThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        busca: z.string().trim().max(120).optional().default(""),
        filtro: z.enum(["todas", "nao_lidas"]).optional().default("todas"),
      })
      .parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("mensagens_threads")
      .select("*")
      .order("ultima_em", { ascending: false })
      .limit(200);
    if (data.busca) q = q.ilike("cliente_nome", `%${data.busca}%`);
    if (data.filtro === "nao_lidas") q = q.gt("nao_lidas", 0);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ThreadDTO[];
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const [cli, msgs] = await Promise.all([
      context.supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("id", data.cliente_id)
        .maybeSingle(),
      context.supabase
        .from("mensagens")
        .select("*")
        .eq("cliente_id", data.cliente_id)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (cli.error) throw new Error(cli.error.message);
    if (msgs.error) throw new Error(msgs.error.message);
    return {
      cliente: cli.data,
      mensagens: (msgs.data ?? []) as MensagemDTO[],
    };
  });

export const marcarLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mensagens")
      .update({ status: "lida", lida_em: new Date().toISOString() })
      .eq("cliente_id", data.cliente_id)
      .eq("direcao", "in")
      .eq("status", "nao_lida");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registrarMensagemRecebida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        corpo: z.string().trim().min(1).max(3500),
        canal: z.enum(["whatsapp", "sms", "email", "manual"]).default("whatsapp"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase
      .from("mensagens")
      .insert({
        cliente_id: data.cliente_id,
        direcao: "in",
        canal: data.canal,
        corpo: data.corpo,
        status: "nao_lida",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const registrarNotaInterna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        corpo: z.string().trim().min(1).max(3500),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("mensagens").insert({
      cliente_id: data.cliente_id,
      direcao: "out",
      canal: "sistema",
      corpo: data.corpo,
      status: "enviada",
      autor_id: context.userId,
      tags: ["nota_interna"],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mensagens")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inboxKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [naoLidas, hojeCount, semResposta] = await Promise.all([
      context.supabase
        .from("mensagens")
        .select("id", { count: "exact", head: true })
        .eq("direcao", "in")
        .eq("status", "nao_lida"),
      context.supabase
        .from("mensagens")
        .select("id", { count: "exact", head: true })
        .gte("created_at", hoje.toISOString()),
      context.supabase
        .from("mensagens_threads")
        .select("cliente_id", { count: "exact", head: true })
        .eq("ultima_direcao", "out"),
    ]);
    return {
      nao_lidas: naoLidas.count ?? 0,
      hoje: hojeCount.count ?? 0,
      aguardando_resposta: semResposta.count ?? 0,
    };
  });
