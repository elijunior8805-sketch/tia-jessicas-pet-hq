import jsPDF from "jspdf";
import { deliverPdf } from "./pdf-open";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { brl, sumItens, type ServicoItem } from "./atendimento-utils";
import { getLogoDataUrl, drawLogoBadge } from "./logo-pdf";

type AtendPDFData = {
  atendimento: any;
  ocorrencias?: any[];
  empresa?: { nome?: string | null; cnpj?: string | null; telefone?: string | null; endereco?: string | null } | null;
  operador?: string | null;
  returnBlob?: boolean;
  /** Bucket paths para as fotos antes/depois. Se ausentes, o gerador lê de atendimento.fotos_antes/fotos_depois. */
  fotosAntesPaths?: string[];
  fotosDepoisPaths?: string[];
  /** Se true, gera o PDF mesmo sem fotos ou com falha no download. */
  permitirSemFotos?: boolean;
};

export type PDFResult = {
  fileName: string;
  blob?: Blob;
  fotosIncluidas: { antes: number; depois: number };
  fotosFalhas: string[];
};

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
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; }
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  } catch { return "—"; }
}

export type LoadedImage = { dataUrl: string; w: number; h: number; path: string };

/**
 * Carrega imagem privada do bucket como dataURL, corrigindo orientação (EXIF)
 * via createImageBitmap quando disponível. Redimensiona para no máx. 1400px.
 */
export async function loadImageAsDataURL(path: string): Promise<LoadedImage> {
  const { data, error } = await supabase.storage
    .from("spa-fotos")
    .createSignedUrl(path, 60 * 5);
  if (error || !data?.signedUrl) throw new Error(`URL falhou: ${path}`);
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`Download falhou: ${path}`);
  const blob = await res.blob();

  // Preferir createImageBitmap para respeitar EXIF (orientação de fotos de celular)
  let width = 0;
  let height = 0;
  let source: CanvasImageSource | null = null;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" as ImageOrientation });
    width = bmp.width; height = bmp.height; source = bmp;
  } catch {
    // Fallback via <img> (não corrige EXIF, mas funciona para PNG/WEBP/JPG normais)
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("img load"));
        el.src = url;
      });
      width = img.naturalWidth; height = img.naturalHeight; source = img;
    } finally {
      // não revoga aqui — usamos o source logo abaixo
    }
  }
  if (!source || !width || !height) throw new Error("Imagem inválida");

  const MAX = 1400;
  const scale = Math.min(1, MAX / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl, w, h, path };
}

