import { humanizarTextoParaVoz } from "./ia-voz-tts";

/**
 * Síntese de Áudio Neural de Alta Fidelidade com Multi-Provedor no Servidor
 * 1. Microsoft Edge Neural Cloud (pt-BR-FranciscaNeural / 24kHz HD) - Áudio de Estúdio
 * 2. Google Cloud Neural / Public Cloud TTS (Voz fluida em português)
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
      const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;

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
          `<prosody pitch='+0Hz' rate='+1%' volume='+0%'>${textoEscapado}</prosody>` +
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
            console.warn("[Edge TTS Server] Erro ao extrair áudio binário:", e);
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
      console.warn("[Edge TTS Server] Erro de inicialização:", err);
      resolve(null);
    }
  });
}

/**
 * Fallback via serviço de áudio Google TTS em nuvem com split de texto
 */
async function sintetizarGoogleCloudPublico(texto: string): Promise<string | null> {
  try {
    const sentencas = texto.match(/[^.!?]+[.!?]+/g) || [texto];
    const buffers: Buffer[] = [];

    for (const s of sentencas.slice(0, 4)) {
      const trecho = s.trim();
      if (!trecho) continue;

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(trecho)}&tl=pt-BR&total=1&idx=0&textlen=${trecho.length}&client=tw-ob`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        buffers.push(Buffer.from(arrayBuf));
      }
    }

    if (buffers.length > 0) {
      const fullBuffer = Buffer.concat(buffers);
      return `data:audio/mp3;base64,${fullBuffer.toString("base64")}`;
    }
    return null;
  } catch (err) {
    console.warn("[Google TTS Server Fallback Error]:", err);
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

  // 2. Tenta Google Cloud TTS Público (MP3 em tempo real)
  try {
    const audioGoogle = await sintetizarGoogleCloudPublico(textoLimpo);
    if (audioGoogle) return audioGoogle;
  } catch (err) {
    console.warn("[TTS Server] Google TTS falhou:", err);
  }

  // 3. Tenta OpenAI Neural TTS (Nova) se houver chave configurada
  try {
    const audioOpenAI = await sintetizarOpenAINeural(textoLimpo);
    if (audioOpenAI) return audioOpenAI;
  } catch (err) {
    console.warn("[TTS Server] OpenAI falhou:", err);
  }

  return null;
}
