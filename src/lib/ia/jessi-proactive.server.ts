import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

/**
 * Motor Proativo da Jessi - Spa de Pet Tia Jéssica
 */

export interface JessiProactiveDigest {
  saudacao: string;
  dataReferencia: string;
  pontosDeAtencao: Array<{
    tipo: "urgente" | "aviso" | "info";
    titulo: string;
    descricao: string;
    acaoSugerida?: string;
  }>;
  resumoDia: {
    atendimentosHoje: number;
    faturamentoPrevisto: number;
    pendenciasRecebimento: number;
    aniversariantesHoje: number;
  };
  oportunidades: Array<{
    titulo: string;
    descricao: string;
  }>;
}

export async function gerarResumoProativoJessi(
  sb: SupabaseClient<Database>
): Promise<JessiProactiveDigest> {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const pontosDeAtencao: JessiProactiveDigest["pontosDeAtencao"] = [];
  const oportunidades: JessiProactiveDigest["oportunidades"] = [];

  // 1. Atendimentos de hoje
  const { data: atendimentosHoje } = await sb
    .from("atendimentos")
    .select("id, status, finalizado, valor_executado")
    .eq("data" as any, hoje);

  // 2. Pagamentos pendentes
  const { data: pagamentosPendentes } = await sb
    .from("pagamentos")
    .select("id, valor_total, valor_pago, status")
    .in("status", ["pendente", "atrasado"])
    .is("arquivado_em", null);

  // 3. Programas com validade próxima (próximos 7 dias)
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() + 7);
  const dataLimiteStr = dataLimite.toISOString().split("T")[0];

  const { data: programasVencendo } = await sb
    .from("programas_contratados")
    .select("id, pet_id, preco_vendido, data_de_validade, pets(nome), clientes(nome)")
    .eq("status_do_programa", "ativo")
    .lte("data_de_validade", dataLimiteStr)
    .gte("data_de_validade", hoje);

  if (programasVencendo && programasVencendo.length > 0) {
    pontosDeAtencao.push({
      tipo: "aviso",
      titulo: `${programasVencendo.length} programa(s) de cuidado vencendo em breve`,
      descricao: `Há contratos com créditos válidos até os próximos 7 dias.`,
      acaoSugerida: "Verificar saldos restantes e sugerir renovação ao tutor.",
    });
  }

  const pendenciasCount = (pagamentosPendentes || []).length;
  if (pendenciasCount > 0) {
    const totalAberto = (pagamentosPendentes || []).reduce(
      (acc, curr) => acc + (Number(curr.valor_total || 0) - Number(curr.valor_pago || 0)),
      0
    );
    pontosDeAtencao.push({
      tipo: "info",
      titulo: `${pendenciasCount} pagamento(s) em aberto`,
      descricao: `Total a receber identificado: R$ ${totalAberto.toFixed(2)}.`,
      acaoSugerida: "Consultar a fila de cobranças ou conciliar comprovantes.",
    });
  }

  const atendimentosCount = (atendimentosHoje || []).length;
  const faturamentoHoje = (atendimentosHoje || []).reduce(
    (acc, curr) => acc + Number(curr.valor_executado || 0),
    0
  );

  return {
    saudacao: "Olá! Aqui está o panorama da operação do Spa de Pet Tia Jéssica:",
    dataReferencia: hoje,
    pontosDeAtencao,
    resumoDia: {
      atendimentosHoje: atendimentosCount,
      faturamentoPrevisto: faturamentoHoje,
      pendenciasRecebimento: pendenciasCount,
      aniversariantesHoje: 0,
    },
    oportunidades: [
      {
        titulo: "Renovação de Pacotes",
        descricao: "Tutores com alta frequência são ideais para adesão aos Programas de Cuidado com economia.",
      },
    ],
  };
}
