import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type DataComemorativa = {
  id: string;
  nome: string;
  dia: number;
  mes: number;
  template: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const listarDatasComemorativas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("datas_comemorativas")
      .select("*")
      .order("mes", { ascending: true })
      .order("dia", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as DataComemorativa[];
  });

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(80),
  dia: z.number().int().min(1).max(31),
  mes: z.number().int().min(1).max(12),
  template: z.string().trim().min(5).max(2000),
  ativo: z.boolean().default(true),
});

export const salvarDataComemorativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("datas_comemorativas")
        .update({
          nome: data.nome,
          dia: data.dia,
          mes: data.mes,
          template: data.template,
          ativo: data.ativo,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("datas_comemorativas")
      .insert({
        nome: data.nome,
        dia: data.dia,
        mes: data.mes,
        template: data.template,
        ativo: data.ativo,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

const IdSchema = z.object({ id: z.string().uuid() });

export const excluirDataComemorativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("datas_comemorativas")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

// Próximos aniversariantes (pets e tutores) nos próximos N dias, para o painel.
export const proximosAniversariantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dias: z.number().int().min(1).max(90).default(30) }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const [pets, tutores] = await Promise.all([
      context.supabase
        .from("pets")
        .select("id, nome, nascimento, cliente_id, clientes(nome, whatsapp, telefone)")
        .not("nascimento", "is", null)
        .eq("ativo", true),
      context.supabase
        .from("clientes")
        .select("id, nome, nascimento, whatsapp, telefone")
        .not("nascimento", "is", null)
        .eq("ativo", true),
    ]);
    if (pets.error) throw new Error(pets.error.message);
    if (tutores.error) throw new Error(tutores.error.message);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + data.dias);

    function proxOcorrencia(d: string): Date {
      const [_, m, dd] = d.split("-");
      const anoAtual = hoje.getFullYear();
      let dt = new Date(anoAtual, Number(m) - 1, Number(dd));
      dt.setHours(0, 0, 0, 0);
      if (dt < hoje) dt = new Date(anoAtual + 1, Number(m) - 1, Number(dd));
      return dt;
    }

    type Item = {
      kind: "pet" | "tutor";
      id: string;
      nome: string;
      quem: string;
      cliente_id: string;
      telefone: string | null;
      data: string;
      etiqueta: string;
    };
    const itens: Item[] = [];

    for (const p of pets.data ?? []) {
      if (!p.nascimento) continue;
      const dt = proxOcorrencia(p.nascimento as string);
      if (dt > limite) continue;
      const c = (p.clientes ?? {}) as any;
      itens.push({
        kind: "pet",
        id: p.id as string,
        nome: p.nome as string,
        quem: c?.nome ?? "—",
        cliente_id: p.cliente_id as string,
        telefone: (c?.whatsapp ?? c?.telefone ?? null) as string | null,
        data: dt.toISOString(),
        etiqueta: `${dt.getDate()} ${MESES[dt.getMonth()]}`,
      });
    }
    for (const c of tutores.data ?? []) {
      if (!c.nascimento) continue;
      const dt = proxOcorrencia(c.nascimento as string);
      if (dt > limite) continue;
      itens.push({
        kind: "tutor",
        id: c.id as string,
        nome: c.nome as string,
        quem: c.nome as string,
        cliente_id: c.id as string,
        telefone: (c.whatsapp ?? c.telefone ?? null) as string | null,
        data: dt.toISOString(),
        etiqueta: `${dt.getDate()} ${MESES[dt.getMonth()]}`,
      });
    }

    itens.sort((a, b) => a.data.localeCompare(b.data));
    return itens;
  });
