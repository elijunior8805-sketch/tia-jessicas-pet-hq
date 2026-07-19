import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl, sumItens, type ServicoItem } from "./atendimento-utils";

type AtendPDFData = {
  atendimento: any;
  ocorrencias?: any[];
  empresa?: { nome?: string | null; cnpj?: string | null; telefone?: string | null; endereco?: string | null } | null;
  operador?: string | null;
  returnBlob?: boolean;
};

// Deep-forest, off-white, gold palette (RGB)
const C = {
  forest: [26, 61, 45] as [number, number, number],
  gold: [176, 141, 87] as [number, number, number],
  ink: [30, 34, 32] as [number, number, number],
  mute: [110, 116, 112] as [number, number, number],
  line: [220, 216, 208] as [number, number, number],
  cream: [250, 247, 240] as [number, number, number],
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return "—";
  }
}

export function generateAtendimentoPDF({ atendimento, ocorrencias = [], empresa, operador }: AtendPDFData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const cliente = atendimento?.clientes ?? {};
  const pet = atendimento?.pets ?? {};
  const executados = (atendimento?.servicos_executados ?? []) as ServicoItem[];
  const planejados = (atendimento?.servicos_planejados ?? []) as ServicoItem[];
  const valorExec = sumItens(executados);
  const taxa = Number(atendimento?.taxa_leva_traz ?? 0);
  const total = valorExec + taxa;
  const comportamentos = (atendimento?.comportamentos ?? []) as string[];

  // Header band
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 90, W, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(empresa?.nome ?? "Spa de Pet Tia Jessica", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const infoLine = [empresa?.cnpj, empresa?.telefone, empresa?.endereco].filter(Boolean).join("  ·  ");
  if (infoLine) doc.text(infoLine, M, 58);
  doc.setFontSize(9);
  doc.text("Relatorio de Atendimento", M, 76);

  // Right side: protocol
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const proto = String(atendimento?.id ?? "").slice(0, 8).toUpperCase();
  doc.text(`Protocolo ${proto}`, W - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(fmtDateTime(atendimento?.data_fim ?? atendimento?.data_inicio), W - M, 58, { align: "right" });

  let y = 120;
  doc.setTextColor(...C.ink);

  // Cliente & Pet
  const boxW = (W - M * 2 - 12) / 2;
  const boxTop = y;
  const boxH = 110;

  const drawBox = (x: number, title: string, lines: [string, string][]) => {
    doc.setDrawColor(...C.line);
    doc.setFillColor(...C.cream);
    doc.roundedRect(x, boxTop, boxW, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.gold);
    doc.text(title.toUpperCase(), x + 12, boxTop + 18);
    doc.setTextColor(...C.ink);
    doc.setFontSize(10);
    let ly = boxTop + 36;
    lines.forEach(([k, v]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.mute);
      doc.text(k, x + 12, ly);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.ink);
      const value = doc.splitTextToSize(v || "—", boxW - 90);
      doc.text(value, x + 82, ly);
      ly += 16;
    });
  };

  drawBox(M, "Tutor", [
    ["Nome", cliente.nome ?? "—"],
    ["WhatsApp", cliente.whatsapp ?? "—"],
    ["VIP", cliente.vip ? "Sim" : "Nao"],
    ["Operador", operador ?? "—"],
  ]);
  drawBox(M + boxW + 12, "Pet", [
    ["Nome", pet.nome ?? "—"],
    ["Raca / Porte", `${pet.raca ?? "—"} / ${pet.porte ?? "—"}`],
    ["Alergias", pet.alergias ?? "—"],
    ["Temperamento", pet.temperamento ?? "—"],
  ]);
  y = boxTop + boxH + 20;

  // Timeline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.forest);
  doc.text("LINHA DO TEMPO", M, y);
  doc.setDrawColor(...C.gold);
  doc.line(M, y + 4, M + 90, y + 4);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  const t1 = `Check-in: ${fmtDateTime(atendimento?.data_inicio)}`;
  const t2 = `Check-out: ${fmtDateTime(atendimento?.data_fim)}`;
  doc.text(t1, M, y); y += 14;
  doc.text(t2, M, y); y += 20;

  // Serviços executados (tabela)
  autoTable(doc, {
    startY: y,
    head: [["Servico", "Qtd", "Valor unit.", "Subtotal"]],
    body: executados.length
      ? executados.map((it) => [
          it.nome,
          String(it.quantidade ?? 1),
          brl(Number(it.valor_unit ?? 0)),
          brl(Number(it.valor_unit ?? 0) * Number(it.quantidade ?? 1)),
        ])
      : [["Nenhum servico executado", "", "", ""]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: C.ink, lineColor: C.line },
    headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      1: { halign: "center", cellWidth: 50 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 },
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Totais
  const totRows: [string, string][] = [
    ["Servicos executados", brl(valorExec)],
    ["Taxa leva-e-traz", brl(taxa)],
    ["TOTAL", brl(total)],
  ];
  const totX = W - M - 240;
  totRows.forEach(([k, v], i) => {
    const isTotal = i === totRows.length - 1;
    if (isTotal) {
      doc.setFillColor(...C.forest);
      doc.rect(totX, y - 2, 240, 22, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...C.ink);
    }
    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.setFontSize(isTotal ? 11 : 10);
    doc.text(k, totX + 10, y + 13);
    doc.text(v, totX + 230, y + 13, { align: "right" });
    y += isTotal ? 26 : 18;
  });
  y += 4;
  doc.setTextColor(...C.ink);

  // Planejado vs executado (resumo compacto)
  if (planejados.length) {
    const planTotal = sumItens(planejados);
    const diff = valorExec - planTotal;
    doc.setFontSize(9);
    doc.setTextColor(...C.mute);
    doc.text(
      `Planejado: ${brl(planTotal)}   Executado: ${brl(valorExec)}   Diferenca: ${diff >= 0 ? "+" : ""}${brl(diff)}`,
      M,
      y
    );
    y += 16;
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 60) {
      doc.addPage();
      y = 60;
    }
  };

  // Registro operacional
  const section = (title: string) => {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.forest);
    doc.text(title.toUpperCase(), M, y);
    doc.setDrawColor(...C.gold);
    doc.line(M, y + 4, M + doc.getTextWidth(title) + 4, y + 4);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.ink);
  };

  const paragraph = (text?: string | null) => {
    const t = (text ?? "").trim() || "—";
    const lines = doc.splitTextToSize(t, W - M * 2);
    ensureSpace(lines.length * 14 + 6);
    doc.text(lines, M, y);
    y += lines.length * 14 + 6;
  };

  section("Observacoes de check-in");
  paragraph(atendimento?.observacoes_checkin);

  if (comportamentos.length) {
    section("Comportamento observado");
    paragraph(comportamentos.join(", "));
  }

  section("Observacoes internas");
  paragraph(atendimento?.observacoes_internas);

  section("Recomendacoes ao tutor");
  paragraph(atendimento?.recomendacoes);

  if (atendimento?.proxima_visita) {
    section("Proxima visita sugerida");
    paragraph(fmtDate(atendimento.proxima_visita));
  }

  // Ocorrências
  if (ocorrencias.length) {
    section("Ocorrencias registradas");
    autoTable(doc, {
      startY: y,
      head: [["Data", "Tipo", "Descricao", "Tutor informado"]],
      body: ocorrencias.map((o: any) => [
        fmtDateTime(o.created_at),
        String(o.tipo ?? "—"),
        String(o.descricao ?? "—"),
        o.tutor_informado ? "Sim" : "Nao",
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: C.ink, lineColor: C.line },
      headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 80 }, 3: { cellWidth: 80, halign: "center" } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.line(M, H - 40, W - M, H - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.mute);
    doc.text(
      `${empresa?.nome ?? "Spa de Pet Tia Jessica"} · Documento gerado em ${fmtDateTime(new Date().toISOString())}`,
      M,
      H - 24
    );
    doc.text(`Pagina ${i} de ${pageCount}`, W - M, H - 24, { align: "right" });
  }

  const fileName = `atendimento-${(pet.nome ?? "pet").toString().replace(/\s+/g, "_")}-${proto}.pdf`;
  if (arguments[0]?.returnBlob) {
    return doc.output("blob") as unknown as Blob;
  }
  doc.save(fileName);
  return fileName;
}
