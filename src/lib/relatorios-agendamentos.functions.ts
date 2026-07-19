import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DestinatarioSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  whatsapp: z.string().trim().regex(/^\+?\d{10,15}$/, "WhatsApp inválido"),
});

export const KPIS_DISPONIVEIS = [
  { id: "faturamento", label: "Faturamento" },
  { id: "atendimentos", label: "Atendimentos (quantidade)" },
  { id: "ticket", label: "Ticket médio" },
  { id: "clientes", label: "Clientes atendidos" },
  { id: "leva_traz", label: "Leva e traz (taxas)" },
  { id: "a_receber", label: "A receber" },
  { id: "atraso", label: "Valor em atraso" },
] as const;

const KpiIdSchema = z.enum([
  "faturamento", "atendimentos", "ticket", "clientes", "leva_traz", "a_receber", "atraso",
]);

export type KpiId = z.infer<typeof KpiIdSchema>;

const AgendamentoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(80),
  hora_envio: z.string().regex(/^\d{2}:\d{2}$/),
  destinatarios: z.array(DestinatarioSchema).min(1).max(20),
  ativo: z.boolean().default(true),
  kpis: z.array(KpiIdSchema).min(1).max(10),
  titulo_mensagem: z.string().trim().max(120).optional().nullable(),
  rodape_mensagem: z.string().trim().max(300).optional().nullable(),
});

export type AgendamentoDTO = {
  id: string;
  nome: string;
  hora_envio: string;
  destinatarios: Array<{ nome: string; whatsapp: string }>;
  ativo: boolean;
  ultima_execucao: string | null;
  kpis: KpiId[];
  titulo_mensagem: string | null;
  rodape_mensagem: string | null;
};

export type ExecucaoDTO = {
  id: string;
  agendamento_id: string | null;
  agendamento_nome: string;
  destinatario_nome: string;
  destinatario_whatsapp: string;
  periodo_de: string;
  periodo_ate: string;
  mensagem: string;
  wa_url: string;
  gerado_em: string;
  enviado_em: string | null;
};

const sel = (s: string): string => s;

export const listarAgendamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("relatorios_agendamentos")
      .select(sel("id, nome, hora_envio, destinatarios, ativo, ultima_execucao, kpis, titulo_mensagem, rodape_mensagem"))
      .order("created_at", { ascending: false })
      .returns<AgendamentoDTO[]>();
    if (error) throw new Error("Falha ao carregar agendamentos");
    return { itens: data ?? [] };
  });

export const salvarAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AgendamentoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      nome: data.nome,
      hora_envio: data.hora_envio,
      destinatarios: data.destinatarios,
      ativo: data.ativo,
      kpis: data.kpis,
      titulo_mensagem: data.titulo_mensagem ?? null,
      rodape_mensagem: data.rodape_mensagem ?? null,
      criado_por: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("relatorios_agendamentos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error("Falha ao atualizar agendamento");
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("relatorios_agendamentos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error("Falha ao criar agendamento");
    return { id: ins.id as string };
  });

export const excluirAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("relatorios_agendamentos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Falha ao excluir agendamento");
    return { ok: true };
  });

export const listarExecucoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      apenasPendentes: z.boolean().optional().default(false),
      limit: z.number().int().min(1).max(200).optional().default(100),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("relatorios_execucoes")
      .select(
        sel(
          "id, agendamento_id, agendamento_nome, destinatario_nome, destinatario_whatsapp, periodo_de, periodo_ate, mensagem, wa_url, gerado_em, enviado_em"
        )
      )
      .order("gerado_em", { ascending: false })
      .limit(data.limit);
    if (data.apenasPendentes) q = q.is("enviado_em", null);
    const { data: rows, error } = await q.returns<ExecucaoDTO[]>();
    if (error) throw new Error("Falha ao carregar histórico");
    return { itens: rows ?? [] };
  });

export const marcarExecucaoEnviada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      observacao: z.string().max(300).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { error } = await supabase
      .from("relatorios_execucoes")
      .update({
        enviado_em: new Date().toISOString(),
        enviado_por: userId,
        observacao: data.observacao ?? null,
      })
      .eq("id", data.id)
      .is("enviado_em", null);
    if (error) throw new Error("Falha ao registrar envio");
    return { ok: true };
  });

// Gera execuções pendentes agora (usado no cron ou por botão manual)
export const gerarExecucoesAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await gerarExecucoesInterno(context.supabase);
    return r;
  });

