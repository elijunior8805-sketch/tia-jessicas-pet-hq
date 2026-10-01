/**
 * Serviço de Voz Neural de Estúdio (Studio Neural TTS) da Jessi V2
 * 
 * Suporta:
 * 1. OpenAI Neural TTS (`tts-1` / `tts-1-hd` com vozes: nova, shimmer, alloy);
 * 2. ElevenLabs Multilingual TTS (alta fidelidade e expressividade);
 * 3. Cache em memória de áudios sintetizados para resposta instantânea (0ms) e economia de cota;
 * 4. Suporte a cancelamento imediato em caso de interrupção (Barge-in).
 */

export interface NeuralVoiceConfig {
  provider: "openai" | "elevenlabs" | "auto";
  openaiVoice: "nova" | "shimmer" | "alloy" | "echo" | "fable" | "onyx";
  openaiModel: "tts-1" | "tts-1-hd";
  openaiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  speed: number;
}

const DEFAULT_CONFIG: NeuralVoiceConfig = {
  provider: "auto",
  openaiVoice: "nova", // Voz feminina calorosa, natural e articulada
  openaiModel: "tts-1", // Resposta ultrarrápida (~250-400ms)
  elevenlabsVoiceId: "21m00Tcm4TlvDq8ikWAM", // Voz padrão expressiva
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
    // 1. Variáveis de ambiente Vite
    if (typeof import.meta !== "undefined" && import.meta.env) {
      openaiKey = (import.meta.env.VITE_OPENAI_API_KEY as string) || "";
      elevenlabsKey = (import.meta.env.VITE_ELEVENLABS_API_KEY as string) || "";
    }
  } catch {}

  try {
    // 2. LocalStorage do navegador (configurações do usuário/painel)
    if (typeof window !== "undefined" && window.localStorage) {
      if (!openaiKey) {
        openaiKey = window.localStorage.getItem("openai_api_key") || window.localStorage.getItem("jessi_openai_key") || "";
      }
      if (!elevenlabsKey) {
        elevenlabsKey = window.localStorage.getItem("elevenlabs_api_key") || window.localStorage.getItem("jessi_elevenlabs_key") || "";
      }
    }
  } catch {}

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
      console.warn(`[Neural TTS OpenAI Error] Status ${response.status}:`, await response.text().catch(() => ""));
      return null;
    }

    return await response.blob();
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return null;
    }
    console.warn("[Neural TTS OpenAI Exception]:", err);
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
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
      console.warn(`[Neural TTS ElevenLabs Error] Status ${response.status}:`, await response.text().catch(() => ""));
      return null;
    }

    return await response.blob();
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return null;
    }
    console.warn("[Neural TTS ElevenLabs Exception]:", err);
    return null;
  }
}

/**
 * Orquestrador central de Síntese de Voz Neural.
 * Tenta sintetizar com a melhor API disponível e retorna o Blob de áudio ou null se não houver credencial/falha.
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

  // 1. Verifica no Cache
  const chaveCache = obterChaveCache(texto, config.provider, config.openaiVoice, config.speed);
  if (audioBlobCache.has(chaveCache)) {
    const blobCached = audioBlobCache.get(chaveCache)!;
    return {
      blob: blobCached,
      url: URL.createObjectURL(blobCached),
    };
  }

  let audioBlob: Blob | null = null;

  // 2. Executa provedor selecionado ou auto-descoberta
  if (config.provider === "elevenlabs" && elevenKey) {
    audioBlob = await sintetizarElevenLabsTTS(texto, elevenKey, config.elevenlabsVoiceId, signal);
  } else if (config.provider === "openai" && openaiKey) {
    audioBlob = await sintetizarOpenAITTS(texto, openaiKey, config.openaiVoice, config.openaiModel, config.speed, signal);
  } else {
    // Modo "auto": prioriza OpenAI (latência menor e custo acessível), depois ElevenLabs
    if (openaiKey) {
      audioBlob = await sintetizarOpenAITTS(texto, openaiKey, config.openaiVoice, config.openaiModel, config.speed, signal);
    }
    if (!audioBlob && elevenKey) {
      audioBlob = await sintetizarElevenLabsTTS(texto, elevenKey, config.elevenlabsVoiceId, signal);
    }
  }

  if (!audioBlob) {
    return null;
  }

  // 3. Salva no Cache
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
