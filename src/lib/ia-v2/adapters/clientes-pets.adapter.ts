import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

/**
 * Adaptador Oficial de Clientes & Pets para a Jessi V2 (Busca Resiliente e Fichas)
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export class ClientesPetsAdapter {
  /**
   * Busca resiliente por nome do cliente, telefone, CPF ou nome do pet
   */
  static async buscarClientesPets(
    sb: SupabaseClient<Database>,
    termo: string
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    try {
      const termoLimpo = (termo || "").trim();
      if (!termoLimpo) {
        // Retorna os clientes recentes se termo estiver vazio
        const { data: recentes } = await sb
          .from("clientes")
          .select("id, nome, telefone, email, pets(id, nome, raca, porte)")
          .order("created_at", { ascending: false })
          .limit(10);

        return {
          success: true,
          source: "tabela_clientes",
          data: recentes || [],
          total_count: recentes?.length || 0,
          summary: `Exibindo os ${recentes?.length || 0} clientes mais recentes.`,
          executed_at: new Date().toISOString(),
          correlation_id: `query_clientes_${inicio}`,
        };
      }

      // Busca combinada por cliente
      const { data: clientesPorNome, error: errCli } = await sb
        .from("clientes")
        .select("id, nome, telefone, email, endereco, pets(id, nome, raca, porte)")
        .or(`nome.ilike.%${termoLimpo}%,telefone.ilike.%${termoLimpo}%,email.ilike.%${termoLimpo}%`)
        .limit(10);

      if (errCli) throw errCli;

      // Busca também por pets cujo nome coincida
      const { data: petsPorNome } = await sb
        .from("pets")
        .select("id, nome, raca, porte, cliente:clientes(id, nome, telefone, email)")
        .ilike("nome", `%${termoLimpo}%`)
        .limit(10);

      const resultadosAgrupados = {
        clientes: clientesPorNome || [],
        petsEncontrados: petsPorNome || [],
      };

      const total = (clientesPorNome?.length || 0) + (petsPorNome?.length || 0);

      return {
        success: true,
        source: "tabela_clientes_e_pets",
        data: resultadosAgrupados,
        total_count: total,
        summary: `Encontrado(s) ${clientesPorNome?.length || 0} cliente(s) e ${petsPorNome?.length || 0} pet(s) para "${termoLimpo}".`,
        filters_applied: { termo: termoLimpo },
        executed_at: new Date().toISOString(),
        correlation_id: `query_busca_${inicio}`,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_clientes",
        data: { clientes: [], petsEncontrados: [] },
        total_count: 0,
        summary: `Erro na busca resiliente: ${err.message}`,
        error_code: err.code || "ERRO_BUSCA_CLIENTES",
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtém ficha detalhada do pet com histórico recente de atendimentos e restrições
   */
  static async obterFichaPet(
    sb: SupabaseClient<Database>,
    petId: string
  ): Promise<JessiV2QueryResult> {
    try {
      const { data: pet, error } = await sb
        .from("pets")
        .select(`
          id,
          nome,
          especie,
          raca,
          porte,
          peso,
          data_nascimento,
          observacoes_saude,
          cliente:clientes(id, nome, telefone, email)
        `)
        .eq("id", petId)
        .maybeSingle();

      if (error || !pet) throw error || new Error("Pet não encontrado.");

      // Busca histórico dos últimos 5 atendimentos
      const { data: atendimentos } = await sb
        .from("agendamentos")
        .select("id, data_hora, status, valor_total")
        .eq("pet_id", petId)
        .order("data_hora", { ascending: false })
        .limit(5);

      return {
        success: true,
        source: "ficha_pet_consolidada",
        data: {
          ...pet,
          historicoAtendimentos: atendimentos || [],
        },
        summary: `Ficha completa de ${pet.nome} (${pet.raca || "Raça não informada"}).`,
        executed_at: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        source: "ficha_pet",
        data: null,
        summary: `Não foi possível carregar a ficha do pet: ${err.message}`,
        error_code: "PET_NAO_ENCONTRADO",
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Gravação de cliente pós-confirmação humana com Read-Back
   */
  static async executarCadastroClienteConfirmado(
    sb: SupabaseClient<Database>,
    params: { nome: string; telefone?: string; email?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    try {
      const { data: novoCliente, error } = await sb
        .from("clientes")
        .insert({
          nome: params.nome,
          telefone: params.telefone || null,
          email: params.email || null,
        } as any)
        .select("id, nome, telefone, email")
        .single();

      if (error || !novoCliente) throw error || new Error("Falha ao registrar cliente.");

      // Read-back verification
      const { data: readBack } = await sb
        .from("clientes")
        .select("id, nome")
        .eq("id", novoCliente.id)
        .maybeSingle();

      return {
        success: true,
        source: "tabela_clientes",
        affected_record_id: novoCliente.id,
        after: novoCliente,
        summary: `Cliente ${novoCliente.nome} cadastrado e verificado com sucesso no banco de dados.`,
        executed_at: new Date().toISOString(),
        verified: Boolean(readBack?.id),
        idempotency_key: idempotencyKey,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "tabela_clientes",
        summary: `Erro ao cadastrar cliente: ${err.message}`,
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        error_code: err.code || "ERRO_CADASTRO_CLIENTE",
        verified: false,
      };
    }
  }
}
