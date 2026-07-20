import jsPDF from "jspdf";

const C = {
  forest: [26, 61, 45] as [number, number, number],
  gold: [176, 141, 87] as [number, number, number],
  ink: [30, 34, 32] as [number, number, number],
  mute: [110, 116, 112] as [number, number, number],
  line: [220, 216, 208] as [number, number, number],
  cream: [250, 247, 240] as [number, number, number],
};

export type ReciboData = {
  tipo: "receita" | "despesa";
  numero: string; // ex: RC-20260719-abcd
  data: string; // yyyy-mm-dd
  contraparte: string; // cliente ou fornecedor
  descricao: string;
  valor: number;
  forma?: string | null;
  categoria?: string | null;
  observacoes?: string | null;
  empresa?: {
    nome?: string | null;
    cnpj?: string | null;
    telefone?: string | null;
    endereco?: string | null;
  } | null;
  operador?: string | null;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Extenso simplificado
function valorExtenso(valor: number): string {
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  const partes: string[] = [];
  if (inteiro > 0) partes.push(`${inteiro} ${inteiro === 1 ? "real" : "reais"}`);
  if (centavos > 0)
    partes.push(`${centavos} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ") || "zero real";
}

export function generateReciboPDF(d: ReciboData, returnBlob = false) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const isReceita = d.tipo === "receita";
  const titulo = isReceita ? "RECIBO DE PAGAMENTO" : "COMPROVANTE DE DESPESA";

  // Header
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 90, W, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(d.empresa?.nome ?? "Spa de Pet Tia Jessica", M, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const sub = [d.empresa?.cnpj, d.empresa?.telefone, d.empresa?.endereco]
    .filter(Boolean)
    .join(" · ");
  if (sub) doc.text(sub, M, 58);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(titulo, W - M, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nº ${d.numero}`, W - M, 58, { align: "right" });
  doc.text(fmtDate(d.data), W - M, 72, { align: "right" });

  // Valor destacado
  let y = 130;
  doc.setFillColor(...C.cream);
  doc.rect(M, y, W - M * 2, 60, "F");
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(1);
  doc.line(M, y, M, y + 60);

  doc.setTextColor(...C.mute);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("VALOR", M + 16, y + 22);

  doc.setTextColor(...C.forest);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(brl(d.valor), M + 16, y + 48);

  doc.setTextColor(...C.mute);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(valorExtenso(d.valor), W - M - 16, y + 48, { align: "right" });

  y += 90;

  // Corpo
  doc.setTextColor(...C.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const declInicio = isReceita
    ? `Recebemos de `
    : `Pagamos a `;
  const declFim = isReceita
    ? ` a importância acima, referente a:`
    : ` a importância acima, referente a:`;

  const parag = `${declInicio}${d.contraparte}${declFim}`;
  const lines = doc.splitTextToSize(parag, W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 14 + 8;

  // Descrição destacada
  doc.setFillColor(248, 246, 240);
  const descLines = doc.splitTextToSize(d.descricao || "—", W - M * 2 - 16);
  const descH = descLines.length * 14 + 20;
  doc.rect(M, y, W - M * 2, descH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.forest);
  doc.text("Descrição", M + 8, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(descLines, M + 8, y + 30);
  y += descH + 16;

  // Detalhes
  const detalhes: [string, string][] = [
    ["Forma de pagamento", d.forma ? d.forma.replace(/_/g, " ") : "—"],
    ["Categoria", d.categoria || "—"],
    ["Data", fmtDate(d.data)],
    ["Operador", d.operador || "—"],
  ];
  doc.setFontSize(9);
  detalhes.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * ((W - M * 2) / 2);
    const yy = y + row * 22;
    doc.setTextColor(...C.mute);
    doc.text(k.toUpperCase(), x, yy);
    doc.setTextColor(...C.ink);
    doc.setFont("helvetica", "bold");
    doc.text(String(v), x, yy + 12);
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(detalhes.length / 2) * 22 + 12;

  if (d.observacoes) {
    doc.setTextColor(...C.mute);
    doc.setFontSize(9);
    doc.text("OBSERVAÇÕES", M, y);
    doc.setTextColor(...C.ink);
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(d.observacoes, W - M * 2);
    doc.text(obsLines, M, y + 14);
    y += obsLines.length * 12 + 20;
  }

  // Assinatura
  y = Math.max(y + 40, H - 140);
  doc.setDrawColor(...C.line);
  doc.line(M, y, M + 240, y);
  doc.setFontSize(9);
  doc.setTextColor(...C.mute);
  doc.text(d.empresa?.nome ?? "Spa de Pet Tia Jessica", M, y + 14);
  doc.text("Emitente", M, y + 26);

  // Rodapé
  doc.setDrawColor(...C.line);
  doc.line(M, H - 40, W - M, H - 40);
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  const gerado = new Date().toLocaleString("pt-BR");
  doc.text(`Documento gerado em ${gerado}`, M, H - 24);
  doc.text(`Nº ${d.numero}`, W - M, H - 24, { align: "right" });

  const fileName = `${isReceita ? "recibo" : "comprovante"}-${d.numero}.pdf`;
  if (returnBlob) return { blob: doc.output("blob") as Blob, fileName };
  deliverPdf(doc, fileName);
  return { fileName };
}
