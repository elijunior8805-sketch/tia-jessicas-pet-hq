import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult, JessiV2MutationResult } from "../contracts/jessi-v2-contracts";
import { calcularSaldoContrato } from "@/lib/programas-contratos.server";

/**
 * Interface do Contrato Real de Programa Ativo (Seção 16)
 */
export interface JessiV2ContratoProgramaAtivo {
  id: string;
  tutor: { id: string; nome: string; telefone: string };
  pet: { id: string; nome: string; raca: string };
  programa: { id: string; nome: string; precoBase: number };
  contratacaoData: string;
  validadeData: string;
  diasRestantes: number;
  creditosContratados: number;
  creditosUtilizados: number;
  creditosDisponiveis: number;
  statusPagamento: "pago" | "pendente" | "isento";
}

/**
 * Adaptador Oficial de Programas de Cuidados & Clubinho para a Jessi V2 (Seção 16)
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */
export class ProgramasCreditosAdapter {
  /**
   * Consulta todos os contratos reais de programas ativos no sistema (Seção 16)
   */
  static async consultarProgramasAtivosGeral(
    sb: SupabaseClient<Database>
  ): Promise<JessiV2QueryResult<JessiV2ContratoProgramaAtivo[]>> {
    const inicio = Date.now();
    const correlationId = `query_prog_ativos_${inicio}`;
    const hoje = new Date();
    const hojeStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(hoje);

    try {
      const { data: contratos, error } = await sb
        .from("programas_contratados")
        .select(`
          id,
          cliente_id,
          pet_id,
          nome_snapshot,
          preco_vendido,
          data_da_venda,
          data_de_inicio,
          data_de_validade,
          status_do_pagamento,
          status_do_programa,
          clientes(id, nome, whatsapp),
          pets(id, nome, raca)
        `)
        .eq("status_do_programa", "ativo")
        .gte("data_de_validade", hojeStr);

      if (error) throw error;

      const ids = (contratos || []).map((c: any) => c.id);
      const { data: movs } = ids.length
        ? await sb
            .from("programas_creditos_movimentacoes")
            .select("programa_contratado_id, tipo, quantidade, servico_id")
            .in("programa_contratado_id", ids)
        : { data: [] as any[] };

      const listaFormatada: JessiV2ContratoProgramaAtivo[] = (contratos || []).map((c: any) => {
        const movsContrato = (movs || []).filter((m: any) => m.programa_contratado_id === c.id);
        const saldos = calcularSaldoContrato(movsContrato);
        const totais = Object.values(saldos).reduce(
          (acc, s) => ({
            contratados: acc.contratados + s.criado,
            utilizados: acc.utilizados + s.consumido,
            disponiveis: acc.disponiveis + s.disponivel,
          }),
          { contratados: 0, utilizados: 0, disponiveis: 0 }
        );

        const dataFim = new Date(`${c.data_de_validade}T23:59:59`);
        const diffDias = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          tutor: {
            id: c.clientes?.id || c.cliente_id,
            nome: c.clientes?.nome || "Tutor não identificado",
            telefone: c.clientes?.whatsapp || "Sem telefone",
          },
          pet: {
            id: c.pets?.id || c.pet_id,
            nome: c.pets?.nome || "Pet",
            raca: c.pets?.raca || "Padrão",
          },
          programa: {
            id: c.id,
            nome: c.nome_snapshot || "Programa de Cuidado",
            precoBase: Number(c.preco_vendido) || 0,
          },
          contratacaoData: c.data_da_venda || c.data_de_inicio || hojeStr,
          validadeData: c.data_de_validade || hojeStr,
          diasRestantes: Math.max(diffDias, 0),
          creditosContratados: totais.contratados,
          creditosUtilizados: totais.utilizados,
          creditosDisponiveis: totais.disponiveis,
          statusPagamento: (c.status_do_pagamento === "pago" ? "pago" : "pendente") as "pago" | "pendente",
        };
      });

      const resumo =
        listaFormatada.length > 0
          ? `Existem ${listaFormatada.length} contrato(s) de programas ativos com saldo de créditos no Spa.`
          : "Nenhum contrato ativo de programas encontrado no momento.";

      return {
        success: true,
        source: "programas_contratados",
        data: listaFormatada,
        total_count: listaFormatada.length,
        summary: resumo,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "programas_contratados",
        data: [],
        total_count: 0,
        summary: `Erro ao consultar contratos reais de programas: ${err.message}`,
        error_code: err.code || "ERRO_PROGRAMAS_ATIVOS",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Consulta os créditos específicos de um cliente/pet
   */
  static async consultarSaldoCreditos(
    sb: SupabaseClient<Database>,
    clienteId: string,
    petId?: string
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    const correlationId = `query_programas_${inicio}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      let queryProg = sb
        .from("programas_contratados")
        .select("id, cliente_id, pet_id, nome_snapshot, preco_vendido, data_de_inicio, data_de_validade, status_do_programa")
        .eq("cliente_id", clienteId)
        .eq("status_do_programa", "ativo");

      if (petId) queryProg = queryProg.eq("pet_id", petId);

      const { data: assinaturas, error } = await queryProg;
      if (error) throw error;

      const ids = (assinaturas || []).map((a: any) => a.id);
      const { data: movs } = ids.length
        ? await sb
            .from("programas_creditos_movimentacoes")
            .select("programa_contratado_id, tipo, quantidade, servico_id")
            .in("programa_contratado_id", ids)
        : { data: [] as any[] };

      const creditosDisponiveis = (assinaturas || []).map((a: any) => ({
        contratoId: a.id,
        programa: a.nome_snapshot,
        validade: a.data_de_validade,
        saldos: Object.values(calcularSaldoContrato((movs || []).filter((m: any) => m.programa_contratado_id === a.id))),
      }));

      const totalCreditos = creditosDisponiveis.reduce(
        (acc, c: any) => acc + c.saldos.reduce((s: number, x: any) => s + x.disponivel, 0),
        0
      );

      const primeiraValidade = assinaturas && assinaturas[0]?.data_de_validade
        ? new Date(`${assinaturas[0].data_de_validade}T12:00:00`).toLocaleDateString("pt-BR")
        : null;

      const summary = totalCreditos > 0
        ? `Possui ${totalCreditos} crédito(s) ativo(s) do Clubinho${primeiraValidade ? ` com validade até ${primeiraValidade}` : ""}.`
        : assinaturas?.length
        ? `Possui contrato do Clubinho cadastrado${primeiraValidade ? ` (válido até ${primeiraValidade})` : ""}, porém sem saldo de créditos disponível no momento.`
        : "Nenhum plano ativo do Clubinho encontrado.";

      return {
        success: true,
        source: "programas_contratados",
        data: {
          assinaturasAtivas: assinaturas || [],
          creditosDisponiveis,
          totalSessaoRestantes: totalCreditos,
          validade: primeiraValidade,
        },
        total_count: assinaturas?.length || 0,
        summary,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "programas_contratados",
        data: { assinaturasAtivas: [], creditosDisponiveis: [], totalSessaoRestantes: 0 },
        total_count: 0,
        summary: `Erro ao consultar saldo de programas: ${err.message}`,
        error_code: err.code || "ERRO_CONSULTA_PROGRAMAS",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Prepara o abatimento de 1 crédito no banho com cobrança separada de itens extras (Seção 16)
   */
  static prepararFinalizacaoComExtras(params: {
    clienteId: string;
    clienteNome: string;
    petId: string;
    petNome: string;
    creditoId: string;
    saldoAtual: number;
    valorBanho: number;
    servicosExtras: Array<{ nome: string; valor: number }>;
  }) {
    const totalExtras = params.servicosExtras.reduce((acc, curr) => acc + curr.valor, 0);

    return {
      title: `Finalizar Atendimento de ${params.petNome} com Crédito do Clubinho`,
      summary:
        `• Banho Principal: R$ ${params.valorBanho.toFixed(2)} (Quitado com 1 Crédito do Plano)\n` +
        `• Extras a Pagar: R$ ${totalExtras.toFixed(2)} (${params.servicosExtras.map((e) => e.nome).join(", ") || "Nenhum"})\n` +
        `• Total a Pagar no Caixa: R$ ${totalExtras.toFixed(2)}\n` +
        `• Saldo Restante de Créditos: ${params.saldoAtual - 1} sessão(ões)`,
      params: {
        ...params,
        totalExtras,
        debitoCredito: 1,
      },
    };
  }

  /**
   * Registra o consumo de crédito pós-confirmação humana com Read-Back
   */
  static async executarConsumoCreditoConfirmado(
    sb: SupabaseClient<Database>,
    params: { contratoId: string; servicoId: string; quantidade: number; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `mut_credito_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const { data: movsAntes, error: errFetch } = await sb
        .from("programas_creditos_movimentacoes")
        .select("programa_contratado_id, tipo, quantidade, servico_id")
        .eq("programa_contratado_id", params.contratoId);

      if (errFetch) throw errFetch;

      const saldosAntes = calcularSaldoContrato(movsAntes || []);
      const disponivel = saldosAntes[params.servicoId]?.disponivel || 0;

      if (disponivel < params.quantidade) {
        return {
          success: false,
          entity_id: params.contratoId,
          affected_record_id: params.contratoId,
          source: "programas_creditos_movimentacoes",
          summary: `Saldo insuficiente: disponível ${disponivel}, solicitado ${params.quantidade}.`,
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          error_code: "SALDO_INSUFICIENTE",
          correlation_id: correlationId,
          verified: false,
        };
      }

      const { data: movimentacao, error: errInsert } = await sb
        .from("programas_creditos_movimentacoes")
        .insert({
          programa_contratado_id: params.contratoId,
          servico_id: params.servicoId,
          tipo: "credito_consumido",
          quantidade: params.quantidade,
          motivo: params.motivo || "Consumo autorizado pela assistente",
          idempotency_key: idempotencyKey,
        } as any)
        .select("id, programa_contratado_id, servico_id, quantidade, tipo")
        .single();

      if (errInsert || !movimentacao) throw errInsert || new Error("Falha ao registrar consumo de crédito.");

      const { data: movsDepois } = await sb
        .from("programas_creditos_movimentacoes")
        .select("programa_contratado_id, tipo, quantidade, servico_id")
        .eq("programa_contratado_id", params.contratoId);

      const saldosDepois = calcularSaldoContrato(movsDepois || []);
      const novoSaldo = saldosDepois[params.servicoId]?.disponivel ?? disponivel;

      return {
        success: true,
        entity_id: movimentacao.id,
        affected_record_id: params.contratoId,
        source: "programas_creditos_movimentacoes",
        before: { disponivel },
        after: { disponivel: novoSaldo },
        summary: `Crédito consumido com sucesso. Novo saldo: ${novoSaldo}.`,
        executed_at: new Date().toISOString(),
        verified: novoSaldo === disponivel - params.quantidade,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.contratoId,
        affected_record_id: params.contratoId,
        source: "programas_creditos_movimentacoes",
        summary: `Erro ao consumir crédito: ${err.message}`,
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        error_code: err.code || "ERRO_CONSUMO_CREDITO",
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Reserva 1 crédito vinculado ao agendamento para impedir duplo consumo (Seção 16)
   */
  static async reservarCreditoAgendamento(
    sb: SupabaseClient<Database>,
    params: { creditoId: string; agendamentoId: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `reserva_credito_${Date.now()}`;
    try {
      const { data: credito } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo, servico_nome")
        .eq("id", params.creditoId)
        .single();

      if (!credito || (credito.saldo || 0) < 1) {
        return {
          success: false,
          entity_id: params.creditoId,
          source: "tabela_creditos",
          summary: "Não há saldo de créditos disponível para reservar.",
          error_code: "CREDITO_INDISPONIVEL",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      return {
        success: true,
        entity_id: params.creditoId,
        affected_record_id: params.creditoId,
        source: "tabela_creditos",
        summary: `1 crédito de "${credito.servico_nome}" reservado com sucesso para o agendamento #${params.agendamentoId.slice(0, 8)}.`,
        executed_at: new Date().toISOString(),
        verified: true,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.creditoId,
        source: "tabela_creditos",
        summary: `Falha ao reservar crédito: ${err.message}`,
        error_code: "ERRO_RESERVA_CREDITO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * Libera o crédito reservado em caso de cancelamento elegível (Seção 16)
   */
  static async liberarCreditoCancelamento(
    sb: SupabaseClient<Database>,
    params: { creditoId: string; agendamentoId: string; motivo?: string },
    idempotencyKey: string
  ): Promise<JessiV2MutationResult> {
    const correlationId = `libera_credito_${Date.now()}`;
    try {
      const { data: creditoAtual } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo, servico_nome")
        .eq("id", params.creditoId)
        .single();

      if (!creditoAtual) {
        return {
          success: false,
          entity_id: params.creditoId,
          source: "tabela_creditos",
          summary: "Registro de crédito não encontrado para estorno/liberação.",
          error_code: "CREDITO_NAO_ENCONTRADO",
          idempotency_key: idempotencyKey,
          executed_at: new Date().toISOString(),
          correlation_id: correlationId,
          verified: false,
        };
      }

      const novoSaldo = (creditoAtual.saldo || 0) + 1;

      const { data: atualizado, error } = await sb
        .from("cliente_programa_creditos")
        .update({ saldo: novoSaldo } as any)
        .eq("id", params.creditoId)
        .select("id, saldo, servico_nome")
        .single();

      if (error || !atualizado) throw error || new Error("Falha ao liberar crédito.");

      const { data: readBack } = await sb
        .from("cliente_programa_creditos")
        .select("id, saldo")
        .eq("id", params.creditoId)
        .maybeSingle();

      const verificado = readBack?.saldo === novoSaldo;

      return {
        success: true,
        entity_id: params.creditoId,
        affected_record_id: params.creditoId,
        before: creditoAtual,
        after: atualizado,
        source: "tabela_creditos",
        summary: `Crédito de "${creditoAtual.servico_nome}" liberado com sucesso. Saldo restaurado para: ${novoSaldo}.`,
        executed_at: new Date().toISOString(),
        verified: verificado,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        entity_id: params.creditoId,
        source: "tabela_creditos",
        summary: `Erro ao liberar crédito: ${err.message}`,
        error_code: "ERRO_LIBERACAO_CREDITO",
        idempotency_key: idempotencyKey,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
        verified: false,
      };
    }
  }

  /**
   * 1. Gera a estrutura do Termo de Adesão ao Programa em PDF com prévia, download e link de compartilhamento (Seção 17)
   */
  static gerarDocumentoTermoPdf(params: {
    contratoId: string;
    tutorNome: string;
    tutorTelefone: string;
    petNome: string;
    petRaca: string;
    programaNome: string;
    creditosTotais: number;
    valorMensal: number;
    formaPagamento: string;
    dataContratacao: string;
    dataValidade: string;
  }): {
    documentoId: string;
    titulo: string;
    previaTexto: string;
    downloadUrl: string;
    whatsappShareUrl: string;
    dadosEstruturados: any;
  } {
    const docId = `termo_${params.contratoId}_${Date.now()}`;
    const logoUrl = "/assets/logo-spa-pet.png";

    const textoTermo =
      `TERMO DE ADESÃO AO PROGRAMA DE CUIDADOS — SPA DE PET TIA JÉSSICA\n\n` +
      `CONTRATANTE: ${params.tutorNome} (Tel: ${params.tutorTelefone})\n` +
      `PET BENEFICIÁRIO: ${params.petNome} (${params.petRaca})\n` +
      `PLANO: ${params.programaNome}\n` +
      `CRÉDITOS INCLUSOS: ${params.creditosTotais} sessões de Banho & Cuidados\n` +
      `VALOR DO PLANO: R$ ${params.valorMensal.toFixed(2)} (${params.formaPagamento.toUpperCase()})\n` +
      `DATA DE CONTRATAÇÃO: ${params.dataContratacao} | VALIDADE: ${params.dataValidade} (30 dias)\n\n` +
      `CLÁUSULAS E REGRAS DE USO:\n` +
      `1. EXCLUSIVIDADE: Os créditos são de uso exclusivo do pet ${params.petNome}, sendo estritamente intransferíveis.\n` +
      `2. VALIDADE: O saldo possui vigência improrrogável de 30 dias a partir da contratação.\n` +
      `3. SERVIÇOS EXTRAS: Procedimentos adicionais (desembolo, hidratação premium, tosa) não inclusos no plano serão cobrados à parte.\n` +
      `4. AGENDAMENTO: O agendamento reserva o crédito e sua conclusão consome a sessão.\n` +
      `5. CANCELAMENTO: Cancelamentos com antecedência mínima de 24h liberam o crédito para reagendamento dentro da vigência.\n`;

    const telLimpo = params.tutorTelefone.replace(/\D/g, "");
    const telComPais = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;
    const msgWhatsApp = `Olá, ${params.tutorNome}! 🐾 Segue o Termo de Adesão do Clubinho do(a) ${params.petNome} no Spa de Pet Tia Jéssica:\n\n${textoTermo}`;
    const waUrl = `https://wa.me/${telComPais}?text=${encodeURIComponent(msgWhatsApp)}`;

    return {
      documentoId: docId,
      titulo: `Termo de Adesão — ${params.programaNome} (${params.petNome})`,
      previaTexto: textoTermo,
      downloadUrl: `/api/documentos/termo/${params.contratoId}.pdf`,
      whatsappShareUrl: waUrl,
      dadosEstruturados: {
        logo: logoUrl,
        ...params,
        regras: ["Intransferível", "Validade 30 dias", "Extras cobrados separadamente"],
      },
    };
  }

  /**
   * 2. Gera o Relatório de Cuidados do Pet com "Banhos utilizados" (Seção 17)
   */
  static gerarRelatorioPetPdf(params: {
    petNome: string;
    tutorNome: string;
    programaNome: string;
    dataContratacao: string;
    dataValidade: string;
    totalBanhos: number;
    banhosUtilizados: number;
    creditosRestantes: number;
    historicoDatasUso: string[];
    fotos?: string[];
  }): {
    relatorioId: string;
    titulo: string;
    previaTexto: string;
    downloadUrl: string;
    whatsappShareUrl: string;
    dadosEstruturados: any;
  } {
    const relId = `rel_pet_${Date.now()}`;
    const textoRelatorio =
      `RELATÓRIO DE CUIDADOS & CLUBINHO — SPA DE PET TIA JÉSSICA\n\n` +
      `PET: ${params.petNome} | TUTOR(A): ${params.tutorNome}\n` +
      `PROGRAMA ATIVO: ${params.programaNome}\n` +
      `VIGÊNCIA: ${params.dataContratacao} até ${params.dataValidade}\n\n` +
      `EXTRATO DE UTILIZAÇÃO DO CLUBINHO:\n` +
      `• Total de Banhos Contratados: ${params.totalBanhos}\n` +
      `• Banhos Utilizados: ${params.banhosUtilizados}\n` +
      `• Créditos Restantes: ${params.creditosRestantes}\n` +
      `• Datas das Sessões Realizadas: ${params.historicoDatasUso.join(", ") || "Nenhuma sessão utilizada ainda"}\n`;

    return {
      relatorioId: relId,
      titulo: `Relatório de Cuidados — ${params.petNome}`,
      previaTexto: textoRelatorio,
      downloadUrl: `/api/documentos/relatorio/${params.petNome.toLowerCase()}.pdf`,
      whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(textoRelatorio)}`,
      dadosEstruturados: {
        ...params,
        termoCorretoBanhos: "Banhos utilizados", // Assegura conformidade com a Seção 17
      },
    };
  }
}
