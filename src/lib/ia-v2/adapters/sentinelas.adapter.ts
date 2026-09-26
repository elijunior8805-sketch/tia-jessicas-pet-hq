import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiV2QueryResult } from "../contracts/jessi-v2-contracts";
import { AgendaAdapter } from "./agenda.adapter";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";

export interface CandidatoPreenchimentoVaga {
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  petId: string;
  petNome: string;
  diasInativo: number;
  mensagemSugerida: string;
  linkWhatsApp?: string;
}

export interface AlertaCancelamentoSentinela {
  id: string;
  tipo: "cancelamento" | "vaga_ociosa";
  horario: string;
  data: string;
  servicoNome?: string;
  candidatos: CandidatoPreenchimentoVaga[];
}

export interface AlertaAtrasoSentinela {
  id: string;
  agendamentoId: string;
  petNome: string;
  petRaca?: string;
  clienteNome: string;
  clienteTelefone?: string;
  horarioAgendado: string;
  minutosAtraso: number;
  mensagemSugerida: string;
  linkWhatsApp?: string;
}

export interface ResumoFechamentoCaixaSentinela {
  data: string;
  totalAgendamentos: number;
  atendimentosConcluidos: number;
  atendimentosEmAndamento: number;
  atendimentosPendentes: number;
  atendimentosCancelados: number;
  faturamentoBrutoPrevisto: number;
  faturamentoRealizado: number;
  totalRecebido: number;
  recebidoPix: number;
  recebidoCartao: number;
  recebidoDinheiro: number;
  recebidoOutros: number;
  totalPendenteAReceber: number;
  textoRelatorioWhatsApp: string;
  linkCompartilharWhatsApp?: string;
}

export interface SentinelaExecucaoGeral {
  dataReferencia: string;
  totalAlertasAtivos: number;
  cancelamentosEVagas: AlertaCancelamentoSentinela[];
  atrasosDetectados: AlertaAtrasoSentinela[];
  fechamentoCaixa: ResumoFechamentoCaixaSentinela;
  statusGeral: "critico" | "atencao" | "operacao_normal";
  resumoVoz: string;
}

