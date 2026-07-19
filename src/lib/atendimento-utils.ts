// Utilitários compartilhados pelo módulo de Atendimentos.

export type ServicoItem = {
  servico_id: string | null;
  nome: string;
  quantidade: number;
  valor_unit: number;
  valor_total: number;
  categoria?: string | null;
};

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
  { value: "necessitou_focinheira", label: "Precisou de focinheira" },
  { value: "necessitou_pausa", label: "Precisou de pausa" },
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