// Núcleo compartilhado com o cron
export async function gerarExecucoesInterno(supabase: any) {
  // Data de referência = "ontem" no fuso de São Paulo (UTC-3)
  const now = new Date();
  const spOffsetMs = -3 * 60 * 60 * 1000;
  const spNow = new Date(now.getTime() + spOffsetMs);
  const ontem = new Date(spNow);
  ontem.setUTCDate(spNow.getUTCDate() - 1);
  const dia = ontem.toISOString().slice(0, 10);
  const hojeSp = spNow.toISOString().slice(0, 10);

  // Agendamentos ativos que ainda não rodaram hoje
  const { data: agends, error } = await supabase
    .from("relatorios_agendamentos")
    .select("id, nome, hora_envio, destinatarios, ultima_execucao, ativo, kpis, titulo_mensagem, rodape_mensagem")
    .eq("ativo", true);
  if (error) throw new Error(error.message);

  const horaAtual = spNow.toISOString().slice(11, 16); // HH:MM UTC-3
  const inseridos: string[] = [];

  for (const a of agends ?? []) {
    if (a.ultima_execucao === hojeSp) continue;
    if (a.hora_envio > horaAtual) continue; // ainda não chegou o horário

    // Faturamento e KPIs do dia anterior
    const deIso = `${dia}T00:00:00.000Z`;
    const ateIso = `${dia}T23:59:59.999Z`;
    const { data: rows } = await supabase
      .from("atendimentos")
      .select("valor_executado, cliente_id, taxa_leva_traz")
      .gte("encerrado_em", deIso)
      .lte("encerrado_em", ateIso)
      .not("encerrado_em", "is", null);

    const linhas = (rows ?? []) as Array<{ valor_executado: number; cliente_id: string | null; taxa_leva_traz: number }>;
    const faturamento = linhas.reduce((s, r) => s + Number(r.valor_executado ?? 0), 0);
    const taxaLT = linhas.reduce((s, r) => s + Number(r.taxa_leva_traz ?? 0), 0);
    const qtd = linhas.length;
    const ticket = qtd ? faturamento / qtd : 0;
    const clientes = new Set(linhas.map((r) => r.cliente_id).filter(Boolean)).size;

    const { data: pag } = await supabase
      .from("pagamentos")
      .select("valor_total, valor_pago, vencimento, status")
      .in("status", ["pendente", "parcial", "atrasado"]);
    const linhasPag = (pag ?? []) as Array<{ valor_total: number; valor_pago: number; vencimento: string | null }>;
    const aReceber = linhasPag.reduce(
      (s, p) => s + Math.max(0, Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)),
      0
    );
    const atraso = linhasPag
      .filter((p) => p.vencimento && p.vencimento < hojeSp)
      .reduce((s, p) => s + Math.max(0, Number(p.valor_total ?? 0) - Number(p.valor_pago ?? 0)), 0);

    const brl = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const diaFmt = new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR");

    const kpisSel: string[] = Array.isArray(a.kpis) && a.kpis.length
      ? a.kpis
      : ["faturamento", "atendimentos", "ticket", "clientes", "leva_traz", "a_receber"];

    const linhaKpi = (id: string): string | null => {
      switch (id) {
        case "faturamento": return `• Faturamento: ${brl(faturamento)}`;
        case "atendimentos": return `• Atendimentos: ${qtd}`;
        case "ticket": return `• Ticket médio: ${brl(ticket)}`;
        case "clientes": return `• Clientes atendidos: ${clientes}`;
        case "leva_traz": return `• Leva e traz: ${brl(taxaLT)}`;
        case "a_receber": return `• A receber: ${brl(aReceber)}`;
        case "atraso": return `• Valor em atraso: ${brl(atraso)}`;
        default: return null;
      }
    };

    const titulo = (a.titulo_mensagem?.trim())
      || `Spa da Tia Jéssica — Relatório diário (${diaFmt})`;
    const rodape = (a.rodape_mensagem?.trim()) || "Detalhes completos no painel. 🐾";

    for (const d of (a.destinatarios ?? []) as Array<{ nome: string; whatsapp: string }>) {
      const blocoKpis = kpisSel.map(linhaKpi).filter((s): s is string => !!s).join("\n");
      const mensagem =
        `*${titulo}*\n\n` +
        `Olá, ${d.nome}! Segue o resumo do dia:\n\n` +
        `${blocoKpis}\n\n` +
        `${rodape}`;

      const fone = d.whatsapp.replace(/\D/g, "");
      const wa_url = `https://wa.me/${fone.startsWith("55") ? fone : `55${fone}`}?text=${encodeURIComponent(mensagem)}`;

      const { error: insErr } = await supabase
        .from("relatorios_execucoes")
        .insert({
          agendamento_id: a.id,
          agendamento_nome: a.nome,
          destinatario_nome: d.nome,
          destinatario_whatsapp: d.whatsapp,
          periodo_de: dia,
          periodo_ate: dia,
          mensagem,
          wa_url,
        });
      // ignora conflito de unique (idempotência)
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
        console.error("[relatorios] insert execução:", insErr.message);
      } else if (!insErr) {
        inseridos.push(`${a.nome}→${d.nome}`);
      }
    }

    await supabase
      .from("relatorios_agendamentos")
      .update({ ultima_execucao: hojeSp })
      .eq("id", a.id);
  }

  return { inseridos, total: inseridos.length };
}
