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
          // Normalização inteligente da forma de pagamento para o enum PostgreSQL `pagamento_forma`
          let formaNormalizada: "pix" | "credito" | "debito" = "credito";
          const mpMetodo = String(pagamentoMp.metodoPagamento || "").toLowerCase();
          if (mpMetodo === "pix" || mpMetodo === "bank_transfer" || mpMetodo.includes("pix")) {
            formaNormalizada = "pix";
          } else if (mpMetodo === "debit_card" || mpMetodo.includes("debito") || mpMetodo.includes("débito")) {
            formaNormalizada = "debito";
          } else {
            formaNormalizada = "credito";
          }

          const dataPagoIso = pagamentoMp.dataAprovacao || new Date().toISOString();
          const valorTotalNum = Number(pagamentoMp.valor || 0);

          // 1. Atualiza ou insere registro na tabela de pagamentos
          const condicoes: string[] = [
            `id_transacao_bancaria.eq.${paymentId}`,
            `observacoes.ilike.%${paymentId}%`,
          ];
          if (cobrancaId) condicoes.push(`id.eq.${cobrancaId}`);
          if (agendamentoId) condicoes.push(`atendimento_id.eq.${agendamentoId}`);

          const { data: pagsExistentes } = await admin
            .from("pagamentos")
            .select("id, status, valor_total, observacoes")
            .or(condicoes.join(","));

          const listaPags = pagsExistentes || [];

          if (listaPags.length > 0) {
            const principal = listaPags[0];
            const valorFinal = valorTotalNum > 0 ? valorTotalNum : Number(principal.valor_total || 0);
            const { error: errUpdate } = await admin
              .from("pagamentos")
              .update({
                status: "pago",
                valor_pago: valorFinal,
                data_pagamento: dataPagoIso.slice(0, 10),
                forma: formaNormalizada,
                id_transacao_bancaria: String(paymentId),
                observacoes: principal.observacoes
                  ? `${principal.observacoes} | Baixa automática via Webhook (${formaNormalizada.toUpperCase()})`
                  : `Baixa automática via Webhook Mercado Pago ID ${paymentId} (${formaNormalizada.toUpperCase()})`,
              } as any)
              .eq("id", principal.id);

            if (errUpdate) {
              console.error("[Webhook MercadoPago] Erro ao atualizar pagamento:", errUpdate);
            }

            // Remove duplicatas pendentes se houver
            if (listaPags.length > 1) {
              const idsDuplicados = listaPags.slice(1).map((p: any) => p.id);
              await admin.from("pagamentos").delete().in("id", idsDuplicados);
            }
          } else {
            // Cria o pagamento caso não tenha sido pré-registrado
            const { error: errInsert } = await admin.from("pagamentos").insert({
              valor_total: valorTotalNum,
              valor_pago: valorTotalNum,
              forma: formaNormalizada,
              status: "pago",
              categoria_receita: "servico",
              descricao: `Mercado Pago ${formaNormalizada.toUpperCase()} (${paymentId})`,
              data_pagamento: dataPagoIso.slice(0, 10),
              vencimento: dataPagoIso.slice(0, 10),
              id_transacao_bancaria: String(paymentId),
              observacoes: `Pagamento Mercado Pago ID ${paymentId} (${formaNormalizada.toUpperCase()}) aprovado automaticamente via Webhook`,
              atendimento_id: agendamentoId || null,
              cliente_id: clienteId || null,
            } as any);

            if (errInsert) {
              console.error("[Webhook MercadoPago] Erro ao inserir novo pagamento:", errInsert);
            }
          }

          // 2. Se houver agendamento/atendimento vinculado, confirma o atendimento na grade
          if (agendamentoId) {
            await admin
              .from("agendamentos")
              .update({ status: "finalizado" })
              .eq("id", agendamentoId);

            await admin
              .from("atendimentos")
              .update({ pagamento_status: "pago", pagamento_forma: formaNormalizada, valor_pago: valorTotalNum })
              .eq("id", agendamentoId);
          }

          // Nota: a tabela cobrancas é sincronizada automaticamente pelo trigger trg_pag_sync_cobranca no PostgreSQL

          console.log(`[Webhook MercadoPago] Sucesso! Baixa automática realizada para o pagamento ${paymentId} (${formaNormalizada}).`);
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
