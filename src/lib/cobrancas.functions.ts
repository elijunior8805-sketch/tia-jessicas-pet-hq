import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============= Types =============
export type CobrancaStatus =
  | "a_vencer"
  | "vencido"
  | "enviada"
  | "respondeu"
  | "promessa"
  | "pago_parcial"
  | "pago"
  | "negociado"
  | "sem_retorno"
  | "pausada";

export type CobrancaDTO = {
  id: string;
  pagamento_id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_whatsapp: string | null;
  atendimento_id: string | null;
  pet_nome: string | null;
  data_atendimento: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number;
  vencimento: string;
  dias_atraso: number;
  status: CobrancaStatus;
  promessa_data: string | null;
  tentativas: number;
  ultima_cobranca_em: string | null;
  pausada: boolean;
  pausada_motivo: string | null;
};

export type CobrancasKPIs = {
  total_atraso: number;
  qtd_inadimplentes: number;
  vence_hoje: number;
  atraso_maior_7d: number;
  recuperado_mes: number;
  taxa_recuperacao: number; // 0..1
};

// ============= Helpers =============
function diasAtraso(vencimento: string): number {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const v = new Date(vencimento + "T00:00:00Z").getTime();
  const diff = Math.floor((hoje.getTime() - v) / 86400000);
  return diff > 0 ? diff : 0;
}

function primeiroNome(v: string | null | undefined) {
  return (v ?? "").trim().split(/\s+/)[0] ?? "";
}

// ============= List =============
const ListSchema = z.object({
  status: z.array(z.string()).optional(),
  clienteNome: z.string().optional().nullable(),
  atrasoFaixa: z.enum(["todos", "0_3", "4_7", "8_15", "15p"]).optional().default("todos"),
  valorMin: z.number().optional().nullable(),
  valorMax: z.number().optional().nullable(),
  vencimentoDe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  vencimentoAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

export const listarCobrancas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let q = supabase
      .from("cobrancas")
      .select(
        `id, pagamento_id, cliente_id, atendimento_id, valor_original, valor_pago, saldo,
         vencimento, status, promessa_data, tentativas, ultima_cobranca_em, pausada, pausada_motivo,
         clientes:cliente_id ( nome, whatsapp ),
         atendimentos:atendimento_id ( data_inicio, pets:pet_id ( nome ) )`,
      )
      .is("arquivada_em", null)
      .order("vencimento", { ascending: true })
      .limit(data.limit);

    if (data.status && data.status.length > 0) q = q.in("status", data.status as any);
    if (data.vencimentoDe) q = q.gte("vencimento", data.vencimentoDe);
    if (data.vencimentoAte) q = q.lte("vencimento", data.vencimentoAte);
    if (data.valorMin != null) q = q.gte("saldo", data.valorMin);
    if (data.valorMax != null) q = q.lte("saldo", data.valorMax);

    const { data: rows, error } = await q;
    if (error) {
      console.error("[cobrancas] listar erro:", error.message);
      throw new Error("Não foi possível carregar as cobranças");
    }

    const nome = (data.clienteNome ?? "").trim().toLowerCase();

    const itens: CobrancaDTO[] = (rows ?? [])
      .map((r: any) => {
        const dias = diasAtraso(r.vencimento);
        return {
          id: r.id,
          pagamento_id: r.pagamento_id,
          cliente_id: r.cliente_id,
          cliente_nome: r.clientes?.nome ?? "—",
          cliente_whatsapp: r.clientes?.whatsapp ?? null,
          atendimento_id: r.atendimento_id,
          pet_nome: r.atendimentos?.pets?.nome ?? null,
          data_atendimento: r.atendimentos?.data_inicio ?? null,
          valor_original: Number(r.valor_original ?? 0),
          valor_pago: Number(r.valor_pago ?? 0),
          saldo: Number(r.saldo ?? 0),
          vencimento: r.vencimento,
          dias_atraso: dias,
          status: r.status as CobrancaStatus,
          promessa_data: r.promessa_data,
          tentativas: r.tentativas ?? 0,
          ultima_cobranca_em: r.ultima_cobranca_em,
          pausada: !!r.pausada,
          pausada_motivo: r.pausada_motivo,
        } satisfies CobrancaDTO;
      })
      .filter((c) => (nome ? c.cliente_nome.toLowerCase().includes(nome) : true))
      .filter((c) => {
        switch (data.atrasoFaixa) {
          case "0_3":
            return c.dias_atraso >= 0 && c.dias_atraso <= 3;
          case "4_7":
            return c.dias_atraso >= 4 && c.dias_atraso <= 7;
          case "8_15":
            return c.dias_atraso >= 8 && c.dias_atraso <= 15;
          case "15p":
            return c.dias_atraso > 15;
          default:
            return true;
        }
      });

    return itens;
  });

