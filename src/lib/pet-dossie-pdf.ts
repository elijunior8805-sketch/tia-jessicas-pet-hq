import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadImageAsDataURL, type LoadedImage } from "./atendimento-pdf";
import { deliverPdf } from "./pdf-open";

const C = {
  forest: [26, 61, 45] as [number, number, number],
  gold: [176, 141, 87] as [number, number, number],
  ink: [30, 34, 32] as [number, number, number],
  mute: [110, 116, 112] as [number, number, number],
  line: [220, 216, 208] as [number, number, number],
  cream: [250, 247, 240] as [number, number, number],
};

const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}
function fmtDT(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; }
}
function idade(nasc?: string | null): string {
  if (!nasc) return "—";
  const n = new Date(nasc);
  if (isNaN(+n)) return "—";
  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  let meses = hoje.getMonth() - n.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  if (anos <= 0) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `${anos} ${anos === 1 ? "ano" : "anos"}${meses ? ` e ${meses} ${meses === 1 ? "mês" : "meses"}` : ""}`;
}

export type DossieSecoes = {
  identificacao: boolean;
  saude: boolean;
  tutor: boolean;
  resumo: boolean;
  atendimentos: boolean;
  fotos: boolean;
  valores: boolean;
  recomendacoes: boolean;
  ocorrencias: boolean;
  peso: boolean;
};

export type DossieOpts = {
  pet: any;
  cliente: any;
  atendimentos: any[];  // já filtrados pelo período
  ocorrencias: any[];
  empresa?: { nome?: string | null; cnpj?: string | null; telefone?: string | null; endereco?: string | null; logo_url?: string | null } | null;
  operador?: string | null;
  secoes: DossieSecoes;
  periodo?: { de?: string | null; ate?: string | null };
  returnBlob?: boolean;
};

export type DossieResult = { fileName: string; blob?: Blob; fotosIncluidas: number; fotosFalhas: string[] };

