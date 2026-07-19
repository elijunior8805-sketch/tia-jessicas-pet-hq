import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const StatusEnum = z.enum(["pendente", "parcial", "atrasado", "pago", "cancelado"]);

const ListInputSchema = z.object({
  status: z.array(StatusEnum).optional(),
  clienteId: z.string().uuid().optional().nullable(),
  vencimentoDe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  vencimentoAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  somenteAtrasados: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

export type PagamentoAbertoDTO = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_whatsapp: string | null;
  pet_nome: string | null;
  valor_total: number;
  valor_pago: number;
  saldo: number;
  vencimento: string | null;
  dias_atraso: number;
  status: string;
  atendimento_id: string | null;
  observacoes: string | null;
};

export type PagamentosResumo = {
  total_aberto: number;
  total_atrasado: number;
  qtd_aberto: number;
  qtd_atrasado: number;
  vence_hoje: number;
  vence_7d: number;
};

export const listarPagamentosAbertos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const statusFiltro = data.status && data.status.length > 0
      ? data.status
      : (["pendente", "parcial", "atrasado"] as const);

    let query = supabase
      .from("pagamentos")
      .select(
        "id, cliente_id, atendimento_id, valor_total, valor_pago, vencimento, status, observacoes, clientes:cliente_id(nome, whatsapp), atendimentos:atendimento_id(pets:pet_id(nome))"
      )
      .in("status", statusFiltro as unknown as string[])
      .order("vencimento", { ascending: true, nullsFirst: false })
      .limit(data.limit);

    if (data.clienteId) query = query.eq("cliente_id", data.clienteId);
    if (data.vencimentoDe) query = query.gte("vencimento", data.vencimentoDe);
    if (data.vencimentoAte) query = query.lte("vencimento", data.vencimentoAte);

    const { data: rows, error } = await query;
    if (error) {
      console.error("[pagamentos] listar erro:", error.message);
      throw new Error("Não foi possível carregar os pagamentos em aberto");
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const hojeMs = hoje.getTime();

    const itens: PagamentoAbertoDTO[] = (rows ?? []).map((r: any) => {
      const valorTotal = Number(r.valor_total ?? 0);
      const valorPago = Number(r.valor_pago ?? 0);
      const saldo = Math.max(0, valorTotal - valorPago);
      let diasAtraso = 0;
      if (r.vencimento) {
        const venc = new Date(r.vencimento + "T00:00:00Z").getTime();
        diasAtraso = Math.floor((hojeMs - venc) / 86400000);
      }
      return {
        id: r.id,
        cliente_id: r.cliente_id,
        cliente_nome: r.clientes?.nome ?? "Cliente",
        cliente_whatsapp: r.clientes?.whatsapp ?? null,
        pet_nome: r.atendimentos?.pets?.nome ?? null,
        valor_total: valorTotal,
        valor_pago: valorPago,
        saldo,
        vencimento: r.vencimento,
        dias_atraso: diasAtraso,
        status: r.status,
        atendimento_id: r.atendimento_id,
        observacoes: r.observacoes,
      };
    });

    const filtrados = data.somenteAtrasados
      ? itens.filter((i) => i.dias_atraso > 0)
      : itens;

    const resumo: PagamentosResumo = {
      total_aberto: 0,
      total_atrasado: 0,
      qtd_aberto: 0,
      qtd_atrasado: 0,
      vence_hoje: 0,
      vence_7d: 0,
    };
    for (const i of itens) {
      resumo.total_aberto += i.saldo;
      resumo.qtd_aberto += 1;
      if (i.dias_atraso > 0) {
        resumo.total_atrasado += i.saldo;
        resumo.qtd_atrasado += 1;
      } else if (i.dias_atraso === 0) {
        resumo.vence_hoje += 1;
      } else if (i.dias_atraso >= -7) {
        resumo.vence_7d += 1;
      }
    }

    return { itens: filtrados, resumo };
  });

const RegistrarContatoSchema = z.object({
  pagamentoId: z.string().uuid(),
  canal: z.enum(["whatsapp", "telefone", "email", "outro"]).default("whatsapp"),
  observacao: z.string().max(500).optional().nullable(),
});

export const registrarContatoCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RegistrarContatoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const obs = `[Cobrança ${data.canal} por ${userId} em ${new Date().toISOString()}] ${data.observacao ?? ""}`.trim();

    const { data: atual, error: readErr } = await supabase
      .from("pagamentos")
      .select("id, status, observacoes")
      .eq("id", data.pagamentoId)
      .maybeSingle();
    if (readErr || !atual) throw new Error("Pagamento não encontrado");
    if (atual.status === "pago" || atual.status === "cancelado") {
      throw new Error("Não é possível registrar cobrança em pagamento finalizado");
    }

    const novasObs = atual.observacoes ? `${atual.observacoes}\n${obs}` : obs;
    const { error: updErr } = await supabase
      .from("pagamentos")
      .update({ observacoes: novasObs })
      .eq("id", data.pagamentoId);
    if (updErr) {
      console.error("[pagamentos] registrar contato erro:", updErr.message);
      throw new Error("Não foi possível registrar o contato");
    }
    return { ok: true };
  });
