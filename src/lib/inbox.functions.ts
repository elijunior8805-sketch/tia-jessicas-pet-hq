import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ThreadStatus =
  | "aguardando_resposta"
  | "respondida"
  | "resolvida"
  | "sem_mensagens";

export type ThreadDTO = {
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_whatsapp: string | null;
  pet_primeiro_nome: string | null;
  ultima_mensagem: string | null;
  ultima_direcao: "in" | "out" | null;
  ultima_em: string | null;
  ultima_em_in: string | null;
  nao_lidas: number;
  total_mensagens: number;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  responsavel_avatar: string | null;
  resolvida_em: string | null;
  status_conversa: ThreadStatus;
  proximo_agendamento_id: string | null;
  proximo_agendamento_data: string | null;
  proximo_agendamento_hora: string | null;
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

export type AtendenteDTO = {
  id: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

const filtroSchema = z
  .enum([
    "todas",
    "nao_lidas",
    "aguardando",
    "hoje",
    "minhas",
    "resolvidas",
  ])
  .optional()
  .default("todas");

export const listarThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        busca: z.string().trim().max(120).optional().default(""),
        filtro: filtroSchema,
      })
      .parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("mensagens_threads_v2")
      .select("*")
      .order("ultima_em", { ascending: false })
      .limit(300);

    if (data.filtro === "nao_lidas") q = q.gt("nao_lidas", 0);
    if (data.filtro === "aguardando") q = q.eq("status_conversa", "aguardando_resposta");
    if (data.filtro === "resolvidas") q = q.eq("status_conversa", "resolvida");
    if (data.filtro === "minhas") q = q.eq("responsavel_id", context.userId);
    if (data.filtro === "hoje") {
      const h = new Date();
      h.setHours(0, 0, 0, 0);
      q = q.gte("ultima_em", h.toISOString());
    }

    let rows: any[] = [];
    // Busca textual: nome do cliente OU nome do pet OU última mensagem.
    // Como não temos FTS aqui, aplicamos filtros em paralelo e unimos.
    if (data.busca) {
      const b = `%${data.busca}%`;
      const [byNome, byPet, byMsg] = await Promise.all([
        q.ilike("cliente_nome", b),
        context.supabase
          .from("mensagens_threads_v2")
          .select("*")
          .ilike("pet_primeiro_nome", b)
          .order("ultima_em", { ascending: false })
          .limit(150),
        context.supabase
          .from("mensagens_threads_v2")
          .select("*")
          .ilike("ultima_mensagem", b)
          .order("ultima_em", { ascending: false })
          .limit(150),
      ]);
      if (byNome.error) throw new Error(byNome.error.message);
      if (byPet.error) throw new Error(byPet.error.message);
      if (byMsg.error) throw new Error(byMsg.error.message);
      const map = new Map<string, any>();
      for (const r of [...(byNome.data ?? []), ...(byPet.data ?? []), ...(byMsg.data ?? [])] as any[]) {
        const cid = r.cliente_id as string | null;
        if (cid && !map.has(cid)) map.set(cid, r);
      }
      rows = Array.from(map.values()).sort((a: any, b: any) =>
        String(b.ultima_em ?? "").localeCompare(String(a.ultima_em ?? ""))
      );
    } else {
      const { data: r, error } = await q;
      if (error) throw new Error(error.message);
      rows = r ?? [];
    }
    return rows as ThreadDTO[];
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [cli, pets, msgs, prox, estado] = await Promise.all([
      context.supabase
        .from("clientes")
        .select("id, nome, telefone, whatsapp")
        .eq("id", data.cliente_id)
        .maybeSingle(),
      context.supabase
        .from("pets")
        .select("id, nome, porte")
        .eq("cliente_id", data.cliente_id)
        .eq("ativo", true)
        .order("created_at"),
      context.supabase
        .from("mensagens")
        .select("*")
        .eq("cliente_id", data.cliente_id)
        .order("created_at", { ascending: true })
        .limit(500),
      context.supabase
        .from("agendamentos")
        .select("id, data, hora, status, pets(nome)")
        .eq("cliente_id", data.cliente_id)
        .in("status", ["agendado", "confirmado"])
        .gte("data", hoje.toISOString().slice(0, 10))
        .order("data")
        .order("hora")
        .limit(1),
      context.supabase
        .from("conversas_estado")
        .select("cliente_id, responsavel_id, resolvida_em, responsavel_atribuido_em")
        .eq("cliente_id", data.cliente_id)
        .maybeSingle(),
    ]);
    if (cli.error) throw new Error(cli.error.message);
    if (msgs.error) throw new Error(msgs.error.message);
    return {
      cliente: cli.data,
      pets: pets.data ?? [],
      mensagens: (msgs.data ?? []) as MensagemDTO[],
      proximo_agendamento: (prox.data && prox.data[0]) || null,
      estado: estado.data,
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

export const registrarEnvioManual = createServerFn({ method: "POST" })
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
    // Registra confirmação manual do que foi enviado pelo WhatsApp Web
    const { error } = await context.supabase.from("mensagens").insert({
      cliente_id: data.cliente_id,
      direcao: "out",
      canal: "whatsapp",
      corpo: data.corpo,
      status: "enviada",
      autor_id: context.userId,
      tags: ["registro_manual"],
      aprovado_por: context.userId,
      aprovado_em: new Date().toISOString(),
      enviado_em: new Date().toISOString(),
      contexto_ia: { origem: "registro_manual", aprovacao: "confirmacao_humana" },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
      aprovado_por: context.userId,
      aprovado_em: new Date().toISOString(),
      enviado_em: new Date().toISOString(),
      contexto_ia: { origem: "nota_interna", aprovacao: "autoria_humana" },
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

export const atribuirResponsavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        responsavel_id: z.string().uuid().nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("conversas_estado").upsert(
      {
        cliente_id: data.cliente_id,
        responsavel_id: data.responsavel_id,
        responsavel_atribuido_em: data.responsavel_id ? now : null,
        responsavel_atribuido_por: data.responsavel_id ? context.userId : null,
      },
      { onConflict: "cliente_id" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarResolvida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        resolvida: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("conversas_estado").upsert(
      {
        cliente_id: data.cliente_id,
        resolvida_em: data.resolvida ? now : null,
        resolvida_por: data.resolvida ? context.userId : null,
      },
      { onConflict: "cliente_id" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarAtendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email, avatar_url, perfil, status")
      .eq("status", "ativo")
      .in("perfil", ["proprietario", "admin", "user", "atendente", "staff"])
      .order("nome");
    if (error) {
      // fallback caso perfis não estejam segmentados
      const alt = await context.supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .order("nome");
      if (alt.error) throw new Error(alt.error.message);
      return (alt.data ?? []) as AtendenteDTO[];
    }
    return (data ?? []).map(({ id, nome, email, avatar_url }) => ({
      id,
      nome,
      email,
      avatar_url,
    })) as AtendenteDTO[];
  });

export const inboxKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [naoLidas, hojeCount, aguardando, minhas] = await Promise.all([
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
        .from("mensagens_threads_v2")
        .select("cliente_id", { count: "exact", head: true })
        .eq("status_conversa", "aguardando_resposta"),
      context.supabase
        .from("mensagens_threads_v2")
        .select("cliente_id", { count: "exact", head: true })
        .eq("responsavel_id", context.userId),
    ]);
    return {
      nao_lidas: naoLidas.count ?? 0,
      hoje: hojeCount.count ?? 0,
      aguardando_resposta: aguardando.count ?? 0,
      minhas: minhas.count ?? 0,
    };
  });
