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

    // Se o Pix foi gerado com sucesso, vincula o ID da transação ao registro existente de pagamento (idempotência)
    if (res.sucesso && res.paymentId) {
      try {
        const idTransacaoStr = String(res.paymentId);
        let pagamentoAtualizado = false;

        // 1. Se foi passado cobrancaId (id da linha de pagamentos)
        if (data.cobrancaId) {
          const { data: existCobranca } = await (supabase as any)
            .from("pagamentos")
            .select("id")
            .eq("id", data.cobrancaId)
            .maybeSingle();

          if (existCobranca) {
            await (supabase as any)
              .from("pagamentos")
              .update({
                id_transacao_bancaria: idTransacaoStr,
                forma: "pix",
                observacoes: `Pix Mercado Pago ID ${idTransacaoStr}`,
              })
              .eq("id", existCobranca.id);
            pagamentoAtualizado = true;
          }
        }

        // 2. Se não foi por cobrancaId mas tem agendamentoId / atendimento_id
        if (!pagamentoAtualizado && data.agendamentoId) {
          const { data: existAtend } = await (supabase as any)
            .from("pagamentos")
            .select("id")
            .eq("atendimento_id", data.agendamentoId)
            .eq("status", "pendente")
            .maybeSingle();

          if (existAtend) {
            await (supabase as any)
              .from("pagamentos")
              .update({
                id_transacao_bancaria: idTransacaoStr,
                forma: "pix",
                observacoes: `Pix Mercado Pago ID ${idTransacaoStr}`,
              })
              .eq("id", existAtend.id);
            pagamentoAtualizado = true;
          }
        }

        // 3. Apenas se NÃO existir nenhum lançamento pendente vinculado é que insere um novo
        if (!pagamentoAtualizado) {
          const payloadInsert: any = {
            valor_total: data.valor,
            valor_pago: 0,
            forma: "pix",
            status: "pendente",
            categoria_receita: "servico",
            descricao: data.descricao,
            id_transacao_bancaria: idTransacaoStr,
            observacoes: `Pix Mercado Pago: ID ${idTransacaoStr} - ${data.descricao}`,
            atendimento_id: data.agendamentoId || null,
            cliente_id: data.clienteId || null,
            vencimento: new Date().toISOString().slice(0, 10),
          };

          await (supabase as any).from("pagamentos").insert(payloadInsert);
        }
      } catch (errDb) {
        console.warn("[MercadoPago] Erro ao sincronizar pagamento pendente:", errDb);
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
        cobrancaId: z.string().optional().nullable(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let res: any = { sucesso: false, status: "pending" };

    // 1. Tenta consulta direta pelo paymentId se informado
    if (data.paymentId) {
      res = await consultarPagamentoMercadoPago(data.paymentId);
    }

    // 2. Se não estiver aprovado ou sem paymentId, busca nos pagamentos recentes aprovados da conta Mercado Pago
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

          // Verificação estrita para evitar confirmação de clientes errados
          if (data.agendamentoId && extRef?.agendamentoId && extRef.agendamentoId === data.agendamentoId) return true;
          if (data.cobrancaId && extRef?.cobrancaId && extRef.cobrancaId === data.cobrancaId) return true;
          if (data.clienteId && extRef?.clienteId && extRef.clienteId === data.clienteId) return true;
          if (data.paymentId && String(p.id) === String(data.paymentId)) return true;
          return false;
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
        const idTransacao = String(res.paymentId || data.paymentId || `mp_${Date.now()}`);
        const dataAprovacaoIso = res.dataAprovacao || new Date().toISOString();
        const valorPagoNum = Number(res.valor || 0);

        // Mapeamento correto para o enum PostgreSQL `pagamento_forma` ('pix' | 'credito' | 'debito' | 'dinheiro' | 'pendente' | 'outras')
        let formaNormalizada: "pix" | "credito" | "debito" = "credito";
        const mpMetodo = String(res.metodoPagamento || "").toLowerCase();
        if (mpMetodo === "pix" || mpMetodo === "bank_transfer" || mpMetodo.includes("pix")) {
          formaNormalizada = "pix";
        } else if (mpMetodo === "debit_card" || mpMetodo.includes("debito") || mpMetodo.includes("débito")) {
          formaNormalizada = "debito";
        } else {
          formaNormalizada = "credito";
        }

        // Busca registros de pagamentos correspondentes pelo id da transação, cobrancaId ou atendimento_id
        const condicoes: string[] = [];
        if (idTransacao) {
          condicoes.push(`id_transacao_bancaria.eq.${idTransacao}`);
          condicoes.push(`observacoes.ilike.%${idTransacao}%`);
        }
        if (data.cobrancaId) {
          condicoes.push(`id.eq.${data.cobrancaId}`);
        }
        if (data.agendamentoId) {
          condicoes.push(`atendimento_id.eq.${data.agendamentoId}`);
        }

        let pagamentosEncontrados: any[] = [];
        if (condicoes.length > 0) {
          const { data: pags } = await (supabase as any)
            .from("pagamentos")
            .select("id, status, valor_total, observacoes, atendimento_id, cliente_id")
            .or(condicoes.join(","));
          pagamentosEncontrados = pags || [];
        }

        if (pagamentosEncontrados.length > 0) {
          // Atualiza o registro principal para 'pago'
          const principal = pagamentosEncontrados[0];
          const valorFinal = valorPagoNum > 0 ? valorPagoNum : Number(principal.valor_total || 0);

          await (supabase as any)
            .from("pagamentos")
            .update({
              status: "pago",
              valor_pago: valorFinal,
              forma: formaNormalizada,
              id_transacao_bancaria: idTransacao,
              data_pagamento: dataAprovacaoIso.slice(0, 10),
              observacoes: principal.observacoes
                ? `${principal.observacoes} | Confirmado Mercado Pago (${formaNormalizada.toUpperCase()})`
                : `Confirmado Mercado Pago ID ${idTransacao} (${formaNormalizada.toUpperCase()})`,
            })
            .eq("id", principal.id);

          // Se houver registros duplicados pendentes com mesmo atendimento_id ou id_transacao, remove a duplicidade para limpar a tela
          if (pagamentosEncontrados.length > 1) {
            const idsDuplicados = pagamentosEncontrados.slice(1).map((p: any) => p.id);
            await (supabase as any)
              .from("pagamentos")
              .delete()
              .in("id", idsDuplicados);
          }
        } else {
          // Caso não tenha encontrado registro anterior, insere como pago
          await (supabase as any).from("pagamentos").insert({
            valor_total: valorPagoNum,
            valor_pago: valorPagoNum,
            forma: formaNormalizada,
            status: "pago",
            categoria_receita: "servico",
            descricao: `Mercado Pago ${formaNormalizada.toUpperCase()} (${idTransacao})`,
            data_pagamento: dataAprovacaoIso.slice(0, 10),
            vencimento: dataAprovacaoIso.slice(0, 10),
            id_transacao_bancaria: idTransacao,
            observacoes: `Pagamento Mercado Pago ID ${idTransacao} (${formaNormalizada.toUpperCase()}) confirmado via verificação em tempo real`,
            atendimento_id: data.agendamentoId || null,
            cliente_id: data.clienteId || null,
          });
        }

        // Se houver agendamento/atendimento vinculado, confirma ou finaliza
        if (data.agendamentoId) {
          await (supabase as any)
            .from("agendamentos")
            .update({ status: "finalizado" })
            .eq("id", data.agendamentoId);

          await (supabase as any)
            .from("atendimentos")
            .update({ pagamento_status: "pago", pagamento_forma: formaNormalizada, valor_pago: valorPagoNum })
            .eq("id", data.agendamentoId);
        }
      } catch (errUp) {
        console.error("[MercadoPago] Erro ao efetivar baixa de pagamento:", errUp);
      }
    }

    return res;
  });