// ============= KPIs =============
export const kpisCobrancas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const hoje = new Date();
    const iso = hoje.toISOString().slice(0, 10);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);

    const [abertas, recuperadas] = await Promise.all([
      supabase
        .from("cobrancas")
        .select("saldo, vencimento, status")
        .is("arquivada_em", null)
        .not("status", "in", "(pago)")
        .gt("saldo", 0),
      supabase
        .from("cobrancas")
        .select("valor_original, updated_at")
        .is("arquivada_em", null)
        .eq("status", "pago")
        .gte("updated_at", inicioMes),
    ]);

    if (abertas.error) throw new Error(abertas.error.message);
    if (recuperadas.error) throw new Error(recuperadas.error.message);

    let total_atraso = 0;
    let qtd_inadimplentes = 0;
    let vence_hoje = 0;
    let atraso_maior_7d = 0;

    for (const c of abertas.data ?? []) {
      const dias = diasAtraso(c.vencimento as string);
      if (dias > 0) {
        total_atraso += Number(c.saldo);
        qtd_inadimplentes += 1;
      }
      if ((c.vencimento as string) === iso) vence_hoje += 1;
      if (dias > 7) atraso_maior_7d += Number(c.saldo);
    }

    const recuperado_mes = (recuperadas.data ?? []).reduce(
      (s: number, r: any) => s + Number(r.valor_original ?? 0),
      0,
    );
    const total_cobrado_periodo = recuperado_mes + total_atraso;
    const taxa_recuperacao = total_cobrado_periodo > 0 ? recuperado_mes / total_cobrado_periodo : 0;

    const kpis: CobrancasKPIs = {
      total_atraso,
      qtd_inadimplentes,
      vence_hoje,
      atraso_maior_7d,
      recuperado_mes,
      taxa_recuperacao,
    };
    return kpis;
  });

// ============= Historico =============
export const historicoCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cobrancaId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cobrancas_eventos")
      .select("id, tipo, canal, usuario_email, payload, created_at")
      .eq("cobranca_id", data.cobrancaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============= Ações =============
async function logEvento(
  supabase: any,
  cobranca_id: string,
  tipo: string,
  payload: Record<string, unknown>,
  canal?: string,
  usuario_email?: string | null,
) {
  await supabase.from("cobrancas_eventos").insert({
    cobranca_id,
    tipo,
    canal: canal ?? null,
    usuario_email: usuario_email ?? null,
    payload,
  });
}

export const registrarEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        cobrancaId: z.string().uuid(),
        mensagem: z.string().min(1).max(2000),
        canal: z.enum(["whatsapp", "outro"]).default("whatsapp"),
        automatico: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    const now = new Date().toISOString();

    const { data: cob, error: eSel } = await supabase
      .from("cobrancas")
      .select("id, status, tentativas")
      .eq("id", data.cobrancaId)
      .maybeSingle();
    if (eSel || !cob) throw new Error("Cobrança não encontrada");

    const novoStatus = cob.status === "pago" ? cob.status : "enviada";

    const { error: eUpd } = await supabase
      .from("cobrancas")
      .update({
        tentativas: (cob.tentativas ?? 0) + 1,
        ultima_cobranca_em: now,
        status: novoStatus,
      })
      .eq("id", data.cobrancaId);
    if (eUpd) throw new Error(eUpd.message);

    await logEvento(
      supabase,
      data.cobrancaId,
      data.automatico ? "envio_auto" : "envio_manual",
      { mensagem: data.mensagem },
      data.canal,
      claims?.email ?? null,
    );

    return { ok: true };
  });

