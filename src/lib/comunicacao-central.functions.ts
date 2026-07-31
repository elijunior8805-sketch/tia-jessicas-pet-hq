import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  gerarMensagemCobrancaIA,
  refinarTexto,
  montarVisaoGeral,
  gerarResumoInteligente,
  listarFilaEnriquecida,
  montarPainelOperacional,
} from "./comunicacao-central.server";

/* ============================================================
 * Visão geral
 * ============================================================ */
export const visaoGeralComunicacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => await montarVisaoGeral(context.supabase));

export const resumoInteligente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const kpis = await montarVisaoGeral(context.supabase);
    return await gerarResumoInteligente(context.supabase, kpis as any);
  });

export const painelOperacional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => await montarPainelOperacional(context.supabase));

/* ============================================================
 * Fila proativa inteligente
 * ============================================================ */
export const listarFilaProativa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => await listarFilaEnriquecida(context.supabase));

export const adiarSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), horas: z.number().int().min(1).max(720) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ate = new Date(Date.now() + data.horas * 3600 * 1000).toISOString();
    const { error } = await context.supabase
      .from("mensagem_sugestoes")
      .update({ adiada_para: ate })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, adiada_para: ate };
  });

export const resolverSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        resultado: z.string().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mensagem_sugestoes")
      .update({ status: "resolvida", proxima_acao: data.resultado ?? "Resolvido manualmente" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 * Gerador de mensagens de cobrança
 * ============================================================ */
const OpcoesSchema = z.object({
  tom: z.string().optional(),
  firmeza: z.number().int().min(1).max(5).optional(),
  canal: z.enum(["whatsapp", "sms", "email"]).optional(),
  tamanho: z.enum(["curta", "media", "detalhada"]).optional(),
  emojis: z.boolean().optional(),
  citarPet: z.boolean().optional(),
  incluirValor: z.boolean().optional(),
  incluirVencimento: z.boolean().optional(),
  incluirPix: z.boolean().optional(),
  incluirLink: z.boolean().optional(),
  permitirNegociacao: z.boolean().optional(),
  incluirAssinatura: z.boolean().optional(),
});

export const gerarCobrancaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cobrancaId: z.string().uuid(),
        opcoes: OpcoesSchema.default({}),
        instrucaoExtra: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(
    async ({ data, context }) =>
      await gerarMensagemCobrancaIA(
        context.supabase,
        data.cobrancaId,
        data.opcoes,
        data.instrucaoExtra ?? null,
      ),
  );

export const refinarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        texto: z.string().min(1).max(4000),
        acao: z.enum([
          "mais_gentil",
          "mais_direta",
          "mais_firme",
          "resumir",
          "corrigir",
          "outra_versao",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => await refinarTexto(context.supabase, data.texto, data.acao));

/* ============================================================
 * Registro rastreável do envio aprovado
 * ============================================================ */
export const registrarComunicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clienteId: z.string().uuid(),
        corpo: z.string().min(1).max(4000),
        mensagemIaOriginal: z.string().max(4000).optional().nullable(),
        tomSugerido: z.string().max(60).optional().nullable(),
        tomEscolhido: z.string().max(60).optional().nullable(),
        nivelFirmeza: z.number().int().min(1).max(5).optional().nullable(),
        modeloIa: z.string().max(120).optional().nullable(),
        canal: z.string().max(30).default("whatsapp"),
        tipo: z.string().max(60).optional().nullable(),
        cobrancaId: z.string().uuid().optional().nullable(),
        atendimentoId: z.string().uuid().optional().nullable(),
        sugestaoId: z.string().uuid().optional().nullable(),
        templateId: z.string().uuid().optional().nullable(),
        promessaId: z.string().uuid().optional().nullable(),
        resultadoContato: z.string().max(120).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("mensagens").insert({
      cliente_id: data.clienteId,
      direcao: "out",
      canal: data.canal,
      corpo: data.corpo,
      status: "enviada",
      autor_id: context.userId,
      autor_email: (context.claims as any)?.email ?? null,
      tipo: data.tipo ?? null,
      cobranca_id: data.cobrancaId ?? null,
      atendimento_id: data.atendimentoId ?? null,
      sugestao_id: data.sugestaoId ?? null,
      template_id: data.templateId ?? null,
      promessa_id: data.promessaId ?? null,
      mensagem_ia_original: data.mensagemIaOriginal ?? null,
      tom_sugerido: data.tomSugerido ?? null,
      tom_escolhido: data.tomEscolhido ?? null,
      nivel_firmeza: data.nivelFirmeza ?? null,
      modelo_ia: data.modeloIa ?? null,
      resultado_contato: data.resultadoContato ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 * Promessas de pagamento
 * ============================================================ */
export const listarPromessas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("promessas_pagamento")
      .select("*, clientes(id, nome, whatsapp)")
      .order("data_prometida", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const salvarPromessa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        clienteId: z.string().uuid(),
        cobrancaId: z.string().uuid().optional().nullable(),
        valorPrometido: z.number().min(0),
        dataPrometida: z.string().min(8),
        formaPagamento: z.string().max(40).optional().nullable(),
        observacoes: z.string().max(500).optional().nullable(),
        status: z
          .enum([
            "aguardando",
            "cumprida",
            "parcialmente_cumprida",
            "vencida",
            "renegociada",
            "cancelada",
          ])
          .default("aguardando"),
        valorRecebido: z.number().min(0).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      cliente_id: data.clienteId,
      cobranca_id: data.cobrancaId ?? null,
      valor_prometido: data.valorPrometido,
      data_prometida: data.dataPrometida,
      forma_pagamento: data.formaPagamento ?? null,
      observacoes: data.observacoes ?? null,
      status: data.status,
      valor_recebido: data.valorRecebido,
      registrado_por: context.userId,
      registrado_por_email: (context.claims as any)?.email ?? null,
      resolvida_em: data.status === "aguardando" ? null : new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("promessas_pagamento")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("promessas_pagamento")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });
