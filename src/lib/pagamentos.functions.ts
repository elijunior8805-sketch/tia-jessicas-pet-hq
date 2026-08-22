import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { format } from "date-fns";
import { calcTotalExecutado } from "./atendimento-totais";

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
  data_atendimento?: string | null;
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

function valorTotalReceita(row: any) {
  const atendimento = row.atendimentos;

  // Usa a regra centralizada de totais de atendimento
  if (atendimento?.finalizado === true && Number(atendimento?.valor_executado ?? 0) > 0) {
    return calcTotalExecutado(atendimento);
  }

  return Number(row.valor_total ?? 0);
}

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
        "id, cliente_id, atendimento_id, valor_total, valor_pago, vencimento, status, observacoes, clientes:cliente_id(nome, whatsapp), atendimentos:atendimento_id(data_inicio, finalizado, valor_executado, taxa_leva_traz, desconto, pets:pet_id(nome))"
      )
      .in("status", [...statusFiltro])
      .order("vencimento", { ascending: true, nullsFirst: false })
      .limit(data.limit);

    if (data.clienteId) query = query.eq("cliente_id", data.clienteId);
    if (data.vencimentoDe) query = query.gte("vencimento", data.vencimentoDe);
    if (data.vencimentoAte) query = query.lte("vencimento", data.vencimentoAte);

    // Garantir que não mostramos pagamentos arquivados ou de atendimentos excluídos
    query = query.is("arquivado_em", null).not("atendimento_id", "is", null);

    const { data: rows, error } = await query;
    if (error) {
      console.error("[pagamentos] listar erro:", error.message);
      throw new Error("Não foi possível carregar os pagamentos em aberto");
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const hojeMs = hoje.getTime();

    const itens: PagamentoAbertoDTO[] = (rows ?? []).map((r: any) => {
      const valorTotal = valorTotalReceita(r);
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
        data_atendimento: r.atendimentos?.data_inicio ?? null,
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
      throw new Error("Não foi possível registrar the contato");
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
        "id, status, observacoes, valor_total, valor_pago, vencimento, cliente_id, atendimento_id, clientes:cliente_id(nome, whatsapp), atendimentos:atendimento_id(finalizado, valor_executado, taxa_leva_traz, desconto, pets:pet_id(nome))"
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

      const valorTotal = valorTotalReceita(r);
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

export const confirmarRecebimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      pagamentoId: z.string().uuid(),
      forma: z.enum(["pix", "dinheiro", "debito", "credito", "outras"]),
      valor: z.number().min(0.01),
      dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: atual, error: readErr } = await supabase
      .from("pagamentos")
      .select("id, status, valor_pago")
      .eq("id", data.pagamentoId)
      .single();

    if (readErr || !atual) throw new Error("Pagamento não encontrado");
    if (atual.status === "pago") throw new Error("Pagamento já foi recebido anteriormente");

    const { error: updErr } = await supabase
      .from("pagamentos")
      .update({
        status: "pago",
        forma: data.forma,
        valor_pago: data.valor,
        data_pagamento: data.dataPagamento,
      })
      .eq("id", data.pagamentoId);

    if (updErr) {
      console.error("[pagamentos] confirmarRecebimento erro:", updErr.message);
      throw new Error("Falha ao registrar recebimento");
    }

    return { success: true };
  });

// ============= Lixeira Financeira (Soft Delete) =============

export const arquivarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ 
        pagamentoId: z.string().uuid(), 
        motivo: z.string().max(300).optional() 
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("pagamentos")
      .update({
        arquivado_em: new Date().toISOString(),
        arquivado_por: userId,
        arquivado_motivo: data.motivo ?? null,
      })
      .eq("id", data.pagamentoId);

    if (error) {
      console.error("[pagamentos] arquivar erro:", error.message);
      throw new Error("Não foi possível arquivar o lançamento");
    }

    return { ok: true };
  });

export const restaurarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ pagamentoId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("pagamentos")
      .update({
        arquivado_em: null,
        arquivado_por: null,
        arquivado_motivo: null,
      })
      .eq("id", data.pagamentoId);

    if (error) {
      console.error("[pagamentos] restaurar erro:", error.message);
      throw new Error("Não foi possível restaurar o lançamento");
    }

    return { ok: true };
  });

export type PagamentoArquivadoDTO = PagamentoAbertoDTO & {
  arquivado_em: string;
  arquivado_motivo: string | null;
  arquivado_por_nome: string | null;
};

export const listarPagamentosArquivados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PagamentoArquivadoDTO[]> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("pagamentos")
      .select(
        `id, cliente_id, atendimento_id, valor_total, valor_pago, vencimento, status, observacoes, 
         arquivado_em, arquivado_por, arquivado_motivo,
         clientes:cliente_id(nome, whatsapp), 
         atendimentos:atendimento_id(data_inicio, finalizado, valor_executado, taxa_leva_traz, desconto, pets:pet_id(nome))`
      )
      .not("arquivado_em", "is", null)
      .order("arquivado_em", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    const autoresIds = Array.from(new Set((rows ?? []).map((r: any) => r.arquivado_por).filter(Boolean))) as string[];
    const nomePorId = new Map<string, string>();
    if (autoresIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", autoresIds);
      for (const p of (profs ?? []) as any[]) nomePorId.set(p.id, p.nome ?? "");
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const hojeMs = hoje.getTime();

    return (rows ?? []).map((r: any) => {
      const valorTotal = valorTotalReceita(r);
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
        data_atendimento: r.atendimentos?.data_inicio ?? null,
        observacoes: r.observacoes,
        arquivado_em: r.arquivado_em,
        arquivado_motivo: r.arquivado_motivo,
        arquivado_por_nome: r.arquivado_por ? nomePorId.get(r.arquivado_por) ?? null : null,
      };
    });
  });

// ============= Conciliação Financeira =============

export const executarConciliacaoDiaria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Buscar pagamentos abertos
    const { data: pgs, error: pgsErr } = await supabase
      .from("pagamentos")
      .select("id, status, arquivado_em")
      .is("arquivado_em", null)
      .in("status", ["pendente", "parcial", "atrasado"]);

    if (pgsErr) throw new Error("Falha ao ler pagamentos para conciliação");

    // 2. Buscar cobranças ativas
    const { data: cobs, error: cobsErr } = await supabase
      .from("cobrancas")
      .select("id, pagamento_id, arquivada_em")
      .is("arquivada_em", null);

    if (cobsErr) throw new Error("Falha ao ler cobranças para conciliação");

    const pgIds = new Set(pgs.map(p => p.id));
    const cobPgIds = new Set(cobs.map(c => c.pagamento_id));

    const divergencias: any[] = [];
    
    // Pagamentos sem cobrança
    pgs.forEach(p => {
      if (!cobPgIds.has(p.id)) {
        divergencias.push({ tipo: "pagamento_sem_cobranca", id: p.id });
      }
    });

    // Cobranças órfãs
    cobs.forEach(c => {
      if (c.pagamento_id && !pgIds.has(c.pagamento_id)) {
        divergencias.push({ tipo: "cobranca_orfa", id: c.id, pagamento_id: c.pagamento_id });
      }
    });

    const status = divergencias.length > 0 ? "divergencia" : "sucesso";

    await supabase.from("conciliacao_logs").insert({
      tipo: "pagamentos_vs_cobrancas",
      status,
      resumo: { 
        total_pagamentos: pgs.length, 
        total_cobrancas: cobs.length, 
        total_divergencias: divergencias.length 
      },
      detalhes: { divergencias },
      executado_por: userId
    });

    return { status, total_divergencias: divergencias.length };
  });