export const registrarPromessa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        cobrancaId: z.string().uuid(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        nota: z.string().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    const { error } = await supabase
      .from("cobrancas")
      .update({ promessa_data: data.data, status: "promessa" })
      .eq("id", data.cobrancaId);
    if (error) throw new Error(error.message);
    await logEvento(
      supabase,
      data.cobrancaId,
      "promessa",
      { data: data.data, nota: data.nota ?? null },
      undefined,
      claims?.email ?? null,
    );
    return { ok: true };
  });

export const alterarStatusCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        cobrancaId: z.string().uuid(),
        status: z.enum([
          "a_vencer",
          "vencido",
          "enviada",
          "respondeu",
          "promessa",
          "pago_parcial",
          "pago",
          "negociado",
          "sem_retorno",
          "pausada",
        ]),
        nota: z.string().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    const { error } = await supabase
      .from("cobrancas")
      .update({ status: data.status })
      .eq("id", data.cobrancaId);
    if (error) throw new Error(error.message);
    await logEvento(
      supabase,
      data.cobrancaId,
      "mudanca_status",
      { status: data.status, nota: data.nota ?? null },
      undefined,
      claims?.email ?? null,
    );
    return { ok: true };
  });

export const pausarCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        cobrancaId: z.string().uuid(),
        pausar: z.boolean(),
        motivo: z.string().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    const { error } = await supabase
      .from("cobrancas")
      .update({
        pausada: data.pausar,
        pausada_motivo: data.pausar ? data.motivo ?? null : null,
        status: data.pausar ? "pausada" : "vencido",
      })
      .eq("id", data.cobrancaId);
    if (error) throw new Error(error.message);
    await logEvento(
      supabase,
      data.cobrancaId,
      data.pausar ? "pausa" : "retomada",
      { motivo: data.motivo ?? null },
      undefined,
      claims?.email ?? null,
    );
    return { ok: true };
  });

export const marcarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        cobrancaId: z.string().uuid(),
        valor: z.number().positive(),
        integral: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;

    const { data: cob, error: eSel } = await supabase
      .from("cobrancas")
      .select("id, pagamento_id, valor_original, valor_pago")
      .eq("id", data.cobrancaId)
      .maybeSingle();
    if (eSel || !cob) throw new Error("Cobrança não encontrada");

    const total = Number(cob.valor_original ?? 0);
    const pagoAntes = Number(cob.valor_pago ?? 0);
    const pagoDepois = data.integral ? total : Math.min(total, pagoAntes + data.valor);

    const { error: eUpdPag } = await supabase
      .from("pagamentos")
      .update({
        valor_pago: pagoDepois,
        status: pagoDepois >= total ? "pago" : "parcial",
        data_pagamento: pagoDepois >= total ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", cob.pagamento_id);
    if (eUpdPag) throw new Error(eUpdPag.message);

    // O trigger sync_cobranca_from_pagamento cuida da linha de cobrança.
    await logEvento(
      supabase,
      data.cobrancaId,
      "pagamento",
      { valor: pagoDepois - pagoAntes, integral: data.integral, total_pago: pagoDepois },
      undefined,
      claims?.email ?? null,
    );

    return { ok: true, total_pago: pagoDepois };
  });

// ============= IA =============
const IAInput = z.object({
  cobrancaId: z.string().uuid(),
  intencao: z
    .enum(["cobranca", "lembrete", "agradecimento", "negociacao", "resposta"])
    .default("cobranca"),
  respostaCliente: z.string().max(2000).optional().nullable(),
});

