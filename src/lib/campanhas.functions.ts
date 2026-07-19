import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CampanhaStatus =
  | "rascunho"
  | "pronta"
  | "em_envio"
  | "concluida"
  | "cancelada";

export type CampanhaFiltros = {
  porte_ids?: string[];
  cidade?: string;
  min_dias_ultimo_atend?: number | null;
  max_dias_ultimo_atend?: number | null;
  aniversariante_mes_pet?: boolean;
  so_sem_agendamento_futuro?: boolean;
  apenas_ativos?: boolean;
};

export type CampanhaRow = {
  id: string;
  nome: string;
  descricao: string | null;
  filtros: CampanhaFiltros;
  mensagem: string;
  status: CampanhaStatus;
  total_destinatarios: number;
  total_enviados: number;
  total_falhas: number;
  agendada_para: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
};

export type DestinatarioRow = {
  id: string;
  campanha_id: string;
  cliente_id: string | null;
  pet_id: string | null;
  cliente_nome: string | null;
  pet_nome: string | null;
  telefone: string | null;
  mensagem_renderizada: string;
  status: "pendente" | "enviado" | "falhou" | "cancelado";
  enviado_em: string | null;
  erro: string | null;
  tentativas: number;
  created_at: string;
};

const FiltrosSchema = z
  .object({
    porte_ids: z.array(z.string().uuid()).optional().default([]),
    cidade: z.string().trim().max(80).optional().default(""),
    min_dias_ultimo_atend: z.number().int().min(0).max(3650).nullable().optional(),
    max_dias_ultimo_atend: z.number().int().min(0).max(3650).nullable().optional(),
    aniversariante_mes_pet: z.boolean().optional().default(false),
    so_sem_agendamento_futuro: z.boolean().optional().default(false),
    apenas_ativos: z.boolean().optional().default(true),
  })
  .default({});

function renderMensagem(tpl: string, tutor: string, pet: string) {
  const primeiro = (tutor || "").split(" ")[0] || tutor;
  return (tpl || "")
    .replaceAll("{{tutor}}", primeiro)
    .replaceAll("{{tutor_completo}}", tutor || "")
    .replaceAll("{{pet}}", pet || "");
}

type PetJoined = {
  id: string;
  nome: string;
  nascimento: string | null;
  porte_id: string | null;
  ativo: boolean | null;
  cliente_id: string | null;
  clientes:
    | { id: string; nome: string | null; cidade: string | null; telefone: string | null; whatsapp: string | null; ativo: boolean | null }
    | null;
};

async function buscarCandidatos(
  supabase: any,
  filtros: CampanhaFiltros
): Promise<
  Array<{
    pet_id: string;
    pet_nome: string;
    cliente_id: string;
    cliente_nome: string;
    telefone: string;
  }>
