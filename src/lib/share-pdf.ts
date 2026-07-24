/**
 * Compartilha um PDF usando a Web Share API (nível 2 - files) quando disponível.
 *
 * Fluxo desejado (celular):
 *  1) Gera o PDF (já feito antes de chamar).
 *  2) Cria File com MIME application/pdf.
 *  3) Verifica navigator.canShare({ files }).
 *  4) Chama navigator.share({ files, title, text }) — o SO abre o menu
 *     nativo com o PDF anexado; o usuário escolhe WhatsApp Business.
 *
 * Retorna:
 *  - "shared"   → usuário concluiu o compartilhamento.
 *  - "cancelled"→ usuário cancelou (AbortError).
 *  - "unsupported" → dispositivo não suporta compartilhar arquivos.
 */
export type ShareResult = "shared" | "cancelled" | "unsupported";

export async function sharePdfFile(opts: {
  blob: Blob;
  fileName: string;
  title?: string;
  text?: string;
}): Promise<ShareResult> {
  const { blob, fileName, title, text } = opts;
  try {
    if (typeof navigator === "undefined" || typeof (navigator as any).share !== "function") {
      return "unsupported";
    }
    const file = new File([blob], fileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });
    const canShareFiles =
      typeof (navigator as any).canShare === "function" &&
      (navigator as any).canShare({ files: [file] });
    if (!canShareFiles) return "unsupported";

    await (navigator as any).share({ files: [file], title, text });
    return "shared";
  } catch (err: any) {
    if (err && (err.name === "AbortError" || err.code === 20)) return "cancelled";
    console.error("share pdf failed", err);
    return "unsupported";
  }
}

/** Fallback: download local do PDF com nome definido. */
export function downloadPdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Abre uma conversa do WhatsApp (Business preferido) com texto opcional. */
export function openWhatsAppChat(numeroE164Digits: string, texto?: string) {
  const t = texto ? `?text=${encodeURIComponent(texto)}` : "";
  window.open(`https://wa.me/${numeroE164Digits}${t}`, "_blank", "noopener,noreferrer");
}
