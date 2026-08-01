import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ============================================================
 * Types
 * ============================================================ */
export const TIPO_MENSAGEM = [
  "confirmacao_agendamento",
  "lembrete_agendamento",
  "pos_atendimento",
  "vacina_vencendo",
  "aniversario_pet",
  "cobranca_pendente",
  "reagendamento",
  "boas_vindas",
  "pesquisa_satisfacao",
  "promocao",
  "reengajamento",
  "personalizada",
] as const;
export type TipoMensagem = (typeof TIPO_MENSAGEM)[number];

export const TIPO_LABEL: Record<TipoMensagem, string> = {
  confirmacao_agendamento: "Confirmação de agendamento",
  lembrete_agendamento: "Lembrete de agendamento",
  pos_atendimento: "Pós-atendimento",
  vacina_vencendo: "Lembrete de vacina",
  aniversario_pet: "Aniversário do pet",
  cobranca_pendente: "Cobrança / pagamento pendente",
  reagendamento: "Reagendamento",
  boas_vindas: "Boas-vindas",
  pesquisa_satisfacao: "Pesquisa de satisfação",
  promocao: "Promoção / campanha",
  reengajamento: "Reengajamento",
  personalizada: "Personalizada",
};

const PROMPT_POR_TIPO: Record<TipoMensagem, string> = {
  confirmacao_agendamento:
    "Confirme o horário de forma cordial. Peça uma confirmação clara (sim/não). Não invente valores.",
  lembrete_agendamento:
    "Envie um lembrete carinhoso do horário marcado. Reforce que se precisar remarcar é só avisar.",
  pos_atendimento:
    "Agradeça pela visita, comente brevemente como o pet saiu (cheiroso, calmo, feliz), e convide o tutor a contar como foi em casa.",
  vacina_vencendo:
    "Avise com carinho que a vacina do pet está próxima de vencer ou já venceu. Ofereça ajuda para reorganizar a agenda.",
  aniversario_pet:
    "Mensagem festiva de aniversário para o pet, em nome do Spa. Um único emoji tipo 🎂 ou 🎉.",
  cobranca_pendente:
    "Cobrança educada e respeitosa. Cite valor e data do atendimento com naturalidade. Se já tiver pago, peça para desconsiderar. Nunca pressione.",
  reagendamento:
    "Explique com naturalidade que precisamos ajustar o horário. Peça sugestão de novo dia/horário.",
  boas_vindas:
    "Boas-vindas calorosas ao novo cliente e ao pet. Reforce que estamos disponíveis para dúvidas.",
  pesquisa_satisfacao:
    "Peça um retorno curto sobre o atendimento — nota de 1 a 5 ou uma frase.",
  promocao:
    "Ofereça a promoção de forma leve, sem parecer spam. Convide a responder para saber detalhes.",
  reengajamento:
    "Cliente sumido — puxe assunto com afeto, cite o pet e ofereça reservar horário.",
  personalizada:
    "Siga estritamente o contexto do usuário. Mantenha curto, humano e útil.",
};

/* ============================================================
 * Compor: gerar mensagem via IA (versão expandida)
 * ============================================================ */
const ComporSchema = z.object({
  tipo: z.enum(TIPO_MENSAGEM),
  clienteNome: z.string().min(1),
  petNome: z.string().optional().nullable(),
  contexto: z.string().optional().nullable(),
  tom: z
    .enum(["amigavel", "profissional", "acolhedor", "formal", "descontraido", "carinhoso", "direto"])
    .default("amigavel"),
  templateBase: z.string().optional().nullable(),
});

