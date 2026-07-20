import jsPDF from "jspdf";
import { deliverPdf } from "./pdf-open";
import logoAsset from "@/assets/spa-de-pet-logo.png.asset.json";

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
  numero: string;
  data: string;
  contraparte: string;
  descricao: string;
  valor: number;
  forma?: string | null;
  categoria?: string | null;
  observacoes?: string | null;
  petNome?: string | null;
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

function valorExtenso(valor: number): string {
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  const partes: string[] = [];
  if (inteiro > 0) partes.push(`${inteiro} ${inteiro === 1 ? "real" : "reais"}`);
  if (centavos > 0)
    partes.push(`${centavos} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ") || "zero real";
}

// Cache do logo em dataURL para evitar refetch a cada emissão
let logoDataUrlCache: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlCache) return logoDataUrlCache;
  try {
    const res = await fetch(logoAsset.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    logoDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

export async function generateReciboPDF(d: ReciboData, returnBlob = false) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const logo = await getLogoDataUrl();

  const isReceita = d.tipo === "receita";
  const titulo = isReceita ? "RECIBO DE PAGAMENTO" : "COMPROVANTE DE DESPESA";

  // ===== Header =====
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, 100, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 100, W, 3, "F");

  // Logo em círculo claro à esquerda
  if (logo) {
    const logoSize = 60;
    const cx = M + logoSize / 2;
    const cy = 50;
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, logoSize / 2 + 3, "F");
    try {
      doc.addImage(logo, "PNG", M, cy - logoSize / 2, logoSize, logoSize, undefined, "FAST");
    } catch {
      /* noop */
    }
  }

  const textX = logo ? M + 76 : M;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(d.empresa?.nome ?? "Spa de Pet Tia Jessica", textX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sub = [d.empresa?.cnpj, d.empresa?.telefone, d.empresa?.endereco]
    .filter(Boolean)
    .join(" · ");
  if (sub) doc.text(sub, textX, 56);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(220, 210, 180);
  doc.text("Cuidado premium para o seu melhor amigo", textX, 72);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(titulo, W - M, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nº ${d.numero}`, W - M, 58, { align: "right" });
  doc.text(fmtDate(d.data), W - M, 72, { align: "right" });

  // ===== Valor destacado =====
  let y = 140;
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

  // ===== Corpo =====
  doc.setTextColor(...C.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const declInicio = isReceita ? `Recebemos de ` : `Pagamos a `;
  const declFim = ` a importância acima, referente a:`;
  const parag = `${declInicio}${d.contraparte}${declFim}`;
  const lines = doc.splitTextToSize(parag, W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 14 + 8;

  // Descrição
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
  y = Math.max(y + 40, H - 170);
  doc.setDrawColor(...C.line);
  doc.line(M, y, M + 240, y);
  doc.setFontSize(9);
  doc.setTextColor(...C.mute);
  doc.text(d.empresa?.nome ?? "Spa de Pet Tia Jessica", M, y + 14);
  doc.text("Emitente", M, y + 26);

  // ===== Rodapé com logo =====
  const footerTop = H - 60;
  doc.setFillColor(...C.forest);
  doc.rect(0, footerTop, W, 60, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, footerTop, W, 2, "F");

  if (logo) {
    const s = 30;
    try {
      doc.addImage(logo, "PNG", M, footerTop + (60 - s) / 2, s, s, undefined, "FAST");
    } catch {
      /* noop */
    }
  }

  const fx = logo ? M + 42 : M;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(d.empresa?.nome ?? "Spa de Pet Tia Jessica", fx, footerTop + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 210, 180);
  const footSub = [d.empresa?.telefone, d.empresa?.endereco]
    .filter(Boolean)
    .join(" · ");
  if (footSub) doc.text(footSub, fx, footerTop + 38);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const gerado = new Date().toLocaleString("pt-BR");
  doc.text(`Nº ${d.numero}`, W - M, footerTop + 24, { align: "right" });
  doc.setTextColor(220, 210, 180);
  doc.text(`Emitido em ${gerado}`, W - M, footerTop + 38, { align: "right" });

  const fileName = `${isReceita ? "recibo" : "comprovante"}-${d.numero}.pdf`;
  if (returnBlob) return { blob: doc.output("blob") as Blob, fileName };
  deliverPdf(doc, fileName);
  return { fileName };
}