export const sugerirMensagemCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IAInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;


    const { data: cob, error } = await supabase
      .from("cobrancas")
      .select(
        `id, valor_original, valor_pago, saldo, vencimento, status, tentativas,
         clientes:cliente_id ( nome ),
         atendimentos:atendimento_id ( data_inicio, pets:pet_id ( nome ) )`,
      )
      .eq("id", data.cobrancaId)
      .maybeSingle();
    if (error || !cob) throw new Error("Cobrança não encontrada");

    const cliente = (cob as any).clientes?.nome ?? "cliente";
    const pet = (cob as any).atendimentos?.pets?.nome ?? "seu pet";
    const dataAtend = (cob as any).atendimentos?.data_inicio
      ? new Date((cob as any).atendimentos.data_inicio).toLocaleDateString("pt-BR")
      : "";
    const venc = new Date((cob as any).vencimento + "T00:00:00Z").toLocaleDateString("pt-BR");
    const dias = diasAtraso((cob as any).vencimento);
    const valor = Number((cob as any).saldo).toFixed(2).replace(".", ",");

    // Config pix
    const { data: cfg } = await supabase
      .from("cobrancas_config")
      .select("pix_chave, pix_tipo")
      .maybeSingle();

    const intencaoPrompt: Record<string, string> = {
      cobranca: `cobrança de pagamento pendente há ${dias} dia(s)`,
      lembrete: "lembrete gentil de vencimento próximo",
      agradecimento: "agradecimento por pagamento recebido",
      negociacao: "proposta amigável de negociação/parcelamento",
      resposta: "resposta empática à mensagem recebida do cliente",
    };

    const prompt = `Você é a assistente de relacionamento do "Spa de Pet Tia Jéssica".
Gere UMA mensagem curta de WhatsApp (máx. 5 linhas, em português do Brasil) para ${intencaoPrompt[data.intencao]}.

Dados:
- Cliente (tutor): ${primeiroNome(cliente) || cliente}
- Pet: ${pet}
- Data do atendimento: ${dataAtend || "(não informada)"}
- Valor pendente: R$ ${valor}
- Vencimento: ${venc}
- Tentativas anteriores: ${(cob as any).tentativas ?? 0}
- Chave Pix da empresa: ${cfg?.pix_chave ?? "(não configurada)"} (${cfg?.pix_tipo ?? ""})
${data.respostaCliente ? `- Mensagem recebida do cliente: "${data.respostaCliente}"` : ""}

Regras obrigatórias:
- Tom sempre cordial, humano e respeitoso. Jamais agressivo, ameaçador ou constrangedor.
- Nunca diga "inadimplente", "devedor", "atrasado grave", "negativação", "protesto".
- Diga que, se já pagou, é só desconsiderar.
- Se houver chave Pix configurada, ofereça-a naturalmente.
- Use no máximo 1 emoji sutil (🐾 ou 💛). Nunca mais de um.
- Não invente valores, datas ou serviços que não estejam nos dados acima.
- Devolva SOMENTE o texto puro da mensagem, sem markdown, aspas ou prefixos.`;

    const { chamarIATexto, carregarIaConfig } = await import("./ia-core.server");
    const iaConfig = await carregarIaConfig(supabase);
    const r = await chamarIATexto({
      system:
        "Você redige mensagens curtas, cordiais e humanas de cobrança amigável para um pet shop premium. Nunca use tom agressivo.",
      prompt,
      config: iaConfig,
      origem: `cobranca:${data.intencao}`,
      sb: supabase,
    });
    const texto = r.texto;
    if (!texto) throw new Error("A IA não retornou texto.");

    await logEvento(supabase, data.cobrancaId, "ia_sugestao", {
      intencao: data.intencao,
      modelo: r.modelo,
      preview: texto.slice(0, 200),
    });

    return { mensagem: texto, modelo: r.modelo };

  });

