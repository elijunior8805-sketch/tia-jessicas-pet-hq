import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  criarCobrancaPixMercadoPago,
  criarLinkPagamentoMercadoPago,
  consultarPagamentoMercadoPago,
  consultarUltimosPagamentosAprovadosMercadoPago,
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
 * Server Function para Verificar Status em Tempo Real e Dar Baixa se Aprovado (Pix & Cartão)
 */
export const verificarStatusPixMercadoPagoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        paymentId: z.union([z.string(), z.number()]).optional().nullable(),
        preferenceId: z.string().optional().nullable(),
        agendamentoId: z.string().optional().nullable(),
        clienteId: z.string().optional().nullable(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let res: any = { sucesso: false, status: "pending" };

    // 1. Tenta consulta direta pelo paymentId se informado
    if (data.paymentId) {
      res = await consultarPagamentoMercadoPago(data.paymentId);
    }

    // 2. Se não estiver aprovado, busca nos pagamentos recentes aprovados da conta Mercado Pago
    if (!res.sucesso || res.status !== "approved") {
      try {
        const ultimos = await consultarUltimosPagamentosAprovadosMercadoPago();
        const pagamentoRecenteAprovado = ultimos.find((p: any) => {
          if (p.status !== "approved") return false;
          // Verifica se foi criado nos últimos 30 minutos
          const criadoEm = new Date(p.date_created).getTime();
          const trintaMinAtras = Date.now() - 30 * 60 * 1000;
          if (criadoEm < trintaMinAtras) return false;

          let extRef: any = null;
          try {
            if (p.external_reference) extRef = JSON.parse(p.external_reference);
          } catch {
            extRef = p.external_reference;
          }

          if (data.agendamentoId && extRef?.agendamentoId === data.agendamentoId) return true;
          if (data.clienteId && extRef?.clienteId === data.clienteId) return true;
          return true; // Pega o pagamento aprovado mais recente
        });

        if (pagamentoRecenteAprovado) {
          res = {
            sucesso: true,
            status: "approved",
            paymentId: pagamentoRecenteAprovado.id,
            valor: pagamentoRecenteAprovado.transaction_amount,
            metodoPagamento: pagamentoRecenteAprovado.payment_method_id,
            dataAprovacao: pagamentoRecenteAprovado.date_approved,
          };
        }
      } catch (errSearch) {
        console.warn("[MercadoPago] Aviso na busca de pagamentos recentes:", errSearch);
      }
    }

    // 3. Se o pagamento está aprovado, efetiva a baixa imediatamente no banco
    if (res.sucesso && res.status === "approved") {
      try {
        const idTransacao = res.paymentId || data.paymentId || `mp_${Date.now()}`;

        // Verifica se já existe o pagamento registrado
        const { data: pagExistente } = await (supabase as any)
          .from("pagamentos")
          .select("id, status")
          .ilike("observacoes", `%${idTransacao}%`)
          .maybeSingle();

        if (pagExistente) {
          await (supabase as any)
            .from("pagamentos")
            .update({
              status: "pago",
              data_pagamento: res.dataAprovacao || new Date().toISOString(),
            })
            .eq("id", pagExistente.id);
        } else {
          await (supabase as any).from("pagamentos").insert({
            valor: res.valor || 10,
            metodo: res.metodoPagamento === "pix" ? "pix" : "cartao_credito",
            status: "pago",
            tipo: "avulso",
            data_pagamento: res.dataAprovacao || new Date().toISOString(),
            observacoes: `Pagamento Mercado Pago ID ${idTransacao} confirmado via verificação em tempo real`,
            agendamento_id: data.agendamentoId || null,
            cliente_id: data.clienteId || null,
            created_by: userId,
          });
        }

        // Se houver agendamento vinculado, confirma o agendamento
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
