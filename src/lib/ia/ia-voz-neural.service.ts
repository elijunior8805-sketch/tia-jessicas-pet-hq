/**
 * Serviço de Voz Neural de Estúdio (Studio Neural TTS) da Jessi V2
 * 
 * Suporta:
 * 1. Microsoft Edge Online Neural TTS (100% Gratuito, Ilimitado, sem necessidade de chave de API, voz HD Francisca/Thalita 24kHz);
 * 2. ElevenLabs Multilingual TTS (quando fornecida chave sk_ com créditos);
 * 3. OpenAI Neural TTS (tts-1 / tts-1-hd);
 * 4. Cache em memória de áudios sintetizados para resposta instantânea (0ms);
 * 5. Suporte a cancelamento imediato em caso de interrupção (Barge-in).
 */

export interface NeuralVoiceConfig {
  provider: "edge-neural" | "elevenlabs" | "openai" | "auto";
  edgeVoice: "pt-BR-FranciscaNeural" | "pt-BR-ThalitaNeural" | "pt-BR-AntonioNeural";
  openaiVoice: "nova" | "shimmer" | "alloy" | "echo" | "fable" | "onyx";
  openaiModel: "tts-1" | "tts-1-hd";
  openaiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  speed: number;
}

const DEFAULT_ELEVENLABS_KEY = "sk_f5d2e5675220c6b7979ee7e4f8658a4527ea695715690653";

const DEFAULT_CONFIG: NeuralVoiceConfig = {
  provider: "auto",
  edgeVoice: "pt-BR-FranciscaNeural", // Voz neural feminina calorosa e natural da Microsoft
  openaiVoice: "nova",
  openaiModel: "tts-1",
  elevenlabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
  speed: 1.0,
};

// Cache LRU de áudio em memória (armazena até 60 frases comuns)
const audioBlobCache = new Map<string, Blob>();
const MAX_CACHE_SIZE = 60;

function obterChaveCache(texto: string, provider: string, voice: string, speed: number): string {
  return `${provider}:${voice}:${speed}:${texto.trim()}`;
}

/**
 * Obtém as chaves de API disponíveis no ambiente ou no armazenamento local
 */
export function obterChavesNeuralTTS(): { openaiKey?: string; elevenlabsKey?: string } {
  let openaiKey = "";
  let elevenlabsKey = "";

  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      openaiKey = (import.meta.env.VITE_OPENAI_API_KEY as string) || "";
      elevenlabsKey = (import.meta.env.VITE_ELEVENLABS_API_KEY as string) || "";
    }
  } catch {}

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (!openaiKey) {
        openaiKey = window.localStorage.getItem("openai_api_key") || window.localStorage.getItem("jessi_openai_key") || "";
      }
      if (!elevenlabsKey) {
        elevenlabsKey = window.localStorage.getItem("elevenlabs_api_key") || window.localStorage.getItem("jessi_elevenlabs_key") || "";
      }
    }
  } catch {}

  if (!elevenlabsKey && DEFAULT_ELEVENLABS_KEY) {
    elevenlabsKey = DEFAULT_ELEVENLABS_KEY;
  }

  return {
    openaiKey: openaiKey.trim() || undefined,
    elevenlabsKey: elevenlabsKey.trim() || undefined,
  };
}

export interface SinteseAudioResult {
  blob: Blob;
  url: string;
}

/**
 * Sintetiza voz neural de estúdio 100% gratuita via Microsoft Edge Neural Speech WebSocket.
 * Qualidade 24kHz MP3, sem custos, sem limite de caracteres e sem necessidade de API key.
 */