// ============= Config e templates =============
export const obterConfigCobranca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [cfg, tpl] = await Promise.all([
      supabase.from("cobrancas_config").select("*").maybeSingle(),
      supabase.from("cobrancas_templates").select("*").order("ordem"),
    ]);
    if (cfg.error) throw new Error(cfg.error.message);
    if (tpl.error) throw new Error(tpl.error.message);
    return { config: cfg.data, templates: tpl.data ?? [] };
  });

export const salvarConfigCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        modo: z.enum(["manual", "auto", "pausado"]),
        nao_repetir_no_dia: z.boolean(),
        pix_chave: z.string().max(200).optional().nullable(),
        pix_tipo: z.string().max(40).optional().nullable(),
        horario_envio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem alterar a régua");

    const { error } = await supabase
      .from("cobrancas_config")
      .update({
        modo: data.modo,
        nao_repetir_no_dia: data.nao_repetir_no_dia,
        pix_chave: data.pix_chave ?? null,
        pix_tipo: data.pix_tipo ?? null,
        horario_envio: data.horario_envio ? `${data.horario_envio}:00` : undefined,
      })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarTemplateCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().min(1).max(120),
        corpo: z.string().min(10).max(4000),
        ativo: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cobrancas_templates")
      .update({ titulo: data.titulo, corpo: data.corpo, ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Preencher template =============
export function renderTemplate(
  corpo: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return corpo.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    if (v == null || v === "") return "";
    return String(v);
  });
}

// ============= Registrar resposta recebida do cliente =============
export type RespostaIntencao =
  | "pagou"
  | "promessa"
  | "negociar"
  | "contestou"
  | "sem_intencao";

const RespostaSchema = z.object({
  cobrancaId: z.string().uuid(),
  texto: z.string().min(1).max(2000),
  intencao: z
    .enum(["pagou", "promessa", "negociar", "contestou", "sem_intencao", "auto"])
    .default("auto"),
  promessaData: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  valorPago: z.number().positive().optional().nullable(),
  canal: z.enum(["whatsapp", "outro"]).default("whatsapp"),
});

function detectarIntencao(texto: string): {
  intencao: RespostaIntencao;
  promessaData: string | null;
} {
  const t = texto.toLowerCase();
  const pagou =
    /\b(paguei|pago|quitei|transferi|pix\s*enviado|comprovante|acabei\s*de\s*pagar|ja\s*paguei|já\s*paguei)\b/.test(
      t,
    );
  const negociar = /\b(parcel|negoci|desconto|dividir|abater|abatimento)\b/.test(t);
  const contestou =
    /\b(nao\s*reconhec|não\s*reconhec|nao\s*devo|não\s*devo|indevid|cobrança\s*errada|errado|engano)\b/.test(
      t,
    );

  // Detecta data de promessa (dd/mm, dd/mm/aaaa, "amanhã", "sexta")
  let promessa: string | null = null;
  const m = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m) {
    const d = String(m[1]).padStart(2, "0");
    const mo = String(m[2]).padStart(2, "0");
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(new Date().getFullYear());
    const cand = `${y}-${mo}-${d}`;
    if (!isNaN(new Date(cand).getTime())) promessa = cand;
  } else if (/\bamanh[ãa]\b/.test(t)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    promessa = d.toISOString().slice(0, 10);
  } else if (/\bhoje\b/.test(t)) {
    promessa = new Date().toISOString().slice(0, 10);
  }

  const promete =
    !!promessa ||
    /\b(prometo|pago\s*(amanh|dia|at[eé])|at[eé]\s*(sexta|amanh|segunda|ter[cç]a|quarta|quinta|s[aá]bado|domingo)|semana\s*que\s*vem|proxima\s*semana|próxima\s*semana|dia\s*\d{1,2})\b/.test(
      t,
    );

  if (pagou) return { intencao: "pagou", promessaData: promessa };
  if (contestou) return { intencao: "contestou", promessaData: promessa };
  if (negociar) return { intencao: "negociar", promessaData: promessa };
  if (promete) return { intencao: "promessa", promessaData: promessa };
  return { intencao: "sem_intencao", promessaData: promessa };
}

