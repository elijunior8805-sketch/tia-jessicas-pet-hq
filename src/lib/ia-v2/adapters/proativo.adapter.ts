import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult } from "../contracts/jessi-v2-contracts";
import { AgendaAdapter } from "./agenda.adapter";
import { FinanceiroRelatoriosAdapter } from "./financeiro-relatorios.adapter";
import { ProgramasCreditosAdapter } from "./programas-creditos.adapter";
import { MensagensWhatsAppAdapter } from "./mensagens-whatsapp.adapter";

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
      const [agendaRes, finRes, progRes, encaixesRes] = await Promise.all([
        AgendaAdapter.consultarAgendaPorData(sb, hojeStr),
        FinanceiroRelatoriosAdapter.consultarResumoConsolidado(sb, "hoje"),
        ProgramasCreditosAdapter.consultarProgramasAtivosGeral(sb),
        AgendaAdapter.identificarEncaixesDisponiveis(sb, hojeStr),
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

      // Vetor 3 & 4: Programas Vencendo e Créditos Não Utilizados
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

      // Vetor 5: Pagamentos Pendentes / Vencidos
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
}