function sintetizarEdgeNeuralTTS(
  texto: string,
  voice: string = "pt-BR-FranciscaNeural",
  signal?: AbortSignal
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      return resolve(null);
    }

    const connectionId = Math.random().toString(36).substring(2, 18).toUpperCase();
    const requestId = Math.random().toString(36).substring(2, 18).toUpperCase();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;

    let socket: WebSocket | null = null;
    let audioChunks: Uint8Array[] = [];
    let isResolved = false;

    const cleanup = () => {
      if (socket) {
        try {
          socket.onopen = null;
          socket.onmessage = null;
          socket.onerror = null;
          socket.onclose = null;
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
        } catch {}
        socket = null;
      }
    };

    const finish = (result: Blob | null) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(result);
      }
    };

    if (signal) {
      signal.addEventListener("abort", () => finish(null));
    }

    const timeout = setTimeout(() => {
      finish(null);
    }, 8000);

    try {
      socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        if (isResolved || !socket) return;

        // 1. Configuração de Áudio
        const configMessage =
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
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

        socket.send(configMessage);

        // 2. SSML Payload com formatação fonética e prosódia humana
        const escapedText = texto
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

        const ssmlMessage =
          `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `Path:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapedText}</prosody>` +
          `</voice>` +
          `</speak>`;

        socket.send(ssmlMessage);
      };

      socket.onmessage = (event) => {
        if (isResolved) return;

        if (typeof event.data === "string") {
          if (event.data.includes("Path:turn.end")) {
            clearTimeout(timeout);
            if (audioChunks.length > 0) {
              const combinedBlob = new Blob(audioChunks, { type: "audio/mp3" });
              finish(combinedBlob);
            } else {
              finish(null);
            }
          }
        } else if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data);
          if (event.data.byteLength >= 2) {
            const headerLength = view.getInt16(0);
            if (event.data.byteLength > headerLength + 2) {
              const audioBytes = new Uint8Array(event.data, headerLength + 2);
              audioChunks.push(audioBytes);
            }
          }
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        finish(null);
      };

      socket.onclose = () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          const combinedBlob = new Blob(audioChunks, { type: "audio/mp3" });
          finish(combinedBlob);
        } else {
          finish(null);
        }
      };
    } catch (err) {
      clearTimeout(timeout);
      finish(null);
    }
  });
}

/**
 * Sintetiza o texto em áudio neural de estúdio via OpenAI TTS
 */
async function sintetizarOpenAITTS(
  texto: string,
  apiKey: string,
  voice: string = "nova",
  model: string = "tts-1",
  speed: number = 1.0,
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: texto,
        voice: voice,
        response_format: "mp3",
        speed: speed,
      }),
      signal: signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch {
    return null;
  }
}

/**
 * Sintetiza o texto em áudio neural de estúdio via ElevenLabs TTS
 */
async function sintetizarElevenLabsTTS(
  texto: string,
  apiKey: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM",
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: texto,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch {
    return null;
  }
}

/**
 * Orquestrador central de Síntese de Voz Neural.
 * Ordem inteligente de prioridade:
 * 1. Microsoft Edge Neural Speech (100% Gratuito, MP3 24kHz de Estúdio, sem bloqueios de cota);
 * 2. ElevenLabs / OpenAI (se chaves com créditos configuradas);
 * 3. Fallback automático para o motor fonético nativo do navegador.
 */
export async function sintetizarVozNeural(
  texto: string,
  configParcial?: Partial<NeuralVoiceConfig>,
  signal?: AbortSignal
): Promise<SinteseAudioResult | null> {
  if (!texto || !texto.trim()) return null;

  const config: NeuralVoiceConfig = { ...DEFAULT_CONFIG, ...configParcial };
  const keys = obterChavesNeuralTTS();
  const openaiKey = config.openaiApiKey || keys.openaiKey;
  const elevenKey = config.elevenlabsApiKey || keys.elevenlabsKey;

  // 1. Verifica no Cache (0ms de latência)
  const chaveCache = obterChaveCache(texto, config.provider, config.edgeVoice || config.openaiVoice, config.speed);
  if (audioBlobCache.has(chaveCache)) {
    const blobCached = audioBlobCache.get(chaveCache)!;
    return {
      blob: blobCached,
      url: URL.createObjectURL(blobCached),
    };
  }

  let audioBlob: Blob | null = null;

  // 2. Prioriza Microsoft Edge Neural Studio (100% Grátis, Ilimitado e com qualidade de rádio)
  try {
    audioBlob = await sintetizarEdgeNeuralTTS(texto, config.edgeVoice, signal);
  } catch (err) {
    console.warn("[Edge Neural TTS Error, trying alternatives]:", err);
  }

  // 3. Se Edge Neural falhar, tenta ElevenLabs ou OpenAI se houver chave configurada
  if (!audioBlob && elevenKey) {
    audioBlob = await sintetizarElevenLabsTTS(texto, elevenKey, config.elevenlabsVoiceId, signal);
  }

  if (!audioBlob && openaiKey) {
    audioBlob = await sintetizarOpenAITTS(texto, openaiKey, config.openaiVoice, config.openaiModel, config.speed, signal);
  }

  if (!audioBlob) {
    return null;
  }

  // 4. Salva no Cache para reuso instantâneo
  if (audioBlobCache.size >= MAX_CACHE_SIZE) {
    const primeiraChave = audioBlobCache.keys().next().value;
    if (primeiraChave) audioBlobCache.delete(primeiraChave);
  }
  audioBlobCache.set(chaveCache, audioBlob);

  return {
    blob: audioBlob,
    url: URL.createObjectURL(audioBlob),
  };
}
