import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult, JessiMutationResult } from "../jessi-contracts";
import { buscarClientesIA, buscarPetsDoClienteIA, obterVisao360Cliente, obterVisao360Pet } from "../ia-consultas.server";
import { criarClienteIA, criarPetIA } from "../ia-acoes.server";
import { validarGravacaoReal } from "../jessi-guardrails";

/**
 * Adaptadores de Clientes e Pets para a Jessi
 */

export async function buscarClientesJessi(
  sb: SupabaseClient<Database>,
  params: { termo: string }
): Promise<JessiQueryResult> {
  const res = await buscarClientesIA(sb, params.termo);

  return {
    success: res.success,
    source: "clientes",
    data: res.data,
    total_count: Array.isArray(res.data) ? res.data.length : 0,
    filters_applied: { termo: params.termo },
    executed_at: new Date().toISOString(),
    summary: `Encontrados ${Array.isArray(res.data) ? res.data.length : 0} cliente(s) para "${params.termo}".`,
  };
}

export async function buscarPetsDoClienteJessi(
  sb: SupabaseClient<Database>,
  params: { cliente_id: string }
): Promise<JessiQueryResult> {
  const res = await buscarPetsDoClienteIA(sb, params.cliente_id);

  return {
    success: res.success,
    source: "pets",
    data: res.data,
    total_count: Array.isArray(res.data) ? res.data.length : 0,
    filters_applied: { cliente_id: params.cliente_id },
    executed_at: new Date().toISOString(),
    summary: `Encontrados ${Array.isArray(res.data) ? res.data.length : 0} pet(s) do cliente.`,
  };
}

export async function obterVisao360ClienteJessi(
  sb: SupabaseClient<Database>,
  params: { cliente_id: string }
): Promise<JessiQueryResult> {
  const res = await obterVisao360Cliente(sb, params.cliente_id);

  return {
    success: res.success,
    source: "visao_360_cliente",
    data: res.data,
    executed_at: new Date().toISOString(),
    summary: `Visão 360° do cliente carregada com sucesso.`,
  };
}

export async function obterVisao360PetJessi(
  sb: SupabaseClient<Database>,
  params: { pet_id: string }
): Promise<JessiQueryResult> {
  const res = await obterVisao360Pet(sb, params.pet_id);

  return {
    success: res.success,
    source: "visao_360_pet",
    data: res.data,
    executed_at: new Date().toISOString(),
    summary: `Visão 360° do pet carregada com sucesso.`,
  };
}

export async function criarClienteJessi(
  sb: SupabaseClient<Database>,
  params: { nome: string; telefone?: string; email?: string }
): Promise<JessiMutationResult> {
  const res = await criarClienteIA(sb, params);

  const validacao = res.affected_record_id
    ? await validarGravacaoReal(sb, "clientes", res.affected_record_id)
    : { verificado: false, dados: null };

  return {
    success: res.success,
    source: "criar_cliente",
    affected_record_id: res.affected_record_id,
    after: res.data,
    verified: validacao.verificado,
    executed_at: new Date().toISOString(),
    summary: `Cliente "${params.nome}" cadastrado com sucesso.`,
  };
}

export async function criarPetJessi(
  sb: SupabaseClient<Database>,
  params: { cliente_id: string; nome: string; especie?: string; raca?: string; porte?: string }
): Promise<JessiMutationResult> {
  const res = await criarPetIA(sb, params);

  const validacao = res.affected_record_id
    ? await validarGravacaoReal(sb, "pets", res.affected_record_id)
    : { verificado: false, dados: null };

  return {
    success: res.success,
    source: "criar_pet",
    affected_record_id: res.affected_record_id,
    after: res.data,
    verified: validacao.verificado,
    executed_at: new Date().toISOString(),
    summary: `Pet "${params.nome}" cadastrado com sucesso.`,
  };
}