export const gerarMensagemIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComporSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { chamarIATexto, carregarIaConfig } = await import("./ia-core.server");
    const config = await carregarIaConfig(context.supabase);

    const primeiro = data.clienteNome.trim().split(/\s+/)[0] || data.clienteNome;
    const promptTipo = PROMPT_POR_TIPO[data.tipo];

    const prompt = `Você é a assistente de comunicação do "Spa da Tia Jéssica", pet shop premium especializado em banho e tosa de cães.

Gere UMA mensagem curta de WhatsApp em português do Brasil (máx. 4 linhas):
- Tipo: ${TIPO_LABEL[data.tipo]}
- Instrução do tipo: ${promptTipo}
- Cliente (tutor): ${primeiro}
- Pet: ${data.petNome ?? "(não informado)"}
- Tom desejado: ${data.tom}
- Contexto adicional: ${data.contexto?.trim() || "(nenhum)"}
${data.templateBase ? `\nUse o template abaixo como base — mantenha a voz do negócio:\n"""${data.templateBase}"""\n` : ""}
${config.instrucoes_empresa ? `\nInstruções da empresa:\n${config.instrucoes_empresa}\n` : ""}
Regras:
- Comece com uma saudação usando o primeiro nome do tutor.
- Cite o nome do pet quando fizer sentido.
- Máximo 1 emoji sutil (🐾, ✨, 💛, 🎂, 🎉, ✅). Em cobrança, NÃO use emoji.
- Não invente datas, valores ou horários que não estejam no contexto/template.
- Não use markdown, aspas nem prefixos. Devolva SOMENTE o texto puro.`;

    const r = await chamarIATexto({
      system: "Você redige mensagens curtas, cordiais e humanas para um pet shop premium.",
      prompt,
      config,
      origem: `sugestao:${data.tipo ?? "generico"}`,
      sb: context.supabase,
    });
    const texto = r.texto;
    if (!texto) throw new Error("A IA não retornou texto.");
    return { mensagem: texto, modelo: r.modelo, usouFallback: r.usouFallback };
  });

/* ============================================================
 * Templates CRUD
 * ============================================================ */
export const listarTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mensagem_templates")
      .select("*")
      .eq("ativo", true)
      .order("tipo")
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });

const SalvarTemplateSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  tipo: z.enum(TIPO_MENSAGEM),
  nome: z.string().min(1).max(120),
  corpo: z.string().min(1).max(4000),
  descricao: z.string().optional().nullable(),
});

export const salvarTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("mensagem_templates")
        .update({ tipo: data.tipo, nome: data.nome, corpo: data.corpo, descricao: data.descricao ?? null })
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("mensagem_templates")
      .insert({ tipo: data.tipo, nome: data.nome, corpo: data.corpo, descricao: data.descricao ?? null })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row!.id };
  });

export const excluirTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mensagem_templates")
      .update({ ativo: false })
      .eq("id", data.id)
      .eq("is_padrao", false);
    if (error) throw error;
    return { ok: true };
  });

/* ============================================================
 * Sugestões proativas — geração baseada em eventos reais
 * ============================================================ */

function primeiroNome(v?: string | null) {
  return (v ?? "").trim().split(/\s+/)[0] || "";
}

function renderTemplate(corpo: string, ctx: Record<string, string>) {
  return corpo.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
}

