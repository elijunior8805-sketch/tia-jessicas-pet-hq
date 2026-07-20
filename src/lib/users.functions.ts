import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PerfilEnum = z.enum([
  "proprietario",
  "admin",
  "gestor",
  "atendente",
  "banho_tosa",
  "leva_traz",
  "financeiro",
  "consulta",
]);

const StatusEnum = z.enum(["ativo", "bloqueado", "desativado", "convite_pendente", "expirado"]);

const PermissaoSchema = z.object({
  modulo: z.string().min(1).max(64),
  acao: z.string().min(1).max(64),
  permitido: z.boolean(),
});

async function assertCanManage(ctx: any) {
  const { supabase, userId } = ctx;
  const { data, error } = await supabase.rpc("pode_gerenciar_usuarios", { _user_id: userId });
  if (error || !data) throw new Error("Sem permissão para gerenciar usuários");
  const { data: prof } = await supabase.from("profiles").select("perfil").eq("id", userId).maybeSingle();
  return { isProprietario: prof?.perfil === "proprietario" };
}

// ============ LISTAR USUÁRIOS ============
export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id,nome,email,telefone,avatar_url,perfil,status,bloqueado_em,desativado_em,convidado_por,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Enrich com last_sign_in_at via admin.listUsers (paginado, primeiros 200 é suficiente para MVP)
    const { data: adminUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const map = new Map(adminUsers?.users?.map((u) => [u.id, u]) ?? []);

    return (profiles ?? []).map((p) => {
      const u = map.get(p.id);
      return {
        ...p,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        email_confirmed_at: u?.email_confirmed_at ?? null,
      };
    });
  });

// ============ CONVIDAR ============
export const convidarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      nome: z.string().min(1).max(120),
      telefone: z.string().max(40).optional().nullable(),
      perfil: PerfilEnum,
      permissoes: z.array(PermissaoSchema).optional().default([]),
      mensagem: z.string().max(500).optional().nullable(),
      expira_em: z.string().datetime().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const meta = await assertCanManage(context);
    if (data.perfil === "proprietario" && !meta.isProprietario) {
      throw new Error("Somente proprietários podem convidar outro proprietário");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nome: data.nome, perfil: data.perfil },
    });
    if (inviteErr) throw new Error(inviteErr.message);
    const newUserId = invite?.user?.id;
    if (!newUserId) throw new Error("Falha ao criar convite");

    // Upsert profile (o trigger handle_new_user pode ter criado com defaults)
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUserId,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? null,
        perfil: data.perfil,
        status: "convite_pendente",
        convidado_por: context.userId,
      }, { onConflict: "id" });

    if (data.permissoes.length > 0) {
      await supabaseAdmin.from("user_permissions").upsert(
        data.permissoes.map((p) => ({
          user_id: newUserId,
          modulo: p.modulo,
          acao: p.acao,
          permitido: p.permitido,
          concedido_por: context.userId,
        })),
      );
    }

    await supabaseAdmin.from("user_invites").insert({
      email: data.email,
      nome: data.nome,
      telefone: data.telefone ?? null,
      perfil: data.perfil,
      permissoes: data.permissoes as any,
      mensagem: data.mensagem ?? null,
      criado_por: context.userId,
      expira_em: data.expira_em ?? null,
    });

    return { ok: true, userId: newUserId };
  });

