import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult, JessiMutationResult } from "../jessi-contracts";
import { getCreditosDisponiveis, getProgramasCatalogo, reconciliarCreditosPet } from "@/lib/programas-cuidado.functions";
import { getContratoDetalhe } from "@/lib/programas-contratos.functions";

/**
 * Adaptadores de Programas de Cuidado e Créditos para a Jessi
 */

export async function consultarCreditosPetJessi(
  sb: SupabaseClient<Database>,
  params: { pet_id?: string; pet_nome?: string; cliente_id?: string }
): Promise<JessiQueryResult> {
  let query = sb
    .from("programas_contratados")
    .select(`
      id, programa_id, preco_vendido, status_do_programa, data_de_inicio, data_de_validade, nome_snapshot,
      pets:pet_id(id, nome, cliente_id, clientes(id, nome)),
      programas_creditos_movimentacoes(*)
    `)
    .in("status_do_programa", ["ativo", "aguardando_pagamento"])
    .order("criado_em", { ascending: false });

  if (params?.pet_id) {
    query = query.eq("pet_id", params.pet_id);
  }

  const { data: contratos } = await query.limit(10);
  const total = (contratos || []).length;

  let resumoTexto = "";
  if (total === 0) {
    resumoTexto = "Não encontrei nenhum contrato do Clubinho ativo ou aguardando pagamento no momento.";
  } else {
    const lista = (contratos as any[]).map((c) => {
      const petNome = c.pets?.nome || "Pet";
      const tutorNome = c.pets?.clientes?.nome ? ` (${c.pets.clientes.nome})` : "";
      const nomePlano = c.nome_snapshot || "Clubinho";
      const movs = c.programas_creditos_movimentacoes || [];
      const consumidos = movs.filter((m: any) => m.tipo === "consumo" || m.tipo === "uso").length;
      return `• ${petNome}${tutorNome}: ${nomePlano} (${c.status_do_programa}) - ${consumidos} uso(s) registrado(s)`;
    }).join("\n");
    resumoTexto = `Encontrei ${total} contrato(s) ativo(s) do Clubinho:\n${lista}`;
  }

  return {
    success: true,
    source: "programas_creditos",
    data: contratos || [],
    total_count: total,
    filters_applied: params,
    executed_at: new Date().toISOString(),
    summary: resumoTexto,
  };
}

export async function consultarCatalogoProgramasJessi(
  sb: SupabaseClient<Database>
): Promise<JessiQueryResult> {
  const { data: programas } = await sb
    .from("programas_de_cuidado")
    .select(`
      *,
      programas_de_cuidado_itens(*, servicos(nome, categoria, valor))
    `)
    .eq("status", "ativo");

  return {
    success: true,
    source: "catalogo_programas",
    data: programas || [],
    total_count: (programas || []).length,
    executed_at: new Date().toISOString(),
    summary: `${(programas || []).length} programas ativos encontrados no catálogo.`,
  };
}

export async function reconciliarCreditosJessi(
  sb: SupabaseClient<Database>,
  params: { pet_id: string }
): Promise<JessiMutationResult> {
  try {
    const { data, error } = await sb.rpc("reconciliar_creditos_pet" as any, {
      p_pet_id: params.pet_id,
    });

    if (error) throw error;

    return {
      success: true,
      source: "reconciliar_creditos",
      affected_record_id: params.pet_id,
      after: data,
      verified: true,
      executed_at: new Date().toISOString(),
      summary: `Créditos do pet reconciliados com sucesso no banco de dados.`,
    };
  } catch (err: any) {
    return {
      success: false,
      source: "reconciliar_creditos",
      verified: false,
      error_code: err.message,
      executed_at: new Date().toISOString(),
      summary: `Não foi possível reconciliar os créditos: ${err.message}`,
    };
  }
}
