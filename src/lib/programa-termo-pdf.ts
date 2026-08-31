import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { deliverPdf } from "./pdf-open";
import logoAsset from "@/assets/spa-de-pet-logo.png.asset.json";
import { abrirWhatsAppBusiness } from "./whatsapp";
import { toast } from "sonner";

const C = {
  forest: [26, 61, 45] as [number, number, number],
  forestDark: [18, 45, 33] as [number, number, number],
  gold: [176, 141, 87] as [number, number, number],
  goldLight: [245, 235, 215] as [number, number, number],
  ink: [30, 34, 32] as [number, number, number],
  mute: [100, 105, 102] as [number, number, number],
  line: [220, 216, 208] as [number, number, number],
  cream: [250, 247, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export interface TermoItemServico {
  nome: string;
  quantidade: number;
  valor_unitario?: number;
}

export interface TermoProgramaData {
  contrato_id: string;
  numero_contrato?: string;
  tutor_nome: string;
  tutor_documento?: string | null;
  tutor_telefone?: string | null;
  pet_nome: string;
  pet_raca?: string | null;
  pet_porte?: string | null;
  programa_nome: string;
  data_contratacao: string; // ISO ou YYYY-MM-DD
  data_inicio: string; // ISO ou YYYY-MM-DD
  data_validade: string; // ISO ou YYYY-MM-DD
  validade_em_dias?: number;
  status_do_programa: "ativo" | "aguardando_pagamento" | "cancelado" | "vencido" | string;
  forma_de_pagamento?: string | null;
  situacao_pagamento?: "pago" | "pendente" | string;
  valor_original: number;
  desconto?: number;
  valor_final: number;
  servicos_inclusos: TermoItemServico[];
  emissao_data_hora?: string;
  versao_termo?: string;
  responsavel_nome?: string;
}

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

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const str = iso.slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}

const brl = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generateTermoProgramaPDF(d: TermoProgramaData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40; // margem lateral
  const contentW = W - M * 2;

  const numContrato = d.numero_contrato || `PC-${d.contrato_id.slice(0, 8).toUpperCase()}`;
  const versao = d.versao_termo || "v2.4 (2026)";
  const logo = await getLogoDataUrl();

  let y = 35;

  // 1. CABEÇALHO ELEGANTE
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M, y, 46, 46);
    } catch {
      /* ignore */
    }
  }

  const headerLeft = logo ? M + 56 : M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.forest);
  doc.text("SPA DE PET TIA JÉSSICA", headerLeft, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.mute);
  doc.text("Centro de Estética, Bem-Estar e Cuidados Caninos Integrados", headerLeft, y + 27);
  doc.text("Termo de Adesão e Uso — Clubinho Tia Jéssica", headerLeft, y + 38);

  // Badge do Número do Contrato no canto superior direito
  doc.setFillColor(...C.cream);
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.8);
  doc.roundedRect(W - M - 140, y + 5, 140, 32, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.forest);
  doc.text("CONTRATO Nº", W - M - 70, y + 17, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(numContrato, W - M - 70, y + 30, { align: "center" });

  y += 58;

  // Linha divisória dourada
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);

  y += 16;

  // 2. QUADRO DE DESTAQUE: RESUMO DA CONTRATAÇÃO (PRIMEIRA PÁGINA)
  doc.setFillColor(...C.cream);
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, contentW, 138, 8, 8, "FD");

  const colW = (contentW - 24) / 3;
  const c1 = M + 12;
  const c2 = c1 + colW + 8;
  const c3 = c2 + colW + 8;

  let rowY = y + 18;

  // Coluna 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  doc.text("CONTRATANTE / TUTOR", c1, rowY);
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(d.tutor_nome || "—", c1, rowY + 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${d.tutor_documento ? `Doc: ${d.tutor_documento}  ·  ` : ""}${d.tutor_telefone ? `Tel: ${d.tutor_telefone}` : "Sem telefone"}`,
    c1,
    rowY + 23
  );

  // Coluna 2
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  doc.text("PET VINCULADO (EXCLUSIVO)", c2, rowY);
  doc.setFontSize(10);
  doc.setTextColor(...C.forest);
  doc.text(`🐾 ${d.pet_nome || "—"}`, c2, rowY + 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.ink);
  doc.text(`${d.pet_raca || "Raça não inf."} · Porte ${d.pet_porte || "Médio"}`, c2, rowY + 23);

  // Coluna 3
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  doc.text("PROGRAMA CONTRATADO", c3, rowY);
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  doc.text(d.programa_nome || "—", c3, rowY + 12);

  rowY += 45;

  // Linha intermediária interna
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.5);
  doc.line(c1, rowY - 8, c3 + colW, rowY - 8);

  // Linha 2 do Quadro
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  doc.text("DATA DA CONTRATAÇÃO", c1, rowY);
  doc.setFontSize(9);
  doc.setTextColor(...C.ink);
  doc.text(fmtDate(d.data_contratacao), c1, rowY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  doc.text("VALIDADE (30 DIAS CORRIDOS)", c2, rowY);
  doc.setFontSize(9);
  doc.setTextColor(...C.forest);
  doc.text(`${fmtDate(d.data_inicio)} até ${fmtDate(d.data_validade)}`, c2, rowY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mute);
  doc.text("VALOR & FORMA DE PAGAMENTO", c3, rowY);
  doc.setFontSize(10);
  doc.setTextColor(...C.forest);
  doc.text(brl(d.valor_final), c3, rowY + 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.ink);
  doc.text(`Forma: ${d.forma_de_pagamento || "Pix"} · ${d.status_do_programa === "ativo" ? "Pago (Ativo)" : "Aguardando Pagamento"}`, c3, rowY + 22);

  y += 150;

  // 3. TABELA DE COMPOSIÇÃO DE CRÉDITOS E SERVIÇOS INCLUÍDOS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.forest);
  doc.text("COMPOSIÇÃO DE CRÉDITOS E SERVIÇOS INCLUSOS", M, y);

  y += 6;

  const tableBody = (d.servicos_inclusos || []).map((it) => [
    it.nome,
    `${it.quantidade} sessão(ões)`,
    it.valor_unitario ? brl(it.valor_unitario) : "—",
    it.valor_unitario ? brl(it.quantidade * it.valor_unitario) : "—",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Serviço Incluso", "Créditos Disponíveis", "Preço Unitário", "Subtotal"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: C.forest,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 5,
    },
    bodyStyles: {
      textColor: C.ink,
      fontSize: 8,
      cellPadding: 4.5,
    },
    alternateRowStyles: {
      fillColor: C.cream,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // 4. CLÁUSULAS CONTRATUAIS E REGRAS DE USO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.forest);
  doc.text("REGRAS DE UTILIZAÇÃO E CLÁUSULAS DO PROGRAMA", M, y);
  y += 12;

  const regras = [
    {
      tit: "1. Exclusividade e Intransferibilidade:",
      txt: `Este programa é estritamente pessoal e intransferível, válido com exclusividade para o tutor ${d.tutor_nome} e o pet ${d.pet_nome}. Não é permitida a transferência de créditos para outros animais ou clientes.`,
    },
    {
      tit: "2. Vigência e Validade Improrrogável:",
      txt: `O programa tem validade de 30 (trinta) dias corridos a partir da ativação (${fmtDate(d.data_inicio)} a ${fmtDate(d.data_validade)}). Créditos não usufruídos dentro da vigência expiram automaticamente, não havendo prorrogação por ausência de agendamento.`,
    },
    {
      tit: "3. Agendamento e Desmarcações:",
      txt: "Os atendimentos devem ser agendados previamente. Cancelamentos solicitados com no mínimo 24h de antecedência liberam o crédito para reagendamento. Desmarcações tardias ou não comparecimento consomem o crédito da sessão.",
    },
    {
      tit: "4. Serviços Adicionais e Equitativos:",
      txt: "Serviços extras não discriminados na tabela acima (ex.: desembolo excessivo, hidratação profunda ou transporte leva-e-traz) serão cobrados separadamente mediante aprovação prévia do tutor.",
    },
    {
      tit: "5. Pré-Pagamento e Liberação:",
      txt: "O Clubinho opera sob regime de pré-pagamento. A liberação e uso dos créditos estão condicionados à liquidação integral do valor contratado.",
    },
  ];

  doc.setFontSize(7.5);
  for (const reg of regras) {
    if (y > H - 85) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.forest);
    doc.text(reg.tit, M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.ink);
    const splitTxt = doc.splitTextToSize(reg.txt, contentW);
    doc.text(splitTxt, M, y + 9);
    y += 10 + splitTxt.length * 8.5;
  }

  // 5. ACEITE E ASSINATURA
  if (y > H - 80) {
    doc.addPage();
    y = 40;
  }

  y += 10;
  doc.setFillColor(...C.cream);
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, contentW, 45, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.forest);
  doc.text("DECLARAÇÃO DE CIÊNCIA E ACEITE DO CONTRATANTE", M + 10, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.ink);
  const aceiteTxt = `Declaro ter lido e concordado integralmente com as regras, vigência de 30 dias e condições do ${d.programa_nome} do Clubinho para o pet ${d.pet_nome}.`;
  doc.text(doc.splitTextToSize(aceiteTxt, contentW - 20), M + 10, y + 25);

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  const agora = d.emissao_data_hora || new Date().toLocaleString("pt-BR");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.5);
    doc.line(M, H - 28, W - M, H - 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.mute);
    doc.text(
      `Spa de Pet Tia Jéssica  ·  Clubinho ${numContrato}  ·  Emitido em: ${agora}  ·  ${versao}`,
      M,
      H - 16
    );
    doc.text(`Página ${i} de ${pageCount}`, W - M, H - 16, { align: "right" });
  }

  return doc;
}

export async function baixarTermoProgramaPDF(data: TermoProgramaData) {
  const doc = await generateTermoProgramaPDF(data);
  const fileName = `clubinho-${data.numero_contrato || data.contrato_id.slice(0, 8)}.pdf`;
  doc.save(fileName);
  toast.success("PDF baixado com sucesso!");
}

export async function visualizarTermoProgramaPDF(data: TermoProgramaData) {
  const doc = await generateTermoProgramaPDF(data);
  const fileName = `clubinho-${data.numero_contrato || data.contrato_id.slice(0, 8)}.pdf`;
  deliverPdf(doc, fileName);
}

export function gerarTextoMensagemTermo(d: TermoProgramaData): string {
  const numContrato = d.numero_contrato || `CLB-${d.contrato_id.slice(0, 8).toUpperCase()}`;
  return `Olá, ${d.tutor_nome}! A adesão ao Clubinho (*${d.programa_nome}*) para o pet *${d.pet_nome}* foi finalizada com sucesso. 🐾

O plano possui validade de *${fmtDate(d.data_inicio)}* até *${fmtDate(d.data_validade)}* (30 dias corridos).

Segue o Termo de Adesão e Uso com os serviços incluídos, créditos, direitos, deveres e regras de agendamento do Clubinho.

Contrato: *${numContrato}*

Spa de Pet Tia Jéssica.`;
}

export async function compartilharTermoWhatsApp(d: TermoProgramaData) {
  const doc = await generateTermoProgramaPDF(d);
  const fileName = `clubinho-${d.numero_contrato || d.contrato_id.slice(0, 8)}.pdf`;
  const textoMensagem = gerarTextoMensagemTermo(d);
  const fone = (d.tutor_telefone || "").replace(/\D/g, "");

  // 1. No Mobile: tenta usar o Web Share API nativo com arquivo PDF
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const blob = doc.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Termo do Clubinho — ${d.pet_nome}`,
          text: textoMensagem,
        });
        toast.success("Compartilhamento aberto com sucesso!");
        return;
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.warn("Falha no navigator.share, caindo para fallback:", err);
      } else {
        return;
      }
    }
  }

  // 2. Fallback / Desktop: Baixa o PDF e abre a conversa do WhatsApp Web
  doc.save(fileName);

  if (fone) {
    abrirWhatsAppBusiness(fone, textoMensagem);
    toast.info("PDF baixado! Anexe o arquivo baixado na conversa aberta do WhatsApp.");
  } else {
    toast.info("PDF baixado! Selecione a conversa do cliente no WhatsApp para anexar o arquivo.");
  }
}
