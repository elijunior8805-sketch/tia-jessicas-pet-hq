import jsPDF from "jspdf";
import { deliverPdf } from "./pdf-open";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { brl, sumItens, type ServicoItem } from "./atendimento-utils";
import { getLogoDataUrl, drawLogoBadge } from "./logo-pdf";

export type ClubinhoHistoricoUso = {
  data: string;
  servico_nome: string;
  quantidade: number;
  saldo_apos: number;
  protocolo?: string;
};

export type ClubinhoRelatorioData = {
  nome_programa: string;
  status_do_programa: string;
  data_contratacao: string;
  data_inicio: string;
  data_validade: string;
  dias_restantes: number;
  banhos_contratados: number;
  banhos_utilizados: number;
  banhos_reservados?: number;
  banhos_restantes: number;
  historico_utilizacoes: ClubinhoHistoricoUso[];
  isQuitadoComCredito?: boolean;
};

type AtendPDFData = {
  atendimento: any;
  ocorrencias?: any[];
  empresa?: { nome?: string | null; cnpj?: string | null; telefone?: string | null; endereco?: string | null } | null;
  operador?: string | null;
  returnBlob?: boolean;
  fotosAntesPaths?: string[];
  fotosDepoisPaths?: string[];
  permitirSemFotos?: boolean;
  clubinho?: ClubinhoRelatorioData | null;
};

export type PDFResult = {
  fileName: string;
  blob?: Blob;
  fotosIncluidas: { antes: number; depois: number };
  fotosFalhas: string[];
};

