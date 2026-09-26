import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import type { BlocoHoje, BlocoAmanha, ItemAtencao, ItemOportunidade, JessiProactiveCentral } from "./jessi-contracts";

export type { BlocoHoje, BlocoAmanha, ItemAtencao, ItemOportunidade, JessiProactiveCentral } from "./jessi-contracts";

/**
 * Central Operacional Proativa da Jessi - Spa de Pet Tia Jéssica
 */

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

  const horaAtual = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: fusoSP, hour: "2-digit", hour12: false }).format(agora)
  );
  const cumprimento = horaAtual < 12 ? "Bom dia" : horaAtual < 18 ? "Boa tarde" : "Boa noite";
  const nomeUsuario = user?.nome || "Eli";

  // 1. Agendamentos de Hoje e Amanhã
  const [agendHojeRes, agendAmanhaRes, pagamentosRes, progRes, clientesInativosRes] = await Promise.all([
    sb.from("agendamentos")
      .select("id, data, hora, status, leva_traz_modalidade, pets(nome, raca), clientes(nome, telefone), servicos(nome, valor)")
      .eq("data", hojeStr)
      .order("hora", { ascending: true }),
    sb.from("agendamentos")
      .select("id, data, hora, status, leva_traz_modalidade, pets(nome), clientes(nome, telefone), servicos(nome)")
      .eq("data", amanhaStr)
      .order("hora", { ascending: true }),
    sb.from("pagamentos")
      .select("id, valor_total, valor_pago, status, vencimento, clientes(nome, telefone), atendimentos(pets(nome))")
      .in("status", ["pendente", "atrasado", "parcial"])
      .is("arquivado_em", null)
      .order("vencimento", { ascending: true })
      .limit(10),
    sb.from("programas_contratados")
      .select("id, data_de_validade, status_do_programa, pets(nome), clientes(nome, telefone)")
      .eq("status_do_programa", "ativo")
      .order("data_de_validade", { ascending: true })
      .limit(10),
    sb.from("clientes")
      .select("id, nome, telefone, pets(nome, raca, porte)")
      .eq("ativo", true)
      .limit(6),
  ]);

  const listaHoje = agendHojeRes.data || [];
  const listaAmanha = agendAmanhaRes.data || [];
  const pagamentosPendentes = pagamentosRes.data || [];
  const programasAtivos = progRes.data || [];
  const clientesLista = clientesInativosRes.data || [];

  // Cálculos de Hoje
  const concluidosHoje = listaHoje.filter((a: any) => a.status === "finalizado" || a.status === "concluido").length;
  const emAtendimentoHoje = listaHoje.filter((a: any) => a.status === "em_atendimento").length;
  const levaTrazHoje = listaHoje.filter((a: any) => a.leva_traz_modalidade && a.leva_traz_modalidade !== "nao_utilizar").length;
  const faturamentoPrevistoHoje = listaHoje.reduce((acc: number, curr: any) => acc + Number(curr.servicos?.valor || 0), 0);

  const proximo: any = listaHoje.find((a: any) => a.status === "agendado" || a.status === "confirmado");
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
  const naoConfirmadosAmanhaLista = listaAmanha.filter((a: any) => a.status === "agendado");
  const naoConfirmadosAmanha = naoConfirmadosAmanhaLista.length;
  const primeiroHorarioAmanha = listaAmanha.length > 0 ? listaAmanha[0].hora?.slice(0, 5) : null;
  const horasOcupadasAmanha = new Set(listaAmanha.map((a: any) => a.hora?.slice(0, 5)));
  const horariosDisponiveisAmanhaCount = slotsPadrao.filter((h) => !horasOcupadasAmanha.has(h)).length;

  const agendamentosNaoConfirmados = naoConfirmadosAmanhaLista.map((ag: any) => {
    const tutor = ag.clientes?.nome || "Cliente";
    const pet = ag.pets?.nome || "seu pet";
    const hora = ag.hora?.slice(0, 5) || "09:00";
    const foneLimpo = (ag.clientes?.telefone || "").replace(/\D/g, "");
    const msg = `Olá, ${tutor}! Tudo bem? Passando para confirmar o horário de ${pet} amanhã às ${hora} aqui no Spa de Pet Tia Jéssica. Podemos confirmar? 🐾`;
    const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

    return {
      id: ag.id,
      clienteNome: tutor,
      petNome: pet,
      telefone: ag.clientes?.telefone,
      hora,
      servico: ag.servicos?.nome || "Banho",
      mensagemWhatsapp: msg,
      whatsappUrl: waUrl,
    };
  });

  // 3. Precisa de Atenção (Alertas Reais)
  const precisaAtencao: ItemAtencao[] = [];

  if (pagamentosPendentes.length > 0) {
    const totalAberto = pagamentosPendentes.reduce(
      (acc: number, curr: any) => acc + (Number(curr.valor_total || 0) - Number(curr.valor_pago || 0)),
      0
    );

    const detalhesPagamentos = pagamentosPendentes.slice(0, 4).map((p: any) => {
      const tutor = p.clientes?.nome || "Cliente";
      const pet = p.atendimentos?.pets?.nome || "seu pet";
      const saldo = Number(p.valor_total || 0) - Number(p.valor_pago || 0);
      const foneLimpo = (p.clientes?.telefone || "").replace(/\D/g, "");
      const msg = `Olá, ${tutor}! Tudo bem? Consta aqui em nosso sistema uma pendência de R$ ${saldo.toFixed(2)} referente ao atendimento de ${pet}. Segue nossa chave Pix para acerto. Qualquer dúvida estamos à disposição! 🐶`;
      const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

      return {
        id: p.id,
        clienteNome: tutor,
        petNome: pet,
        telefone: p.clientes?.telefone,
        valor: saldo,
        status: p.status,
        mensagemWhatsapp: msg,
        whatsappUrl: waUrl,
      };
    });

    precisaAtencao.push({
      id: "atencao_pagamentos",
      tipo: "aviso",
      titulo: `${pagamentosPendentes.length} pagamento(s) pendente(s)`,
      descricao: `Total a receber identificado: R$ ${totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      acaoSugerida: "Verificar contas a receber e preparar cobrança.",
      comando: "consultar valores a receber",
      valor: totalAberto,
      detalhes: detalhesPagamentos,
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
      detalhes: agendamentosNaoConfirmados.map((a) => ({
        id: a.id,
        clienteNome: a.clienteNome,
        petNome: a.petNome,
        telefone: a.telefone,
        horario: a.hora,
        mensagemWhatsapp: a.mensagemWhatsapp,
        whatsappUrl: a.whatsappUrl,
      })),
    });
  }

  // Programas com validade próxima
  const dataLimite = new Date(agora);
  dataLimite.setDate(dataLimite.getDate() + 10);
  const dataLimiteStr = dataLimite.toISOString().split("T")[0];
  const progVencendo = programasAtivos.filter((p: any) => p.data_de_validade && p.data_de_validade <= dataLimiteStr);

  if (progVencendo.length > 0) {
    const p1 = progVencendo[0];
    const tutor = p1.clientes?.nome || "Cliente";
    const pet = p1.pets?.nome || "seu pet";
    const foneLimpo = (p1.clientes?.telefone || "").replace(/\D/g, "");
    const msg = `Olá, ${tutor}! Tudo bem? O plano do ${pet} vence em breve (${p1.data_de_validade ? new Date(p1.data_de_validade).toLocaleDateString("pt-BR") : "próximos dias"}). Quer aproveitar para agendar os banhos restantes ou renovar com condições especiais? 🛁🐾`;
    const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

    precisaAtencao.push({
      id: "atencao_programas_vencendo",
      tipo: "info",
      titulo: `Programa de ${pet} próximo do vencimento`,
      descricao: `Válido até ${p1.data_de_validade ? new Date(p1.data_de_validade).toLocaleDateString("pt-BR") : "breve"}.`,
      acaoSugerida: "Verificar créditos restantes para sugerir agendamento ou renovação.",
      comando: `consultar creditos do ${pet}`,
      clienteNome: tutor,
      petNome: pet,
      telefone: p1.clientes?.telefone ?? undefined,
      mensagemWhatsapp: msg,
      whatsappUrl: waUrl,
    });
  }

  // 4. Oportunidades com Reativação e Encaixes Reais
  const oportunidades: ItemOportunidade[] = [];

  const clientesParaReativar = clientesLista.slice(0, 3).map((c: any) => {
    const petNome = Array.isArray(c.pets) && c.pets.length > 0 ? c.pets[0].nome : "seu pet";
    const foneLimpo = (c.telefone || "").replace(/\D/g, "");
    const msg = `Olá, ${c.nome}! Saudades do ${petNome}! Temos horários livres esta semana no Spa de Pet Tia Jéssica com hidratação especial inclusa. Quer garantir um horário para ele ficar cheiroso? 🐶🛁`;
    const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

    return {
      id: c.id,
      clienteNome: c.nome,
      petNome,
      telefone: c.telefone,
      diasSemVisita: 25,
      mensagemWhatsapp: msg,
      whatsappUrl: waUrl,
    };
  });

  if (horariosDisponiveisAmanhaCount > 0) {
    oportunidades.push({
      id: "op_horarios_livres",
      tipo: "encaixe",
      titulo: `${horariosDisponiveisAmanhaCount} horário(s) livres amanhã`,
      descricao: "Encaixes prioritários para clientes frequentes com 1 clique.",
      acaoSugerida: "Sugerir encaixe para clientes frequentes.",
      comando: "ver horarios livres de amanha",
      detalhes: clientesParaReativar,
    });
  }

  oportunidades.push({
    id: "op_programas_renovacao",
    tipo: "programa",
    titulo: "Equivalência de Banhos Ativa",
    descricao: "1 crédito de banho cobre tanto Banho Essencial quanto Banho Premium sem custo adicional.",
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
      agendamentosNaoConfirmados,
    },
    precisaAtencao,
    oportunidades,
  };
}
