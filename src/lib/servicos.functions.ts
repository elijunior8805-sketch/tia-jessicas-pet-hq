import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const upsertServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1, "Nome é obrigatório"),
    categoria: z.string().optional().nullable(),
    descricao: z.string().optional().nullable(),
    valor: z.number().min(0),
    duracao_min: z.number().min(0),
    ativo: z.boolean().default(true),
    is_combo: z.boolean().default(false),
    preco_a_partir: z.boolean().default(false),
    itens_inclusos: z.array(z.string()).optional(),
    observacoes_internas: z.string().optional().nullable()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { id, ...rest } = data;

    if (id) {
      const { data: updated, error } = await sb
        .from("servicos")
        .update(rest as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await sb
        .from("servicos")
        .insert(rest as any)
        .select()
        .single();
      if (error) throw error;
      return inserted;
    }
  });

/** Consulta se um serviço possui vínculos operacionais (atendimentos, programas, etc.) */
export const consultarUsoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    servico_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // 1. Uso em atendimentos
    const { count: countAtendimentos } = await sb
      .from("atendimentos_servicos" as any)
      .select("id", { count: "exact", head: true })
      .eq("servico_id", data.servico_id);

    // 2. Uso em programas de cuidado
    const { count: countProgramas } = await sb
      .from("programas_de_cuidado_itens" as any)
      .select("id", { count: "exact", head: true })
      .eq("servico_id", data.servico_id);

    // 3. Uso em combos
    const { count: countCombos } = await sb
      .from("servicos_combo_itens" as any)
      .select("id", { count: "exact", head: true })
      .eq("servico_id", data.servico_id);

    const totalUso = (countAtendimentos || 0) + (countProgramas || 0) + (countCombos || 0);

    return {
      servico_id: data.servico_id,
      tem_historico: totalUso > 0,
      total_uso: totalUso,
      count_atendimentos: countAtendimentos || 0,
      count_programas: countProgramas || 0,
      count_combos: countCombos || 0
    };
  });

/** Exclui permanentemente ou desativa com segurança caso possua histórico */
export const excluirServicoSeguro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    servico_id: z.string().uuid(),
    motivo: z.string().optional()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // 1. Verifica vínculos
    const { count: countAtendimentos } = await sb
      .from("atendimentos_servicos" as any)
      .select("id", { count: "exact", head: true })
      .eq("servico_id", data.servico_id);

    const { count: countProgramas } = await sb
      .from("programas_de_cuidado_itens" as any)
      .select("id", { count: "exact", head: true })
      .eq("servico_id", data.servico_id);

    const temHistorico = (countAtendimentos || 0) > 0 || (countProgramas || 0) > 0;

    if (temHistorico) {
      // Desativa com segurança para preservar relatórios e integridade referencial
      const { error: uErr } = await sb
        .from("servicos")
        .update({ ativo: false } as any)
        .eq("id", data.servico_id);

      if (uErr) throw uErr;

      return {
        success: true,
        acao: "desativado",
        mensagem: "Serviço possui histórico em atendimentos ou programas. Foi desativado com segurança para preservar seus relatórios."
      };
    } else {
      // Limpa tabelas filhas sem histórico antes de deletar
      await sb.from("servicos_precos" as any).delete().eq("servico_id", data.servico_id);
      await sb.from("servicos_combo_itens" as any).delete().eq("servico_id", data.servico_id);

      const { error: dErr } = await sb.from("servicos").delete().eq("id", data.servico_id);
      if (dErr) throw dErr;

      return {
        success: true,
        acao: "excluido_permanente",
        mensagem: "Serviço excluído permanentemente."
      };
    }
  });

/** Duplica um serviço do catálogo */
export const duplicarServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    servico_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: original, error: oErr } = await sb
      .from("servicos")
      .select("*")
      .eq("id", data.servico_id)
      .single();

    if (oErr) throw oErr;

    const { id: _, created_at: __, ...cloneData } = original as any;

    const { data: novo, error: nErr } = await sb
      .from("servicos")
      .insert({
        ...cloneData,
        nome: `${cloneData.nome} — Cópia`,
        ativo: true
      })
      .select()
      .single();

    if (nErr) throw nErr;

    // Copia preços por porte se existirem
    const { data: precosOriginais = [] } = await sb
      .from("servicos_precos" as any)
      .select("*")
      .eq("servico_id", data.servico_id);

    if (precosOriginais && precosOriginais.length > 0) {
      await sb
        .from("servicos_precos" as any)
        .insert(precosOriginais.map((p: any) => ({
          servico_id: (novo as any).id,
          porte_id: p.porte_id,
          valor: p.valor
        })));
    }

    return novo;
  });

/** Expurgar serviços indesejados permanentemente do catálogo */
export const expurgarServicoPorNome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        termo: z.string().default("BANHO SPA"),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: itens, error } = await sb
      .from("servicos")
      .select("id, nome")
      .ilike("nome", `%${data.termo}%`);

    if (error || !itens || itens.length === 0) return { removidos: 0 };

    for (const item of itens) {
      await sb.from("servicos_precos" as any).delete().eq("servico_id", item.id);
      await sb.from("servicos_combo_itens" as any).delete().eq("servico_id", item.id);
      await sb.from("servicos").delete().eq("id", item.id);
      await sb.from("servicos").update({ ativo: false } as any).eq("id", item.id);
    }

    return { removidos: itens.length };
  });
