import type jsPDF from "jspdf";

/**
 * Entrega um PDF de forma amigável em mobile e desktop.
 *
 * No celular, `doc.save()` apenas dispara um download que muitas vezes o
 * usuário não encontra ou não consegue abrir. Aqui geramos uma URL blob e
 * abrimos em nova aba — assim iOS/Android renderizam o PDF inline no
 * visualizador nativo, e o usuário ainda pode salvar/compartilhar dali.
 */
export function deliverPdf(doc: jsPDF, fileName: string) {
  try {
    const blob = doc.output("blob") as Blob;
    const url = URL.createObjectURL(blob);

    // Tenta abrir em nova aba para pré-visualização (funciona em iOS/Android)
    const win = typeof window !== "undefined" ? window.open(url, "_blank") : null;

    if (!win) {
      // Popup bloqueado — cai para download com nome definido
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // Libera a URL depois de um tempo suficiente para o viewer carregar
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // Último recurso: usa o save nativo do jsPDF
    doc.save(fileName);
  }
}
