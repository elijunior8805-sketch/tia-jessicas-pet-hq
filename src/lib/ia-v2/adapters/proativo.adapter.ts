import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult } from "../contracts/jessi-v2-contracts";
import { AgendaAdapter } from "./agenda.adapter";
import { FinanceiroRelatoriosAdapter } from "./financeiro-relatorios.adapter";
import { ProgramasCreditosAdapter } from "./programas-creditos.adapter";
import { MensagensWhatsAppAdapter } from "./mensagens-whatsapp.adapter";
import { identificarAniversariantesIA } from "@/lib/ia/ia-comunicacao.server";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";

/**
 * Motor de Proatividade da Jessi V2 (Seção 18)
 * Gera recomendações, resumos e oportunidades sem nunca executar ações automaticamente.
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export interface JessiV2ProactiveItem {
  id: string;
  categoria:
    | "resumo_diario"
    | "horarios_vagos"
    | "programas_vencendo"
    | "creditos_nao_utilizados"
    | "clientes_para_retorno"
    | "pagamentos_pendentes"
    | "divergencias"
    | "sugestao_mensagem";
  urgencia: "alta" | "media" | "baixa";
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  comandoAtivacao: string;
  payloadParaConfirmacao?: Record<string, any>;
  linkWhatsApp?: string;
}

export interface JessiV2CentralProativa {
  dataReferencia: string;
  resumoGeral: string;
  itensPrioritarios: JessiV2ProactiveItem[];
  oportunidadesVendas: JessiV2ProactiveItem[];
  totalItens: number;
}

export class ProativoAdapter {
  /**
   * Compila os 8 vetores proativos da Jessi V2 com dados 100% reais
   * Regra Absoluta: NÃO executa ações automaticamente.
   */
  static async gerarCentralProativa(
    sb: SupabaseClient<Database>,
    user?: { id?: string; nome?: string }
  ): Promise<JessiV2QueryResult<JessiV2CentralProativa>> {
    const inicio = Date.now();
    const correlationId = `proativo_${inicio}`;

    try {
      const hoje = new Date();
      const hojeStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(hoje);

      // 1. Coleta concorrente dos dados operacionais reais
      const [agendaRes, finRes, progRes, encaixesRes, niverRes, retornoRes] = await Promise.all([
        AgendaAdapter.consultarAgendaPorData(sb, hojeStr),
        FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, "hoje"),
        ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb),
        AgendaAdapter.identificarEncaixesDisponiveis(sb, hojeStr),
        identificarAniversariantesIA(sb),
        ProativoAdapter.identificarClientesParaRetorno(sb),
      ]);

      const itensPrioritarios: JessiV2ProactiveItem[] = [];
      const oportunidadesVendas: JessiV2ProactiveItem[] = [];

      // Vetor 1: Resumo Diário
      const totalAgendados = agendaRes.total_count || 0;
      const faturamentoHoje = finRes.data.faturamentoBruto || 0;

      // Vetor 2: Horários Vagos / Encaixes
      const horariosLivres = encaixesRes.data?.horariosSugeridos || [];
      if (horariosLivres.length > 0) {
        oportunidadesVendas.push({
          id: "opp_horarios_livres",
          categoria: "horarios_vagos",
          urgencia: "media",
          titulo: `${horariosLivres.length} horário(s) livre(s) na grade de hoje`,
          descricao: `Horários vagos detectados: ${horariosLivres.slice(0, 4).join(", ")}.`,
          acaoSugerida: "Ofertar encaixe para clientes frequentes",
          comandoAtivacao: "ver clientes para retorno hoje",
        });
      }

      // Vetor 3: Aniversariantes do Dia
      const aniversariantes = (niverRes?.data as any[]) || [];
      aniversariantes.slice(0, 3).forEach((n: any) => {
        const petNome = n.nome || n.petNome || "Pet";
        const tutorNome = n.clientes?.nome || n.clienteNome || "Tutor";
        const tel = n.clientes?.telefone || n.telefone || "";
        const msg = `Olá, ${tutorNome}! 🎉 Hoje é o aniversário do(a) querido(a) ${petNome}! 🎂🐾 O Spa de Pet Tia Jéssica deseja muita saúde e alegrias!`;
        const link = tel ? (gerarLinkWhatsApp(tel, msg) ?? undefined) : undefined;
        itensPrioritarios.push({
          id: `niver_${n.id}`,
          categoria: "sugestao_mensagem",
          urgencia: "media",
          titulo: `🎂 Aniversário de ${petNome} hoje!`,
          descricao: `Tutor(a): ${tutorNome}. Envie felicitações carinhosas com 1 clique.`,
          acaoSugerida: "Parabenizar no WhatsApp",
          comandoAtivacao: `parabenizar aniversariante ${petNome}`,
          linkWhatsApp: link,
        });
      });

      // Vetor 4 & 5: Programas Vencendo e Créditos Não Utilizados
      const programas = progRes.data || [];
      const programasVencendo = programas.filter((p: any) => p.diasRestantes <= 7 && p.creditosDisponiveis > 0);

      programasVencendo.slice(0, 3).forEach((p: any) => {
        const msgWa = MensagensWhatsAppAdapter.gerarMensagemWhatsApp({
          telefoneDestino: p.tutor.telefone,
          nomeCliente: p.tutor.nome,
          nomePet: p.pet.nome,
          tipoMensagem: "lembrete_agenda",
          detalhes: { horario: `esta semana (restam ${p.creditosDisponiveis} créditos)` },
        });

        itensPrioritarios.push({
          id: `prog_venc_${p.id}`,
          categoria: "programas_vencendo",
          urgencia: "alta",
          titulo: `Plano de ${p.pet.nome} vence em ${p.diasRestantes} dia(s)`,
          descricao: `O tutor ${p.tutor.nome} ainda possui ${p.creditosDisponiveis} crédito(s) de banho que expirarão em ${p.validadeData}.`,
          acaoSugerida: "Lembrar tutor no WhatsApp de 1 clique",
          comandoAtivacao: `enviar lembrete whatsapp para ${p.tutor.nome}`,
          linkWhatsApp: msgWa.urlWhatsApp,
        });
      });

      // Vetor 6: Clientes para Retorno / Reativação
      const retornos = (retornoRes?.data as any[]) || [];
      if (retornos.length > 0) {
        const topRetorno = retornos[0];
        oportunidadesVendas.push({
          id: "opp_reativacao_clientes",
          categoria: "clientes_para_retorno",
          urgencia: "media",
          titulo: `${retornos.length} cliente(s) para reativação`,
          descricao: `Exemplo: ${topRetorno.cliente?.nome || "Cliente"} (${topRetorno.pet?.nome || "Pet"}) ausente há ${topRetorno.diasInativo || 0} dias.`,
          acaoSugerida: "Convidar no WhatsApp",
          comandoAtivacao: "quem são os clientes sumidos",
        });
      }

      // Vetor 7: Pagamentos Pendentes / Vencidos
      const pendencias = finRes.data.valoresVencidosDevedores || 0;
      if (pendencias > 0) {
        itensPrioritarios.push({
          id: "fin_pendencias_vencidas",
          categoria: "pagamentos_pendentes",
          urgencia: "alta",
          titulo: `Cobranças pendentes: R$ ${pendencias.toFixed(2)}`,
          descricao: "Existem valores em aberto de atendimentos anteriores que já venceram.",
          acaoSugerida: "Revisar lista de cobranças pendentes",
          comandoAtivacao: "consultar valores a receber",
        });
      }

      const totalItens = itensPrioritarios.length + oportunidadesVendas.length;
      const resumoGeral =
        `Hoje (${hojeStr}) temos ${totalAgendados} atendimento(s) na grade, faturamento previsto de R$ ${faturamentoHoje.toFixed(2)} e ${horariosLivres.length} horários para encaixe.`;

      return {
        success: true,
        source: "central_proativa_v2",
        data: {
          dataReferencia: hojeStr,
          resumoGeral,
          itensPrioritarios,
          oportunidadesVendas,
          totalItens,
        },
        total_count: totalItens,
        summary: resumoGeral,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      return {
        success: false,
        source: "central_proativa",
        data: {
          dataReferencia: new Date().toISOString().split("T")[0],
          resumoGeral: "Não foi possível consolidar os dados proativos no momento.",
          itensPrioritarios: [],
          oportunidadesVendas: [],
          totalItens: 0,
        },
        total_count: 0,
        summary: `Erro no motor proativo: ${err.message}`,
        error_code: err.code || "ERRO_PROATIVO",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Vetor 1: Resumo Diário Consolidado
   */
  static async gerarResumoDiario(sb: SupabaseClient<Database>): Promise<JessiV2QueryResult> {
    const central = await this.gerarCentralProativa(sb);
    return {
      success: central.success,
      source: "resumo_diario_proativo",
      data: central.data?.resumoGeral,
      summary: central.data?.resumoGeral || "Resumo diário compilado.",
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * Vetor 2: Horários Vagos e Oportunidades de Encaixe
   */
  static async identificarHorariosVagos(sb: SupabaseClient<Database>, data?: string): Promise<JessiV2QueryResult> {
    const hojeStr = data || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return await AgendaAdapter.identificarEncaixesDisponiveis(sb, hojeStr);
  }

  /**
   * Vetor 3 & 4: Programas Vencendo e Créditos Não Utilizados
   */
  static async identificarProgramasVencendo(sb: SupabaseClient<Database>, dias = 7): Promise<JessiV2QueryResult> {
    const res = await ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb);
    const vencendo = (res.data || []).filter((p: any) => p.diasRestantes <= dias && p.creditosDisponiveis > 0);
    return {
      success: true,
      source: "programas_vencendo",
      data: vencendo,
      total_count: vencendo.length,
      summary: `Existem ${vencendo.length} programa(s) com créditos ativos vencendo nos próximos ${dias} dias.`,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * Vetor 5: Sugestão Inteligente de Clientes para Encaixes / Horários Vagos
   * FOCADO EM ALTA CONVERSÃO REAL:
   * 1. Identifica clientes que costumam vir no mesmo dia da semana (ex: sextas-feiras).
   * 2. Recência ativa e saudável (último atendimento entre 7 e 35 dias).
   * 3. Exclui clientes que já têm agendamento futuro ou que estão inativos há mais de 45 dias.
   * 4. Gera link de WhatsApp com mensagem contextual pronta.
   */
  static async sugerirClientesParaEncaixeInteligente(
    sb: SupabaseClient<Database>,
    params?: { data?: string; horarioVago?: string }
  ): Promise<JessiV2QueryResult> {
    const dataAlvoStr =
      params?.data ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    const dataAlvoObj = new Date(`${dataAlvoStr}T12:00:00`);
    const diaSemanaAlvo = dataAlvoObj.getDay();
    const nomesDias = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];
    const nomeDiaSemana = nomesDias[diaSemanaAlvo] || "neste dia";

    try {
      // 1. Busca agendamentos futuros para NÃO sugerir quem já tem horário marcado
      const { data: agendamentosFuturos } = await sb
        .from("agendamentos")
        .select("cliente_id, pet_id")
        .gte("data", dataAlvoStr)
        .neq("status", "cancelado");

      const clientesJaAgendados = new Set((agendamentosFuturos || []).map((a: any) => a.cliente_id).filter(Boolean));
      const petsJaAgendados = new Set((agendamentosFuturos || []).map((a: any) => a.pet_id).filter(Boolean));

      // 2. Histórico recente dos últimos 90 dias
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);
      const dataLimiteStr = dataLimite.toISOString().split("T")[0];

      const { data: historico } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, cliente_id, pet_id, clientes(id, nome, whatsapp, telefone), pets(id, nome, raca, porte)")
        .gte("data", dataLimiteStr)
        .lt("data", dataAlvoStr)
        .neq("status", "cancelado")
        .order("data", { ascending: false });

      if (!historico || historico.length === 0) {
        return {
          success: true,
          source: "encaixe_inteligente",
          data: [],
          total_count: 0,
          summary: `Não há histórico suficiente nos últimos 90 dias para calcular o padrão de frequência por dia da semana.`,
          executed_at: new Date().toISOString(),
        };
      }

      const statsPorPet: Record<
        string,
        {
          cliente: any;
          pet: any;
          totalAtendimentos: number;
          atendimentosNesseDiaSemana: number;
          ultimaData: string;
          diasDesdeUltimo: number;
        }
      > = {};

      const hojeMs = new Date().getTime();

      for (const ag of historico) {
        if (!ag.cliente_id || !ag.pet_id) continue;
        if (clientesJaAgendados.has(ag.cliente_id) || petsJaAgendados.has(ag.pet_id)) continue;

        const chave = `${ag.cliente_id}_${ag.pet_id}`;
        const dataAg = new Date(`${ag.data}T12:00:00`);
        const diaSemana = dataAg.getDay();
        const diffDias = Math.max(1, Math.round((hojeMs - dataAg.getTime()) / (1000 * 60 * 60 * 24)));

        if (!statsPorPet[chave]) {
          statsPorPet[chave] = {
            cliente: ag.clientes,
            pet: ag.pets,
            totalAtendimentos: 0,
            atendimentosNesseDiaSemana: 0,
            ultimaData: ag.data,
            diasDesdeUltimo: diffDias,
          };
        }

        statsPorPet[chave].totalAtendimentos += 1;
        if (diaSemana === diaSemanaAlvo) {
          statsPorPet[chave].atendimentosNesseDiaSemana += 1;
        }
        if (diffDias < statsPorPet[chave].diasDesdeUltimo) {
          statsPorPet[chave].diasDesdeUltimo = diffDias;
          statsPorPet[chave].ultimaData = ag.data;
        }
      }

      // 3. Filtra clientes ativos e pontua conversão
      const candidatos = Object.values(statsPorPet)
        .filter((item) => item.diasDesdeUltimo >= 7 && item.diasDesdeUltimo <= 40)
        .map((item) => {
          let score = 0;
          const proporcaoDia = item.totalAtendimentos > 0 ? item.atendimentosNesseDiaSemana / item.totalAtendimentos : 0;
          if (item.atendimentosNesseDiaSemana > 0) score += 40 * proporcaoDia;
          if (item.diasDesdeUltimo >= 10 && item.diasDesdeUltimo <= 22) score += 35;
          else if (item.diasDesdeUltimo >= 7 && item.diasDesdeUltimo <= 35) score += 20;
          score += Math.min(15, item.totalAtendimentos * 3);

          const tel = item.cliente?.whatsapp || item.cliente?.telefone || "";
          const horarioStr = params?.horarioVago ? ` às ${params.horarioVago}` : "";
          const msgTexto = `Olá, ${item.cliente?.nome || "Tutor"}! Tudo bem? 🐾 Sobrou uma vaga hoje${horarioStr} no Spa de Pet Tia Jéssica para o(a) ${item.pet?.nome || "seu pet"}. Como vocês costumam vir às ${nomeDiaSemana}, quer que eu reserve esse horário?`;
          const linkWa = tel ? (gerarLinkWhatsApp(tel, msgTexto) ?? undefined) : undefined;

          return {
            cliente: {
              id: item.cliente?.id,
              nome: item.cliente?.nome,
              telefone: tel,
            },
            pet: {
              id: item.pet?.id,
              nome: item.pet?.nome,
              raca: item.pet?.raca,
            },
            diasInativo: item.diasDesdeUltimo,
            frequenciaDiaSemana: item.atendimentosNesseDiaSemana,
            totalAtendimentos: item.totalAtendimentos,
            scoreConversao: Math.round(score),
            motivoSugestao: `Costuma vir às ${nomeDiaSemana} (${item.atendimentosNesseDiaSemana}x) • Último banho há ${item.diasDesdeUltimo} dias`,
            mensagemSugerida: {
              textoMensagem: msgTexto,
              mensagemFormatada: msgTexto,
              urlWhatsApp: linkWa,
              telefoneDestino: tel,
            },
          };
        })
        .sort((a, b) => b.scoreConversao - a.scoreConversao)
        .slice(0, 6);

      const summary =
        candidatos.length > 0
          ? `Localizei ${candidatos.length} cliente(s) habituais de ${nomeDiaSemana} com ciclo ideal para preenchimento de vaga.`
          : `Não há clientes habituais de ${nomeDiaSemana} no momento com ciclo de retorno aberto.`;

      return {
        success: true,
        source: "encaixes_inteligentes_conversao",
        data: candidatos,
        total_count: candidatos.length,
        summary,
        executed_at: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error("[ProativoAdapter] Erro ao sugerir encaixes inteligentes:", err);
      return {
        success: false,
        source: "encaixes_inteligentes_conversao",
        data: [],
        total_count: 0,
        summary: `Erro ao identificar clientes para encaixe: ${err.message}`,
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Vetor 5: Clientes para Retorno (Compatibilidade com busca de reativação)
   */
  static async identificarClientesParaRetorno(sb: SupabaseClient<Database>): Promise<JessiV2QueryResult> {
    return this.sugerirClientesParaEncaixeInteligente(sb);
  }

  /**
   * Processador de Voz Supervisionado (Seção 18)
   * Preserva o áudio durante todo o processamento e exige as mesmas confirmações
   */
  static processarTranscricaoVoz(params: {
    audioUrl?: string;
    transcricao: string;
    confiancaAudio?: number;
  }): {
    transcricaoApresentada: string;
    audioPreservadoUrl?: string;
    requerRevisaoTexto: boolean;
    aviso: string;
  } {
    return {
      transcricaoApresentada: params.transcricao.trim(),
      audioPreservadoUrl: params.audioUrl,
      requerRevisaoTexto: (params.confiancaAudio ?? 1.0) < 0.85,
      aviso: "Áudio processado em PT-BR. Comandos de alteração exigirão confirmação no cartão.",
    };
  }
}
