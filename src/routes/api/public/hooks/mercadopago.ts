import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { consultarPagamentoMercadoPago } from "@/lib/mercadopago.server";

/**
 * Webhook Oficial do Mercado Pago
 * Recebe notificações instantâneas de pagamentos (Pix, Cartão, Boleto)
 * e realiza a baixa automática no Supabase em tempo real.
 */
export const Route = createFileRoute("/api/public/hooks/mercadopago")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ status: "Webhook Mercado Pago Ativo" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },

      POST: async ({ request }) => {
        try {
          const urlObj = new URL(request.url);
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            body = {};
          }

          // Identifica o ID do pagamento enviado pelo Mercado Pago (pode vir no body ou na query string)
          const paymentId =
            body?.data?.id ||
            body?.id ||
            urlObj.searchParams.get("data.id") ||
            urlObj.searchParams.get("id");

          const topic = body?.type || body?.topic || urlObj.searchParams.get("topic") || urlObj.searchParams.get("type");

          if (!paymentId || (topic && topic !== "payment" && topic !== "merchant_order")) {
            // Retorna 200 para o Mercado Pago não reenviar notificações irrelevantes
            return new Response(JSON.stringify({ ok: true, message: "Evento ignorado (não é pagamento)" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Consulta detalhes oficiais do pagamento na API do Mercado Pago
          const pagamentoMp = await consultarPagamentoMercadoPago(paymentId);

          if (!pagamentoMp.sucesso || !pagamentoMp.status) {
            console.warn(`[Webhook MercadoPago] Pagamento ${paymentId} não localizado na API.`);
            return new Response(JSON.stringify({ ok: false, error: "Pagamento não localizado" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (pagamentoMp.status !== "approved") {
            return new Response(JSON.stringify({ ok: true, status: pagamentoMp.status }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const reference = pagamentoMp.externalReference;
          const agendamentoId = typeof reference?.agendamentoId === "string" ? reference.agendamentoId : null;
          const cobrancaId = typeof reference?.cobrancaId === "string" ? reference.cobrancaId : null;
          const clienteId = typeof reference?.clienteId === "string" ? reference.clienteId : null;

          const url = process.env.SUPABASE_URL || "";
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
          if (!url || !serviceKey) throw new Error("Credenciais de processamento não configuradas");
          const admin = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // Se o pagamento estiver APROVADO, efetiva a baixa imediata
            // Normalização inteligente da forma de pagamento
            let metodoNormalizado: "pix" | "cartao_credito" | "cartao_debito" = "cartao_credito";
            const mpMetodo = String(pagamentoMp.metodoPagamento || "").toLowerCase();
            if (mpMetodo === "pix" || mpMetodo === "bank_transfer" || mpMetodo.includes("pix")) {
              metodoNormalizado = "pix";
            } else if (mpMetodo === "debit_card" || mpMetodo.includes("debito") || mpMetodo.includes("débito")) {
              metodoNormalizado = "cartao_debito";
            } else {
              metodoNormalizado = "cartao_credito";
            }

            const dataPagoIso = pagamentoMp.dataAprovacao || new Date().toISOString();
            const valorTotalNum = Number(pagamentoMp.valor || 0);

            // 1. Atualiza ou insere registro na tabela de pagamentos
            const { data: pagamentoExistente } = await admin
              .from("pagamentos")
              .select("id, status, observacoes")
              .or(`observacoes.ilike.%${paymentId}%,id_transacao_bancaria.eq.${paymentId}`)
              .maybeSingle();

            if (pagamentoExistente) {
              await admin
                .from("pagamentos")
                .update({
                  status: "pago",
                  valor_pago: valorTotalNum,
                  data_pagamento: dataPagoIso,
                  forma: metodoNormalizado,
                  metodo: metodoNormalizado,
                  id_transacao_bancaria: String(paymentId),
                  observacoes: pagamentoExistente.observacoes
                    ? `${pagamentoExistente.observacoes} | Baixa automática via Webhook (${metodoNormalizado})`
                    : `Baixa automática via Webhook Mercado Pago ID ${paymentId} (${metodoNormalizado})`,
                } as any)
                .eq("id", pagamentoExistente.id);
            } else {
              // Cria o pagamento caso não tenha sido pré-registrado
              await admin.from("pagamentos").insert({
                valor: valorTotalNum,
                valor_total: valorTotalNum,
                valor_pago: valorTotalNum,
                metodo: metodoNormalizado,
                forma: metodoNormalizado,
                status: "pago",
                tipo: "avulso",
                data_pagamento: dataPagoIso,
                id_transacao_bancaria: String(paymentId),
                observacoes: `Pagamento Mercado Pago ID ${paymentId} (${metodoNormalizado.toUpperCase()}) aprovado automaticamente via Webhook`,
                agendamento_id: agendamentoId || null,
                atendimento_id: agendamentoId || null,
                cliente_id: clienteId || null,
              } as any);
            }

            // 2. Se houver agendamento vinculado, confirma o atendimento na grade
            if (agendamentoId) {
              await admin
                .from("agendamentos")
                .update({ status: "confirmado" })
                .eq("id", agendamentoId);
            }

            // 3. Se houver cobrança vinculada, dá baixa na cobrança
            if (cobrancaId) {
              await admin
                .from("cobrancas")
                .update({
                  status: "pago",
                  data_pagamento: dataPagoIso,
                })
                .eq("id", cobrancaId);
            }

            console.log(`[Webhook MercadoPago] Sucesso! Baixa automática realizada para o pagamento ${paymentId} (${metodoNormalizado}).`);
          return new Response(
            JSON.stringify({
              ok: true,
              paymentId,
              status: pagamentoMp.status,
              processadoEm: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[Webhook MercadoPago] Erro crítico:", err);
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 200, // Retorna 200 para o Mercado Pago evitar spam de retentativas
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
