import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProgramasCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    
    const { data, error } = await sb
      .from("programas_de_cuidado" as any)
      .select(`
        *,
        itens:programas_de_cuidado_itens (
          *,
          servico:servicos (*)
        )
      `)
      .order("criado_em", { ascending: false });

    if (error) throw error;
    return data;
  });

export const upsertPrograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1, "Nome é obrigatório"),
    descricao: z.string().optional(),
    status: z.enum(["rascunho", "ativo", "inativo"]),
    preco_do_programa: z.number().min(0),
    valor_normal_dos_servicos: z.number().min(0),
    economia: z.number().min(0),
    validade_em_dias: z.number().min(1),
    permite_parcelamento: z.boolean(),
    inclui_transporte: z.boolean(),
    modalidade_transporte: z.string().optional(),
    quantidade_transportes: z.number().optional(),
    valor_transporte: z.number().optional(),
    regras: z.string().optional(),
    itens: z.array(z.object({
      servico_id: z.string().uuid(),
      quantidade: z.number().min(1),
      valor_unitario_de_referencia: z.number(),
      valor_alocado: z.number(),
      ordem_de_exibicao: z.number().optional()
    }))
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;
    const { itens, ...programaData } = data;

    // 1. Upsert do programa
    const { data: programa, error: pError } = await sb
      .from("programas_de_cuidado" as any)
      .upsert({
        ...programaData,
        criado_por: data.id ? undefined : userId,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pError) throw pError;

    // 2. Se for edição, remove itens antigos (ou poderíamos fazer sync mais complexo)
    if (data.id) {
      const { error: dError } = await sb
        .from("programas_de_cuidado_itens" as any)
        .delete()
        .eq("programa_id", data.id);
      if (dError) throw dError;
    }

    // 3. Insere os novos itens
    const { error: iError } = await sb
      .from("programas_de_cuidado_itens" as any)
      .insert(itens.map(item => ({
        ...item,
        programa_id: (programa as any).id
      })));

    if (iError) throw iError;

    return programa;
  });

export const toggleProgramaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid(),
    status: z.enum(["rascunho", "ativo", "inativo"])
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("programas_de_cuidado" as any)
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });

export const duplicarPrograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    // 1. Busca programa original
    const { data: original, error: oError } = await sb
      .from("programas_de_cuidado" as any)
      .select("*, itens:programas_de_cuidado_itens(*)")
      .eq("id", data.id)
      .single();

    if (oError) throw oError;

    // 2. Clona programa
    const { id: _, criado_em: __, updated_at: ___, itens, ...cloneData } = original as any;
    const { data: clone, error: cError } = await sb
      .from("programas_de_cuidado" as any)
      .insert({
        ...cloneData,
        nome: `${cloneData.nome} (Cópia)`,
        status: "rascunho",
        criado_por: userId
      })
      .select()
      .single();

    if (cError) throw cError;

    // 3. Clona itens
    const { error: iError } = await sb
      .from("programas_de_cuidado_itens" as any)
      .insert(itens.map((item: any) => {
        const { id: ____, programa_id: _____, ...itemData } = item;
        return { ...itemData, programa_id: (clone as any).id };
      }));

    if (iError) throw iError;

    return clone;
  });
