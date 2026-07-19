// Utilitários compartilhados pelo módulo de Atendimentos.

export type ServicoItem = {
  servico_id: string | null;
  nome: string;
  quantidade: number;
  valor_unit: number;
  valor_total: number;
  categoria?: string | null;
  motivo?: string | null;
  adicionado_por?: string | null;
  adicionado_por_nome?: string | null;
  adicionado_em?: string | null;
};

export type FotoItem = {
  path: string;
  observacao?: string | null;
  principal?: boolean;
  created_at?: string;
  created_by?: string | null;
  created_by_nome?: string | null;
};

export type EtapaStatusValor = "pendente" | "em_preenchimento" | "concluida";

export type EtapaStatus = {
  status: EtapaStatusValor;
  confirmado_em?: string | null;
  confirmado_por?: string | null;
  confirmado_por_nome?: string | null;
};

export const ETAPAS = [
  { num: 1, key: "solicitado", titulo: "Serviço solicitado", cta: "CONFIRMAR SERVIÇO SOLICITADO" },
  { num: 2, key: "extras", titulo: "Serviços extras", cta: "SALVAR E CONFIRMAR SERVIÇOS" },
  { num: 3, key: "foto_antes", titulo: "Foto antes do atendimento", cta: "SALVAR E CONFIRMAR FOTOS DO ANTES" },
  { num: 4, key: "atendimento", titulo: "Como foi o atendimento", cta: "SALVAR E CONFIRMAR ATENDIMENTO" },
  { num: 5, key: "foto_depois", titulo: "Foto do pet finalizado", cta: "SALVAR E CONFIRMAR FOTOS DO RESULTADO" },
  { num: 6, key: "relatorio", titulo: "Relatório completo", cta: "CONFIRMAR RELATÓRIO" },
  { num: 7, key: "pagamento", titulo: "Pagamento", cta: "CONFIRMAR PAGAMENTO OU PENDÊNCIA" },
  { num: 8, key: "encerrar", titulo: "Encerrar atendimento", cta: "ENCERRAR ATENDIMENTO" },
] as const;

export function getEtapaStatus(atend: any, num: number): EtapaStatus {
  const map = (atend?.etapas_status ?? {}) as Record<string, EtapaStatus>;
  return map[String(num)] ?? { status: "pendente" };
}

export function isEtapaConfirmada(atend: any, num: number): boolean {
  return getEtapaStatus(atend, num).status === "concluida";
}

export function brl(v: number | null | undefined) {
  return Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function sumItens(itens: ServicoItem[] | null | undefined) {
  return (itens ?? []).reduce((acc, i) => acc + Number(i.valor_total || 0), 0);
}

export function itemFromServico(
  s: { id: string; nome: string; valor: number | null; categoria?: string | null },
  quantidade = 1,
): ServicoItem {
  const valor_unit = Number(s.valor ?? 0);
  return {
    servico_id: s.id,
    nome: s.nome,
    categoria: s.categoria ?? null,
    quantidade,
    valor_unit,
    valor_total: valor_unit * quantidade,
  };
}

export function isBanho(item: ServicoItem) {
  const t = `${item.categoria ?? ""} ${item.nome ?? ""}`.toLowerCase();
  return t.includes("banho");
}
export function isTosa(item: ServicoItem) {
  const t = `${item.categoria ?? ""} ${item.nome ?? ""}`.toLowerCase();
  return t.includes("tosa");
}

export const COMPORTAMENTOS = [
  { value: "muito_tranquilo", label: "Muito tranquilo" },
  { value: "tranquilo", label: "Tranquilo" },
  { value: "agitado", label: "Agitado" },
  { value: "muito_agitado", label: "Muito agitado" },
  { value: "ansioso", label: "Ansioso" },
  { value: "medroso", label: "Medroso" },
  { value: "agressivo", label: "Agressivo" },
] as const;

export const OCORRENCIA_TIPOS = [
  { value: "machucado", label: "Machucado" },
  { value: "irritacao", label: "Irritação de pele" },
  { value: "pulgas_carrapatos", label: "Pulgas / carrapatos" },
  { value: "agressividade", label: "Agressividade" },
  { value: "servico_interrompido", label: "Serviço interrompido" },
  { value: "acidente", label: "Acidente" },
  { value: "outro", label: "Outro" },
] as const;

export const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "pendente", label: "Pendente" },
] as const;