export async function generateAtendimentoPDF(opts: AtendPDFData): Promise<PDFResult> {
  const { atendimento, ocorrencias = [], empresa, operador, returnBlob, permitirSemFotos } = opts;

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

  // ---- Fotos: descobrir caminhos ----
  const antesPaths: string[] =
    opts.fotosAntesPaths
    ?? ((atendimento?.fotos_antes ?? []) as any[])
        .map((f: any) => (typeof f === "string" ? f : f?.path))
        .filter(Boolean);
  const depoisPaths: string[] =
    opts.fotosDepoisPaths
    ?? ((atendimento?.fotos_depois ?? []) as any[])
        .map((f: any) => (typeof f === "string" ? f : f?.path))
        .filter(Boolean);

  // ---- Fotos: baixar antes de desenhar qualquer coisa ----
  const [antesRes, depoisRes] = await Promise.all([
    Promise.allSettled(antesPaths.map(loadImageAsDataURL)),
    Promise.allSettled(depoisPaths.map(loadImageAsDataURL)),
  ]);
  const antesOk = antesRes.filter((r): r is PromiseFulfilledResult<LoadedImage> => r.status === "fulfilled").map(r => r.value);
  const depoisOk = depoisRes.filter((r): r is PromiseFulfilledResult<LoadedImage> => r.status === "fulfilled").map(r => r.value);
  const falhas: string[] = [];
  antesRes.forEach((r, i) => { if (r.status === "rejected") falhas.push(antesPaths[i]); });
  depoisRes.forEach((r, i) => { if (r.status === "rejected") falhas.push(depoisPaths[i]); });

  if (!permitirSemFotos) {
    const semAntes = antesOk.length === 0;
    const semDepois = depoisOk.length === 0;
    if (semAntes || semDepois || falhas.length) {
      const err = new Error("Não foi possível carregar uma das fotos. Verifique as imagens antes de gerar o relatório.");
      (err as any).code = "FOTOS_INCOMPLETAS";
      (err as any).detalhe = { falhas, antesOk: antesOk.length, depoisOk: depoisOk.length };
      throw err;
    }
  }

  // ============ HEADER ============
  const logoDataUrl = await getLogoDataUrl();
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 90, W, 3, "F");

  drawLogoBadge(doc, logoDataUrl, M + 30, 45, 56);
  const textX = logoDataUrl ? M + 74 : M;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(empresa?.nome ?? "Spa de Pet Tia Jessica", textX, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const infoLine = [empresa?.cnpj, empresa?.telefone, empresa?.endereco].filter(Boolean).join("  ·  ");
  if (infoLine) doc.text(infoLine, textX, 58);
  doc.setFontSize(9);
  doc.text("Relatorio de Atendimento", textX, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const proto = String(atendimento?.id ?? "").slice(0, 8).toUpperCase();
  doc.text(`Protocolo ${proto}`, W - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(fmtDateTime(atendimento?.data_fim ?? atendimento?.data_inicio), W - M, 58, { align: "right" });

  let y = 120;
  doc.setTextColor(...C.ink);

  // ============ CLIENTE / PET ============
  const boxW = (W - M * 2 - 12) / 2;
  const boxTop = y;
  const boxH = 110;
  const drawBox = (x: number, title: string, lines: [string, string][]) => {
    doc.setDrawColor(...C.line);
    doc.setFillColor(...C.cream);
    doc.roundedRect(x, boxTop, boxW, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...C.gold);
    doc.text(title.toUpperCase(), x + 12, boxTop + 18);
    doc.setTextColor(...C.ink); doc.setFontSize(10);
    let ly = boxTop + 36;
    lines.forEach(([k, v]) => {
      doc.setFont("helvetica", "normal"); doc.setTextColor(...C.mute);
      doc.text(k, x + 12, ly);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...C.ink);
      const value = doc.splitTextToSize(v || "—", boxW - 90);
      doc.text(value, x + 82, ly);
      ly += 16;
    });
  };
  drawBox(M, "Tutor", [
    ["Nome", cliente.nome ?? "—"],
    ["WhatsApp", cliente.whatsapp ?? "—"],
    ["VIP", cliente.vip === true ? "Sim" : "—"],
    ["Atendente", (operador && operador.trim()) ? operador : "Jéssica Xavier"],
  ]);
  drawBox(M + boxW + 12, "Pet", [
    ["Nome", pet.nome ?? "—"],
    ["Raca / Porte", `${pet.raca ?? "—"} / ${pet.porte ?? "—"}`],
    ["Alergias", pet.alergias ?? "—"],
    ["Temperamento", pet.temperamento ?? "—"],
  ]);
  y = boxTop + boxH + 20;

  // ============ TIMELINE ============
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...C.forest);
  doc.text("LINHA DO TEMPO", M, y);
  doc.setDrawColor(...C.gold); doc.line(M, y + 4, M + 90, y + 4);
  y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...C.ink);
  doc.text(`Check-in: ${fmtDateTime(atendimento?.data_inicio)}`, M, y); y += 14;
  doc.text(`Check-out: ${fmtDateTime(atendimento?.data_fim)}`, M, y); y += 20;

  // ============ SERVIÇOS ============
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

  // ============ TOTAIS ============
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

  if (planejados.length) {
    const planTotal = sumItens(planejados);
    const diff = valorExec - planTotal;
    doc.setFontSize(9); doc.setTextColor(...C.mute);
    doc.text(
      `Planejado: ${brl(planTotal)}   Executado: ${brl(valorExec)}   Diferenca: ${diff >= 0 ? "+" : ""}${brl(diff)}`,
      M, y,
    );
    y += 16;
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 60) { doc.addPage(); y = 60; }
  };
  const section = (title: string) => {
    ensureSpace(30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...C.forest);
    doc.text(title.toUpperCase(), M, y);
    doc.setDrawColor(...C.gold); doc.line(M, y + 4, M + doc.getTextWidth(title) + 4, y + 4);
    y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...C.ink);
  };
  const paragraph = (text?: string | null) => {
    const t = (text ?? "").trim() || "—";
    const lines = doc.splitTextToSize(t, W - M * 2);
    ensureSpace(lines.length * 14 + 6);
    doc.text(lines, M, y);
    y += lines.length * 14 + 6;
  };

  // ============ REGISTRO DO CHECK-IN ============
  section("Registro do check-in");
  const flags: { label: string; on: boolean }[] = [
    { label: "Usou focinheira", on: !!(atendimento as any)?.usou_focinheira },
    { label: "Precisou de pausa", on: !!(atendimento as any)?.precisou_pausa },
    { label: "Alergia registrada", on: !!(pet?.alergias && String(pet.alergias).trim()) },
    { label: "Precisa de focinheira (ficha)", on: !!(pet as any)?.necessita_focinheira },
  ];
  const activeFlags = flags.filter((f) => f.on);
  if (activeFlags.length) {
    ensureSpace(24);
    let bx = M;
    activeFlags.forEach((f) => {
      const tw = doc.getTextWidth(f.label) + 18;
      if (bx + tw > W - M) { y += 20; bx = M; ensureSpace(24); }
      doc.setFillColor(255, 244, 214);
      doc.setDrawColor(...C.gold);
      doc.roundedRect(bx, y - 10, tw, 16, 4, 4, "FD");
      doc.setFontSize(9); doc.setTextColor(...C.forest); doc.setFont("helvetica", "bold");
      doc.text(f.label, bx + 9, y + 1);
      bx += tw + 6;
    });
    y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...C.ink);
  } else {
    paragraph("Sem alertas registrados no check-in.");
  }

  if (pet?.alergias) { section("Alergias do pet"); paragraph(String(pet.alergias)); }
  if (comportamentos.length) { section("Comportamento observado"); paragraph(comportamentos.join(", ")); }
  const obsCheckin = (atendimento?.observacoes_checkin?.trim?.() || atendimento?.observacoes?.trim?.() || (atendimento as any)?.check_in_obs?.trim?.() || "");
  section("Observacoes de check-in"); paragraph(obsCheckin);
  // Observações internas são de uso exclusivo da equipe — nunca no relatório do cliente.
  section("Recomendacoes ao tutor"); paragraph(atendimento?.recomendacoes);
  if (atendimento?.proxima_visita) { section("Proxima visita sugerida"); paragraph(fmtDate(atendimento.proxima_visita)); }

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

  // ============ RESULTADO DO ATENDIMENTO (ANTES x DEPOIS) ============
  if (antesOk.length || depoisOk.length) {
    // Página exclusiva para dar destaque
    doc.addPage();
    y = 60;

    // Faixa título
    doc.setFillColor(...C.forest);
    doc.rect(0, 0, W, 60, "F");
    doc.setFillColor(...C.gold);
    doc.rect(0, 60, W, 2, "F");
    drawLogoBadge(doc, logoDataUrl, W - M - 18, 30, 36);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Resultado do atendimento", M, 38);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const subtituloParts = [pet?.nome, fmtDate(atendimento?.data_fim ?? atendimento?.data_inicio)].filter(Boolean).join("  ·  ");
    if (subtituloParts) doc.text(subtituloParts, W - M, 38, { align: "right" });
    doc.setTextColor(...C.ink);

    y = 90;

    const drawPair = (antes: LoadedImage | null, depois: LoadedImage | null) => {
      const gap = 16;
      const availW = W - M * 2 - gap;
      const cellW = availW / 2;
      const cellH = 260;

      if (y + cellH + 40 > H - 60) { doc.addPage(); y = 60; }

      const drawCell = (label: string, img: LoadedImage | null, x: number) => {
        // Moldura
        doc.setDrawColor(...C.line);
        doc.setFillColor(...C.cream);
        doc.roundedRect(x, y, cellW, cellH + 30, 8, 8, "FD");

        // Etiqueta
        doc.setFillColor(...C.forest);
        doc.roundedRect(x + 10, y + 10, 74, 20, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(label.toUpperCase(), x + 47, y + 24, { align: "center" });
        doc.setTextColor(...C.ink);

        // Imagem contida (fit) — sem esticar
        const areaX = x + 10;
        const areaY = y + 40;
        const areaW = cellW - 20;
        const areaH = cellH - 20;
        if (img) {
          const r = Math.min(areaW / img.w, areaH / img.h);
          const iw = img.w * r;
          const ih = img.h * r;
          const ix = areaX + (areaW - iw) / 2;
          const iy = areaY + (areaH - ih) / 2;
          try {
            doc.addImage(img.dataUrl, "JPEG", ix, iy, iw, ih, undefined, "FAST");
          } catch {
            doc.setTextColor(...C.mute); doc.setFontSize(9);
            doc.text("Falha ao renderizar", areaX + areaW / 2, areaY + areaH / 2, { align: "center" });
            doc.setTextColor(...C.ink);
          }
        } else {
          doc.setTextColor(...C.mute); doc.setFont("helvetica", "italic"); doc.setFontSize(10);
          doc.text("Sem foto disponível", areaX + areaW / 2, areaY + areaH / 2, { align: "center" });
          doc.setFont("helvetica", "normal"); doc.setTextColor(...C.ink);
        }

        // Rodapé com pet + data
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...C.mute);
        const meta = [pet?.nome, fmtDate(atendimento?.data_fim ?? atendimento?.data_inicio)].filter(Boolean).join(" · ");
        if (meta) doc.text(meta, x + cellW / 2, y + cellH + 22, { align: "center" });
        doc.setTextColor(...C.ink);
      };

      drawCell("Antes", antes, M);
      drawCell("Depois", depois, M + cellW + gap);
      y += cellH + 30 + 20;
    };

    const maxPairs = Math.max(antesOk.length, depoisOk.length);
    for (let i = 0; i < maxPairs; i++) {
      drawPair(antesOk[i] ?? null, depoisOk[i] ?? null);
    }

    if (falhas.length) {
      ensureSpace(30);
      doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...C.mute);
      doc.text(`${falhas.length} foto(s) não puderam ser carregadas e foram omitidas.`, M, y);
      y += 14; doc.setTextColor(...C.ink); doc.setFont("helvetica", "normal");
    }
  }

  // ============ FOOTER ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.line(M, H - 40, W - M, H - 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...C.mute);
    doc.text(
      `${empresa?.nome ?? "Spa de Pet Tia Jessica"} · Documento gerado em ${fmtDateTime(new Date().toISOString())}`,
      M, H - 24,
    );
    doc.text(`Pagina ${i} de ${pageCount}`, W - M, H - 24, { align: "right" });
  }

  const fileName = `relatorio-${(pet.nome ?? "pet").toString().replace(/\s+/g, "_")}-${proto}.pdf`;
  const result: PDFResult = {
    fileName,
    fotosIncluidas: { antes: antesOk.length, depois: depoisOk.length },
    fotosFalhas: falhas,
  };
  if (returnBlob) {
    result.blob = doc.output("blob") as unknown as Blob;
  } else {
    deliverPdf(doc, fileName);
  }
  return result;
}