// ============ ALTERAR PERFIL ============
export const setPerfilUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), perfil: PerfilEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const meta = await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("perfil").eq("id", data.userId).maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado");
    if ((alvo.perfil === "proprietario" || data.perfil === "proprietario") && !meta.isProprietario) {
      throw new Error("Somente proprietários podem alterar/atribuir o perfil de proprietário");
    }
    const { error } = await supabaseAdmin.from("profiles").update({ perfil: data.perfil }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ STATUS: BLOQUEAR / DESBLOQUEAR / DESATIVAR ============
export const setStatusUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), status: StatusEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const meta = await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("perfil,id").eq("id", data.userId).maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado");
    if (alvo.perfil === "proprietario" && !meta.isProprietario) {
      throw new Error("Somente proprietários podem bloquear/desativar outro proprietário");
    }
    if (alvo.id === context.userId && data.status !== "ativo") {
      throw new Error("Você não pode bloquear ou desativar a própria conta");
    }
    const patch: any = { status: data.status };
    if (data.status === "bloqueado") patch.bloqueado_em = new Date().toISOString();
    if (data.status === "desativado") patch.desativado_em = new Date().toISOString();
    if (data.status === "ativo") { patch.bloqueado_em = null; patch.desativado_em = null; }

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);

    // Bloqueio ou desativação encerra sessões
    if (data.status === "bloqueado" || data.status === "desativado") {
      await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => {});
    }
    return { ok: true };
  });

// ============ PERMISSÕES ============
export const listarPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perms } = await supabaseAdmin
      .from("user_permissions")
      .select("modulo,acao,permitido")
      .eq("user_id", data.userId);
    return perms ?? [];
  });

export const salvarPermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      permissoes: z.array(PermissaoSchema),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bloqueio server-side: proprietários têm acesso total e não podem ter
    // suas permissões editadas por essa via, independentemente da UI.
    const { data: alvo } = await supabaseAdmin
      .from("profiles")
      .select("perfil")
      .eq("id", data.userId)
      .maybeSingle();
    if (!alvo) throw new Error("Usuário não encontrado");
    if (alvo.perfil === "proprietario") {
      throw new Error("Proprietários têm acesso completo e não podem ter permissões editadas.");
    }

    // Snapshot anterior para registrar diff em auditoria
    const { data: antes } = await supabaseAdmin
      .from("user_permissions")
      .select("modulo,acao,permitido")
      .eq("user_id", data.userId);

    await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.userId);
    if (data.permissoes.length > 0) {
      const rows = data.permissoes.map((p) => ({
        user_id: data.userId,
        modulo: p.modulo,
        acao: p.acao,
        permitido: p.permitido,
        concedido_por: context.userId,
      }));
      const { error } = await supabaseAdmin.from("user_permissions").insert(rows);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      table_name: "user_permissions",
      record_id: data.userId,
      action: "UPDATE_PERMISSOES",
      old_data: { permissoes: antes ?? [] } as any,
      new_data: { permissoes: data.permissoes } as any,
    } as any).then(() => {}, () => {});

    return { ok: true };
  });

// ============ RESET SENHA / SESSÕES ============
export const enviarResetSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const encerrarSessoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONVITES ============
export const listarConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_invites")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const cancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_invites").update({
      status: "cancelado",
      cancelado_em: new Date().toISOString(),
    }).eq("id", data.id);
    return { ok: true };
  });

// ============ VISÃO GERAL / MÉTRICAS ============
export const overviewSeguranca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profs }, { data: invs }, { data: audit }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,perfil,status"),
      supabaseAdmin.from("user_invites").select("id,status"),
      supabaseAdmin.from("audit_log").select("id,user_email,table_name,action,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const total = profs?.length ?? 0;
    const ativos = profs?.filter((p) => p.status === "ativo").length ?? 0;
    const bloqueados = profs?.filter((p) => p.status === "bloqueado").length ?? 0;
    const desativados = profs?.filter((p) => p.status === "desativado").length ?? 0;
    const convites_pendentes = invs?.filter((i) => i.status === "pendente").length ?? 0;
    const administradores = profs?.filter((p) => p.perfil === "admin" || p.perfil === "proprietario").length ?? 0;
    const proprietarios = profs?.filter((p) => p.perfil === "proprietario" && p.status === "ativo").length ?? 0;

    return {
      total,
      ativos,
      bloqueados,
      desativados,
      convites_pendentes,
      administradores,
      proprietarios,
      atividades: audit ?? [],
    };
  });

// ============ AUDITORIA ============
export const listarAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional().default(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });
