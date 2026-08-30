/**
 * Motor central de regras de crédito, categorias e equivalências para Programas de Cuidado
 * Spa de Pet Tia Jéssica
 */

export type CategoriaCreditoTipo = "banho" | "hidratacao" | "tosa" | "acabamento" | "adicional" | "outro";

export interface RegraEquivalenciaServico {
  categoria_credito: CategoriaCreditoTipo;
  nome_categoria: string;
  descricao_cobertura: string;
  servicos_elegiveis_nomes: string[];
}

export const REGRAS_CATEGORIAS_PADRAO: Record<CategoriaCreditoTipo, RegraEquivalenciaServico> = {
  banho: {
    categoria_credito: "banho",
    nome_categoria: "Banho",
    descricao_cobertura: "Válido para Banho Simples ou Banho Premium",
    servicos_elegiveis_nomes: ["Banho Simples", "Banho Premium", "Banho", "Banho e Secagem"],
  },
  hidratacao: {
    categoria_credito: "hidratacao",
    nome_categoria: "Hidratação",
    descricao_cobertura: "Válido exclusivamente para Hidratação Profunda",
    servicos_elegiveis_nomes: ["Hidratação Profunda", "Hidratação", "Máscara de Hidratação"],
  },
  tosa: {
    categoria_credito: "tosa",
    nome_categoria: "Tosa",
    descricao_cobertura: "Válido para Tosa Higiênica ou Tosa da Raça",
    servicos_elegiveis_nomes: ["Tosa Higiênica", "Tosa da Raça", "Tosa Geral", "Tosa Máquina", "Tosa Tesoura"],
  },
  acabamento: {
    categoria_credito: "acabamento",
    nome_categoria: "Acabamento",
    descricao_cobertura: "Válido para Acabamentos Específicos",
    servicos_elegiveis_nomes: ["Acerto de Patas", "Acabamento do Rosto", "Corte de Unhas", "Limpeza de Ouvidos"],
  },
  adicional: {
    categoria_credito: "adicional",
    nome_categoria: "Adicional",
    descricao_cobertura: "Serviço adicional específico do contrato",
    servicos_elegiveis_nomes: ["Desembolo", "Remoção de Subpelo", "Penteado"],
  },
  outro: {
    categoria_credito: "outro",
    nome_categoria: "Outros Serviços",
    descricao_cobertura: "Serviço avulso sob medida",
    servicos_elegiveis_nomes: [],
  },
};

/**
 * Identifica a categoria de crédito a partir do serviço (por ID real e categoria oficial do catálogo)
 */
export function identificarCategoriaCredito(servico: { id?: string; nome?: string; categoria?: string | null }): CategoriaCreditoTipo {
  const catOficial = (servico.categoria || "").trim().toLowerCase();
  const nomeServico = (servico.nome || "").trim().toLowerCase();

  if (catOficial === "banhos" || nomeServico.includes("banho")) {
    return "banho";
  }

  if (catOficial === "hidratação" || catOficial === "hidratacao" || nomeServico.includes("hidrata")) {
    return "hidratacao";
  }

  if (catOficial === "tosas" || nomeServico.includes("tosa")) {
    return "tosa";
  }

  if (catOficial === "acabamentos" || nomeServico.includes("unha") || nomeServico.includes("pata") || nomeServico.includes("rosto")) {
    return "acabamento";
  }

  if (catOficial === "cuidados com a pelagem" || nomeServico.includes("desembolo") || nomeServico.includes("subpelo")) {
    return "adicional";
  }

  return "outro";
}

/**
 * Verifica se um determinado serviço executado/agendado é elegível para uma categoria de crédito
 */
export function isServicoElegivelParaCategoria(
  servico: { id?: string; nome?: string; categoria?: string | null },
  categoriaCredito: CategoriaCreditoTipo
): boolean {
  const catIdentificada = identificarCategoriaCredito(servico);
  return catIdentificada === categoriaCredito;
}

export interface SaldoCreditoItem {
  categoria: CategoriaCreditoTipo;
  nome_categoria: string;
  descricao_cobertura: string;
  servico_referencia_id: string;
  servico_referencia_nome: string;
  contratados: number;
  reservados: number;
  utilizados: number;
  cancelados: number;
  expirados: number;
  disponiveis: number;
  bloqueado: boolean;
}

export interface ResumoCreditosContrato {
  contrato_id: string;
  nome_programa: string;
  pet_id: string;
  pet_nome?: string;
  cliente_id: string;
  status_do_programa: string;
  data_de_inicio: string;
  data_de_validade: string;
  dias_restantes: number;
  status_validade: "valido" | "vence_hoje" | "proximo_vencimento" | "vencido";
  preco_vendido: number;
  valor_pago: number;
  saldo_financeiro: number;
  itens: SaldoCreditoItem[];
  total_creditos_disponiveis: number;
}

/**
 * Calcula os saldos de créditos de um contrato a partir das movimentações e do snapshot da composição
 */