export const registrarRespostaCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RespostaSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;

    const { data: cob, error: eSel } = await supabase
      .from("cobrancas")
      .select("id, pagamento_id, valor_original, valor_pago, saldo, status")
      .eq("id", data.cobrancaId)
      .maybeSingle();
    if (eSel || !cob) throw new Error("Cobrança não encontrada");

    // Determina intenção (manual ou heurística)
    const auto = data.intencao === "auto";
    const detectada = detectarIntencao(data.texto);
    const intencao: RespostaIntencao = auto
      ? detectada.intencao
      : (data.intencao as RespostaIntencao);
    const promessaData = data.promessaData ?? detectada.promessaData;

    // 1) Log da resposta recebida (histórico)
    await logEvento(
      supabase,
      data.cobrancaId,
      "resposta_cliente",
      {
        texto: data.texto,
        intencao,
        auto,
        promessa_data: promessaData ?? null,
        valor_pago: data.valorPago ?? null,
      },
      data.canal,
      claims?.email ?? null,
    );

    // 2) Efeitos colaterais conforme intenção
    if (intencao === "pagou") {
      const total = Number(cob.valor_original ?? 0);
      const pagoAntes = Number(cob.valor_pago ?? 0);
      const integral = data.valorPago == null || data.valorPago >= Number(cob.saldo ?? 0);
      const pagoDepois = integral ? total : Math.min(total, pagoAntes + (data.valorPago ?? 0));
      const { error: eUpdPag } = await supabase
        .from("pagamentos")
        .update({
          valor_pago: pagoDepois,
          status: pagoDepois >= total ? "pago" : "parcial",
          data_pagamento:
            pagoDepois >= total ? new Date().toISOString().slice(0, 10) : null,
        })
        .eq("id", cob.pagamento_id);
      if (eUpdPag) throw new Error(eUpdPag.message);
      await logEvento(
        supabase,
        data.cobrancaId,
        "pagamento",
        {
          valor: pagoDepois - pagoAntes,
          integral,
          total_pago: pagoDepois,
          origem: "resposta_cliente",
        },
        undefined,
        claims?.email ?? null,
      );
      return { ok: true, intencao, promessaData: null };
    }

    if (intencao === "promessa") {
      const alvo =
        promessaData ??
        (() => {
          const d = new Date();
          d.setDate(d.getDate() + 3);
          return d.toISOString().slice(0, 10);
        })();
      const { error } = await supabase
        .from("cobrancas")
        .update({ promessa_data: alvo, status: "promessa" })
        .eq("id", data.cobrancaId);
      if (error) throw new Error(error.message);
      return { ok: true, intencao, promessaData: alvo };
    }

    if (intencao === "negociar") {
      const { error } = await supabase
        .from("cobrancas")
        .update({ status: "negociado" })
        .eq("id", data.cobrancaId);
      if (error) throw new Error(error.message);
      return { ok: true, intencao, promessaData: null };
    }

    if (intencao === "contestou") {
      // Pausa cordialmente para revisão humana
      const { error } = await supabase
        .from("cobrancas")
        .update({
          status: "pausada",
          pausada: true,
          pausada_motivo: "Cliente contestou — revisar",
        })
        .eq("id", data.cobrancaId);
      if (error) throw new Error(error.message);
      return { ok: true, intencao, promessaData: null };
    }

    // sem_intencao → apenas marca que respondeu
    if (cob.status !== "pago") {
      await supabase
        .from("cobrancas")
        .update({ status: "respondeu" })
        .eq("id", data.cobrancaId);
    }
    return { ok: true, intencao, promessaData: null };
  });


// ============= Fila do Dia (priorização inteligente) =============
export type FilaGatilho =
  | "promessa_vencida"
  | "d_menos_3"
  | "d_menos_1"
  | "d_zero"
  | "d_mais_3"
  | "d_mais_7"
  | "d_mais_15"
  | "atraso_longo"
  | "sem_retorno";

