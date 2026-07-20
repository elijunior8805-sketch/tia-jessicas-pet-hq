import jsPDF from "jspdf";

const C = {
  forest: [26, 61, 45] as [number, number, number],
  gold: [176, 141, 87] as [number, number, number],
  ink: [30, 34, 32] as [number, number, number],
  mute: [110, 116, 112] as [number, number, number],
  line: [220, 216, 208] as [number, number, number],
  cream: [250, 247, 240] as [number, number, number],
  emerald: [4, 120, 87] as [number, number, number],
  rose: [190, 18, 60] as [number, number, number],
};

const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export type FinPdfKpis = {
  receitaBruta: number;
  totalRecebido: number;
  totalAReceber: number;
  vencidos: number;
  despesas: number;
  lucroEstimado: number;
  saldoPeriodo: number;
  ticketMedio: number;
  qtdPendentes: number;
  aportesAjustes: number;
};

export type FinPdfPorForma = {
  label: string;
  valor: number;
  qtd: number;
  pct: number;
};

export type FinPdfEntrada = {
  data?: string | null;
  vencimento?: string | null;
  cliente: string;
  descricao: string;
  forma: string;
  status: string;
  valor: number;
  valor_pago: number;
};

export type FinPdfSaida = {
  data?: string | null;
  vencimento?: string | null;
  fornecedor: string;
  descricao: string;
  categoria?: string | null;
  forma: string;
  status: string;
  valor: number;
  valor_pago: number;
};

export type FinPdfData = {
  empresa?: { nome?: string | null; cnpj?: string | null; telefone?: string | null } | null;
  periodo: { de: string; ate: string };
  filtrosAtivos: string[];
  kpis: FinPdfKpis;
  porForma: FinPdfPorForma[];
  entradas: FinPdfEntrada[];
  saidas: FinPdfSaida[];
};

export function generateFinanceiroPDF(d: FinPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 50) {
      addFooter();
      doc.addPage();
      y = M;
    }
  };

  let page = 1;
  const addFooter = () => {
    doc.setDrawColor(...C.line);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.mute);
    doc.text(
      `Relatório financeiro · gerado em ${new Date().toLocaleString("pt-BR")}`,
      M,
      H - 20,
    );
    doc.text(`Página ${page}`, W - M, H - 20, { align: "right" });
    page += 1;
  };

  // ===== Header =====
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, 84, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 84, W, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(d.empresa?.nome ?? "Spa de Pet Tia Jéssica", M, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sub = [d.empresa?.cnpj, d.empresa?.telefone].filter(Boolean).join(" · ");
  if (sub) doc.text(sub, M, 52);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RELATÓRIO FINANCEIRO", W - M, 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${fmtDate(d.periodo.de)} a ${fmtDate(d.periodo.ate)}`, W - M, 52, {
    align: "right",
  });

  y = 108;

  // Filtros ativos
  if (d.filtrosAtivos.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.mute);
    const line = `Filtros ativos: ${d.filtrosAtivos.join(" · ")}`;
    const lines = doc.splitTextToSize(line, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 11 + 6;
  }

  // ===== Cards =====
  const cards: { label: string; value: string; accent?: [number, number, number] }[] = [
    { label: "Receita bruta (competência)", value: brl(d.kpis.receitaBruta), accent: C.forest },
    { label: "Total recebido (caixa)", value: brl(d.kpis.totalRecebido), accent: C.emerald },
    { label: "A receber", value: brl(d.kpis.totalAReceber), accent: C.gold },
    { label: "Vencidos", value: brl(d.kpis.vencidos), accent: C.rose },
    { label: "Despesas pagas", value: brl(d.kpis.despesas), accent: C.rose },
    { label: "Lucro estimado", value: brl(d.kpis.lucroEstimado), accent: C.emerald },
    { label: "Saldo do período", value: brl(d.kpis.saldoPeriodo), accent: C.forest },
    { label: "Ticket médio", value: brl(d.kpis.ticketMedio), accent: C.mute },
    { label: "Pendências", value: String(d.kpis.qtdPendentes), accent: C.mute },
    { label: "Aportes / ajustes", value: brl(d.kpis.aportesAjustes), accent: C.mute },
  ];

  const cols = 5;
  const gap = 8;
  const cardW = (W - M * 2 - gap * (cols - 1)) / cols;
  const cardH = 54;
  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (cardW + gap);
    const yy = y + row * (cardH + gap);
    doc.setFillColor(...C.cream);
    doc.rect(x, yy, cardW, cardH, "F");
    if (c.accent) {
      doc.setFillColor(...c.accent);
      doc.rect(x, yy, 3, cardH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.mute);
    const labelLines = doc.splitTextToSize(c.label.toUpperCase(), cardW - 14);
    doc.text(labelLines, x + 8, yy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(c.value, x + 8, yy + 42);
  });
  const rows = Math.ceil(cards.length / cols);
  y += rows * (cardH + gap) + 8;

  // ===== Totais por forma =====
  ensureSpace(24 + Math.max(1, d.porForma.length) * 16 + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.forest);
  doc.text("Totais por forma de pagamento", M, y);
  y += 12;

  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.mute);
  doc.text("Forma", M + 4, y + 10);
  doc.text("Qtd", W - M - 220, y + 10, { align: "right" });
  doc.text("% do total", W - M - 130, y + 10, { align: "right" });
  doc.text("Valor", W - M - 4, y + 10, { align: "right" });
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.ink);
  const formas = d.porForma.filter((r) => r.valor > 0);
  if (!formas.length) {
    doc.setTextColor(...C.mute);
    doc.text("Sem recebimentos no período.", M + 4, y + 10);
    y += 18;
  } else {
    formas.forEach((r) => {
      ensureSpace(18);
      doc.text(r.label, M + 4, y + 10);
      doc.text(String(r.qtd), W - M - 220, y + 10, { align: "right" });
      doc.text(`${(r.pct * 100).toFixed(1)}%`, W - M - 130, y + 10, { align: "right" });
      doc.text(brl(r.valor), W - M - 4, y + 10, { align: "right" });
      y += 16;
    });
  }
  y += 8;

  // ===== Entradas =====
  drawTable(
    doc,
    () => y,
    (nv) => (y = nv),
    ensureSpace,
    W,
    M,
    H,
    "Entradas do período",
    ["Data", "Cliente", "Descrição", "Forma", "Status", "Valor"],
    [56, 120, 170, 60, 60, 60],
    d.entradas.map((e) => [
      fmtDate(e.data ?? e.vencimento),
      e.cliente,
      e.descricao,
      e.forma,
      e.status,
      brl(e.valor_pago || e.valor),
    ]),
    d.entradas.reduce((s, e) => s + (e.valor_pago || e.valor || 0), 0),
    "Total entradas",
  );

  y += 12;

  // ===== Saídas =====
  drawTable(
    doc,
    () => y,
    (nv) => (y = nv),
    ensureSpace,
    W,
    M,
    H,
    "Saídas do período",
    ["Data", "Fornecedor", "Descrição", "Forma", "Status", "Valor"],
    [56, 120, 170, 60, 60, 60],
    d.saidas.map((e) => [
      fmtDate(e.data ?? e.vencimento),
      e.fornecedor,
      e.descricao,
      e.forma,
      e.status,
      brl(e.valor_pago || e.valor),
    ]),
    d.saidas.reduce((s, e) => s + (e.valor_pago || e.valor || 0), 0),
    "Total saídas",
  );

  addFooter();

  const fileName = `financeiro_${d.periodo.de}_a_${d.periodo.ate}.pdf`;
  deliverPdf(doc, fileName);
  return { fileName };
}

