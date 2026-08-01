import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TipoEnum = z.enum([
  // legado
  "confirmacao_agendamento",
  "lembrete_atendimento",
  "aviso_atraso",
  "pet_pronto",
  "agradecimento",
  "solicitacao_avaliacao",
  "recomendacao_retorno",
  "reativacao_cliente",
  "lembrete_pagamento",
  "cobranca_vencida",
  "confirmacao_pagamento",
  "parabens_cliente",
  "aniversario_pet",
  "personalizada",
  // novos (comunicação e IA v2)
  "lembrete_agendamento",
  "pos_atendimento",
  "vacina_vencendo",
  "cobranca_pendente",
  "reagendamento",
  "boas_vindas",
  "pesquisa_satisfacao",
  "promocao",
  "reengajamento",
]);

const StatusEnum = z.enum([
  "aberto",
  "enviado",
  "respondeu",
  "sem_resposta",
  "promessa",
  "pago",
]);

const AberturaSchema = z.object({
  tipo: TipoEnum,
  destinatario: z.string().trim().min(1).max(120),
  telefone: z.string().trim().min(1).max(20),
  mensagem: z.string().trim().min(1).max(3500),
  motivo: z.string().trim().max(200).optional().nullable(),
  cliente_id: z.string().uuid().optional().nullable(),
  atendimento_id: z.string().uuid().optional().nullable(),
  pagamento_id: z.string().uuid().optional().nullable(),
  cobranca_id: z.string().uuid().optional().nullable(),
});

export const registrarAberturaWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AberturaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ins, error } = await supabase
      .from("whatsapp_contatos")
      .insert({
        user_id: userId,
        tipo: data.tipo,
        destinatario: data.destinatario,
        telefone: data.telefone,
        mensagem: data.mensagem,
        motivo: data.motivo ?? null,
        status: "aberto",
        cliente_id: data.cliente_id ?? null,
        atendimento_id: data.atendimento_id ?? null,
        pagamento_id: data.pagamento_id ?? null,
        cobranca_id: data.cobranca_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error("Falha ao registrar abertura");

    // Também alimenta a Central de Mensagens (inbox unificada)
    if (data.cliente_id) {
      await supabase.from("mensagens").insert({
        cliente_id: data.cliente_id,
        direcao: "out",
        canal: "whatsapp",
        corpo: data.mensagem,
        status: "enviada",
        autor_id: userId,
        atendimento_id: data.atendimento_id ?? null,
        pagamento_id: data.pagamento_id ?? null,
        cobranca_id: data.cobranca_id ?? null,
        tipo: data.tipo,
        tags: [data.tipo],
        metadata: { destinatario: data.destinatario, telefone: data.telefone },
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
        enviado_em: new Date().toISOString(),
        contexto_ia: { origem: "envio_documento", aprovacao: "clique_humano" },
      });
    return { id: ins.id as string };
  });

export const atualizarStatusWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: StatusEnum,
        observacao: z.string().max(300).optional().nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_contatos")
      .update({
        status: data.status,
        marcado_em: new Date().toISOString(),
        observacao: data.observacao ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error("Falha ao atualizar status");
    return { ok: true };
  });

export type HistoricoItem = {
  id: string;
  created_at: string;
  tipo: string;
  destinatario: string;
  telefone: string;
  mensagem: string;
  motivo: string | null;
  status: string;
  marcado_em: string | null;
  cliente_id: string | null;
  atendimento_id: string | null;
  pagamento_id: string | null;
  cobranca_id: string | null;
};

export const listarHistoricoWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid().optional().nullable(),
        atendimento_id: z.string().uuid().optional().nullable(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("whatsapp_contatos")
      .select(
        "id, created_at, tipo, destinatario, telefone, mensagem, motivo, status, marcado_em, cliente_id, atendimento_id, pagamento_id, cobranca_id"
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    if (data.atendimento_id) q = q.eq("atendimento_id", data.atendimento_id);
    const { data: rows, error } = await q.returns<HistoricoItem[]>();
    if (error) throw new Error("Falha ao carregar histórico");
    return { itens: rows ?? [] };
  });
