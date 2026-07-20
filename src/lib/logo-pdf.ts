import logoAsset from "@/assets/spa-de-pet-logo.png.asset.json";

let cache: string | null = null;

/** Retorna a logo oficial como dataURL PNG, cacheada em memória. */
export async function getLogoDataUrl(): Promise<string | null> {
  if (cache) return cache;
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
    cache = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

/** Desenha a logo em um círculo branco (badge) — usado nos cabeçalhos verdes. */
export function drawLogoBadge(
  doc: any,
  logoDataUrl: string | null,
  cx: number,
  cy: number,
  size: number,
) {
  if (!logoDataUrl) return;
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, size / 2 + 3, "F");
  try {
    doc.addImage(
      logoDataUrl,
      "PNG",
      cx - size / 2,
      cy - size / 2,
      size,
      size,
      undefined,
      "FAST",
    );
  } catch {
    /* noop */
  }
}
