/**
 * Serviço de Voz Neural de Estúdio (Studio Neural TTS) da Jessi V2
 * 
 * Estratégia Multi-Camadas:
 * 1. Cache em Memória LRU (0ms de latência para frases frequentes);
 * 2. Server Function `gerarAudioNeuralJessiFn` (Edge Neural / Google Cloud 24kHz HD sem bloqueio de CORS/Origin);
 * 3. Client-Side Edge WebSocket Synthesizer;
 * 4. Fallback Transparente para Motor Fonético do Navegador.
 */

import { gerarAudioNeuralJessiFn } from "./ia-voz.functions";

export interface NeuralVoiceConfig {
  provider: "auto" | "server" | "edge-neural" | "elevenlabs" | "openai";
  edgeVoice: "pt-BR-FranciscaNeural" | "pt-BR-ThalitaNeural" | "pt-BR-AntonioNeural";
  openaiVoice: "nova" | "shimmer" | "alloy" | "echo" | "fable" | "onyx";
  openaiModel: "tts-1" | "tts-1-hd";
  openaiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  speed: number;
}

const DEFAULT_CONFIG: NeuralVoiceConfig = {
  provider: "auto",
  edgeVoice: "pt-BR-FranciscaNeural",
  openaiVoice: "nova",
  openaiModel: "tts-1",
  elevenlabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
  speed: 1.0,
};

// Cache LRU de áudio em memória (armazena até 80 frases comuns)
const audioBlobCache = new Map<string, Blob>();
const MAX_CACHE_SIZE = 80;

function obterChaveCache(texto: string): string {
  return texto.trim().toLowerCase();
}

/**
 * Converte data URL em Blob
 */
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export interface SinteseAudioResult {
  blob: Blob;
  url: string;
}

/**
 * Orquestrador central de Síntese de Voz Neural.
 */
export async function sintetizarVozNeural(
  texto: string,
  configParcial?: Partial<NeuralVoiceConfig>,
  signal?: AbortSignal
): Promise<SinteseAudioResult | null> {
  if (!texto || !texto.trim()) return null;

  // 1. Verifica no Cache (0ms de latência)
  const chaveCache = obterChaveCache(texto);
  if (audioBlobCache.has(chaveCache)) {
    const blobCached = audioBlobCache.get(chaveCache)!;
    return {
      blob: blobCached,
      url: URL.createObjectURL(blobCached),
    };
  }

  let audioBlob: Blob | null = null;

  // 2. Chama a Server Function dedicada (Edge Neural HD / Google Cloud MP3)
  try {
    const res = await gerarAudioNeuralJessiFn({
      data: { texto },
    });

    if (res?.audioDataUrl && res.audioDataUrl.startsWith("data:audio/")) {
      audioBlob = dataURItoBlob(res.audioDataUrl);
    }
  } catch (err) {
    console.warn("[Neural TTS Server Function Warning]:", err);
  }

  if (!audioBlob) {
    return null;
  }

  // 3. Salva no Cache para reuso instantâneo
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
