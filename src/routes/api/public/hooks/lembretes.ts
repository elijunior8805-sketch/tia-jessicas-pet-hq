import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Endpoint chamado por pg_cron para enfileirar lembretes do dia.
// Autentica via header `apikey` (anon publishable key) — padrão do template.
export const Route = createFileRoute("/api/public/hooks/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const url = process.env.SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await admin.rpc("enfileirar_lembretes");
        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ ok: true, resultado: data, executado_em: new Date().toISOString() }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
