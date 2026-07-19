import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ReativacaoRow = {
  pet_id: string;
  pet_nome: string;
  pet_foto: string | null;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_whatsapp: string | null;
  ultimo_atendimento_em: string | null;
  dias_inativo: number;
  faixa: "sem_historico" | "critico" | "alto" | "medio" | "baixo" | "recente";
  ticket_medio: number;
  total_atendimentos: number;
  ultimo_contato_reativacao_em: string | null;
  retornou_apos_contato: boolean;
};

const ListaSchema = z
  .object({
    faixa: z.enum(["todas", "baixo", "medio", "alto", "critico"]).optional().default("todas"),
    busca: z.string().trim().max(120).optional().default(""),
    apenas_nao_contatados: z.boolean().optional().default(false),
  })
  .default({});

export const listarPetsReativacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListaSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("pets_reativacao")
      .select("*")
      .order("dias_inativo", { ascending: false })
      .limit(500);
    if (data.faixa !== "todas") q = q.eq("faixa", data.faixa);
    if (data.busca) q = q.or(`pet_nome.ilike.%${data.busca}%,cliente_nome.ilike.%${data.busca}%`);
    if (data.apenas_nao_contatados) q = q.is("ultimo_contato_reativacao_em", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ReativacaoRow[];
  });

export type ReativacaoKPIs = {
  total_candidatos: number;
  por_faixa: { baixo: number; medio: number; alto: number; critico: number };
  contatados_mes: number;
  recuperados_mes: number;
  taxa_conversao: number;
  ticket_medio_potencial: number;
};

export const getReativacaoKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("pets_reativacao")
      .select("faixa, ticket_medio, ultimo_contato_reativacao_em, retornou_apos_contato");
    if (error) throw new Error(error.message);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioIso = inicioMes.toISOString();

    const kpi: ReativacaoKPIs = {
      total_candidatos: rows?.length ?? 0,
      por_faixa: { baixo: 0, medio: 0, alto: 0, critico: 0 },
      contatados_mes: 0,
      recuperados_mes: 0,
      taxa_conversao: 0,
      ticket_medio_potencial: 0,
    };

    let somaTicket = 0;
    let nTicket = 0;
    for (const r of rows ?? []) {
      const f = String(r.faixa ?? "");
      if (f in kpi.por_faixa) (kpi.por_faixa as any)[f] += 1;
      const t = Number(r.ticket_medio ?? 0);
      if (t > 0) {
        somaTicket += t;
        nTicket += 1;
      }
      const ultimo = r.ultimo_contato_reativacao_em ? String(r.ultimo_contato_reativacao_em) : null;
      if (ultimo && ultimo >= inicioIso) {
        kpi.contatados_mes += 1;
        if (r.retornou_apos_contato) kpi.recuperados_mes += 1;
      }
    }
    kpi.ticket_medio_potencial = nTicket > 0 ? Math.round((somaTicket / nTicket) * 100) / 100 : 0;
    kpi.taxa_conversao =
      kpi.contatados_mes > 0 ? Math.round((kpi.recuperados_mes / kpi.contatados_mes) * 1000) / 10 : 0;
    return kpi;
  });