function drawTable(
  doc: jsPDF,
  getY: () => number,
  setY: (n: number) => void,
  ensureSpace: (n: number) => void,
  W: number,
  M: number,
  H: number,
  title: string,
  headers: string[],
  widths: number[],
  rows: string[][],
  total: number,
  totalLabel: string,
) {
  ensureSpace(36);
  let y = getY();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.forest);
  doc.text(title, M, y);
  y += 12;

  const totalW = widths.reduce((s, w) => s + w, 0);
  const scale = (W - M * 2) / totalW;
  const ws = widths.map((w) => w * scale);

  // Header row
  doc.setFillColor(...C.cream);
  doc.rect(M, y, W - M * 2, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.mute);
  let x = M + 4;
  headers.forEach((h, i) => {
    const align = i === headers.length - 1 ? "right" : "left";
    const tx = align === "right" ? x + ws[i] - 8 : x;
    doc.text(h.toUpperCase(), tx, y + 12, { align });
    x += ws[i];
  });
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.ink);

  if (!rows.length) {
    doc.setTextColor(...C.mute);
    doc.text("Sem lançamentos com os filtros atuais.", M + 4, y + 12);
    y += 20;
    setY(y);
    return;
  }

  rows.forEach((row, ri) => {
    // measure row height by wrapping middle column (descrição) if needed
    const heights = row.map((cell, i) => {
      const lines = doc.splitTextToSize(String(cell), ws[i] - 8);
      return lines.length * 11;
    });
    const rowH = Math.max(16, ...heights) + 4;
    ensureSpace(rowH + 4);
    y = getY();
    if (ri % 2 === 1) {
      doc.setFillColor(248, 246, 240);
      doc.rect(M, y, W - M * 2, rowH, "F");
    }
    let cx = M + 4;
    doc.setTextColor(...C.ink);
    row.forEach((cell, i) => {
      const align = i === row.length - 1 ? "right" : "left";
      const lines = doc.splitTextToSize(String(cell), ws[i] - 8);
      const tx = align === "right" ? cx + ws[i] - 8 : cx;
      doc.text(lines, tx, y + 11, { align });
      cx += ws[i];
    });
    y += rowH;
    setY(y);
  });

  // Total row
  ensureSpace(22);
  y = getY();
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.forest);
  doc.text(totalLabel, M + 4, y + 12);
  doc.text(brl(total), W - M - 4, y + 12, { align: "right" });
  y += 20;
  setY(y);
}