export function calcularSaldosDoContrato(
  contrato: any,
  movimentacoes: any[],
  pagamento?: any
): ResumoCreditosContrato {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataValidade = contrato.data_de_validade ? new Date(contrato.data_de_validade) : null;
  let diasRestantes = 0;
  let statusValidade: "valido" | "vence_hoje" | "proximo_vencimento" | "vencido" = "valido";

  if (dataValidade) {
    dataValidade.setHours(0, 0, 0, 0);
    diasRestantes = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) {
      statusValidade = "vencido";
    } else if (diasRestantes === 0) {
      statusValidade = "vence_hoje";
    } else if (diasRestantes <= 5) {
      statusValidade = "proximo_vencimento";
    }
  }

  const isBloqueado = contrato.status_do_programa === "aguardando_pagamento";
  const valorPago = Number(pagamento?.valor_pago ?? (contrato.status_do_programa === "ativo" ? contrato.preco_vendido : 0));
  const saldoFinanceiro = Math.max(0, Number(contrato.preco_vendido) - valorPago);

  // Mapa de itens por categoria
  const composicao = Array.isArray(contrato.composicao_snapshot) ? contrato.composicao_snapshot : [];
  const categoriasMap: Record<string, SaldoCreditoItem> = {};

  // Inicializa a partir da composição contratada
  composicao.forEach((item: any) => {
    const cat = identificarCategoriaCredito({ nome: item.nome, categoria: item.categoria });
    const regra = REGRAS_CATEGORIAS_PADRAO[cat] || REGRAS_CATEGORIAS_PADRAO.outro;

    if (!categoriasMap[cat]) {
      categoriasMap[cat] = {
        categoria: cat,
        nome_categoria: regra.nome_categoria,
        descricao_cobertura: regra.descricao_cobertura,
        servico_referencia_id: item.servico_id,
        servico_referencia_nome: item.nome || regra.nome_categoria,
        contratados: 0,
        reservados: 0,
        utilizados: 0,
        cancelados: 0,
        expirados: 0,
        disponiveis: 0,
        bloqueado: isBloqueado,
      };
    }

    categoriasMap[cat].contratados += Number(item.quantidade || 0);
  });

  // Processa as movimentações
  movimentacoes.forEach((mov: any) => {
    let cat = mov.categoria_credito as CategoriaCreditoTipo;
    if (!cat) {
      cat = identificarCategoriaCredito({ nome: mov.servico?.nome || mov.motivo, categoria: mov.servico?.categoria });
    }

    if (!categoriasMap[cat]) {
      const regra = REGRAS_CATEGORIAS_PADRAO[cat] || REGRAS_CATEGORIAS_PADRAO.outro;
      categoriasMap[cat] = {
        categoria: cat,
        nome_categoria: regra.nome_categoria,
        descricao_cobertura: regra.descricao_cobertura,
        servico_referencia_id: mov.servico_id || "",
        servico_referencia_nome: mov.servico?.nome || regra.nome_categoria,
        contratados: 0,
        reservados: 0,
        utilizados: 0,
        cancelados: 0,
        expirados: 0,
        disponiveis: 0,
        bloqueado: isBloqueado,
      };
    }

    const qtd = Number(mov.quantidade || 0);
    const tipo = mov.tipo;

    if (tipo === "credito_reservado") {
      categoriasMap[cat].reservados += qtd;
    } else if (tipo === "reserva_liberada") {
      categoriasMap[cat].reservados = Math.max(0, categoriasMap[cat].reservados - qtd);
    } else if (tipo === "credito_consumido") {
      categoriasMap[cat].utilizados += qtd;
    } else if (tipo === "estorno_consumo") {
      categoriasMap[cat].utilizados = Math.max(0, categoriasMap[cat].utilizados - qtd);
    } else if (tipo === "cancelamento") {
      categoriasMap[cat].cancelados += qtd;
    } else if (tipo === "credito_expirado") {
      categoriasMap[cat].expirados += qtd;
    } else if (tipo === "ajuste_manual" && qtd < 0) {
      categoriasMap[cat].cancelados += Math.abs(qtd);
    } else if (tipo === "ajuste_manual" && qtd > 0) {
      categoriasMap[cat].contratados += qtd;
    }
  });

  // Calcula disponíveis para cada categoria
  let totalDisponiveis = 0;
  const itens = Object.values(categoriasMap).map((it) => {
    const disponivel = Math.max(0, it.contratados - it.reservados - it.utilizados - it.cancelados - it.expirados);
    it.disponiveis = isBloqueado ? 0 : disponivel;
    if (!isBloqueado) totalDisponiveis += disponivel;
    return it;
  });

  return {
    contrato_id: contrato.id,
    nome_programa: contrato.nome_snapshot || "Programa de Cuidado",
    pet_id: contrato.pet_id,
    pet_nome: contrato.pets?.nome,
    cliente_id: contrato.cliente_id,
    status_do_programa: contrato.status_do_programa,
    data_de_inicio: contrato.data_de_inicio,
    data_de_validade: contrato.data_de_validade,
    dias_restantes: diasRestantes,
    status_validade: statusValidade,
    preco_vendido: Number(contrato.preco_vendido || 0),
    valor_pago: valorPago,
    saldo_financeiro: saldoFinanceiro,
    itens,
    total_creditos_disponiveis: totalDisponiveis,
  };
}