export const gerarSugestoesProativas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;

    // Config de janelas
    const { data: cfg } = await sb.from("lembretes_config").select("*").maybeSingle();
    const HORAS_CONF = cfg?.sugestao_confirmacao_horas ?? 24;
    const DIAS_REENG = cfg?.sugestao_reengajamento_dias ?? 60;
    const HORAS_POS = cfg?.sugestao_pos_atendimento_horas ?? 24;

    // Templates ativos por tipo (primeiro ativo)
    const { data: tpls } = await sb
      .from("mensagem_templates")
      .select("id, tipo, corpo")
      .eq("ativo", true);
    const tplPorTipo: Record<string, { id: string; corpo: string } | undefined> = {};
    for (const t of tpls ?? []) if (!tplPorTipo[t.tipo]) tplPorTipo[t.tipo] = { id: t.id, corpo: t.corpo };

    const hoje = new Date();
    const criadas: any[] = [];

    async function upsert(row: {
      idempotency_key: string;
      cliente_id: string;
      pet_id?: string | null;
      agendamento_id?: string | null;
      atendimento_id?: string | null;
      cobranca_id?: string | null;
      tipo: string;
      motivo: string;
      prioridade: number;
      prevista_para?: string | null;
      mensagem_sugerida: string;
    }) {
      const { error } = await sb
        .from("mensagem_sugestoes")
        .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (!error) criadas.push(row);
    }

    // 1) Confirmação: agendamentos dentro da janela X horas (não confirmados)
    const alvoConf = new Date(hoje.getTime() + HORAS_CONF * 3600 * 1000).toISOString();
    const { data: agConf } = await sb
      .from("agendamentos")
      .select("id, data, hora, cliente_id, pet_id, clientes(nome, whatsapp, opt_out_comunicacao), pets(nome)")
      .in("status", ["agendado"])
      .gte("data", hoje.toISOString().slice(0, 10))
      .lte("data", alvoConf.slice(0, 10))
      .limit(100);
    for (const a of (agConf ?? []) as any[]) {
      if (!a.clientes || a.clientes.opt_out_comunicacao) continue;
      const dataFmt = a.data ? new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
      const ctx = { tutor: primeiroNome(a.clientes?.nome), pet: a.pets?.nome ?? "seu pet", data: dataFmt, hora: (a.hora ?? "").slice(0, 5) };
      const tpl = tplPorTipo["confirmacao_agendamento"];
      const msg = tpl ? renderTemplate(tpl.corpo, ctx) : `Olá, ${ctx.tutor}! Confirmando ${ctx.pet} em ${dataFmt} às ${ctx.hora}.`;
      await upsert({
        idempotency_key: `conf:${a.id}`,
        cliente_id: a.cliente_id,
        pet_id: a.pet_id,
        agendamento_id: a.id,
        tipo: "confirmacao_agendamento",
        motivo: `Agendamento em ${dataFmt} às ${ctx.hora}`,
        prioridade: 90,
        prevista_para: `${a.data}T${a.hora}`,
        mensagem_sugerida: msg,
      });
    }

    // 2) Pós-atendimento: encerrados nas últimas HORAS_POS horas
    const desde = new Date(hoje.getTime() - HORAS_POS * 3600 * 1000).toISOString();
    const { data: ats } = await sb
      .from("atendimentos")
      .select("id, encerrado_em, cliente_id, pet_id, clientes(nome, whatsapp, opt_out_comunicacao), pets(nome)")
      .not("encerrado_em", "is", null)
      .gte("encerrado_em", desde)
      .limit(100);
    for (const a of (ats ?? []) as any[]) {
      if (!a.clientes || a.clientes.opt_out_comunicacao) continue;
      const ctx = { tutor: primeiroNome(a.clientes.nome), pet: a.pets?.nome ?? "seu pet" };
      const tpl = tplPorTipo["pos_atendimento"];
      const msg = tpl ? renderTemplate(tpl.corpo, ctx) : `Oi, ${ctx.tutor}! Foi um prazer receber ${ctx.pet} hoje. ✨`;
      await upsert({
        idempotency_key: `pos:${a.id}`,
        cliente_id: a.cliente_id,
        pet_id: a.pet_id,
        atendimento_id: a.id,
        tipo: "pos_atendimento",
        motivo: `Atendimento encerrado`,
        prioridade: 70,
        mensagem_sugerida: msg,
      });
    }

    // 3) Aniversário do pet (hoje)
    const mmdd = `${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const { data: pets } = await sb
      .from("pets")
      .select("id, nome, nascimento, cliente_id, clientes(nome, whatsapp, opt_out_comunicacao)")
      .not("nascimento", "is", null)
      .eq("ativo", true)
      .limit(200);
    for (const p of (pets ?? []) as any[]) {
      if (!p.clientes || p.clientes.opt_out_comunicacao || !p.nascimento) continue;
      const n = p.nascimento as string;
      if (n.slice(5, 10) !== mmdd) continue;
      const ctx = { tutor: primeiroNome(p.clientes.nome), pet: p.nome };
      const tpl = tplPorTipo["aniversario_pet"];
      const msg = tpl ? renderTemplate(tpl.corpo, ctx) : `🎂 Feliz aniversário, ${p.nome}!`;
      await upsert({
        idempotency_key: `aniv:${p.id}:${hoje.toISOString().slice(0, 10)}`,
        cliente_id: p.cliente_id,
        pet_id: p.id,
        tipo: "aniversario_pet",
        motivo: "Aniversário do pet hoje 🎂",
        prioridade: 60,
        mensagem_sugerida: msg,
      });
    }

    // 4) Reengajamento: pets sem atendimento há N dias
    const limite = new Date(hoje.getTime() - DIAS_REENG * 86400000).toISOString().slice(0, 10);
    const { data: reengPets } = await sb
      .from("pets")
      .select("id, nome, cliente_id, ultimo_banho, clientes(nome, whatsapp, opt_out_comunicacao)")
      .eq("ativo", true)
      .lt("ultimo_banho", limite)
      .not("ultimo_banho", "is", null)
      .limit(100);
    for (const p of (reengPets ?? []) as any[]) {
      if (!p.clientes || p.clientes.opt_out_comunicacao) continue;
      const ctx = { tutor: primeiroNome(p.clientes.nome), pet: p.nome };
      const tpl = tplPorTipo["reengajamento"];
      const msg = tpl ? renderTemplate(tpl.corpo, ctx) : `Oi, ${ctx.tutor}! Sentimos saudade do ${p.nome}. 🐾`;
      await upsert({
        idempotency_key: `reeng:${p.id}:${limite}`,
        cliente_id: p.cliente_id,
        pet_id: p.id,
        tipo: "reengajamento",
        motivo: `Sem atendimento há mais de ${DIAS_REENG} dias`,
        prioridade: 50,
        mensagem_sugerida: msg,
      });
    }

    // 5) Cobrança pendente: cobranças vencidas
    const { data: cobrs } = await sb
      .from("cobrancas")
      .select("id, valor_original, saldo, vencimento, cliente_id, clientes(nome, whatsapp, opt_out_comunicacao)")
      .is("arquivada_em", null)
      .in("status", ["vencido", "a_vencer", "pago_parcial"])
      .lt("vencimento", hoje.toISOString().slice(0, 10))
      .gt("saldo", 0)
      .limit(100);
    for (const c of (cobrs ?? []) as any[]) {
      if (!c.clientes || c.clientes.opt_out_comunicacao) continue;
      const ctx = {
        tutor: primeiroNome(c.clientes.nome),
        pet: "seu pet",
        valor: Number(c.saldo).toFixed(2).replace(".", ","),
        data: c.vencimento ? new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "",
      };
      const tpl = tplPorTipo["cobranca_pendente"];
      const msg = tpl ? renderTemplate(tpl.corpo, ctx) : `Olá, ${ctx.tutor}. Pagamento pendente de R$ ${ctx.valor}.`;
      await upsert({
        idempotency_key: `cob:${c.id}`,
        cliente_id: c.cliente_id,
        cobranca_id: c.id,
        tipo: "cobranca_pendente",
        motivo: `Saldo pendente R$ ${ctx.valor} desde ${ctx.data}`,
        prioridade: 80,
        mensagem_sugerida: msg,
      });
    }

    return { criadas: criadas.length };
  });

export const listarSugestoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mensagem_sugestoes")
      .select(
        "*, clientes(id, nome, whatsapp, opt_out_comunicacao, tom_preferido), pets(id, nome)"
      )
      .eq("status", "pendente")
      .order("prioridade", { ascending: false })
      .order("prevista_para", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const atualizarStatusSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["enviada", "ignorada"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mensagem_sugestoes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const feedbackSugestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      feedback: z.enum(["positivo", "negativo"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mensagem_sugestoes")
      .update({ feedback: data.feedback, feedback_em: new Date().toISOString(), feedback_por: context.userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ============================================================
 * Histórico completo com filtros
 * ============================================================ */
const HistSchema = z.object({
  clienteId: z.string().uuid().optional().nullable(),
  tipo: z.string().optional().nullable(),
  autorId: z.string().uuid().optional().nullable(),
  desde: z.string().optional().nullable(),
  ate: z.string().optional().nullable(),
});

export const listarHistoricoMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HistSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("mensagens")
      .select("*, clientes(id, nome)")
      .eq("direcao", "out")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.clienteId) q = q.eq("cliente_id", data.clienteId);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.autorId) q = q.eq("autor_id", data.autorId);
    if (data.desde) q = q.gte("created_at", data.desde);
    if (data.ate) q = q.lte("created_at", data.ate);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Enriquecer com autor a partir de profiles
    const autorIds = [...new Set((rows ?? []).map((r: any) => r.autor_id).filter(Boolean))];
    let autores: Record<string, { nome: string | null; email: string | null }> = {};
    if (autorIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", autorIds);
      for (const p of profs ?? []) autores[p.id] = { nome: p.nome, email: p.email };
    }
    return (rows ?? []).map((r: any) => ({ ...r, autor: r.autor_id ? autores[r.autor_id] ?? null : null }));
  });
