import { humanizarTextoParaVoz } from "./ia-voz-tts";

/**
 * Síntese de Áudio Neural de Alta Definição no Servidor (OpenAI / Lovable AI Gateway)
 * Gera fala com entonação humana ultra-realista, calorosa e fluida em português do Brasil.
 */
export async function sintetizarAudioNeural(texto: string): Promise<string | null> {
  const textoLimpo = humanizarTextoParaVoz(texto);
  if (!textoLimpo || textoLimpo.length < 2) return null;

  const apiKey =
    process.env.LOVABLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_LOVABLE_API_KEY);

  if (!apiKey) {
    return null;
  }

  const endpoint = process.env.LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/audio/speech"
    : "https://api.openai.com/v1/audio/speech";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "nova", // Voz feminina calorosa, natural e expressiva para a Jessi
        input: textoLimpo.slice(0, 4000),
        response_format: "mp3",
        speed: 1.02,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn("[TTS Server] Falha ao gerar áudio neural:", res.status);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:audio/mp3;base64,${base64}`;
  } catch (err) {
    console.warn("[TTS Server] Erro ao sintetizar áudio neural:", err);
    return null;
  }
}