const C = {
  forest: [26, 61, 45] as [number, number, number],
  forestLight: [38, 86, 64] as [number, number, number],
  gold: [176, 141, 87] as [number, number, number],
  goldLight: [245, 230, 190] as [number, number, number],
  ink: [30, 34, 32] as [number, number, number],
  mute: [110, 116, 112] as [number, number, number],
  line: [220, 216, 208] as [number, number, number],
  cream: [250, 247, 240] as [number, number, number],
  emeraldLight: [236, 253, 245] as [number, number, number],
  emeraldDark: [6, 78, 59] as [number, number, number],
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

export async function loadImageAsDataURL(path: string): Promise<LoadedImage> {
  const { data, error } = await supabase.storage
    .from("spa-fotos")
    .createSignedUrl(path, 60 * 5);
  if (error || !data?.signedUrl) throw new Error(`URL falhou: ${path}`);
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`Download falhou: ${path}`);
  const blob = await res.blob();

  let width = 0;
  let height = 0;
  let source: CanvasImageSource | null = null;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" as ImageOrientation });
    width = bmp.width; height = bmp.height; source = bmp;
  } catch {
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
      // url liberada
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
  const M = 36; // Margem padrão lateral otimizada

  const cliente = atendimento?.clientes ?? {};
  const pet = atendimento?.pets ?? {};
  const executados = (atendimento?.servicos_executados ?? []) as ServicoItem[];
  const valorExec = sumItens(executados);
  const taxa = Number(atendimento?.taxa_leva_traz ?? 0);
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

  // ---- Fotos: baixar antes de desenhar ----
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

  // ==========================================
  // PÁGINA 1: RELATÓRIO COMPLETO DO ATENDIMENTO
  // ==========================================

  // A. CABEÇALHO COMPACTO E ELEGANTE
  const logoDataUrl = await getLogoDataUrl();
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, 76, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 76, W, 2.5, "F");

  drawLogoBadge(doc, logoDataUrl, M + 24, 38, 48);
  const textX = logoDataUrl ? M + 62 : M;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(empresa?.nome ?? "Spa de Pet Tia Jéssica", textX, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const infoLine = [empresa?.cnpj, empresa?.telefone, empresa?.endereco].filter(Boolean).join("  ·  ");
  if (infoLine) doc.text(infoLine, textX, 48);
  doc.setFontSize(9);
  doc.setTextColor(...C.goldLight);
  doc.text("Relatório de Atendimento", textX, 63);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const proto = String(atendimento?.id ?? "").slice(0, 8).toUpperCase();
  doc.text(`Protocolo ${proto}`, W - M, 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(230, 230, 230);
  doc.text(fmtDateTime(atendimento?.data_fim ?? atendimento?.data_inicio), W - M, 48, { align: "right" });

  let y = 88;
  doc.setTextColor(...C.ink);

  // B. DADOS DO TUTOR E DO PET (LADO A LADO)
  const boxW = (W - M * 2 - 10) / 2;
  const boxTop = y;
  const boxH = 66;

  const drawBox = (x: number, title: string, lines: [string, string][]) => {
    doc.setDrawColor(...C.line);
    doc.setFillColor(...C.cream);
    doc.roundedRect(x, boxTop, boxW, boxH, 4, 4, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...C.gold);
    doc.text(title.toUpperCase(), x + 10, boxTop + 14);
    doc.setTextColor(...C.ink);
    let ly = boxTop + 27;
    lines.forEach(([k, v]) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...C.mute);
      doc.text(k, x + 10, ly);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...C.ink);
      const valText = doc.splitTextToSize(v || "—", boxW - 85);
      doc.text(valText, x + 76, ly);
      ly += 12;
    });
  };

  const atendenteNome = (operador && operador.trim()) ? operador : "Jéssica Xavier";
  const ultimaVisitaStr = (atendimento as any).ultima_visita ? fmtDate((atendimento as any).ultima_visita) : "Primeira visita";

  drawBox(M, "Tutor", [
    ["Nome", cliente.nome ?? "—"],
    ["WhatsApp", cliente.whatsapp ?? "—"],
    ["Atendente", atendenteNome],
  ]);

  drawBox(M + boxW + 10, "Pet", [
    ["Nome", pet.nome ?? "—"],
    ["Raça / Porte", `${pet.raca ?? "—"} / ${pet.porte ?? "—"}`],
    ["Última visita", ultimaVisitaStr],
  ]);

  y = boxTop + boxH + 10;

  // C. CLUBINHO (SE EXISTIR PARA O PET)
  const clubinho = opts.clubinho;
  const isQuitadoComCredito = clubinho?.isQuitadoComCredito ?? (atendimento?.pagamento_forma === "credito_programa" || executados.some((it: any) => it.usar_credito));

  if (clubinho && (clubinho.banhos_contratados > 0 || clubinho.nome_programa)) {
    const clbBoxW = W - M * 2;
    const clbTop = y;

    // Cabeçalho da seção Clubinho com Selo de Situação
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...C.forest);
    doc.text("CLUBINHO - PROGRAMA DE CUIDADOS", M, clbTop + 9);
    doc.setDrawColor(...C.gold); doc.line(M, clbTop + 13, M + 185, clbTop + 13);

    const stLabel = clubinho.status_do_programa === "ativo"
      ? "Clubinho Ativo"
      : clubinho.status_do_programa === "concluido" || clubinho.status_do_programa === "concluído"
      ? "Utilização Concluída"
      : clubinho.status_do_programa === "vencido"
      ? "Vencido"
      : "Clubinho";

    doc.setFillColor(...(clubinho.status_do_programa === "ativo" ? C.emeraldLight : C.cream));
    doc.setDrawColor(...C.gold);
    doc.roundedRect(W - M - 95, clbTop, 95, 14, 3, 3, "FD");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.setTextColor(...(clubinho.status_do_programa === "ativo" ? C.emeraldDark : C.forest));
    doc.text(stLabel, W - M - 47.5, clbTop + 10, { align: "center" });

    y += 18;

    // Cartão Principal com Dados do Plano e 3 Indicadores (SEM Banhos Reservados)
    const cardH = 50;
    doc.setDrawColor(...C.line);
    doc.setFillColor(...C.cream);
    doc.roundedRect(M, y, clbBoxW, cardH, 5, 5, "FD");

    // Linha de Identificação do Plano e Validade
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...C.forest);
    doc.text(`Plano: ${clubinho.nome_programa || "Clubinho Tia Jéssica"}`, M + 10, y + 13);

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.mute);
    const validadeStr = `Validade: ${fmtDate(clubinho.data_inicio)} a ${fmtDate(clubinho.data_validade)}${clubinho.dias_restantes > 0 ? ` (${clubinho.dias_restantes} dias restantes)` : ""}`;
    doc.text(validadeStr, W - M - 10, y + 13, { align: "right" });

    // 3 INDICADORES DISTRIBUÍDOS UNIFORMEMENTE OCUPANDO 100% DA LARGURA
    const indW = (clbBoxW - 20 - 12) / 3;
    const indY = y + 20;
    const indH = 24;

    const indicadores = [
      { label: "Banhos contratados", val: `${clubinho.banhos_contratados} ${clubinho.banhos_contratados === 1 ? "banho" : "banhos"}`, tone: C.ink },
      { label: "Banhos utilizados", val: `${clubinho.banhos_utilizados} ${clubinho.banhos_utilizados === 1 ? "banho" : "banhos"}`, tone: C.forest },
      { label: "Banhos restantes", val: `${clubinho.banhos_restantes} ${clubinho.banhos_restantes === 1 ? "banho" : "banhos"}`, tone: C.emeraldDark },
    ];

    indicadores.forEach((ind, i) => {
      const ix = M + 10 + i * (indW + 6);
      doc.setDrawColor(...C.line);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ix, indY, indW, indH, 3, 3, "FD");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...C.mute);
      doc.text(ind.label, ix + indW / 2, indY + 9, { align: "center" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...ind.tone);
      doc.text(ind.val, ix + indW / 2, indY + 19, { align: "center" });
    });

    y += cardH + 6;

    // Tabela Compacta do Histórico de Utilizações
    if (clubinho.historico_utilizacoes && clubinho.historico_utilizacoes.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...C.forest);
      doc.text("HISTÓRICO DE CRÉDITOS UTILIZADOS", M, y + 6);
      y += 9;

      autoTable(doc, {
        startY: y,
        head: [["Data do Uso", "Serviço", "Crédito Utilizado", "Saldo após o uso"]],
        body: clubinho.historico_utilizacoes.map((u) => [
          fmtDate(u.data),
          u.servico_nome || "Banho",
          `${u.quantidade} crédito`,
          `${u.saldo_apos} ${u.saldo_apos === 1 ? "banho restante" : "banhos restantes"}`,
        ]),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.5, textColor: C.ink, lineColor: C.line },
        headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 150 },
          2: { halign: "center", cellWidth: 120 },
          3: { halign: "center" },
        },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // D. LINHA DO TEMPO & SERVIÇOS EXECUTADOS
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...C.forest);
  doc.text("SERVIÇOS E LINHA DO TEMPO", M, y + 8);
  doc.setDrawColor(...C.gold); doc.line(M, y + 12, M + 140, y + 12);

  // Check-in / Check-out alinhados no canto direito
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.mute);
  const timeStr = `Check-in: ${fmtDateTime(atendimento?.data_inicio)}   |   Check-out: ${fmtDateTime(atendimento?.data_fim)}`;
  doc.text(timeStr, W - M, y + 8, { align: "right" });

  y += 16;

  // Cálculo financeiro
  let valorReferenciaBanhoCoberto = 0;
  let valorExtrasReal = 0;

  executados.forEach((it: any) => {
    const isBanhoItem = it.usar_credito || (isQuitadoComCredito && (it.nome?.toLowerCase().includes("banho") || it.valor_unit === 0));
    if (isBanhoItem) {
      valorReferenciaBanhoCoberto += Number(it.valor_unit || it.valor_total || 60);
    } else {
      valorExtrasReal += Number(it.valor_total || it.valor_unit || 0) * Number(it.quantidade ?? 1);
    }
  });

  const descontoReal = Number(atendimento?.desconto ?? 0);
  const totalReceberReal = isQuitadoComCredito
    ? Math.max(0, valorExtrasReal + taxa - descontoReal)
    : Math.max(0, valorExec + taxa - descontoReal);

  // Tabela de Serviços
  autoTable(doc, {
    startY: y,
    head: [["Serviço Executado", "Qtd", "Valor Ref.", "Situação / Valor Cobrado"]],
    body: executados.length
      ? executados.map((it: any) => {
          const coberto = it.usar_credito || (isQuitadoComCredito && (it.nome?.toLowerCase().includes("banho") || it.valor_unit === 0));
          const valRef = Number(it.valor_unit || 60);
          return [
            coberto ? `${it.nome} (Coberto pelo Clubinho)` : it.nome,
            String(it.quantidade ?? 1),
            brl(valRef),
            coberto ? "Quitado (1 crédito - R$ 0,00)" : brl(valRef * Number(it.quantidade ?? 1)),
          ];
        })
      : [["Nenhum serviço executado", "", "", ""]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3.5, textColor: C.ink, lineColor: C.line },
    headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, cellPadding: 3.5 },
    columnStyles: {
      0: { cellWidth: 230 },
      1: { halign: "center", cellWidth: 35 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right" },
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Resumo Financeiro Compacto à Direita
  const totRows: [string, string, boolean][] = [
    ["Valor ref. serviços", brl(valorExec || valorReferenciaBanhoCoberto), false],
  ];

  if (isQuitadoComCredito && valorReferenciaBanhoCoberto > 0) {
    totRows.push(["Coberto pelo Clubinho", `- ${brl(valorReferenciaBanhoCoberto)} (1 crédito)`, false]);
  }
  if (valorExtrasReal > 0) {
    totRows.push(["Serviços extras", brl(valorExtrasReal), false]);
  }
  if (taxa > 0) {
    totRows.push(["Taxa leva-e-traz", brl(taxa), false]);
  }
  if (descontoReal > 0) {
    totRows.push(["Desconto aplicado", `- ${brl(descontoReal)}`, false]);
  }
  totRows.push(["TOTAL A RECEBER AGORA", brl(totalReceberReal), true]);

  const totW = 230;
  const totX = W - M - totW;
  totRows.forEach(([k, v, isTotal]) => {
    if (isTotal) {
      doc.setFillColor(...(totalReceberReal === 0 ? C.forest : C.gold));
      doc.roundedRect(totX, y, totW, 16, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(k, totX + 8, y + 11);
      doc.text(v, totX + totW - 8, y + 11, { align: "right" });
      y += 18;
    } else {
      doc.setTextColor(...C.mute);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(k, totX + 8, y + 9);
      doc.setTextColor(...C.ink);
      doc.setFont("helvetica", "bold");
      doc.text(v, totX + totW - 8, y + 9, { align: "right" });
      y += 12;
    }
  });

  if (isQuitadoComCredito && totalReceberReal === 0) {
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.emeraldDark);
    doc.text("✨ Atendimento 100% quitado com crédito do Clubinho.", M, y - 6);
  }

  y += 4;

  // E. INFORMAÇÕES DO ATENDIMENTO, RECOMENDAÇÕES E PRÓXIMA VISITA (TUDO NA PÁGINA 1)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...C.forest);
  doc.text("INFORMAÇÕES E OBSERVAÇÕES DO ATENDIMENTO", M, y + 6);
  doc.setDrawColor(...C.gold); doc.line(M, y + 10, M + 230, y + 10);
  y += 16;

  // Alertas do check-in
  const flags: { label: string; on: boolean }[] = [
    { label: "Usou focinheira", on: !!(atendimento as any)?.usou_focinheira },
    { label: "Precisou de pausa", on: !!(atendimento as any)?.precisou_pausa },
    { label: "Alergia no check-in", on: !!(atendimento as any)?.alergia_checkin },
  ];
  const activeFlags = flags.filter((f) => f.on);
  if (activeFlags.length) {
    let bx = M;
    activeFlags.forEach((f) => {
      const tw = doc.getTextWidth(f.label) + 14;
      doc.setFillColor(255, 244, 214);
      doc.setDrawColor(...C.gold);
      doc.roundedRect(bx, y - 8, tw, 13, 3, 3, "FD");
      doc.setFontSize(7.5); doc.setTextColor(...C.forest); doc.setFont("helvetica", "bold");
      doc.text(f.label, bx + 7, y + 1);
      bx += tw + 5;
    });
    y += 12;
  }

  const obsCheckin = (atendimento?.observacoes_checkin?.trim?.() || atendimento?.observacoes?.trim?.() || (atendimento as any)?.check_in_obs?.trim?.() || "Atendimento realizado com carinho e tranquilidade.");
  const recomendacoes = (atendimento?.recomendacoes?.trim?.() || "Manter a rotina de escovação e cuidados em casa.");

  // Card unificado de Observações e Recomendações
  const infoBoxW = W - M * 2;
  const infoBoxTop = y;

  doc.setDrawColor(...C.line);
  doc.setFillColor(...C.cream);
  
  // Calcula linhas de texto
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  const obsLines = doc.splitTextToSize(obsCheckin, infoBoxW - 120);
  const recLines = doc.splitTextToSize(recomendacoes, infoBoxW - 120);
  const boxHeightCalc = 12 + (obsLines.length * 10) + (recLines.length * 10) + (atendimento?.proxima_visita ? 22 : 8);

  doc.roundedRect(M, infoBoxTop, infoBoxW, boxHeightCalc, 4, 4, "FD");

  let curY = infoBoxTop + 10;

  // Observações
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...C.forest);
  doc.text("Observações:", M + 8, curY);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.ink);
  doc.text(obsLines, M + 95, curY);
  curY += obsLines.length * 10 + 2;

  // Recomendações
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...C.forest);
  doc.text("Recomendações:", M + 8, curY);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...C.ink);
  doc.text(recLines, M + 95, curY);
  curY += recLines.length * 10 + 4;

  // PRÓXIMA VISITA SUGERIDA NA PRIMEIRA PÁGINA (LOGO APÓS AS RECOMENDAÇÕES)
  if (atendimento?.proxima_visita) {
    doc.setFillColor(...C.emeraldLight);
    doc.setDrawColor(...C.gold);
    doc.roundedRect(M + 8, curY - 2, infoBoxW - 16, 16, 3, 3, "FD");

    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...C.emeraldDark);
    doc.text(`📅 PRÓXIMA VISITA SUGERIDA: ${fmtDate(atendimento.proxima_visita)}`, M + 16, curY + 9);
  }

  // ====================================================
  // PÁGINA 2: FOTOS DE ANTES E DEPOIS (APENAS SE HOUVER)
  // ====================================================
  if (antesOk.length || depoisOk.length) {
    // Nova página EXCLUSIVA para a galeria visual (Página 2)
    doc.addPage();
    let yFotos = 50;

    // Faixa título elegante
    doc.setFillColor(...C.forest);
    doc.rect(0, 0, W, 52, "F");
    doc.setFillColor(...C.gold);
    doc.rect(0, 52, W, 2, "F");
    drawLogoBadge(doc, logoDataUrl, W - M - 16, 26, 32);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text("Resultado do Atendimento", M, 33);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const subtituloParts = [pet?.nome, fmtDate(atendimento?.data_fim ?? atendimento?.data_inicio)].filter(Boolean).join("  ·  ");
    if (subtituloParts) doc.text(subtituloParts, W - M - 40, 33, { align: "right" });
    doc.setTextColor(...C.ink);

    yFotos = 72;

    const drawPair = (antes: LoadedImage | null, depois: LoadedImage | null) => {
      const gap = 14;
      const availW = W - M * 2 - gap;
      const cellW = availW / 2;
      const cellH = 270;

      const drawCell = (label: string, img: LoadedImage | null, x: number) => {
        // Moldura
        doc.setDrawColor(...C.line);
        doc.setFillColor(...C.cream);
        doc.roundedRect(x, yFotos, cellW, cellH + 30, 6, 6, "FD");

        // Etiqueta
        doc.setFillColor(...C.forest);
        doc.roundedRect(x + 10, yFotos + 10, 68, 18, 3, 3, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
        doc.text(label.toUpperCase(), x + 44, yFotos + 22, { align: "center" });
        doc.setTextColor(...C.ink);

        // Imagem contida (fit)
        const areaX = x + 10;
        const areaY = yFotos + 36;
        const areaW = cellW - 20;
        const areaH = cellH - 16;
        if (img) {
          const r = Math.min(areaW / img.w, areaH / img.h);
          const iw = img.w * r;
          const ih = img.h * r;
          const ix = areaX + (areaW - iw) / 2;
          const iy = areaY + (areaH - ih) / 2;
          try {
            doc.addImage(img.dataUrl, "JPEG", ix, iy, iw, ih, undefined, "FAST");
          } catch {
            doc.setTextColor(...C.mute); doc.setFontSize(8);
            doc.text("Falha ao renderizar imagem", areaX + areaW / 2, areaY + areaH / 2, { align: "center" });
            doc.setTextColor(...C.ink);
          }
        } else {
          doc.setTextColor(...C.mute); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
          doc.text("Sem foto disponível", areaX + areaW / 2, areaY + areaH / 2, { align: "center" });
          doc.setFont("helvetica", "normal"); doc.setTextColor(...C.ink);
        }

        // Rodapé do Card
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...C.mute);
        const meta = [pet?.nome, fmtDate(atendimento?.data_fim ?? atendimento?.data_inicio)].filter(Boolean).join(" · ");
        if (meta) doc.text(meta, x + cellW / 2, yFotos + cellH + 20, { align: "center" });
        doc.setTextColor(...C.ink);
      };

      drawCell("Antes", antes, M);
      drawCell("Depois", depois, M + cellW + gap);
      yFotos += cellH + 40;
    };

    const maxPairs = Math.max(antesOk.length, depoisOk.length);
    for (let i = 0; i < maxPairs; i++) {
      drawPair(antesOk[i] ?? null, depoisOk[i] ?? null);
    }
  }

  // ==========================================
  // RODAPÉ E NUMERAÇÃO DINÂMICA DE PÁGINAS
  // ==========================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.line(M, H - 32, W - M, H - 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.mute);
    doc.text(
      `${empresa?.nome ?? "Spa de Pet Tia Jéssica"} · Documento gerado em ${fmtDateTime(new Date().toISOString())}`,
      M, H - 18,
    );
    doc.text(`Página ${i} de ${pageCount}`, W - M, H - 18, { align: "right" });
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