export type FilaItem = CobrancaDTO & {
  gatilho: FilaGatilho;
  gatilho_label: string;
  score: number;
  promessa_data: string | null;
};

const GATILHO_LABEL: Record<FilaGatilho, string> = {
  promessa_vencida: "Promessa vencida",
  d_menos_3: "Lembrete D-3",
  d_menos_1: "Lembrete D-1",
  d_zero: "Vence hoje",
  d_mais_3: "1ª cobrança (D+3)",
  d_mais_7: "2ª cobrança (D+7)",
  d_mais_15: "Última régua (D+15)",
  atraso_longo: "Atraso > 15 dias",
  sem_retorno: "Sem retorno",
};

function classificarGatilho(
  dias: number,
  status: CobrancaStatus,
  promessaData: string | null,
  hojeIso: string,
): FilaGatilho | null {
  if (status === "pago" || status === "pausada" || status === "negociado") return null;
  if (status === "promessa" && promessaData && promessaData < hojeIso) return "promessa_vencida";
  if (status === "sem_retorno") return "sem_retorno";
  if (dias === -3) return "d_menos_3";
  if (dias === -1) return "d_menos_1";
  if (dias === 0) return "d_zero";
  if (dias === 3) return "d_mais_3";
  if (dias >= 6 && dias <= 8) return "d_mais_7";
  if (dias >= 13 && dias <= 16) return "d_mais_15";
  if (dias > 15) return "atraso_longo";
  return null;
}

/** Score = saldo × log(1+dias) × penalidade por tentativas (satura em 5). */
function calcularScore(saldo: number, dias: number, tentativas: number, gatilho: FilaGatilho): number {
  const diasEfetivos = Math.max(1, dias);
  const base = saldo * Math.log(1 + diasEfetivos);
  const penalidade = 1 / (1 + Math.min(tentativas, 5) * 0.15);
  const boost =
    gatilho === "promessa_vencida" ? 1.6 :
    gatilho === "atraso_longo" ? 1.3 :
    gatilho === "d_mais_7" || gatilho === "d_mais_15" ? 1.1 :
    1;
  return Math.round(base * penalidade * boost);
}

export const filaDoDia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const hoje = new Date();
    const iso = hoje.toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("cobrancas")
      .select(
        `id, pagamento_id, cliente_id, atendimento_id, valor_original, valor_pago, saldo,
         vencimento, status, promessa_data, tentativas, ultima_cobranca_em, pausada, pausada_motivo,
         clientes:cliente_id ( nome, whatsapp ),
         atendimentos:atendimento_id ( data_inicio, pets:pet_id ( nome ) )`,
      )
      .is("arquivada_em", null)
      .eq("pausada", false)
      .not("status", "eq", "pago")
      .gt("saldo", 0)
      .limit(500);

    if (error) throw new Error(error.message);

    const itens: FilaItem[] = [];
    for (const r of rows ?? []) {
      const dias = diasAtraso((r as any).vencimento);
      // permite dias negativos (D-1, D-3)
      const v = new Date((r as any).vencimento + "T00:00:00Z").getTime();
      const h = new Date(iso + "T00:00:00Z").getTime();
      const diasReal = Math.floor((h - v) / 86400000);
      const gatilho = classificarGatilho(
        diasReal,
        (r as any).status,
        (r as any).promessa_data ?? null,
        iso,
      );
      if (!gatilho) continue;

      const saldo = Number((r as any).saldo ?? 0);
      const tentativas = (r as any).tentativas ?? 0;
      const score = calcularScore(saldo, diasReal, tentativas, gatilho);

      itens.push({
        id: (r as any).id,
        pagamento_id: (r as any).pagamento_id,
        cliente_id: (r as any).cliente_id,
        cliente_nome: (r as any).clientes?.nome ?? "—",
        cliente_whatsapp: (r as any).clientes?.whatsapp ?? null,
        atendimento_id: (r as any).atendimento_id,
        pet_nome: (r as any).atendimentos?.pets?.nome ?? null,
        data_atendimento: (r as any).atendimentos?.data_inicio ?? null,
        valor_original: Number((r as any).valor_original ?? 0),
        valor_pago: Number((r as any).valor_pago ?? 0),
        saldo,
        vencimento: (r as any).vencimento,
        dias_atraso: dias,
        status: (r as any).status as CobrancaStatus,
        promessa_data: (r as any).promessa_data ?? null,
        tentativas,
        ultima_cobranca_em: (r as any).ultima_cobranca_em,
        pausada: !!(r as any).pausada,
        pausada_motivo: (r as any).pausada_motivo,
        gatilho,
        gatilho_label: GATILHO_LABEL[gatilho],
        score,
      });
    }

    itens.sort((a, b) => b.score - a.score);
    return itens;
  });

