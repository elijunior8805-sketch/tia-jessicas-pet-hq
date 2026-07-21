import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cron público: chamado por pg_cron a cada hora. Idempotente por dia via
// UNIQUE(agendamento_id, destinatario_whatsapp, periodo_de).
// Autentica via header `x-cron-secret` = CRON_WEBHOOK_SECRET (server-only).
export const Route = createFileRoute("/api/public/hooks/relatorios-diarios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected = process.env.CRON_WEBHOOK_SECRET ?? "";
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Usa service role apenas dentro do handler autenticado por apikey.
        const url = process.env.SUPABASE_URL!;
        const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!url || !svc) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const supabase = createClient(url, svc, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        try {
          const { gerarExecucoesInterno } = await import(
            "@/lib/relatorios-agendamentos.functions"
          );
          const r = await gerarExecucoesInterno(supabase);
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          console.error("[cron relatorios-diarios]", e?.message ?? e);
          return Response.json(
            { ok: false, error: e?.message ?? "erro" },
            { status: 500 }
          );
        }
      },
    },
  },
});
