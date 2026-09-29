import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  criarCobrancaPixMercadoPago,
  criarLinkPagamentoMercadoPago,
  consultarPagamentoMercadoPago,
} from "./mercadopago.server";

/**
 * Server Function para Gerar Cobrança Pix via Mercado Pago
 */
export const gerarPixMercadoPagoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        valor: z.number().min(0.01),
        descricao: z.string().min(1),
        clienteNome: z.string().optional(),
        clienteEmail: z.string().optional(),
        clienteCpf: z.string().optional(),
        clienteTelefone: z.string().optional(),
        agendamentoId: z.string().optional(),
        cobrancaId: z.string().optional(),
        clienteId: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const res = await criarCobrancaPixMercadoPago(data);

    // Se o Pix foi gerado com sucesso, registra a pendência na tabela de pagamentos do Supabase
    if (res.sucesso && res.paymentId) {
      try {
        await (supabase as any).from("pagamentos").insert({
          valor: data.valor,
          metodo: "pix",
          status: "pendente",
          tipo: "avulso",
          observacoes: `Pix Mercado Pago: ID ${res.paymentId} - ${data.descricao}`,
          agendamento_id: data.agendamentoId || null,
          cliente_id: data.clienteId || null,
          created_by: userId,
        });
      } catch (errDb) {
        console.warn("[MercadoPago] Aviso ao registrar pagamento pendente:", errDb);
      }
    }

    return res;
  });

/**
 * Server Function para Gerar Link de Pagamento (Cartão de Crédito / Parcelado)
 */
export const gerarLinkMercadoPagoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        titulo: z.string().min(1),
        valor: z.number().min(0.01),
        quantidade: z.number().optional().default(1),
        clienteNome: z.string().optional(),
        clienteEmail: z.string().optional(),
        agendamentoId: z.string().optional(),
        cobrancaId: z.string().optional(),
        clienteId: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    return await criarLinkPagamentoMercadoPago(data);
  });

/**
 * Server Function para Verificar Status em Tempo Real e Dar Baixa se Aprovado
 */
export const verificarStatusPixMercadoPagoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        paymentId: z.union([z.string(), z.number()]),
        agendamentoId: z.string().optional(),
        clienteId: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const res = await consultarPagamentoMercadoPago(data.paymentId);

    // Se o pagamento já foi aprovado, efetiva a baixa imediatamente no banco
    if (res.sucesso && res.status === "approved") {
      try {
        // 1. Atualiza o status em pagamentos
        await (supabase as any)
          .from("pagamentos")
          .update({
            status: "pago",
            data_pagamento: new Date().toISOString(),
          })
          .ilike("observacoes", `%${data.paymentId}%`);

        // 2. Se houver agendamento vinculado, confirma o atendimento
        if (data.agendamentoId) {
          await (supabase as any)
            .from("agendamentos")
            .update({ status: "confirmado" })
            .eq("id", data.agendamentoId);
        }
      } catch (errUp) {
        console.warn("[MercadoPago] Aviso ao efetivar baixa de pagamento:", errUp);
      }
    }

    return res;
  });
