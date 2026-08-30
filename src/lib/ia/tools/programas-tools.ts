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
  params: { pet_id: string }
): Promise<JessiQueryResult> {
  const { data: pet } = await sb
    .from("pets")
    .select("id, nome, cliente_id, clientes(nome)")
    .eq("id", params.pet_id)
    .maybeSingle();

  // Busca movimentações e contratos do pet
  const { data: contratos } = await sb
    .from("programas_contratados")
    .select(`
      id, programa_id, preco_vendido, status_do_programa, data_de_inicio, data_de_validade,
      programas_de_cuidado(nome),
      programas_creditos_movimentacoes(*)
    `)
    .eq("pet_id", params.pet_id)
    .in("status_do_programa", ["ativo", "aguardando_pagamento"]);

  return {
    success: true,
    source: "programas_creditos",
    data: {
      pet: pet || null,
      contratos: contratos || [],
    },
    total_count: (contratos || []).length,
    filters_applied: { pet_id: params.pet_id },
    executed_at: new Date().toISOString(),
    summary: `Créditos e programas do pet ${(pet as any)?.nome || params.pet_id} consultados com sucesso.`,
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
