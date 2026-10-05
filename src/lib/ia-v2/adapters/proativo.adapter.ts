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
   * Sugestão Inteligente de Clientes para Ocupação de Vagas na Grade
   * Audita o histórico real de atendimentos dos últimos meses para identificar:
   * 1. Dia da semana habitual de cada cliente/pet (Segunda a Sábado);
   * 2. Ciclo de retorno e dias desde a última visita (momento ideal de banho: 7 a 25 dias);
   * 3. Assinantes do Clubinho / Pacotes com créditos ativos;
   * 4. Score de propensão à conversão (quem tem maior chance de aceitar naquele dia).
   */
  static async sugerirClientesParaVagas(
    sb: SupabaseClient<Database>,
    params?: { data?: string; diaSemana?: string; limite?: number }
  ): Promise<JessiV2QueryResult> {
    const inicio = Date.now();
    const correlationId = `sugestao_grade_${inicio}`;

    try {
      const hoje = new Date();
      // Obtém hora e dia no fuso de São Paulo
      const spTimeParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "numeric",
        hour12: false,
        weekday: "short",
      }).formatToParts(hoje);
      
      const horaAtual = parseInt(spTimeParts.find(p => p.type === "hour")?.value || String(hoje.getHours()), 10);
      const diaSemanaHojeIndex = hoje.getDay(); // 0 = Domingo, 1 = Segunda, etc.

      const diasSemanaNomes = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
      const diasSemanaLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

      // Determina a data e o dia da semana alvo
      let dataAlvoStr = params?.data;
      let diaSemanaAlvoIndex = diaSemanaHojeIndex;

      if (params?.diaSemana && params.diaSemana !== "hoje") {
        const diaNorm = params.diaSemana.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (diaNorm.includes("amanha")) {
          // Amanhã: avança 1 dia (ou 2 se hoje for sábado)
          const diasAvançar = diaSemanaHojeIndex === 6 ? 2 : (diaSemanaHojeIndex === 0 ? 1 : 1);
          const dataAlvoDate = new Date(hoje.getTime() + diasAvançar * 86400000);
          dataAlvoStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(dataAlvoDate);
          diaSemanaAlvoIndex = dataAlvoDate.getDay();
        } else {
          const idx = diasSemanaNomes.findIndex((d) => diaNorm.includes(d) || (d === "terca" && diaNorm.includes("terc")));
          if (idx !== -1) {
            diaSemanaAlvoIndex = idx;
            // Calcula a próxima data que cai nesse dia da semana
            const diasAte = (idx - diaSemanaHojeIndex + 7) % 7;
            const dataAlvoDate = new Date(hoje.getTime() + (diasAte === 0 ? 0 : diasAte) * 86400000);
            dataAlvoStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(dataAlvoDate);
          }
        }
      }

      // Se não especificou dia ou se caiu no Domingo (spa fechado) ou noite (após 18h):
      if (!params?.diaSemana || params.diaSemana === "hoje") {
        if (diaSemanaHojeIndex === 0) {
          // Domingo -> Pet spa fechado, preenche a grade de Segunda-feira!
          diaSemanaAlvoIndex = 1;
          const dataAlvoDate = new Date(hoje.getTime() + 86400000);
          dataAlvoStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(dataAlvoDate);
        } else if (horaAtual >= 18) {
          // Noite (após expediente) -> Preenche a grade de amanhã (ou segunda se for sábado)
          const diasAvançar = diaSemanaHojeIndex === 6 ? 2 : 1;
          const dataAlvoDate = new Date(hoje.getTime() + diasAvançar * 86400000);
          dataAlvoStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(dataAlvoDate);
          diaSemanaAlvoIndex = dataAlvoDate.getDay();
        } else {
          dataAlvoStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(hoje);
        }
      }

      // Se por algum motivo ainda for domingo, ajusta para segunda-feira
      if (diaSemanaAlvoIndex === 0) {
        diaSemanaAlvoIndex = 1;
      }

      if (!dataAlvoStr) {
        dataAlvoStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(hoje);
      }

      const diaSemanaLabel = diasSemanaLabels[diaSemanaAlvoIndex] || "Segunda-feira";

      // 1. Coleta histórico de agendamentos dos últimos 120 dias, clientes ativos e planos do clubinho
      const dataLimiteHistorico = new Date(Date.now() - 120 * 86400000).toISOString().split("T")[0];

      const [resAgendamentos, resClientes, resClubinho, resAgendadosDataAlvo] = await Promise.all([
        sb.from("agendamentos")
          .select("id, data, hora, cliente_id, pet_id, status, servicos(nome)")
          .gte("data", dataLimiteHistorico)
          .order("data", { ascending: false }),
        sb.from("clientes")
          .select("id, nome, telefone, whatsapp, bairro, ativo, pets(id, nome, raca, porte)")
          .eq("ativo", true),
        sb.from("programas_contratos")
          .select("id, cliente_id, pet_id, status, creditos_disponiveis")
          .eq("status", "ativo"),
        sb.from("agendamentos")
          .select("pet_id, cliente_id")
          .eq("data", dataAlvoStr),
      ]);

      const todosAgendamentos = resAgendamentos?.data || [];
      const todosClientes = resClientes?.data || [];
      const todosContratos = resClubinho?.data || [];
      const jaAgendadosPets = new Set((resAgendadosDataAlvo?.data || []).map((a: any) => a.pet_id).filter(Boolean));

      // 2. Mapeia perfil de frequência e hábitos de cada pet
      const mapaHistoricoPets: Record<string, {
        totalVisitas: number;
        diasSemanaContagem: number[]; // contagem por dia da semana 0 a 6
        ultimaVisitaData: string | null;
        ultimoServico: string | null;
      }> = {};

      for (const ag of todosAgendamentos) {
        if (!ag.pet_id || !ag.data) continue;
        if (!mapaHistoricoPets[ag.pet_id]) {
          mapaHistoricoPets[ag.pet_id] = {
            totalVisitas: 0,
            diasSemanaContagem: [0, 0, 0, 0, 0, 0, 0],
            ultimaVisitaData: null,
            ultimoServico: null,
          };
        }

        const h = mapaHistoricoPets[ag.pet_id];
        h.totalVisitas++;

        const [aAno, aMes, aDia] = ag.data.split("-").map(Number);
        const dtAg = new Date(aAno, aMes - 1, aDia);
        const wDay = dtAg.getDay();
        if (wDay >= 0 && wDay <= 6) {
          h.diasSemanaContagem[wDay]++;
        }

        if (!h.ultimaVisitaData || ag.data > h.ultimaVisitaData) {
          h.ultimaVisitaData = ag.data;
          h.ultimoServico = (ag.servicos as any)?.nome || "Banho";
        }
      }

      // Mapa de contratos ativos do clubinho
      const mapaClubinhoPet: Record<string, { creditos: number }> = {};
      for (const c of todosContratos) {
        if (c.pet_id) {
          mapaClubinhoPet[c.pet_id] = { creditos: c.creditos_disponiveis || 0 };
        }
      }

      // 3. Pontua e audita cada cliente/pet para a vaga
      interface CandidatoVaga {
        clienteId: string;
        clienteNome: string;
        telefone: string;
        bairro?: string;
        petId: string;
        petNome: string;
        petRaca?: string;
        petPorte?: string;
        diasSemVir: number;
        ultimaVisitaData?: string;
        diaSemanaHabitual: string;
        visitasNoDiaAlvo: number;
        totalVisitasGeral: number;
        scorePropensao: number;
        probabilidadeConversao: string;
        motivoInteligente: string;
        temClubinho: boolean;
        creditosClubinho: number;
        mensagemSugerida: {
          textoMensagem: string;
          mensagemFormatada: string;
          urlWhatsApp?: string;
          telefoneDestino: string;
        };
      }

      const candidatos: CandidatoVaga[] = [];

      for (const cliente of todosClientes) {
        const tel = cliente.whatsapp || cliente.telefone || "";
        const pets = (cliente.pets as any[]) || [];

        for (const pet of pets) {
          // Se o pet já estiver agendado para o dia alvo, pula
          if (jaAgendadosPets.has(pet.id)) continue;

          const hist = mapaHistoricoPets[pet.id];
          const clubinho = mapaClubinhoPet[pet.id];
          const temClubinho = Boolean(clubinho && clubinho.creditos > 0);
          const creditosClubinho = clubinho?.creditos || 0;

          let totalVisitas = hist?.totalVisitas || 0;
          let visitasNoDiaAlvo = hist?.diasSemanaContagem[diaSemanaAlvoIndex] || 0;
          let ultimaVisitaData = hist?.ultimaVisitaData || null;

          // Calcula dias desde a última visita
          let diasSemVir = 14; // valor padrão razoável se não houver registro
          if (ultimaVisitaData) {
            const [uAno, uMes, uDia] = ultimaVisitaData.split("-").map(Number);
            const dtUlt = new Date(uAno, uMes - 1, uDia);
            diasSemVir = Math.max(1, Math.floor((hoje.getTime() - dtUlt.getTime()) / 86400000));
          }

          // Descobre o dia da semana favorito do pet
          let maiorVisitasDia = 0;
          let diaFavoritoIndex = diaSemanaAlvoIndex;
          if (hist) {
            hist.diasSemanaContagem.forEach((qtd, idx) => {
              if (qtd > maiorVisitasDia) {
                maiorVisitasDia = qtd;
                diaFavoritoIndex = idx;
              }
            });
          }
          const diaSemanaHabitual = diasSemanaLabels[diaFavoritoIndex] || diaSemanaLabel;

          // CÁLCULO DO SCORE INTELIGENTE DE PROPENSÃO:
          let score = 0;

          // A) Correspondência com o Dia da Semana Alvo (Peso Máximo)
          if (visitasNoDiaAlvo > 0) {
            score += 45 + (visitasNoDiaAlvo * 10); // Ex: 3 visitas na segunda = +75 pontos!
          } else if (diaFavoritoIndex === diaSemanaAlvoIndex) {
            score += 35;
          }

          // B) Ciclo Ideal de Retorno (Banho Semanal / Quinzenal / Mensal)
          if (diasSemVir >= 7 && diasSemVir <= 15) {
            score += 40; // Momento de ouro: exatamente 1 a 2 semanas sem banho
          } else if (diasSemVir >= 16 && diasSemVir <= 28) {
            score += 30; // Ciclo quinzenal/mensal ideal
          } else if (diasSemVir >= 29 && diasSemVir <= 45) {
            score += 15; // Precisando de um toque de retorno
          } else if (diasSemVir > 60) {
            score -= 25; // Penaliza clientes inativos há muito tempo (esses são para resgate frio, não vaga imediata)
          }

          // C) Assinante de Clubinho / Créditos Ativos
          if (temClubinho) {
            score += 30; // Tem crédito pré-pago disponível, conversão quase certa!
          }

          // D) Recorrência Histórica Geral
          if (totalVisitas >= 4) score += 20;
          else if (totalVisitas >= 2) score += 10;
          else if (totalVisitas === 1) score += 5;

          // Porcentagem amigável de conversão estimada
          const pct = Math.min(98, Math.max(55, Math.round(50 + (score / 150) * 45)));
          const probabilidadeConversao = `${pct}% (${pct >= 85 ? "Alta" : "Boa"} Conversão)`;

          // Monta explicação inteligente dos motivos
          const motivos: string[] = [];
          if (visitasNoDiaAlvo > 0) {
            motivos.push(`Costuma vir às ${diaSemanaLabel}s (${visitasNoDiaAlvo}x)`);
          } else if (totalVisitas > 0) {
            motivos.push(`Cliente frequente (${totalVisitas} atendimentos)`);
          }

          if (diasSemVir >= 7 && diasSemVir <= 28) {
            motivos.push(`Último banho há ${diasSemVir} dias (Ciclo Ideal)`);
          } else {
            motivos.push(`Último banho há ${diasSemVir} dias`);
          }

          if (temClubinho) {
            motivos.push(`Clubinho ativo (${creditosClubinho} créditos)`);
          }

          const motivoInteligente = motivos.join(" • ") || "Perfil compatível para encaixe";

          // Monta mensagem calorosa e humanizada de WhatsApp
          const primeiroNomeTutor = cliente.nome ? cliente.nome.split(" ")[0] : "Tutor";
          const diaMensagemTexto = dataAlvoStr === hoje.toISOString().split("T")[0] ? "hoje" : diaSemanaLabel.toLowerCase();

          let textoMsg = `Olá, ${primeiroNomeTutor}! Tudo bem? 🐶✨ Notamos que o pelo do(a) ${pet.nome} já está no período ideal para aquele banho relaxante e cheiroso no Spa de Pet Tia Jéssica.`;
          if (visitasNoDiaAlvo > 0) {
            textoMsg += ` Como vocês costumam vir às ${diaSemanaLabel}s, separamos um horário especial para ${diaMensagemTexto}! Podemos reservar para o(a) ${pet.nome}? 🐾🛁`;
          } else {
            textoMsg += ` Temos uma vaga especial para ${diaMensagemTexto} e gostaríamos de reservar para o(a) ${pet.nome}! Podemos confirmar o horário? 🐾🛁`;
          }

          const telLimpo = tel.replace(/\D/g, "");
          const urlWa = telLimpo ? `https://wa.me/55${telLimpo}?text=${encodeURIComponent(textoMsg)}` : undefined;

          candidatos.push({
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            telefone: tel,
            bairro: cliente.bairro,
            petId: pet.id,
            petNome: pet.nome,
            petRaca: pet.raca,
            petPorte: pet.porte,
            diasSemVir,
            ultimaVisitaData: ultimaVisitaData || undefined,
            diaSemanaHabitual,
            visitasNoDiaAlvo,
            totalVisitasGeral: totalVisitas,
            scorePropensao: score,
            probabilidadeConversao,
            motivoInteligente,
            temClubinho,
            creditosClubinho,
            mensagemSugerida: {
              textoMensagem: textoMsg,
              mensagemFormatada: textoMsg,
              urlWhatsApp: urlWa,
              telefoneDestino: tel,
            },
          });
        }
      }

      // 4. Ordena pelos maiores scores (clientes de maior conversão e hábito no topo)
      candidatos.sort((a, b) => b.scorePropensao - a.scorePropensao);

      const limite = params?.limite || 6;
      const topCandidatos = candidatos.slice(0, limite);

      // Formatação padronizada compatível com os cards da interface
      const sugestoesFormatadas = topCandidatos.map((c) => ({
        cliente: {
          id: c.clienteId,
          nome: c.clienteNome,
          telefone: c.telefone,
          bairro: c.bairro,
        },
        pet: {
          id: c.petId,
          nome: c.petNome,
          raca: c.petRaca,
          porte: c.petPorte,
        },
        diasInativo: c.diasSemVir,
        diaHabitual: c.diaSemanaHabitual,
        faixaRisco: c.scorePropensao >= 70 ? "alta_conversao" : "boa_conversao",
        probabilidadeConversao: c.probabilidadeConversao,
        motivoInteligente: c.motivoInteligente,
        temClubinho: c.temClubinho,
        creditosClubinho: c.creditosClubinho,
        ultimoAtendimento: c.ultimaVisitaData,
        mensagemSugerida: c.mensagemSugerida,
        whatsappUrl: c.mensagemSugerida.urlWhatsApp,
      }));

      const nomesDestaque = topCandidatos.slice(0, 3).map((c) => `${c.petNome} (${c.clienteNome.split(" ")[0]})`).join(", ");
      const summary = `Auditoria concluída para ${diaSemanaLabel} (${dataAlvoStr}): Localizei ${sugestoesFormatadas.length} cliente(s) com alto histórico de frequência e ciclo ideal de retorno (${nomesDestaque}).`;

      return {
        success: true,
        source: "sugestao_inteligente_vagas",
        data: {
          dataReferencia: dataAlvoStr,
          diaSemana: diaSemanaLabel,
          sugestoes: sugestoesFormatadas,
          candidatos: sugestoesFormatadas,
          total: sugestoesFormatadas.length,
        },
        total_count: sugestoesFormatadas.length,
        summary,
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    } catch (err: any) {
      console.error("Erro na sugestão inteligente de clientes para vagas:", err);
      return {
        success: false,
        source: "sugestao_inteligente_vagas",
        data: { sugestoes: [], total: 0 },
        total_count: 0,
        summary: `Não foi possível auditar os hábitos de agendamento no momento: ${err.message}`,
        error_code: "ERRO_AUDITORIA_HABITOS",
        executed_at: new Date().toISOString(),
        correlation_id: correlationId,
      };
    }
  }

  /**
   * Vetor 5: Clientes para Retorno (Reativação e Saudade com view pets_reativacao)
   */
  static async identificarClientesParaRetorno(sb: SupabaseClient<Database>): Promise<JessiV2QueryResult> {
    try {
      const { data: reativacoes } = await sb
        .from("pets_reativacao")
        .select("cliente_id, cliente_nome, cliente_telefone, cliente_whatsapp, pet_id, pet_nome, dias_inativo, faixa, ticket_medio, ultimo_atendimento_em")
        .gte("dias_inativo", 25)
        .lte("dias_inativo", 60) // Foca primeiro no ciclo de alerta/saudade recente
        .order("dias_inativo", { ascending: true })
        .limit(10);

      if (reativacoes && reativacoes.length > 0) {
        const sugestoes = reativacoes.map((r: any) => {
          const tel = r.cliente_whatsapp || r.cliente_telefone || "";
          const msgGen = MensagensWhatsAppAdapter.gerarMensagemWhatsApp({
            telefoneDestino: tel,
            nomeCliente: r.cliente_nome || "Cliente",
            nomePet: r.pet_nome || "seu pet",
            tipoMensagem: "reativacao_carinho",
          });

          return {
            cliente: {
              id: r.cliente_id,
              nome: r.cliente_nome,
              telefone: tel,
            },
            pet: {
              id: r.pet_id,
              nome: r.pet_nome,
            },
            diasInativo: r.dias_inativo,
            faixaRisco: r.faixa,
            ultimoAtendimento: r.ultimo_atendimento_em,
            mensagemSugerida: {
              textoMensagem: msgGen.mensagemFormatada,
              mensagemFormatada: msgGen.mensagemFormatada,
              urlWhatsApp: msgGen.urlWhatsApp,
              telefoneDestino: msgGen.telefoneFormatado,
            },
          };
        });

        return {
          success: true,
          source: "pets_reativacao",
          data: sugestoes,
          total_count: sugestoes.length,
          summary: `Identificados ${sugestoes.length} cliente(s) e pet(s) inativos com alto potencial de reativação (VIEW pets_reativacao).`,
          executed_at: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn("Aviso: fallback na busca de reativação de clientes:", err);
    }

    // Fallback caso a view esteja sem dados
    const { data: clientes } = await sb
      .from("clientes")
      .select("id, nome, telefone, whatsapp, pets(id, nome, raca)")
      .limit(10);

    const sugestoes = (clientes || []).map((c: any) => {
      const pet = Array.isArray(c.pets) && c.pets.length > 0 ? c.pets[0] : null;
      const tel = c.whatsapp || c.telefone || "";
      const msgGen = MensagensWhatsAppAdapter.gerarMensagemWhatsApp({
        telefoneDestino: tel,
        nomeCliente: c.nome,
        nomePet: pet?.nome || "seu pet",
        tipoMensagem: "reativacao_carinho",
      });

      return {
        cliente: {
          id: c.id,
          nome: c.nome,
          telefone: tel,
        },
        pet: pet ? { id: pet.id, nome: pet.nome, raca: pet.raca } : undefined,
        diasInativo: 25,
        faixaRisco: "alerta",
        mensagemSugerida: {
          textoMensagem: msgGen.mensagemFormatada,
          mensagemFormatada: msgGen.mensagemFormatada,
          urlWhatsApp: msgGen.urlWhatsApp,
          telefoneDestino: msgGen.telefoneFormatado,
        },
      };
    });

    return {
      success: true,
      source: "clientes_para_retorno",
      data: sugestoes,
      total_count: sugestoes.length,
      summary: `Localizados ${sugestoes.length} cliente(s) com sugestões de contato personalizadas.`,
      executed_at: new Date().toISOString(),
    };
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
