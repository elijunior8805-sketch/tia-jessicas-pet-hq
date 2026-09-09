import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";

/**
 * Normaliza strings removendo acentos, caracteres especiais e convertendo para minúsculas
 */
export function normalizarTexto(texto?: string | null): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Calcula a distância de Levenshtein para medir proximidade entre strings
 */
export function calcularDistanciaLevenshtein(a: string, b: string): number {
  const normA = normalizarTexto(a);
  const normB = normalizarTexto(b);
  if (!normA.length) return normB.length;
  if (!normB.length) return normA.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= normB.length; i++) matrix[i] = [i];
  for (let j = 0; j <= normA.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= normB.length; i++) {
    for (let j = 1; j <= normA.length; j++) {
      if (normB.charAt(i - 1) === normA.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }

  return matrix[normB.length][normA.length];
}

/**
 * Calcula score de similaridade entre 0.0 (totalmente diferente) e 1.0 (idêntico)
 */
export function calcularSimilaridade(a: string, b: string): number {
  const normA = normalizarTexto(a);
  const normB = normalizarTexto(b);
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  const dist = calcularDistanciaLevenshtein(normA, normB);
  return Math.max(0, 1 - dist / maxLen);
}

export interface CandidatoLocalizado {
  id: string;
  tipo: "cliente" | "pet";
  nomePrincipal: string;
  detalheSecundario: string;
  scoreConfianca: number;
  dadosCompletos: any;
}

/**
 * Adaptador Oficial de Clientes & Pets para a Jessi V2 (Hierarquia Completa da Seção 9)
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */
export class ClientesPetsAdapter {
  /**
   * Localiza clientes e pets seguindo a ordem estrita de prioridade:
   * 1. ID -> 2. Correspondência Exata -> 3. Telefone -> 4. Nome Normalizado -> 5. Correspondência Aproximada -> 6. Opções
   * Regra Absoluta: NUNCA escolher silenciosamente diante de duas opções válidas.
   */
  static async buscarClientesPets(
    sb: SupabaseClient<Database>,
    termo: string
  ): Promise<JessiV2QueryResult<{ candidatos: CandidatoLocalizado[]; exigeDesambiguacao: boolean; opcoesParaApresentacao?: string[] }>> {
    const inicio = Date.now();
    const termoOriginal = (termo || "").trim();
    const termoNorm = normalizarTexto(termoOriginal);
    const apenasDigitos = termoOriginal.replace(/\D/g, "");

    try {
      if (!termoNorm) {
        const { data: recentes } = await sb
          .from("clientes")
          .select("id, nome, telefone, email, pets(id, nome, raca, porte)")
          .order("created_at", { ascending: false })
          .limit(5);

        const candidatosRecentes: CandidatoLocalizado[] = (recentes || []).map((c: any) => ({
          id: c.id,
          tipo: "cliente",
          nomePrincipal: c.nome,
          detalheSecundario: `Telefone: ${c.telefone || "Sem telefone"} | Pets: ${(c.pets || []).map((p: any) => p.nome).join(", ") || "Nenhum"}`,
          scoreConfianca: 1.0,
          dadosCompletos: c,
        }));

        return {
          success: true,
          source: "tabela_clientes_recentes",
          data: { candidatos: candidatosRecentes, exigeDesambiguacao: false },
          total_count: candidatosRecentes.length,
          summary: `Exibindo os ${candidatosRecentes.length} clientes mais recentes.`,
          executed_at: new Date().toISOString(),
          correlation_id: `busca_recentes_${inicio}`,
        };
      }

      // 1. TIER 1: Busca Direta por ID (UUID ou chave)
      const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(termoOriginal);
      if (ehUuid) {
        const { data: clienteId } = await sb
          .from("clientes")
          .select("id, nome, telefone, email, pets(id, nome, raca, porte)")
          .eq("id", termoOriginal)
          .maybeSingle();

        if (clienteId) {
          const candidato: CandidatoLocalizado = {
            id: clienteId.id,
            tipo: "cliente",
            nomePrincipal: clienteId.nome,
            detalheSecundario: `ID Exato: ${clienteId.id}`,
            scoreConfianca: 1.0,
            dadosCompletos: clienteId,
          };
          return {
            success: true,
            source: "busca_por_id",
            data: { candidatos: [candidato], exigeDesambiguacao: false },
            total_count: 1,
            summary: `Cliente ${clienteId.nome} localizado diretamente pelo ID.`,
            executed_at: new Date().toISOString(),
          };
        }
      }

      // 2. Busca ampla de clientes e pets no banco para ranqueamento
      const { data: todosClientes } = await sb
        .from("clientes")
        .select("id, nome, telefone, email, endereco, pets(id, nome, raca, porte)")
        .limit(100);

      const { data: todosPets } = await sb
        .from("pets")
        .select("id, nome, raca, porte, cliente:clientes(id, nome, telefone, email)")
        .limit(100);

      const candidatosRanqueados: CandidatoLocalizado[] = [];

      // Avaliação de Clientes (Nome completo, primeiro nome, sobrenome, abreviado, sem acento, telefone, erros de digitação)
      (todosClientes || []).forEach((cli: any) => {
        const nomeNorm = normalizarTexto(cli.nome);
        const telLimpo = (cli.telefone || "").replace(/\D/g, "");
        const partesNome = nomeNorm.split(/\s+/);

        let score = 0;

        // 1. Correspondência Exata de Nome Completo
        if (nomeNorm === termoNorm) {
          score = 1.0;
        }
        // 2. Telefone Exato ou Substring (com ou sem DDD)
        else if (apenasDigitos.length >= 8 && telLimpo.includes(apenasDigitos)) {
          score = 0.98;
        }
        // 3. Primeiro Nome ou Sobrenome Exato
        else if (partesNome.some((p) => p === termoNorm)) {
          score = 0.94;
        }
        // 4. Nome Abreviado / Iniciais (ex: "J. Silva", "Jessica S", "M. Santos")
        else if (
          partesNome.some((p) => p.startsWith(termoNorm) || termoNorm.startsWith(p)) ||
          nomeNorm.startsWith(termoNorm) ||
          nomeNorm.includes(termoNorm)
        ) {
          score = 0.90;
        }
        // 5. Correspondência Aproximada / Erro de Digitação (Levenshtein)
        else {
          const sim = calcularSimilaridade(nomeNorm, termoNorm);
          if (sim >= 0.70) score = sim * 0.86;
        }

        if (score > 0) {
          candidatosRanqueados.push({
            id: cli.id,
            tipo: "cliente",
            nomePrincipal: cli.nome,
            detalheSecundario: `Tutor • Tel: ${cli.telefone || "Sem telefone"} • Pets: ${(cli.pets || []).map((p: any) => p.nome).join(", ") || "Nenhum"}`,
            scoreConfianca: score,
            dadosCompletos: cli,
          });
        }
      });

      // Avaliação de Pets (Nome do pet, raça, pequeno erro de digitação, vínculo do tutor)
      (todosPets || []).forEach((pet: any) => {
        const nomeNorm = normalizarTexto(pet.nome);
        let score = 0;

        if (nomeNorm === termoNorm) {
          score = 1.0;
        } else if (nomeNorm.startsWith(termoNorm) || nomeNorm.includes(termoNorm)) {
          score = 0.92;
        } else {
          const sim = calcularSimilaridade(nomeNorm, termoNorm);
          if (sim >= 0.70) score = sim * 0.88;
        }

        if (score > 0) {
          candidatosRanqueados.push({
            id: pet.id,
            tipo: "pet",
            nomePrincipal: pet.nome,
            detalheSecundario: `Pet (${pet.raca || "Raça padrão"}) • Tutor: ${pet.cliente?.nome || "Não vinculado"}`,
            scoreConfianca: score,
            dadosCompletos: pet,
          });
        }
      });

      // Ordena decrescente por score de confiança
      candidatosRanqueados.sort((a, b) => b.scoreConfianca - a.scoreConfianca);

      // Regra da Seção 9: NUNCA escolher silenciosamente diante de duas opções válidas com scores próximos
      const melhoresCandidatos = candidatosRanqueados.slice(0, 5);
      const existeAmbiguidade =
        melhoresCandidatos.length > 1 &&
        Math.abs(melhoresCandidatos[0].scoreConfianca - melhoresCandidatos[1].scoreConfianca) < 0.15;

      let opcoesFormatadas: string[] | undefined;
      let resumoTexto = "";

      if (melhoresCandidatos.length === 0) {
        resumoTexto = `Nenhum cliente ou pet encontrado para o termo "${termoOriginal}".`;
      } else if (existeAmbiguidade) {
        resumoTexto = `Encontrei ${melhoresCandidatos.length} opções semelhantes para "${termoOriginal}". Por favor, escolha qual delas você deseja:`;
        opcoesFormatadas = melhoresCandidatos.map(
          (c, idx) => `${idx + 1}. **${c.nomePrincipal}** (${c.detalheSecundario})`
        );
      } else {
        const principal = melhoresCandidatos[0];
        resumoTexto = `Localizado com sucesso: **${principal.nomePrincipal}** (${principal.detalheSecundario}).`;
      }

      return {
        success: true,
        source: "busca_hierarquica_clientes_pets",
        data: {
          candidatos: melhoresCandidatos,
          exigeDesambiguacao: existeAmbiguidade,
          opcoesParaApresentacao: opcoesFormatadas,
        },
        total_count: melhoresCandidatos.length,
        summary: resumoTexto,
        filters_applied: { termo: termoOriginal, termoNormalizado: termoNorm },
        executed_at: new Date().toISOString(),
        correlation_id: `busca_${inicio}`,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "busca_clientes_pets",
        data: { candidatos: [], exigeDesambiguacao: false },
        total_count: 0,
        summary: `Erro ao localizar clientes e pets: ${err.message}`,
        error_code: err.code || "ERRO_BUSCA",
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtém ficha detalhada do pet com histórico recente de atendimentos e restrições
   */
  /**
   * Obtém ficha detalhada do pet com histórico completo de atendimentos, restrições e programa ativo
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
          raca,
          porte,
          peso,
          nascimento,
          cuidados_saude,
          alergias,
          observacoes,
          cliente:clientes(id, nome, whatsapp, telefone, email, endereco, bairro, cidade)
        `)
        .eq("id", petId)
        .maybeSingle();

      if (error || !pet) throw error || new Error("Pet não encontrado.");

      // Histórico de atendimentos e serviços realizados
      const { data: atendimentos } = await sb
        .from("agendamentos")
        .select(`
          id,
          data,
          hora,
          status,
          valor_previsto,
          observacoes,
          leva_traz_modalidade,
          servicos(id, nome, valor)
        `)
        .eq("pet_id", petId)
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(10);

      // Programa contratado ativo do pet
      const { data: programas } = await sb
        .from("programas_contratados")
        .select("id, nome_snapshot, data_de_inicio, data_de_validade, status_do_programa")
        .eq("pet_id", petId)
        .eq("status_do_programa", "ativo")
        .limit(3);

      const ultimoAtendimento = atendimentos && atendimentos.length > 0 ? atendimentos[0] : null;
      const petNome = (pet as any).nome;
      const raca = (pet as any).raca || "Padrão";
      const tutor = (pet as any).cliente?.nome || "Tutor não vinculado";

      let summary = `**Ficha Cadastral de ${petNome}** (${raca})\n• Tutor: ${tutor}\n• Porte: ${(pet as any).porte || "Médio"} | Peso: ${(pet as any).peso ? `${(pet as any).peso}kg` : "Não informado"}`;

      if ((pet as any).cuidados_saude || (pet as any).alergias) {
        summary += `\n• Cuidados/Alergias: ${(pet as any).cuidados_saude || (pet as any).alergias}`;
      }

      if (ultimoAtendimento) {
        const dataFmt = new Date(`${ultimoAtendimento.data}T12:00:00`).toLocaleDateString("pt-BR");
        const srv = (ultimoAtendimento.servicos as any)?.nome || "Atendimento";
        summary += `\n• Último Atendimento: ${dataFmt} (${srv} - Status: ${ultimoAtendimento.status})`;
      }

      if (programas && programas.length > 0) {
        summary += `\n• Programa Ativo: ${programas[0].nome_snapshot} (Válido até ${new Date(`${programas[0].data_de_validade}T12:00:00`).toLocaleDateString("pt-BR")})`;
      }

      return {
        success: true,
        source: "ficha_pet_consolidada",
        data: {
          ...(pet as any),
          historicoAtendimentos: atendimentos || [],
          ultimoAtendimento,
          programasAtivos: programas || [],
        },
        summary,
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
   * Obtém ficha cadastral e financeira completa de um cliente com todos os pets e situação financeira
   */
  static async obterFichaClienteCompleta(
    sb: SupabaseClient<Database>,
    clienteId: string
  ): Promise<JessiV2QueryResult> {
    try {
      const { data: cliente, error } = await sb
        .from("clientes")
        .select(`
          id,
          nome,
          telefone,
          whatsapp,
          email,
          cpf,
          rua,
          numero,
          bairro,
          cidade,
          observacoes,
          pets(id, nome, raca, porte, peso, cuidados_saude, alergias)
        `)
        .eq("id", clienteId)
        .maybeSingle();

      if (error || !cliente) throw error || new Error("Cliente não encontrado.");

      // Consulta situação financeira do cliente (pagamentos pendentes e histórico)
      const { data: pagamentos } = await sb
        .from("pagamentos")
        .select("id, valor_total, valor_pago, status, vencimento, forma")
        .eq("cliente_id", clienteId)
        .is("arquivado_em", null)
        .order("created_at", { ascending: false })
        .limit(10);

      // Programas contratados do cliente
      const { data: programas } = await sb
        .from("programas_contratados")
        .select("id, nome_snapshot, data_de_inicio, data_de_validade, status_do_programa, pet_id")
        .eq("cliente_id", clienteId)
        .eq("status_do_programa", "ativo");

      const pendentes = (pagamentos || []).filter((p) => p.status !== "pago" && p.status !== "cancelado");
      const totalPendente = pendentes.reduce(
        (acc, p) => acc + Math.max((Number(p.valor_total) || 0) - (Number(p.valor_pago) || 0), 0),
        0
      );

      const petsList = (cliente.pets || []).map((p: any) => `${p.nome} (${p.raca || "Padrão"})`).join(", ");
      const sitFin = totalPendente > 0 ? `Possui R$ ${totalPendente.toFixed(2)} em pendências de pagamento` : "Situação financeira regular (Sem débitos pendentes)";

      const summary =
        `**Ficha Cadastral de ${cliente.nome}**\n` +
        `• Telefone/WhatsApp: ${cliente.whatsapp || cliente.telefone || "Não informado"}\n` +
        `• Endereço: ${[cliente.rua, cliente.numero].filter(Boolean).join(", ") || "Não cadastrado"}${cliente.bairro ? ` - ${cliente.bairro}` : ""}${cliente.cidade ? `, ${cliente.cidade}` : ""}\n` +
        `• Pets Vinculados (${cliente.pets?.length || 0}): ${petsList || "Nenhum"}\n` +
        `• Programas Ativos: ${programas?.length ? programas.map((pr: any) => pr.nome_snapshot).join(", ") : "Nenhum plano ativo"}\n` +
        `• Situação Financeira: ${sitFin}`;

      return {
        success: true,
        source: "ficha_cliente_consolidada",
        data: {
          ...cliente,
          historicoPagamentos: pagamentos || [],
          totalPendente,
          programasAtivos: programas || [],
        },
        summary,
        executed_at: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        source: "ficha_cliente",
        data: null,
        summary: `Não foi possível carregar a ficha do cliente: ${err.message}`,
        error_code: "CLIENTE_NAO_ENCONTRADO",
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
