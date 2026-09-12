/**
 * Síntese de Voz Neural Ultra-Realista no Cliente (Microsoft Edge Speech HD 24kHz)
 * Funciona diretamente no navegador via WebSocket sem bloqueio de CORS.
 */

export interface SinteseClienteOpcoes {
  voz?: "pt-BR-FranciscaNeural" | "pt-BR-ThalitaNeural" | "pt-BR-BrendaNeural";
  pitch?: string; // ex: "+0Hz", "+1Hz"
  rate?: string;  // ex: "+0%", "+3%"
  timeoutMs?: number;
}

export async function sintetizarEdgeNeuralCliente(
  texto: string,
  opcoes: SinteseClienteOpcoes = {}
): Promise<string | null> {
  if (typeof window === "undefined" || !texto || texto.trim().length < 2) {
    return null;
  }

  const {
    voz = "pt-BR-FranciscaNeural",
    pitch = "+1Hz",
    rate = "+2%",
    timeoutMs = 8000,
  } = opcoes;

  return new Promise((resolve) => {
    try {
      const WebSocketClass = window.WebSocket;
      if (!WebSocketClass) {
        resolve(null);
        return;
      }

      const connectionId =
        Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);
      const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1?TrustedClientToken=6A5AA1D4EA654972A3445493572D69A6&ConnectionId=${connectionId}`;

      const ws = new WebSocketClass(wsUrl);
      ws.binaryType = "arraybuffer";

      const audioChunks: ArrayBuffer[] = [];
      let isDone = false;

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try {
            ws.close();
          } catch {}
          resolve(null);
        }
      }, timeoutMs);

      ws.onopen = () => {
        // 1. Configuração do formato MP3 24kHz Mono 48kbps
        const timestampConfig = new Date().toISOString();
        const configMsg =
          `Path:speech.config\r\n` +
          `X-Timestamp:${timestampConfig}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: "false",
                    wordBoundaryEnabled: "false",
                  },
                  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                },
              },
            },
          });
        ws.send(configMsg);

        // 2. Envio do SSML Neural
        const requestId =
          Math.random().toString(36).substring(2, 10) +
          Math.random().toString(36).substring(2, 10);
        const timestampSSML = new Date().toISOString();
        const textoEscapado = texto.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
          `<voice name='${voz}'>` +
          `<prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${textoEscapado}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg =
          `Path:ssml\r\n` +
          `X-RequestId:${requestId}\r\n` +
          `X-Timestamp:${timestampSSML}\r\n` +
          `Content-Type:application/ssml+xml\r\n\r\n` +
          ssml;

        ws.send(ssmlMsg);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          if (event.data.includes("Path:turn.end")) {
            isDone = true;
            clearTimeout(timer);
            try {
              ws.close();
            } catch {}

            if (audioChunks.length > 0) {
              const blob = new Blob(audioChunks, { type: "audio/mp3" });
              const objectUrl = URL.createObjectURL(blob);
              resolve(objectUrl);
            } else {
              resolve(null);
            }
          }
        } else if (event.data instanceof ArrayBuffer) {
          const arrayBuf = event.data;
          if (arrayBuf.byteLength > 2) {
            const dataView = new DataView(arrayBuf);
            const headerLen = dataView.getUint16(0); // Big Endian
            if (arrayBuf.byteLength > 2 + headerLen) {
              const audioData = arrayBuf.slice(2 + headerLen);
              audioChunks.push(audioData);
            }
          }
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        if (!isDone) {
          isDone = true;
          try {
            ws.close();
          } catch {}
          resolve(null);
        }
      };

      ws.onclose = () => {
        clearTimeout(timer);
        if (!isDone) {
          isDone = true;
          if (audioChunks.length > 0) {
            const blob = new Blob(audioChunks, { type: "audio/mp3" });
            const objectUrl = URL.createObjectURL(blob);
            resolve(objectUrl);
          } else {
            resolve(null);
          }
        }
      };
    } catch {
      resolve(null);
    }
  });
}