// ============= Funil de recuperação (mês corrente) =============
export type FunilCobrancas = {
  criadas: number;
  enviadas: number;
  responderam: number;
  prometeram: number;
  pagaram: number;
  valor_criado: number;
  valor_recuperado: number;
  taxa_envio: number;
  taxa_resposta: number;
  taxa_pagamento: number;
};

export const funilCobrancas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

    const { data: cobs, error } = await supabase
      .from("cobrancas")
      .select("id, status, valor_original, tentativas, created_at, updated_at")
      .is("arquivada_em", null)
      .gte("created_at", inicioMes);
    if (error) throw new Error(error.message);

    const { data: eventos } = await supabase
      .from("cobrancas_eventos")
      .select("cobranca_id, tipo, created_at")
      .gte("created_at", inicioMes);

    const cobIds = new Set((cobs ?? []).map((c: any) => c.id));
    const respondeu = new Set<string>();
    const prometeu = new Set<string>();
    for (const e of eventos ?? []) {
      if (!cobIds.has((e as any).cobranca_id)) continue;
      const t = (e as any).tipo as string;
      if (t === "resposta_cliente") respondeu.add((e as any).cobranca_id);
      if (t === "promessa") prometeu.add((e as any).cobranca_id);
    }

    let criadas = 0;
    let enviadas = 0;
    let pagaram = 0;
    let valor_criado = 0;
    let valor_recuperado = 0;

    for (const c of cobs ?? []) {
      criadas += 1;
      valor_criado += Number((c as any).valor_original ?? 0);
      if (((c as any).tentativas ?? 0) > 0 || (c as any).status !== "a_vencer") {
        // "enviada" cobre todo estado operacional pós-envio
        if (((c as any).tentativas ?? 0) > 0) enviadas += 1;
      }
      if ((c as any).status === "pago") {
        pagaram += 1;
        valor_recuperado += Number((c as any).valor_original ?? 0);
      }
    }

    const responderam = respondeu.size;
    const prometeram = prometeu.size;

    const kpis: FunilCobrancas = {
      criadas,
      enviadas,
      responderam,
      prometeram,
      pagaram,
      valor_criado,
      valor_recuperado,
      taxa_envio: criadas > 0 ? enviadas / criadas : 0,
      taxa_resposta: enviadas > 0 ? responderam / enviadas : 0,
      taxa_pagamento: enviadas > 0 ? pagaram / enviadas : 0,
    };
    return kpis;
  });

// ============= Excluir =============
export const excluirCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ cobrancaId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Remove eventos vinculados primeiro (evita órfãos caso não haja cascade).
    await supabase.from("cobrancas_eventos").delete().eq("cobranca_id", data.cobrancaId);

    const { error } = await supabase.from("cobrancas").delete().eq("id", data.cobrancaId);
    if (error) {
      console.error("[cobrancas] excluir erro:", error.message);
      throw new Error("Não foi possível excluir a cobrança");
    }
    return { ok: true };
  });
