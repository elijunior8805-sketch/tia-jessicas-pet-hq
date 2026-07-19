import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cron público: chamado por pg_cron a cada hora. Idempotente por dia via
// UNIQUE(agendamento_id, destinatario_whatsapp, periodo_de).
export const Route = createFileRoute("/api/public/hooks/relatorios-diarios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("apikey") ?? "";
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!auth || auth !== anon) {
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