export async function generateDossiePDF(opts: DossieOpts): Promise<DossieResult> {
  const { pet, cliente, atendimentos, ocorrencias, empresa, operador, secoes, periodo, returnBlob } = opts;

  // Pré-carrega foto principal + fotos antes/depois se habilitado
  const heroPath: string | null = pet?.foto_url ?? null;
  const heroPromise = heroPath ? loadImageAsDataURL(heroPath).catch(() => null) : Promise.resolve(null);

  const fotosPorAtend: Record<string, { antes: string[]; depois: string[] }> = {};
  const fotosPathsAll: string[] = [];
  if (secoes.fotos) {
    for (const a of atendimentos) {
      const antes = ((a.fotos_antes ?? []) as any[]).map(f => typeof f === "string" ? f : f?.path).filter(Boolean).slice(0, 4);
      const depois = ((a.fotos_depois ?? []) as any[]).map(f => typeof f === "string" ? f : f?.path).filter(Boolean).slice(0, 4);
      fotosPorAtend[a.id] = { antes, depois };
      fotosPathsAll.push(...antes, ...depois);
    }
  }
  const fotosLoaded: Record<string, LoadedImage> = {};
  const falhas: string[] = [];
  if (fotosPathsAll.length) {
    const results = await Promise.allSettled(fotosPathsAll.map(loadImageAsDataURL));
    results.forEach((r, i) => {
      if (r.status === "fulfilled") fotosLoaded[fotosPathsAll[i]] = r.value;
      else falhas.push(fotosPathsAll[i]);
    });
  }
  const hero = await heroPromise;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  // ---------- CAPA ----------
  doc.setFillColor(...C.forest);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 240, W, 4, "F");

  doc.setTextColor(...C.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text((empresa?.nome ?? "Spa de Pet Tia Jessica").toUpperCase(), M, 60);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("DOSSIÊ DO PET", M, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(220, 220, 210);
  doc.text("Prontuário operacional e histórico completo", M, 130);

  // Hero photo
  if (hero) {
    const size = 260;
    const cx = W / 2 - size / 2;
    const cy = 280;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx - 6, cy - 6, size + 12, size + 12, 8, 8, "F");
    // fit
    const ratio = hero.w / hero.h;
    let dw = size, dh = size;
    if (ratio > 1) dh = size / ratio; else dw = size * ratio;
    doc.addImage(hero.dataUrl, "JPEG", cx + (size - dw) / 2, cy + (size - dh) / 2, dw, dh, undefined, "FAST");
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text(pet?.nome ?? "—", W / 2, 600, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(220, 220, 210);
  doc.text(`Tutor: ${cliente?.nome ?? "—"}`, W / 2, 622, { align: "center" });
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, W / 2, 640, { align: "center" });
  if (periodo?.de || periodo?.ate) {
    doc.text(`Período: ${fmtDate(periodo.de)} a ${fmtDate(periodo.ate)}`, W / 2, 658, { align: "center" });
  }
  doc.setTextColor(...C.gold);
  doc.setFontSize(9);
  doc.text(operador ? `Responsável pela emissão: ${operador}` : "", W / 2, H - 40, { align: "center" });

  // ---------- Utilitário: cabeçalho de página ----------
  let y = 0;
  const newPage = () => {
    doc.addPage();
    doc.setFillColor(...C.forest);
    doc.rect(0, 0, W, 40, "F");
    doc.setFillColor(...C.gold);
    doc.rect(0, 40, W, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Dossiê · ${pet?.nome ?? ""}`, M, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString("pt-BR"), W - M, 26, { align: "right" });
    y = 70;
    doc.setTextColor(...C.ink);
  };
  const ensure = (need: number) => { if (y + need > H - 60) newPage(); };
  const sectionTitle = (t: string) => {
    ensure(40);
    doc.setFillColor(...C.cream);
    doc.rect(M, y, W - 2 * M, 26, "F");
    doc.setDrawColor(...C.gold);
    doc.setLineWidth(2);
    doc.line(M, y, M, y + 26);
    doc.setTextColor(...C.forest);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(t.toUpperCase(), M + 10, y + 17);
    y += 40;
    doc.setTextColor(...C.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };
  const kv = (rows: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      body: rows.map(([k, v]) => [k, v || "—"]),
      theme: "plain",
      styles: { fontSize: 10, cellPadding: { top: 4, bottom: 4, left: 0, right: 0 }, textColor: C.ink },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 160, textColor: C.mute },
        1: { cellWidth: "auto" },
      },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  newPage();

  // ---------- IDENTIFICAÇÃO ----------
  if (secoes.identificacao) {
    sectionTitle("Identificação do pet");
    kv([
      ["Nome", pet?.nome ?? "—"],
      ["Raça", pet?.raca ?? "—"],
      ["Sexo", pet?.sexo === "macho" ? "Macho" : pet?.sexo === "femea" ? "Fêmea" : "—"],
      ["Nascimento", fmtDate(pet?.nascimento)],
      ["Idade", idade(pet?.nascimento)],
      ["Porte", pet?.porte ?? "—"],
      ["Peso atual", pet?.peso ? `${pet.peso} kg` : "—"],
      ["Cor / pelagem", pet?.cor ?? "—"],
      ["Castrado", pet?.castrado ? "Sim" : "Não"],
      ["Cadastrado em", fmtDate(pet?.created_at)],
    ]);
  }

  // ---------- SAÚDE ----------
  if (secoes.saude) {
    sectionTitle("Saúde e segurança");
    kv([
      ["Alergias", pet?.alergias ?? "—"],
      ["Cuidados de saúde", pet?.cuidados_saude ?? "—"],
      ["Temperamento", pet?.temperamento ?? "—"],
      ["Necessita focinheira", pet?.necessita_focinheira ? "SIM — obrigatória" : "Não"],
      ["Observações", pet?.observacoes ?? "—"],
      ["Preferências do tutor", pet?.preferencias_tutor ?? "—"],
    ]);
  }

  // ---------- TUTOR ----------
  if (secoes.tutor) {
    sectionTitle("Dados do tutor");
    kv([
      ["Nome", cliente?.nome ?? "—"],
      ["WhatsApp", cliente?.whatsapp ?? cliente?.telefone ?? "—"],
      ["E-mail", cliente?.email ?? "—"],
      ["Endereço", [cliente?.rua, cliente?.numero, cliente?.bairro, cliente?.cidade, cliente?.estado].filter(Boolean).join(", ") || "—"],
    ]);
  }

  // ---------- RESUMO ----------
  const concluidos = atendimentos.filter(a => a.encerrado_em);
  if (secoes.resumo) {
    sectionTitle("Resumo do histórico");
    const primeiro = concluidos[concluidos.length - 1];
    const ultimo = concluidos[0];
    const servicosContagem: Record<string, number> = {};
    concluidos.forEach(a => {
      ((a.servicos_executados ?? []) as any[]).forEach((s: any) => {
        const n = s?.nome ?? "—";
        servicosContagem[n] = (servicosContagem[n] ?? 0) + 1;
      });
    });
    const topServicos = Object.entries(servicosContagem).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([n, c]) => `${n} (${c}x)`).join(", ") || "—";
    kv([
      ["Total de atendimentos", String(concluidos.length)],
      ["Primeiro atendimento", fmtDate(primeiro?.data_inicio)],
      ["Último atendimento", fmtDate(ultimo?.data_inicio)],
      ["Último banho", fmtDate(pet?.ultimo_banho)],
      ["Última tosa", fmtDate(pet?.ultima_tosa)],
      ["Próxima visita", fmtDate(pet?.proxima_visita)],
      ["Serviços mais realizados", topServicos],
    ]);
  }

  // ---------- HISTÓRICO DE PESO ----------
  if (secoes.peso) {
    const pesos = concluidos
      .map((a: any) => ({ data: a.data_inicio, peso: (a as any)?.peso_registrado ?? null }))
      .filter(x => x.peso != null);
    if (pesos.length) {
      sectionTitle("Evolução do peso");
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Data", "Peso (kg)"]],
        body: pesos.map(p => [fmtDate(p.data), String(p.peso)]),
        headStyles: { fillColor: C.forest, textColor: 255 },
        styles: { fontSize: 10 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ---------- HISTÓRICO DE ATENDIMENTOS ----------
  if (secoes.atendimentos) {
    sectionTitle("Histórico de atendimentos");
    if (concluidos.length === 0) {
      doc.setTextColor(...C.mute);
      doc.setFontSize(10);
      doc.text("Nenhum atendimento concluído no período selecionado.", M, y);
      y += 20;
    }
    for (const a of concluidos) {
      ensure(120);
      // cabeçalho do atendimento
      doc.setFillColor(...C.cream);
      doc.rect(M, y, W - 2 * M, 22, "F");
      doc.setTextColor(...C.forest);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(fmtDT(a.data_inicio), M + 8, y + 15);
      const total = Number(a.valor_executado ?? 0) + Number(a.taxa_leva_traz ?? 0);
      if (secoes.valores) {
        doc.text(brl(total), W - M - 8, y + 15, { align: "right" });
      }
      y += 30;
      doc.setTextColor(...C.ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const execs = ((a.servicos_executados ?? []) as any[]).map((s: any) => s?.nome).filter(Boolean).join(", ") || "—";
      const plans = ((a.servicos_planejados ?? []) as any[]).map((s: any) => s?.nome).filter(Boolean).join(", ") || "—";
      const extras = ((a.servicos_extras ?? []) as any[]).map((s: any) => s?.nome).filter(Boolean).join(", ") || "—";
      const rows: [string, string][] = [
        ["Serviços executados", execs],
        ["Serviços planejados", plans],
        ["Adicionais", extras],
        ["Comportamento", (a.comportamentos ?? []).join(", ") || "—"],
        ["Usou focinheira", a.usou_focinheira ? "Sim" : "Não"],
      ];
      if (secoes.recomendacoes && a.recomendacoes) rows.push(["Recomendações", a.recomendacoes]);
      if (a.observacoes) rows.push(["Observações", a.observacoes]);
      if (a.alergia_observada) rows.push(["Alergia observada", a.alergia_observada]);
      if (a.proxima_visita) rows.push(["Próxima visita", fmtDate(a.proxima_visita)]);
      if (secoes.valores) {
        rows.push(["Pagamento", `${(a.pagamento_forma ?? "—")} · ${a.pagamento_status ?? "—"} · pago ${brl(Number(a.valor_pago ?? 0))}`]);
      }
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        body: rows,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 0, right: 0 } },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 130, textColor: C.mute }, 1: { cellWidth: "auto" } },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 8;

      if (secoes.fotos) {
        const ff = fotosPorAtend[a.id];
        const antesImgs = (ff?.antes ?? []).map(p => fotosLoaded[p]).filter(Boolean);
        const depoisImgs = (ff?.depois ?? []).map(p => fotosLoaded[p]).filter(Boolean);
        if (antesImgs.length || depoisImgs.length) {
          ensure(180);
          const colW = (W - 2 * M - 12) / 2;
          const imgH = 130;
          // headings
          doc.setTextColor(...C.mute);
          doc.setFontSize(8);
          doc.text("ANTES", M, y);
          doc.text("DEPOIS", M + colW + 12, y);
          y += 6;
          // usa a primeira imagem de cada lado
          const drawFit = (img: LoadedImage | undefined, x: number) => {
            if (!img) return;
            const r = img.w / img.h;
            let dw = colW, dh = imgH;
            if (r > colW / imgH) dh = colW / r; else dw = imgH * r;
            doc.setFillColor(245, 243, 235);
            doc.rect(x, y, colW, imgH, "F");
            doc.addImage(img.dataUrl, "JPEG", x + (colW - dw) / 2, y + (imgH - dh) / 2, dw, dh, undefined, "FAST");
          };
          drawFit(antesImgs[0], M);
          drawFit(depoisImgs[0], M + colW + 12);
          y += imgH + 12;
        }
      }

      // separador
      doc.setDrawColor(...C.line);
      doc.line(M, y, W - M, y);
      y += 12;
    }
  }

  // ---------- OCORRÊNCIAS AUTORIZADAS ----------
  if (secoes.ocorrencias) {
    const publicas = ocorrencias; // agente decide o que passar
    sectionTitle("Ocorrências");
    if (publicas.length === 0) {
      doc.setTextColor(...C.mute); doc.setFontSize(10);
      doc.text("Nenhuma ocorrência registrada no período.", M, y); y += 20;
    } else {
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Data", "Tipo", "Descrição"]],
        body: publicas.map(o => [fmtDate(o.data_ocorrencia ?? o.created_at), String(o.tipo ?? "—"), String(o.descricao ?? "—")]),
        headStyles: { fillColor: C.forest, textColor: 255 },
        styles: { fontSize: 9 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ---------- ENCERRAMENTO ----------
  ensure(120);
  sectionTitle("Encerramento");
  doc.setFontSize(10); doc.setTextColor(...C.ink);
  const enc = [
    `Documento gerado em ${new Date().toLocaleString("pt-BR")}.`,
    operador ? `Responsável pela emissão: ${operador}.` : "",
    `Este dossiê contém informações operacionais do pet ${pet?.nome ?? ""} (ID ${pet?.id ?? ""}).`,
    `${empresa?.nome ?? "Spa de Pet Tia Jessica"}${empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}${empresa?.telefone ? ` · ${empresa.telefone}` : ""}.`,
    "Documento de uso interno e para compartilhamento com o tutor. Informações internas não autorizadas foram omitidas.",
  ].filter(Boolean);
  enc.forEach(t => {
    const lines = doc.splitTextToSize(t, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 12 + 4;
  });

  // Rodapé em todas as páginas: número
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setTextColor(...C.mute);
    doc.setFontSize(8);
    doc.text(`${i} / ${total}`, W - M, H - 20, { align: "right" });
    if (i > 1) doc.text(`Dossiê · ${pet?.nome ?? ""}`, M, H - 20);
  }

  const fileName = `dossie-${(pet?.nome ?? "pet").toString().toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.pdf`;
  const fotosIncluidas = Object.keys(fotosLoaded).length;
  if (returnBlob) return { fileName, blob: doc.output("blob") as Blob, fotosIncluidas, fotosFalhas: falhas };
  deliverPdf(doc, fileName);
  return { fileName, fotosIncluidas, fotosFalhas: falhas };
}
