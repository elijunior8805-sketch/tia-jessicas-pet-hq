import { supabase } from "@/integrations/supabase/client";

export type DenialInput = {
  modulo?: string | null;
  acao?: string | null;
  motivo: "permission_check" | "rls_denied" | "http_403" | "http_401" | "route_guard" | "other";
  codigo_erro?: string | null;
  rota?: string | null;
  metodo?: string | null;
  tabela_alvo?: string | null;
  detalhes?: Record<string, any>;
};

// Dedup por sessão para evitar spam (mesmo módulo/ação/rota/motivo)
const seen = new Set<string>();
const DEDUP_MS = 60_000;

function keyOf(d: DenialInput) {
  return [d.motivo, d.modulo, d.acao, d.rota, d.tabela_alvo, d.codigo_erro].join("|");
}

export async function logAccessDenial(d: DenialInput) {
  try {
    const k = keyOf(d);
    if (seen.has(k)) return;
    seen.add(k);
    setTimeout(() => seen.delete(k), DEDUP_MS);

    const { data: u } = await supabase.auth.getUser();
    const user = u?.user ?? null;
    // Não registra bloqueios anônimos (RLS exigiria user_id do próprio; sem sessão não faz sentido)
    if (!user) return;

    await supabase.from("access_denials").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      modulo: d.modulo ?? null,
      acao: d.acao ?? null,
      motivo: d.motivo,
      codigo_erro: d.codigo_erro ?? null,
      rota: d.rota ?? (typeof window !== "undefined" ? window.location.pathname : null),
      metodo: d.metodo ?? null,
      tabela_alvo: d.tabela_alvo ?? null,
      detalhes: d.detalhes ?? {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // silencioso — nunca deve quebrar a UI
  }
}

// Extrai módulo/tabela de uma URL PostgREST (ex.: /rest/v1/pagamentos?...).
function parseTable(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/rest\/v1\/([^?/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Detecta se um erro do Supabase/PostgREST é bloqueio de RLS/permissão.
export function isDenialError(err: any): { motivo: DenialInput["motivo"]; codigo?: string } | null {
  if (!err) return null;
  const code = String(err.code ?? err.status ?? "");
  const msg = String(err.message ?? "").toLowerCase();
  if (code === "42501" || msg.includes("permission denied")) return { motivo: "rls_denied", codigo: code || "42501" };
  if (code === "PGRST301" || msg.includes("row-level security") || msg.includes("row level security"))
    return { motivo: "rls_denied", codigo: code || "PGRST301" };
  if (code === "401" || err.status === 401) return { motivo: "http_401", codigo: "401" };
  if (code === "403" || err.status === 403) return { motivo: "http_403", codigo: "403" };
  return null;
}

export function logSupabaseError(err: any, ctx: { modulo?: string; acao?: string; tabela?: string; rota?: string } = {}) {
  const kind = isDenialError(err);
  if (!kind) return;
  logAccessDenial({
    motivo: kind.motivo,
    codigo_erro: kind.codigo ?? null,
    modulo: ctx.modulo,
    acao: ctx.acao,
    tabela_alvo: ctx.tabela ?? parseTable(err?.details ?? err?.hint ?? ""),
    rota: ctx.rota,
    detalhes: { message: err?.message, hint: err?.hint, details: err?.details },
  });
}
