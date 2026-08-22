import { deliverPdf } from "./pdf-open";
import type { FinPdfData } from "./financeiro-pdf";

const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export function generateFinanceiroCSV(d: FinPdfData) {
  const SEP = ";";
  const rows: string[] = [];

  // Cabeçalho da Empresa e Período
  rows.push(`RELATORIO FINANCEIRO${SEP}${d.empresa?.nome || "Spa de Pet Tia Jessica"}`);
  rows.push(`PERIODO${SEP}${fmtDate(d.periodo.de)} ate ${fmtDate(d.periodo.ate)}`);
  rows.push("");

  // KPIs
  rows.push(`INDICADORES (VALORES EM BRL)`);
  rows.push(`Faturamento (Competencia)${SEP}${d.kpis.receitaBruta.toFixed(2)}`);
  rows.push(`Recebido (Caixa)${SEP}${d.kpis.totalRecebido.toFixed(2)}`);
  rows.push(`Despesas Pagas${SEP}${d.kpis.despesas.toFixed(2)}`);
  rows.push(`Lucro Estimado${SEP}${d.kpis.lucroEstimado.toFixed(2)}`);
  rows.push(`Saldo do Periodo${SEP}${d.kpis.saldoPeriodo.toFixed(2)}`);
  rows.push(`A Receber${SEP}${d.kpis.totalAReceber.toFixed(2)}`);
  rows.push(`Vencidos${SEP}${d.kpis.vencidos.toFixed(2)}`);
  rows.push(`Ticket Medio${SEP}${d.kpis.ticketMedio.toFixed(2)}`);
  rows.push(`Aportes / Ajustes${SEP}${d.kpis.aportesAjustes.toFixed(2)}`);
  rows.push("");

  // Totais por Forma
  rows.push(`TOTAIS POR FORMA DE PAGAMENTO`);
  rows.push(`Forma${SEP}Quantidade${SEP}Percentual${SEP}Valor`);
  d.porForma.forEach(f => {
    rows.push(`${f.label}${SEP}${f.qtd}${SEP}${(f.pct * 100).toFixed(2)}%${SEP}${f.valor.toFixed(2)}`);
  });
  rows.push("");

  // Entradas
  rows.push(`ENTRADAS DO PERIODO`);
  rows.push(`Data${SEP}Cliente${SEP}Descricao${SEP}Forma${SEP}Status${SEP}Valor`);
  d.entradas.forEach(e => {
    const val = e.valor_pago || e.valor || 0;
    rows.push(`${fmtDate(e.data || e.vencimento)}${SEP}${e.cliente}${SEP}${e.descricao}${SEP}${e.forma}${SEP}${e.status}${SEP}${val.toFixed(2)}`);
  });
  rows.push("");

  // Saídas
  rows.push(`SAIDAS DO PERIODO`);
  rows.push(`Data${SEP}Fornecedor${SEP}Descricao${SEP}Forma${SEP}Status${SEP}Valor`);
  d.saidas.forEach(s => {
    const val = s.valor_pago || s.valor || 0;
    rows.push(`${fmtDate(s.data || s.vencimento)}${SEP}${s.fornecedor}${SEP}${s.descricao}${SEP}${s.forma}${SEP}${s.status}${SEP}${val.toFixed(2)}`);
  });
  rows.push("");

  // Audit Note
  if (d.auditNote) {
    rows.push(`NOTAS DE AUDITORIA`);
    // Remove newlines and separator to avoid breaking CSV
    const cleanNote = d.auditNote.replace(/[\r\n]+/g, " ").replace(new RegExp(SEP, 'g'), ",");
    rows.push(cleanNote);
  }

  const csvContent = "\ufeff" + rows.join("\n"); // Add BOM for Excel
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const fileName = `financeiro_${d.periodo.de}_a_${d.periodo.ate}.csv`;
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