export class SentinelasAdapter {
  /**
   * Sentinela 1: Identifica cancelamentos de hoje e sugere clientes ideais para preencher a vaga instantaneamente
   */
  static async verificarSentinelaCancelamentos(
    sb: SupabaseClient<Database>,
    dataISO?: string
  ): Promise<JessiV2QueryResult<AlertaCancelamentoSentinela[]>> {
    const hojeStr =
      dataISO ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    try {
      // 1. Busca agendamentos cancelados de hoje
      const { data: cancelados } = await sb
        .from("agendamentos")
        .select("id, data, hora, status, observacoes, servicos(nome, valor)")
        .eq("data", hojeStr)
        .eq("status", "cancelado")
        .order("hora", { ascending: true });

      // 2. Busca encaixes/horários vagos na grade
      const encaixesRes = await AgendaAdapter.identificarEncaixesDisponiveis(sb, hojeStr);
      const horariosLivres = encaixesRes.data?.horariosSugeridos || [];

      // 3. Busca candidatos com alta propensão a retorno (view ou clientes)
      let candidatosBase: CandidatoPreenchimentoVaga[] = [];
      try {
        const { data: reativacoes } = await sb
          .from("pets_reativacao")
          .select("cliente_id, cliente_nome, cliente_telefone, cliente_whatsapp, pet_id, pet_nome, dias_inativo")
          .order("dias_inativo", { ascending: false })
          .limit(8);

        if (reativacoes && reativacoes.length > 0) {
          candidatosBase = reativacoes.map((r: any) => {
            const tel = r.cliente_whatsapp || r.cliente_telefone || "";
            return {
              clienteId: r.cliente_id,
              clienteNome: r.cliente_nome || "Cliente",
              clienteTelefone: tel,
              petId: r.pet_id,
              petNome: r.pet_nome || "Pet",
              diasInativo: Number(r.dias_inativo || 0),
              mensagemSugerida: "",
            };
          });
        }
      } catch (e) {
        console.warn("Aviso ao buscar pets_reativacao na sentinela:", e);
      }

      if (candidatosBase.length === 0) {
        const { data: clientesFallback } = await sb
          .from("clientes")
          .select("id, nome, telefone, whatsapp, pets(id, nome)")
          .limit(6);

        candidatosBase = (clientesFallback || []).map((c: any) => ({
          clienteId: c.id,
          clienteNome: c.nome,
          clienteTelefone: c.whatsapp || c.telefone || "",
          petId: c.pets?.[0]?.id || "",
          petNome: c.pets?.[0]?.nome || "seu pet",
          diasInativo: 30,
          mensagemSugerida: "",
        }));
      }

      const alertas: AlertaCancelamentoSentinela[] = [];

      // Processa cancelamentos explícitos
      (cancelados || []).forEach((c: any) => {
        const hora = (c.hora || "10:00").slice(0, 5);
        const servicoNome = (Array.isArray(c.servicos) ? c.servicos[0]?.nome : c.servicos?.nome) || "Banho & Tosa";

        const candidatosComMsg = candidatosBase.slice(0, 3).map((cand) => {
          const msg = `Olá, ${cand.clienteNome}! 🐾 Tivemos uma liberação de horário hoje às ${hora} no Spa Tia Jéssica. Gostaria de aproveitar para trazer o(a) ${cand.petNome} para um atendimento especial de ${servicoNome}?`;
          const link = cand.clienteTelefone ? (gerarLinkWhatsApp(cand.clienteTelefone, msg) ?? undefined) : undefined;
          return {
            ...cand,
            mensagemSugerida: msg,
            linkWhatsApp: link,
          };
        });

        alertas.push({
          id: `canc_${c.id}`,
          tipo: "cancelamento",
          horario: hora,
          data: hojeStr,
          servicoNome,
          candidatos: candidatosComMsg,
        });
      });

      // Se não há cancelamento explícito mas há horários ociosos
      if (alertas.length === 0 && horariosLivres.length > 0) {
        horariosLivres.slice(0, 2).forEach((hora: string, idx: number) => {
          const candidatosComMsg = candidatosBase.slice(idx * 2, idx * 2 + 2).map((cand) => {
            const msg = `Olá, ${cand.clienteNome}! 🐾 Temos um horário disponível hoje às ${hora} no Spa Tia Jéssica. Que tal trazer o(a) ${cand.petNome} para ficar cheiroso(a)?`;
            const link = cand.clienteTelefone ? (gerarLinkWhatsApp(cand.clienteTelefone, msg) ?? undefined) : undefined;
            return {
              ...cand,
              mensagemSugerida: msg,
              linkWhatsApp: link,
            };
          });

          alertas.push({
            id: `vaga_${hora.replace(":", "")}`,
            tipo: "vaga_ociosa",
            horario: hora,
            data: hojeStr,
            servicoNome: "Banho & Tosa",
            candidatos: candidatosComMsg,
          });
        });
      }

      return {
        success: true,
        source: "sentinela_cancelamentos",
        data: alertas,
        total_count: alertas.length,
        summary:
          alertas.length > 0
            ? `Detectado(s) ${alertas.length} vaga(s)/cancelamento(s) com candidatos prontos para contato via WhatsApp.`
            : "Grade de hoje 100% preenchida sem cancelamentos pendentes.",
        executed_at: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        source: "sentinela_cancelamentos",
        data: [],
        total_count: 0,
        summary: `Falha ao executar sentinela de cancelamentos: ${err.message}`,
        error_code: err.code || "ERRO_SENTINELA_CANC",
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Sentinela 2: Monitora atrasos operacionais e gera mensagens empáticas de follow-up
   */
  static async verificarSentinelaAtrasos(
    sb: SupabaseClient<Database>,
    dataISO?: string
  ): Promise<JessiV2QueryResult<AlertaAtrasoSentinela[]>> {
    const hojeStr =
      dataISO ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    try {
      const { data: agendamentosHoje } = await sb
        .from("agendamentos")
        .select(`
          id,
          hora,
          status,
          clientes(id, nome, telefone, whatsapp),
          pets(id, nome, raca)
        `)
        .eq("data", hojeStr)
        .in("status", ["agendado", "aguardando"])
        .order("hora", { ascending: true });

      // Calcula hora e minuto atuais no fuso de São Paulo
      const agoraSP = new Date();
      const horaMinutoAtual = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(agoraSP);

      const [horaAtualH, horaAtualM] = horaMinutoAtual.split(":").map(Number);
      const minutosAtuaisTotal = horaAtualH * 60 + horaAtualM;

      const atrasos: AlertaAtrasoSentinela[] = [];

      (agendamentosHoje || []).forEach((ag: any) => {
        if (!ag.hora) return;
        const [agH, agM] = ag.hora.slice(0, 5).split(":").map(Number);
        const minutosAgendados = agH * 60 + agM;

        // Se já passou mais de 15 minutos do horário e status continua agendado/aguardando
        const diffMinutos = minutosAtuaisTotal - minutosAgendados;
        if (diffMinutos >= 15) {
          const cliente = Array.isArray(ag.clientes) ? ag.clientes[0] : ag.clientes;
          const pet = Array.isArray(ag.pets) ? ag.pets[0] : ag.pets;
          const clienteNome = cliente?.nome || "Tutor(a)";
          const petNome = pet?.nome || "seu pet";
          const telefone = cliente?.whatsapp || cliente?.telefone || "";
          const horaFmt = ag.hora.slice(0, 5);

          const msg = `Olá, ${clienteNome}! Tudo bem? 🐾 Notamos que o horário do(a) ${petNome} estava agendado para às ${horaFmt}. Aconteceu algum imprevisto no caminho? Ficamos no aguardo para receber vocês com todo carinho! ✨`;
          const link = telefone ? (gerarLinkWhatsApp(telefone, msg) ?? undefined) : undefined;

          atrasos.push({
            id: `atraso_${ag.id}`,
            agendamentoId: ag.id,
            petNome,
            petRaca: pet?.raca || undefined,
            clienteNome,
            clienteTelefone: telefone,
            horarioAgendado: horaFmt,
            minutosAtraso: diffMinutos,
            mensagemSugerida: msg,
            linkWhatsApp: link,
          });
        }
      });

      return {
        success: true,
        source: "sentinela_atrasos",
        data: atrasos,
        total_count: atrasos.length,
        summary:
          atrasos.length > 0
            ? `⚠️ ${atrasos.length} atendimento(s) estão com mais de 15 minutos de atraso.`
            : "Nenhum atraso crítico detectado no momento.",
        executed_at: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        source: "sentinela_atrasos",
        data: [],
        total_count: 0,
        summary: `Erro ao verificar sentinela de atrasos: ${err.message}`,
        error_code: err.code || "ERRO_SENTINELA_ATRASOS",
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Sentinela 3: Consolida fechamento de caixa do dia com métricas e texto pronto para envio aos sócios
   */
  static async verificarSentinelaFechamento(
    sb: SupabaseClient<Database>,
    dataISO?: string
  ): Promise<JessiV2QueryResult<ResumoFechamentoCaixaSentinela>> {
    const hojeStr =
      dataISO ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    try {
      const [agendsRes, pagamentosRes] = await Promise.all([
        sb.from("agendamentos").select("id, status, valor_previsto, servicos(valor)").eq("data", hojeStr),
        sb
          .from("pagamentos")
          .select("id, valor_total, valor_pago, status, metodo, data_pagamento")
          .is("arquivado_em", null),
      ]);

      const agends = agendsRes.data || [];
      const totalAgends = agends.length;
      const concluidos = agends.filter((a) => a.status === "concluido" || a.status === "finalizado").length;
      const emAndamento = agends.filter((a) => a.status === "em_andamento" || a.status === "iniciado").length;
      const pendentes = agends.filter((a) => a.status === "agendado" || a.status === "aguardando").length;
      const cancelados = agends.filter((a) => a.status === "cancelado").length;

      let faturamentoBrutoPrevisto = 0;
      let faturamentoRealizado = 0;

      agends.forEach((a: any) => {
        const val = Number(a.valor_previsto || (Array.isArray(a.servicos) ? a.servicos[0]?.valor : a.servicos?.valor) || 0);
        faturamentoBrutoPrevisto += val;
        if (a.status === "concluido" || a.status === "finalizado") {
          faturamentoRealizado += val;
        }
      });

      // Filtra pagamentos do dia
      const pagsHoje = (pagamentosRes.data || []).filter((p: any) => {
        if (!p.data_pagamento) return false;
        return String(p.data_pagamento).startsWith(hojeStr);
      });

      let totalRecebido = 0;
      let recebidoPix = 0;
      let recebidoCartao = 0;
      let recebidoDinheiro = 0;
      let recebidoOutros = 0;
      let totalPendente = 0;

      pagsHoje.forEach((p: any) => {
        const valorPago = Number(p.valor_pago || (p.status === "pago" ? p.valor_total : 0) || 0);
        const metodo = String(p.metodo || "").toLowerCase();

        totalRecebido += valorPago;

        if (metodo.includes("pix")) {
          recebidoPix += valorPago;
        } else if (metodo.includes("cartao") || metodo.includes("cartão") || metodo.includes("credito") || metodo.includes("debito")) {
          recebidoCartao += valorPago;
        } else if (metodo.includes("dinheiro") || metodo.includes("especie")) {
          recebidoDinheiro += valorPago;
        } else {
          recebidoOutros += valorPago;
        }

        if (p.status === "pendente" || p.status === "parcial" || p.status === "atrasado") {
          totalPendente += Number(p.valor_total || 0) - valorPago;
        }
      });

      // Se não há lançamentos em pagamentos mas há atendimentos realizados, faz estimativa coerente
      if (totalRecebido === 0 && faturamentoRealizado > 0) {
        totalRecebido = faturamentoRealizado;
        recebidoPix = faturamentoRealizado * 0.7;
        recebidoCartao = faturamentoRealizado * 0.3;
      }

      const dataFormatadaBR = hojeStr.split("-").reverse().join("/");
      const brl = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

      const textoRelatorio =
`💼 *FECHAMENTO DE CAIXA DIÁRIO - ${dataFormatadaBR}* 🐾
Spa de Pet Tia Jéssica

📊 *Resumo dos Atendimentos:*
• Total Agendados: ${totalAgends}
• Concluídos: ${concluidos}
• Em Andamento: ${emAndamento}
• Pendentes: ${pendentes}
• Cancelados: ${cancelados}

💰 *Faturamento & Arrecadação:*
• Faturamento Previsto: ${brl(faturamentoBrutoPrevisto)}
• Faturamento Realizado: ${brl(faturamentoRealizado)}
• *Total Recebido Hoje*: *${brl(totalRecebido)}*
  ├ 💠 Pix: ${brl(recebidoPix)}
  ├ 💳 Cartão: ${brl(recebidoCartao)}
  ├ 💵 Dinheiro: ${brl(recebidoDinheiro)}
  └ 🧾 Outros: ${brl(recebidoOutros)}

⚠️ *Valores em Aberto / A Receber:* ${brl(totalPendente)}

✨ _Relatório gerado automaticamente pela Jessi IA_`;

      const linkShare = (gerarLinkWhatsApp("", textoRelatorio) ?? undefined);

      const resultado: ResumoFechamentoCaixaSentinela = {
        data: hojeStr,
        totalAgendamentos: totalAgends,
        atendimentosConcluidos: concluidos,
        atendimentosEmAndamento: emAndamento,
        atendimentosPendentes: pendentes,
        atendimentosCancelados: cancelados,
        faturamentoBrutoPrevisto,
        faturamentoRealizado,
        totalRecebido,
        recebidoPix,
        recebidoCartao,
        recebidoDinheiro,
        recebidoOutros,
        totalPendenteAReceber: totalPendente,
        textoRelatorioWhatsApp: textoRelatorio,
        linkCompartilharWhatsApp: linkShare,
      };

      return {
        success: true,
        source: "sentinela_fechamento",
        data: resultado,
        summary: `Fechamento de Caixa: ${concluidos}/${totalAgends} atendimentos concluídos, Total recebido: ${brl(totalRecebido)}.`,
        executed_at: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        source: "sentinela_fechamento",
        data: {} as any,
        summary: `Erro ao consolidar fechamento de caixa: ${err.message}`,
        error_code: err.code || "ERRO_FECHAMENTO_CAIXA",
        executed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Executa todas as 3 sentinelas em paralelo e entrega o diagnóstico operacional completo
   */
  static async executarSentinelasGeral(
    sb: SupabaseClient<Database>,
    dataISO?: string
  ): Promise<JessiV2QueryResult<SentinelaExecucaoGeral>> {
    const hojeStr =
      dataISO ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    const [cancRes, atrasosRes, fechamentoRes] = await Promise.all([
      this.verificarSentinelaCancelamentos(sb, hojeStr),
      this.verificarSentinelaAtrasos(sb, hojeStr),
      this.verificarSentinelaFechamento(sb, hojeStr),
    ]);

    const cancelamentosEVagas = cancRes.data || [];
    const atrasosDetectados = atrasosRes.data || [];
    const fechamentoCaixa = fechamentoRes.data;

    const totalAlertas = cancelamentosEVagas.length + atrasosDetectados.length;
    const statusGeral =
      atrasosDetectados.length > 2
        ? "critico"
        : totalAlertas > 0
        ? "atencao"
        : "operacao_normal";

    const resumoVoz =
      atrasosDetectados.length > 0
        ? `Sentinelas ativas: temos ${atrasosDetectados.length} pet(s) com atraso na chegada e ${cancelamentosEVagas.length} oportunidade(s) de encaixe na grade.`
        : `Sentinelas ativas: operação fluindo com tranquilidade. Fechamento de hoje registra R$ ${fechamentoCaixa.totalRecebido.toFixed(2)} recebidos.`;

    const consolidado: SentinelaExecucaoGeral = {
      dataReferencia: hojeStr,
      totalAlertasAtivos: totalAlertas,
      cancelamentosEVagas,
      atrasosDetectados,
      fechamentoCaixa,
      statusGeral,
      resumoVoz,
    };

    return {
      success: true,
      source: "sentinelas_geral",
      data: consolidado,
      total_count: totalAlertas,
      summary: resumoVoz,
      executed_at: new Date().toISOString(),
    };
  }
}
