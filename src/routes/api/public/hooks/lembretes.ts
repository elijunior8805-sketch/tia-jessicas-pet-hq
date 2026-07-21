import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Endpoint chamado por pg_cron para enfileirar lembretes do dia.
// Autentica via header `x-cron-secret` comparado com CRON_WEBHOOK_SECRET
// (segredo dedicado do servidor). Não usar a chave anon aqui — ela é pública.
export const Route = createFileRoute("/api/public/hooks/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.CRON_WEBHOOK_SECRET;
        if (!expected || !provided || provided !== expected) {
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