> {
  let q = supabase
    .from("pets")
    .select(
      `id, nome, nascimento, porte_id, ativo, cliente_id,
       clientes:cliente_id ( id, nome, cidade, telefone, whatsapp, ativo )`
    )
    .limit(5000);

  if (filtros.apenas_ativos !== false) q = q.eq("ativo", true);
  if (filtros.porte_ids && filtros.porte_ids.length > 0) {
    q = q.in("porte_id", filtros.porte_ids);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const pets = (data ?? []) as PetJoined[];

  // Filtro por cidade / cliente ativo
  const cidadeFiltro = (filtros.cidade ?? "").trim().toLowerCase();
  let filtrados = pets.filter((p) => {
    const c = p.clientes;
    if (!c) return false;
    if (filtros.apenas_ativos !== false && c.ativo === false) return false;
    if (cidadeFiltro && (c.cidade ?? "").toLowerCase().indexOf(cidadeFiltro) < 0) return false;
    return true;
  });

  // Aniversariante do pet no mês corrente
  if (filtros.aniversariante_mes_pet) {
    const m = new Date().getUTCMonth() + 1;
    filtrados = filtrados.filter((p) => {
      if (!p.nascimento) return false;
      const mm = Number(String(p.nascimento).slice(5, 7));
      return mm === m;
    });
  }

  const petIds = filtrados.map((p) => p.id);
  if (petIds.length === 0) return [];

  // Último atendimento por pet
  const dias = { min: filtros.min_dias_ultimo_atend ?? null, max: filtros.max_dias_ultimo_atend ?? null };
  const precisaUltimo = dias.min !== null || dias.max !== null;
  let ultimoPorPet: Record<string, string | null> = {};
  if (precisaUltimo) {
    const { data: atRows, error: atErr } = await supabase
      .from("atendimentos")
      .select("pet_id, data_fim, encerrado_em")
      .in("pet_id", petIds)
      .not("encerrado_em", "is", null);
    if (atErr) throw new Error(atErr.message);
    for (const r of (atRows ?? []) as any[]) {
      const pid = r.pet_id as string;
      const d = (r.data_fim ?? r.encerrado_em) as string;
      const cur = ultimoPorPet[pid];
      if (!cur || (d && d > cur)) ultimoPorPet[pid] = d;
    }
  }

  // Agendamentos futuros
  let temFuturoPorPet: Record<string, boolean> = {};
  if (filtros.so_sem_agendamento_futuro) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: ag, error: agErr } = await supabase
      .from("agendamentos")
      .select("pet_id, data, status")
      .in("pet_id", petIds)
      .gte("data", hoje)
      .in("status", ["agendado", "confirmado"]);
    if (agErr) throw new Error(agErr.message);
    for (const r of (ag ?? []) as any[]) temFuturoPorPet[r.pet_id] = true;
  }

  const agora = Date.now();
  const finais = filtrados.filter((p) => {
    if (precisaUltimo) {
      const d = ultimoPorPet[p.id];
      const dias_desde = d ? Math.floor((agora - new Date(d).getTime()) / 86_400_000) : 99_999;
      if (dias.min !== null && dias_desde < dias.min) return false;
      if (dias.max !== null && dias_desde > dias.max) return false;
    }
    if (filtros.so_sem_agendamento_futuro && temFuturoPorPet[p.id]) return false;
    return true;
  });

  const res: Array<{ pet_id: string; pet_nome: string; cliente_id: string; cliente_nome: string; telefone: string }> = [];
  const dedupClientes = new Set<string>();
  for (const p of finais) {
    const c = p.clientes!;
    const tel = (c.whatsapp || c.telefone || "").trim();
    if (!tel) continue;
    const key = `${c.id}:${p.id}`;
    if (dedupClientes.has(key)) continue;
    dedupClientes.add(key);
    res.push({
      pet_id: p.id,
      pet_nome: p.nome,
      cliente_id: c.id,
      cliente_nome: c.nome ?? "Cliente",
      telefone: tel,
    });
  }
  return res;
}

// ---------- Public API ----------

export const listarCampanhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campanhas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as CampanhaRow[];
  });

export const obterCampanha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: camp, error } = await context.supabase
      .from("campanhas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!camp) throw new Error("Campanha não encontrada");
    const { data: dests, error: derr } = await context.supabase
      .from("campanhas_destinatarios")
      .select("*")
      .eq("campanha_id", data.id)
      .order("cliente_nome", { ascending: true });
    if (derr) throw new Error(derr.message);
    return {
      campanha: camp as CampanhaRow,
      destinatarios: (dests ?? []) as DestinatarioRow[],
    };
  });

export const preverAudiencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ filtros: FiltrosSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const candidatos = await buscarCandidatos(context.supabase, data.filtros);
    return {
      total: candidatos.length,
      preview: candidatos.slice(0, 15),
    };
  });

const CriarSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  descricao: z.string().trim().max(500).optional().default(""),
  filtros: FiltrosSchema,
  mensagem: z.string().trim().min(1).max(4000),
});

