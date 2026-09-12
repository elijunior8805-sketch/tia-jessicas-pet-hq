import { humanizarTextoParaVoz } from "./ia-voz-tts";

/**
 * Síntese de Áudio Neural de Alta Fidelidade com Multi-Provedor
 * 1. Microsoft Edge Neural Cloud (pt-BR-FranciscaNeural / 24kHz HD) - Som de estúdio humano gratuito
 * 2. Google Cloud Neural2 (pt-BR-Neural2-A)
 * 3. OpenAI TTS (Nova / tts-1)
 */

async function sintetizarEdgeNeural(texto: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const WebSocketConstructor = (globalThis as any).WebSocket;
      if (!WebSocketConstructor) {
        resolve(null);
        return;
      }

      const connectionId = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1?TrustedClientToken=6A5AA1D4EA654972A3445493572D69A6&ConnectionId=${connectionId}`;

      const ws = new WebSocketConstructor(wsUrl);
      const audioChunks: Buffer[] = [];
      let isDone = false;

      const timeout = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try {
            ws.close();
          } catch {}
          resolve(null);
        }
      }, 9000);

      ws.onopen = () => {
        // 1. Configuração do formato de áudio (MP3 24kHz Mono 48kbps)
        const timestampConfig = new Date().toISOString();
        const configMsg =
          `Path:speech.config\r\n` +
          `X-Timestamp:${timestampConfig}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                },
              },
            },
          });
        ws.send(configMsg);

        // 2. Envio do SSML com a voz feminina neural brasileira (Francisca)
        const requestId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const timestampSSML = new Date().toISOString();
        const textoEscapado = texto.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
          `<voice name='pt-BR-FranciscaNeural'>` +
          `<prosody pitch='+1Hz' rate='+2%' volume='+0%'>${textoEscapado}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg =
          `Path:ssml\r\n` +
          `X-RequestId:${requestId}\r\n` +
          `X-Timestamp:${timestampSSML}\r\n` +
          `Content-Type:application/ssml+xml\r\n\r\n` +
          ssml;
        ws.send(ssmlMsg);
      };

      ws.onmessage = async (event: any) => {
        const data = event.data;
        if (typeof data === "string") {
          if (data.includes("Path:turn.end")) {
            isDone = true;
            clearTimeout(timeout);
            try {
              ws.close();
            } catch {}
            if (audioChunks.length > 0) {
              const fullBuffer = Buffer.concat(audioChunks);
              resolve(`data:audio/mp3;base64,${fullBuffer.toString("base64")}`);
            } else {
              resolve(null);
            }
          }
        } else if (data) {
          try {
            let buffer: Buffer;
            if (Buffer.isBuffer(data)) {
              buffer = data;
            } else if (data instanceof ArrayBuffer) {
              buffer = Buffer.from(data);
            } else if (typeof Blob !== "undefined" && data instanceof Blob) {
              const arrayBuf = await data.arrayBuffer();
              buffer = Buffer.from(arrayBuf);
            } else {
              return;
            }

            if (buffer.length > 2) {
              const headerLength = buffer.readUInt16BE(0);
              if (buffer.length > 2 + headerLength) {
                const audioChunk = buffer.subarray(2 + headerLength);
                if (audioChunk.length > 0) {
                  audioChunks.push(audioChunk);
                }
              }
            }
          } catch (e) {
            console.warn("[Edge TTS] Erro ao extrair áudio binário:", e);
          }
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!isDone) {
          isDone = true;
          try {
            ws.close();
          } catch {}
          resolve(null);
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (!isDone) {
          isDone = true;
          if (audioChunks.length > 0) {
            const fullBuffer = Buffer.concat(audioChunks);
            resolve(`data:audio/mp3;base64,${fullBuffer.toString("base64")}`);
          } else {
            resolve(null);
          }
        }
      };
    } catch (err) {
      console.warn("[Edge TTS] Erro de inicialização:", err);
      resolve(null);
    }
  });
}

async function sintetizarGoogleNeural(texto: string): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY);

  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: texto },
        voice: {
          languageCode: "pt-BR",
          name: "pt-BR-Neural2-A",
          ssmlGender: "FEMALE",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.02,
          pitch: 0.5,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data: any = await res.json();
    if (data?.audioContent) {
      return `data:audio/mp3;base64,${data.audioContent}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function sintetizarOpenAINeural(texto: string): Promise<string | null> {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_OPENAI_API_KEY);

  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "nova",
        input: texto.slice(0, 4000),
        response_format: "mp3",
        speed: 1.02,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:audio/mp3;base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Função principal de Síntese de Voz Ultra-Realista
 */
export async function sintetizarAudioNeural(texto: string): Promise<string | null> {
  const textoLimpo = humanizarTextoParaVoz(texto);
  if (!textoLimpo || textoLimpo.length < 2) return null;

  // 1. Tenta Microsoft Edge Cloud Neural (Voz Francisca 24kHz HD Studio)
  try {
    const audioEdge = await sintetizarEdgeNeural(textoLimpo);
    if (audioEdge) return audioEdge;
  } catch (err) {
    console.warn("[TTS Server] Edge Neural falhou:", err);
  }

  // 2. Tenta Google Cloud Neural2 (pt-BR-Neural2-A)
  try {
    const audioGoogle = await sintetizarGoogleNeural(textoLimpo);
    if (audioGoogle) return audioGoogle;
  } catch (err) {
    console.warn("[TTS Server] Google Cloud falhou:", err);
  }

  // 3. Tenta OpenAI Neural TTS (Nova)
  try {
    const audioOpenAI = await sintetizarOpenAINeural(textoLimpo);
    if (audioOpenAI) return audioOpenAI;
  } catch (err) {
    console.warn("[TTS Server] OpenAI falhou:", err);
  }

  return null;
}
