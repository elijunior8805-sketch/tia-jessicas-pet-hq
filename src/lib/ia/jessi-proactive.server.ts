import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

/**
 * Central Operacional Proativa da Jessi - Spa de Pet Tia Jéssica
 */

export interface BlocoHoje {
  totalAgendamentos: number;
  proximoAtendimento?: {
    hora: string;
    pet: string;
    tutor: string;
    servico: string;
  } | null;
  emAtendimento: number;
  concluidos: number;
  levaTrazCount: number;
  faturamentoPrevisto: number;
  horariosLivres: string[];
}

export interface BlocoAmanha {
  totalAgendamentos: number;
  primeiroHorario?: string | null;
  levaTrazCount: number;
  naoConfirmados: number;
  horariosDisponiveisCount: number;
}

export interface ItemAtencao {
  id: string;
  tipo: "urgente" | "aviso" | "info";
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  comando: string;
}

export interface ItemOportunidade {
  id: string;
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  comando: string;
}

export interface JessiProactiveCentral {
  saudacaoPersonalizada: string;
  dataReferencia: string;
  proprietarioNome: string;
  hoje: BlocoHoje;
  amanha: BlocoAmanha;
  precisaAtencao: ItemAtencao[];
  oportunidades: ItemOportunidade[];
}

export async function gerarCentralOperacionalJessi(
  sb: SupabaseClient<Database>,
  user?: { id?: string; nome?: string }
): Promise<JessiProactiveCentral> {
  const agora = new Date();
  const fusoSP = "America/Sao_Paulo";
  const hojeStr = new Intl.DateTimeFormat("en-CA", { timeZone: fusoSP, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);

  const amanhaDt = new Date(agora);
  amanhaDt.setDate(amanhaDt.getDate() + 1);
  const amanhaStr = new Intl.DateTimeFormat("en-CA", { timeZone: fusoSP, year: "numeric", month: "2-digit", day: "2-digit" }).format(amanhaDt);

  const horaAtual = agora.getHours();
  const cumprimento = horaAtual < 12 ? "Bom dia" : horaAtual < 18 ? "Boa tarde" : "Boa noite";
  const nomeUsuario = user?.nome || "Eli";

  // 1. Agendamentos de Hoje e Amanhã
  const [agendHojeRes, agendAmanhaRes, pagamentosRes, progRes, clientesAtrasadosRes] = await Promise.all([
    sb.from("agendamentos")
      .select("id, data, hora, status, leva_traz_modalidade, pets(nome, raca), clientes(nome, telefone), servicos(nome, preco)")
      .eq("data", hojeStr)
      .order("hora", { ascending: true }),
    sb.from("agendamentos")
      .select("id, data, hora, status, leva_traz_modalidade, pets(nome), clientes(nome), servicos(nome)")
      .eq("data", amanhaStr)
      .order("hora", { ascending: true }),
    sb.from("pagamentos")
      .select("id, valor_total, valor_pago, status, vencimento, clientes(nome), atendimentos(pets(nome))")
      .in("status", ["pendente", "atrasado", "parcial"])
      .is("arquivado_em", null)
      .order("vencimento", { ascending: true })
      .limit(10),
    sb.from("programas_contratados")
      .select("id, data_de_validade, status_do_programa, pets(nome), clientes(nome)")
      .eq("status_do_programa", "ativo")
      .order("data_de_validade", { ascending: true })
      .limit(10),
    sb.from("clientes")
      .select("id, nome, telefone, pets(nome, raca, porte)")
      .eq("ativo", true)
      .limit(5),
  ]);

  const listaHoje = agendHojeRes.data || [];
  const listaAmanha = agendAmanhaRes.data || [];
  const pagamentosPendentes = pagamentosRes.data || [];
  const programasAtivos = progRes.data || [];

  // Cálculos de Hoje
  const concluidosHoje = listaHoje.filter((a: any) => a.status === "finalizado" || a.status === "concluido").length;
  const emAtendimentoHoje = listaHoje.filter((a: any) => a.status === "em_atendimento").length;
  const levaTrazHoje = listaHoje.filter((a: any) => a.leva_traz_modalidade && a.leva_traz_modalidade !== "nao_utilizar").length;
  const faturamentoPrevistoHoje = listaHoje.reduce((acc: number, curr: any) => acc + Number(curr.servicos?.preco || 0), 0);

  const proximo = listaHoje.find((a: any) => a.status === "agendado" || a.status === "confirmado");
  const proximoAtendimento = proximo ? {
    hora: proximo.hora?.slice(0, 5) || "09:00",
    pet: proximo.pets?.nome || "Pet",
    tutor: proximo.clientes?.nome || "Cliente",
    servico: proximo.servicos?.nome || "Banho",
  } : null;

  // Grade de Horários Livres de Hoje (9h às 18h)
  const slotsPadrao = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const horasOcupadasHoje = new Set(listaHoje.map((a: any) => a.hora?.slice(0, 5)));
  const horariosLivresHoje = slotsPadrao.filter((h) => !horasOcupadasHoje.has(h));

  // Cálculos de Amanhã
  const levaTrazAmanha = listaAmanha.filter((a: any) => a.leva_traz_modalidade && a.leva_traz_modalidade !== "nao_utilizar").length;
  const naoConfirmadosAmanha = listaAmanha.filter((a: any) => a.status === "agendado").length;
  const primeiroHorarioAmanha = listaAmanha.length > 0 ? listaAmanha[0].hora?.slice(0, 5) : null;
  const horasOcupadasAmanha = new Set(listaAmanha.map((a: any) => a.hora?.slice(0, 5)));
  const horariosDisponiveisAmanhaCount = slotsPadrao.filter((h) => !horasOcupadasAmanha.has(h)).length;

  // 3. Precisa de Atenção (Alertas Reais)
  const precisaAtencao: ItemAtencao[] = [];

  if (pagamentosPendentes.length > 0) {
    const totalAberto = pagamentosPendentes.reduce(
      (acc: number, curr: any) => acc + (Number(curr.valor_total || 0) - Number(curr.valor_pago || 0)),
      0
    );
    precisaAtencao.push({
      id: "atencao_pagamentos",
      tipo: "aviso",
      titulo: `${pagamentosPendentes.length} pagamento(s) pendente(s)`,
      descricao: `Total a receber identificado: R$ ${totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      acaoSugerida: "Verificar contas a receber e preparar cobrança.",
      comando: "consultar valores a receber",
    });
  }

  if (naoConfirmadosAmanha > 0) {
    precisaAtencao.push({
      id: "atencao_confirmacoes",
      tipo: "aviso",
      titulo: `${naoConfirmadosAmanha} agendamento(s) de amanhã sem confirmação`,
      descricao: "Clientes ainda não confirmaram a presença para os atendimentos de amanhã.",
      acaoSugerida: "Preparar mensagens de confirmação pelo WhatsApp.",
      comando: "preparar lembretes de confirmacao para amanha",
    });
  }

  // Programas com validade próxima
  const dataLimite = new Date(agora);
  dataLimite.setDate(dataLimite.getDate() + 10);
  const dataLimiteStr = dataLimite.toISOString().split("T")[0];
  const progVencendo = programasAtivos.filter((p: any) => p.data_de_validade && p.data_de_validade <= dataLimiteStr);

  if (progVencendo.length > 0) {
    const p1 = progVencendo[0];
    precisaAtencao.push({
      id: "atencao_programas_vencendo",
      tipo: "info",
      titulo: `Programa de ${p1.pets?.nome || "Pet"} próximo do vencimento`,
      descricao: `Válido até ${p1.data_de_validade ? new Date(p1.data_de_validade).toLocaleDateString("pt-BR") : "breve"}.`,
      acaoSugerida: "Verificar créditos restantes para sugerir agendamento ou renovação.",
      comando: `consultar creditos do ${p1.pets?.nome || "Thor"}`,
    });
  }

  // 4. Oportunidades
  const oportunidades: ItemOportunidade[] = [];

  if (horariosDisponiveisAmanhaCount > 0) {
    oportunidades.push({
      id: "op_horarios_livres",
      titulo: `${horariosDisponiveisAmanhaCount} horário(s) livres amanhã`,
      descricao: "Oportunidade para encaixes ou reativação de clientes frequentes.",
      acaoSugerida: "Ver horários vagos e sugerir para clientes em atraso.",
      comando: "ver horarios livres de amanha",
    });
  }

  oportunidades.push({
    id: "op_programas_renovacao",
    titulo: "Equivalência de Banhos Ativa",
    descricao: "1 crédito de banho cobre tanto Banho Simples quanto Banho Premium sem custo adicional.",
    acaoSugerida: "Oferecer upgrade para clientes de planos ativos.",
    comando: "consultar catalogo de programas",
  });

  const saudacaoPersonalizada = `${cumprimento}, ${nomeUsuario}. Preparei sua central operacional de hoje. Você tem ${listaHoje.length} atendimento(s), ${levaTrazHoje} com leva e traz e ${pagamentosPendentes.length} pendência(s) financeira(s). Por onde você quer começar?`;

  return {
    saudacaoPersonalizada,
    dataReferencia: hojeStr,
    proprietarioNome: nomeUsuario,
    hoje: {
      totalAgendamentos: listaHoje.length,
      proximoAtendimento,
      emAtendimento: emAtendimentoHoje,
      concluidos: concluidosHoje,
      levaTrazCount: levaTrazHoje,
      faturamentoPrevisto: faturamentoPrevistoHoje,
      horariosLivres: horariosLivresHoje,
    },
    amanha: {
      totalAgendamentos: listaAmanha.length,
      primeiroHorario: primeiroHorarioAmanha,
      levaTrazCount: levaTrazAmanha,
      naoConfirmados: naoConfirmadosAmanha,
      horariosDisponiveisCount: horariosDisponiveisAmanhaCount,
    },
    precisaAtencao,
    oportunidades,
  };
}