export const criarCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const candidatos = await buscarCandidatos(context.supabase, data.filtros);
    const { data: inserted, error } = await context.supabase
      .from("campanhas")
      .insert({
        nome: data.nome,
        descricao: data.descricao || null,
        filtros: data.filtros as any,
        mensagem: data.mensagem,
        status: "rascunho",
        total_destinatarios: candidatos.length,
        criado_por: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const camp = inserted as CampanhaRow;

    if (candidatos.length > 0) {
      const linhas = candidatos.map((c) => ({
        campanha_id: camp.id,
        cliente_id: c.cliente_id,
        pet_id: c.pet_id,
        cliente_nome: c.cliente_nome,
        pet_nome: c.pet_nome,
        telefone: c.telefone,
        mensagem_renderizada: renderMensagem(data.mensagem, c.cliente_nome, c.pet_nome),
      }));
      // Insere em lotes de 500 para evitar payloads grandes
      for (let i = 0; i < linhas.length; i += 500) {
        const slice = linhas.slice(i, i + 500);
        const { error: derr } = await context.supabase
          .from("campanhas_destinatarios")
          .insert(slice);
        if (derr) throw new Error(derr.message);
      }
    }
    return { id: camp.id, total: candidatos.length };
  });

export const excluirCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campanhas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicarCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: origem, error } = await context.supabase
      .from("campanhas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!origem) throw new Error("Campanha não encontrada");
    const { data: novo, error: ierr } = await context.supabase
      .from("campanhas")
      .insert({
        nome: `${(origem as any).nome} (cópia)`,
        descricao: (origem as any).descricao,
        filtros: (origem as any).filtros,
        mensagem: (origem as any).mensagem,
        status: "rascunho",
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (ierr) throw new Error(ierr.message);
    return { id: (novo as any).id as string };
  });

export const marcarDestinatarioEnviado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ destinatario_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: dest, error } = await context.supabase
      .from("campanhas_destinatarios")
      .update({
        status: "enviado",
        enviado_em: new Date().toISOString(),
        tentativas: 1,
        erro: null,
      })
      .eq("id", data.destinatario_id)
      .select("campanha_id")
      .single();
    if (error) throw new Error(error.message);

    // Recalcula contadores da campanha
    const campId = (dest as any).campanha_id as string;
    const { data: totais } = await context.supabase
      .from("campanhas_destinatarios")
      .select("status", { count: "exact", head: false })
      .eq("campanha_id", campId);
    const arr = (totais ?? []) as Array<{ status: string }>;
    const enviados = arr.filter((r) => r.status === "enviado").length;
    const falhas = arr.filter((r) => r.status === "falhou").length;
    const pendentes = arr.filter((r) => r.status === "pendente").length;
    await context.supabase
      .from("campanhas")
      .update({
        total_enviados: enviados,
        total_falhas: falhas,
        status: pendentes === 0 ? "concluida" : "em_envio",
        concluida_em: pendentes === 0 ? new Date().toISOString() : null,
      })
      .eq("id", campId);
    return { ok: true };
  });

export const cancelarDestinatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ destinatario_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campanhas_destinatarios")
      .update({ status: "cancelado" })
      .eq("id", data.destinatario_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const kpisCampanhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("campanhas")
      .select("status, total_destinatarios, total_enviados, total_falhas");
    const arr = (data ?? []) as Array<{
      status: CampanhaStatus;
      total_destinatarios: number;
      total_enviados: number;
      total_falhas: number;
    }>;
    return {
      total_campanhas: arr.length,
      em_envio: arr.filter((r) => r.status === "em_envio").length,
      concluidas: arr.filter((r) => r.status === "concluida").length,
      total_mensagens: arr.reduce((s, r) => s + (r.total_destinatarios ?? 0), 0),
      total_enviadas: arr.reduce((s, r) => s + (r.total_enviados ?? 0), 0),
    };
  });
