import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Régua diária de cobrança. Chamada pelo pg_cron via header `x-cron-secret`.
// Autenticação usa CRON_WEBHOOK_SECRET (segredo dedicado do servidor) — nunca
// a chave anon/publishable, que é pública no bundle do frontend.

export const Route = createFileRoute("/api/public/hooks/regua-cobranca")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.CRON_WEBHOOK_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env.SUPABASE_URL;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !service) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const admin = createClient(url, service, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const today = new Date();
        const iso = today.toISOString().slice(0, 10);

        // 1) Passa a_vencer -> vencido quando data já passou
        await admin
          .from("cobrancas")
          .update({ status: "vencido" })
          .eq("status", "a_vencer")
          .lt("vencimento", iso);

        // 1b) Promessas vencidas voltam para "vencido" e registram evento.
        const { data: promessasVencidas } = await admin
          .from("cobrancas")
          .select("id, promessa_data")
          .eq("status", "promessa")
          .lt("promessa_data", iso);

        for (const p of promessasVencidas ?? []) {
          await admin.from("cobrancas").update({ status: "vencido" }).eq("id", p.id);
          await admin.from("cobrancas_eventos").insert({
            cobranca_id: p.id,
            tipo: "mudanca_status",
            canal: "sistema",
            payload: {
              status: "vencido",
              motivo: "promessa_vencida",
              promessa_data: p.promessa_data,
            },
          });
        }



        // 2) Config
        const { data: cfg } = await admin
          .from("cobrancas_config")
          .select("modo, nao_repetir_no_dia")
          .maybeSingle();
        const modo = (cfg?.modo ?? "manual") as "manual" | "auto" | "pausado";
        if (modo === "pausado") {
          return Response.json({ ok: true, skipped: "modo pausado" });
        }

        // 3) Descobre linhas elegíveis. Só para automáticas registramos evento.
        // Para "manual", a UI já reflete o estado (o operador vê e envia).
        if (modo !== "auto") {
          return Response.json({ ok: true, modo });
        }

        const { data: cobrancas, error } = await admin
          .from("cobrancas")
          .select("id, vencimento, status, ultima_cobranca_em, pausada")
          .in("status", ["a_vencer", "vencido"])
          .eq("pausada", false)
          .gt("saldo", 0);
        if (error) return new Response(error.message, { status: 500 });

        let programadas = 0;
        for (const c of cobrancas ?? []) {
          const v = new Date((c.vencimento as string) + "T00:00:00Z").getTime();
          const h = new Date(iso + "T00:00:00Z").getTime();
          const diff = Math.floor((h - v) / 86400000);
          const gatilho =
            diff === -1
              ? "d_menos_1"
              : diff === 0
                ? "d_zero"
                : diff === 3
                  ? "d_mais_3"
                  : diff === 7
                    ? "d_mais_7"
                    : diff === 15
                      ? "d_mais_15"
                      : null;
          if (!gatilho) continue;

          // Não repetir no mesmo dia
          if (cfg?.nao_repetir_no_dia && c.ultima_cobranca_em) {
            const ultima = new Date(c.ultima_cobranca_em as string).toISOString().slice(0, 10);
            if (ultima === iso) continue;
          }

          await admin.from("cobrancas_eventos").insert({
            cobranca_id: c.id,
            tipo: "envio_auto",
            canal: "sistema",
            payload: { gatilho, modo, iso },
          });
          await admin
            .from("cobrancas")
            .update({ ultima_cobranca_em: new Date().toISOString() })
            .eq("id", c.id);
          programadas += 1;
        }

        return Response.json({ ok: true, programadas });
      },
    },
  },
});
