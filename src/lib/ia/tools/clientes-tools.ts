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
  params: { cliente_id?: string; cliente_nome?: string; termo?: string },
  contexto?: any
): Promise<JessiQueryResult> {
  let targetId = params.cliente_id || contexto?.contexto?.clienteSelecionadoId;

  // Se não temos UUID, tenta resolver pelo nome do cliente ou termo
  if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    const nomeOuTermo = params.cliente_nome || params.termo || targetId;
    if (nomeOuTermo) {
      const buscaCli = await buscarClientesIA(sb, nomeOuTermo);
      if (Array.isArray(buscaCli.data) && buscaCli.data.length > 0) {
        targetId = buscaCli.data[0].id;
      }
    }
  }

  if (!targetId) {
    return {
      success: false,
      source: "pets",
      data: [],
      total_count: 0,
      executed_at: new Date().toISOString(),
      summary: "Não foi possível identificar o cliente para listar os pets. Por favor, informe o nome do cliente.",
    };
  }

  const res = await buscarPetsDoClienteIA(sb, targetId);
  const petsList = Array.isArray(res.data) ? res.data : [];
  const nomesPets = petsList.map((p: any) => p.nome).join(", ");

  return {
    success: res.success,
    source: "pets",
    data: petsList,
    total_count: petsList.length,
    filters_applied: { cliente_id: targetId },
    executed_at: new Date().toISOString(),
    summary: petsList.length > 0
      ? `Encontrado(s) ${petsList.length} pet(s): ${nomesPets}.`
      : "Nenhum pet encontrado para este cliente.",
  };
}

export async function obterVisao360ClienteJessi(
  sb: SupabaseClient<Database>,
  params: { cliente_id?: string; cliente_nome?: string; termo?: string },
  contexto?: any
): Promise<JessiQueryResult> {
  let targetId = params.cliente_id || contexto?.contexto?.clienteSelecionadoId;

  if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    const nomeOuTermo = params.cliente_nome || params.termo || targetId;
    if (nomeOuTermo) {
      const buscaCli = await buscarClientesIA(sb, nomeOuTermo);
      if (Array.isArray(buscaCli.data) && buscaCli.data.length > 0) {
        targetId = buscaCli.data[0].id;
      }
    }
  }

  if (!targetId) {
    return {
      success: false,
      source: "visao_360_cliente",
      data: null,
      executed_at: new Date().toISOString(),
      summary: "Cliente não localizado para gerar visão 360°.",
    };
  }

  const res = await obterVisao360Cliente(sb, targetId);

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
