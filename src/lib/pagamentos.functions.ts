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
      .in("status", [...statusFiltro])
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

// ============ Cobrança em lote ============

const LoteSchema = z.object({
  pagamentoIds: z.array(z.string().uuid()).min(1).max(50),
  observacao: z.string().max(300).optional().nullable(),
});

export type CobrancaLoteItem = {
  pagamentoId: string;
  cliente_nome: string;
  cliente_whatsapp: string | null;
  pet_nome: string | null;
  saldo: number;
  vencimento: string | null;
  dias_atraso: number;
  mensagem: string;
  wa_url: string | null;
  registrado: boolean;
  motivo?: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const registrarContatoCobrancaLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LoteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    // Ler todas as parcelas selecionadas em uma única query
    const { data: rows, error } = await supabase
      .from("pagamentos")
      .select(
        "id, status, observacoes, valor_total, valor_pago, vencimento, cliente_id, atendimento_id, clientes:cliente_id(nome, whatsapp), atendimentos:atendimento_id(pets:pet_id(nome))"
      )
      .in("id", data.pagamentoIds);
    if (error) {
      console.error("[pagamentos] lote read erro:", error.message);
      throw new Error("Falha ao carregar parcelas selecionadas");
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const hojeMs = hoje.getTime();

    const resultados: CobrancaLoteItem[] = [];
    let totalOk = 0;
    let totalFalha = 0;

    for (const pid of data.pagamentoIds) {
      const r: any = (rows ?? []).find((x: any) => x.id === pid);
      if (!r) {
        resultados.push({
          pagamentoId: pid,
          cliente_nome: "—", cliente_whatsapp: null, pet_nome: null,
          saldo: 0, vencimento: null, dias_atraso: 0,
          mensagem: "", wa_url: null,
          registrado: false, motivo: "Parcela não encontrada",
        });
        totalFalha++;
        continue;
      }
      if (r.status === "pago" || r.status === "cancelado") {
        resultados.push({
          pagamentoId: pid,
          cliente_nome: r.clientes?.nome ?? "—",
          cliente_whatsapp: r.clientes?.whatsapp ?? null,
          pet_nome: r.atendimentos?.pets?.nome ?? null,
          saldo: 0, vencimento: r.vencimento, dias_atraso: 0,
          mensagem: "", wa_url: null,
          registrado: false, motivo: `Status: ${r.status}`,
        });
        totalFalha++;
        continue;
      }

      const valorTotal = Number(r.valor_total ?? 0);
      const valorPago = Number(r.valor_pago ?? 0);
      const saldo = Math.max(0, valorTotal - valorPago);
      let diasAtraso = 0;
      if (r.vencimento) {
        const venc = new Date(r.vencimento + "T00:00:00Z").getTime();
        diasAtraso = Math.floor((hojeMs - venc) / 86400000);
      }

      const clienteNome = (r.clientes?.nome ?? "Cliente") as string;
      const petNome = (r.atendimentos?.pets?.nome ?? null) as string | null;
      const whatsapp = (r.clientes?.whatsapp ?? null) as string | null;

      const vencTxt = r.vencimento
        ? ` com vencimento em ${new Date(r.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}`
        : "";
      const atrasoTxt = diasAtraso > 0 ? ` (em atraso há ${diasAtraso} dia(s))` : "";
      const petTxt = petNome ? ` referente ao atendimento do ${petNome}` : "";
      const mensagem =
        `Olá, ${clienteNome}! Passando para lembrar do pagamento de ${brl(saldo)}${petTxt}${vencTxt}${atrasoTxt}. ` +
        `Se já efetuou, por favor desconsidere. Obrigada! 🐾`;

      const fone = (whatsapp ?? "").replace(/\D/g, "");
      const wa_url = fone
        ? `https://wa.me/55${fone}?text=${encodeURIComponent(mensagem)}`
        : null;

      const marca = `[Cobrança lote whatsapp por ${userId} em ${nowIso}${data.observacao ? ` — ${data.observacao}` : ""}]`;
      const novasObs = r.observacoes ? `${r.observacoes}\n${marca}` : marca;

      const { error: updErr } = await supabase
        .from("pagamentos")
        .update({ observacoes: novasObs })
        .eq("id", pid)
        .in("status", ["pendente", "parcial", "atrasado"]); // guarda concorrência

      if (updErr) {
        console.error("[pagamentos] lote update erro:", pid, updErr.message);
        resultados.push({
          pagamentoId: pid, cliente_nome: clienteNome, cliente_whatsapp: whatsapp,
          pet_nome: petNome, saldo, vencimento: r.vencimento, dias_atraso: diasAtraso,
          mensagem, wa_url,
          registrado: false, motivo: "Falha ao registrar",
        });
        totalFalha++;
        continue;
      }

      resultados.push({
        pagamentoId: pid, cliente_nome: clienteNome, cliente_whatsapp: whatsapp,
        pet_nome: petNome, saldo, vencimento: r.vencimento, dias_atraso: diasAtraso,
        mensagem, wa_url, registrado: true,
      });
      totalOk++;
    }

    return { resultados, totalOk, totalFalha };
  });

  });
