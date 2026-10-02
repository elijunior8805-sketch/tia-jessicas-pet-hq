import { useState, useRef, useEffect, useCallback } from "react";
import {
  VoiceRecognizer,
  VoiceRecognitionStatus,
  VoiceUtterance,
  consolidarTranscricao,
  ehFalaValida,
  falarTextoJessi,
  pararFalaJessi,
} from "./ia-voz";
import { reproduzirFalaHumana, humanizarTextoParaVoz, ControladorFala } from "./ia-voz-tts";
import { JessiBargeInDetector, ehDispositivoMovel } from "./ia-barge-in";
import { humanizarRespostaParaVoz } from "./ia-voz-conversational";
import { toast } from "sonner";

export interface UseJessiVoiceReturn {
  voiceStatus: VoiceRecognitionStatus;
  isListening: boolean;
  isContinuousMode: boolean;
  isReviewing: boolean;
  interimTranscript: string;
  finalTranscript: string;
  isSpeaking: boolean;
  audioLevel: number;
  isInterrupted: boolean;
  ttsEnabled: boolean;
  setTtsEnabled: (val: boolean) => void;
  startListening: (textoAtual?: string) => void;
  stopListening: () => void;
  startContinuousMode: () => void;
  stopContinuousMode: () => void;
  toggleContinuousMode: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  cancelListening: () => void;
  resetTranscript: () => void;
  speakResponse: (
    entrada: string | { texto: string; cards?: any[] },
    cardsOrOnFinish?: any[] | (() => void),
    onFinish?: () => void
  ) => void;
  falarResposta: (texto: string) => void;
  pararFala: () => void;
  cancelVoice: () => void;
}

/**
 * Vocabulario especifico do Spa para calibrar acuracia fonetica em pt-BR
 */
const DICIONARIO_SPA: Record<string, string> = {
  "banho e tosa": "banho e tosa",
  "banhitosa": "banho e tosa",
  "banho etosa": "banho e tosa",
  "banho tosa": "banho e tosa",
  "banho essencial": "banho essencial",
  "banho simples": "banho essencial",
  "banho premium": "banho premium",
  "tosa higiênica": "tosa higiênica",
  "tosa higienica": "tosa higiênica",
  "tosa higiênico": "tosa higiênica",
  "hidratação": "hidratação",
  "hidratacao": "hidratação",
  "leva e traz": "leva e traz",
  "leva traz": "leva e traz",
  "levar e trazer": "leva e traz",
  "eli junior": "Eli Júnior",
  "eli júnior": "Eli Júnior",
  "eli jr": "Eli Júnior",
  "thor": "Thor",
  "tor": "Thor",
  "rex": "Rex",
  "belinha": "Belinha",
  "cleusa": "Cleusa",
  "pix": "Pix",
  "pics": "Pix",
  "débito": "débito",
  "crédito": "crédito",
  "comprovante": "comprovante",
  "agendar": "agendar",
  "reagendar": "reagendar",
  "remarcar": "remarcar",
  "cancelar": "cancelar",
  "faturamento": "faturamento",
};

/** Corrige vicios comuns do reconhecimento de voz e devolve frase fluida. */
const CORRECOES_FALA: Array<[RegExp, string]> = [
  [/\b(embarcar|embaque|desembarcar|enmarcar|eh marcar|e marcar)\b/gi, "marcar"],
  [/\bagendar banho para\b/gi, "agendar banho para"],
  [/\bmarcar banho para\b/gi, "marcar banho para"],
  [/\bvc\b/gi, "você"],
  [/\bpq\b/gi, "porque"],
  [/\btb\b/gi, "também"],
  [/\btbm\b/gi, "também"],
  [/\bqto\b/gi, "quanto"],
  [/\bamnh\b|\bamanhã de manha\b/gi, "amanhã de manhã"],
  [/\bmeio dia e meia\b/gi, "meio-dia e meia"],
  [/\bda\s+(qui|aki)\b/gi, "daqui"],
  [/\bpeti shop\b|\bpet shop\b/gi, "pet shop"],
];

export function aperfeicoarTextoSpa(texto: string): string {
  let corrigido = texto;
  for (const [termo, substituicao] of Object.entries(DICIONARIO_SPA)) {
    const regex = new RegExp(`\\b${termo}\\b`, "gi");
    corrigido = corrigido.replace(regex, substituicao);
  }
  return corrigido;
}

/**
 * Humaniza a transcricao final: aplica o vocabulario do Spa, corrige vicios
 * comuns do reconhecedor, capitaliza o inicio das frases e fecha a pontuacao,
 * entregando um texto fluido e natural para leitura e envio.
 */
export function humanizarTranscricao(texto: string): string {
  let t = aperfeicoarTextoSpa((texto || "").replace(/\s+/g, " ").trim());
  if (!t) return "";

  for (const [regex, substituicao] of CORRECOES_FALA) {
    t = t.replace(regex, substituicao);
  }

  // Capitaliza a primeira letra de cada frase
  t = t.replace(/(^\s*[a-zà-ÿ]|[.!?]\s+[a-zà-ÿ])/g, (m) => m.toUpperCase());

  // Garante pontuacao final para a frase nao ficar pendurada
  if (!/[.!?…]$/.test(t)) {
    // Perguntas comuns ganham interrogacao
    if (/^(qual|quais|quanto|quantos|quantas|quando|onde|como|quem|será|pode|tem|temos|existe)\b/i.test(t)) {
      t += "?";
    } else {
      t += ".";
    }
  }

  return t;
}

/**
 * Filtro Anti-Eco: Detecta se o texto transcrito pelo microfone é o eco
 * da fala sintetizada da própria Jessi que acabou de sair pelo alto-falante.
 */
export function ehEcoDaPropriaIa(
  textoUsuario: string,
  historicoIa: Array<{ texto: string; timestamp: number }>
): boolean {
  if (!textoUsuario || !historicoIa || historicoIa.length === 0) return false;

  const now = Date.now();
  const textoLimpo = textoUsuario.toLowerCase().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim();
  const palavrasUsuario = textoLimpo.split(/\s+/).filter((p) => p.length >= 3);
  if (palavrasUsuario.length === 0) return false;

  for (const item of historicoIa) {
    // Analisa falas recentes da IA nos últimos 10 segundos
    if (now - item.timestamp > 10000) continue;

    const textoIa = item.texto.toLowerCase().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim();

    // Se o texto for idêntico ou substring
    if (textoIa.includes(textoLimpo) || textoLimpo.includes(textoIa)) {
      return true;
    }

    // Calcula sobreposição de palavras
    let palavrasCorrespondentes = 0;
    for (const p of palavrasUsuario) {
      if (textoIa.includes(p)) {
        palavrasCorrespondentes++;
      }
    }

    const taxaSobreposicao = palavrasCorrespondentes / palavrasUsuario.length;
    if (taxaSobreposicao >= 0.40 && palavrasCorrespondentes >= 2) {
      return true;
    }
  }

  return false;
}

export function useJessiVoice(
  onTranscriptFinal?: (texto: string) => void,
  onAutoSend?: (texto: string) => void
): UseJessiVoiceReturn {
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>("idle");
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const onTranscriptFinalRef = useRef(onTranscriptFinal);
  const onAutoSendRef = useRef(onAutoSend);
  const isSpeakingRef = useRef(false);
  const lastSpeakingEndTimeRef = useRef(0);
  const controladorFalaRef = useRef<ControladorFala | null>(null);
  const bargeInDetectorRef = useRef<JessiBargeInDetector | null>(null);
  const isContinuousModeRef = useRef(false);
  const ultimasFalasJessiRef = useRef<Array<{ texto: string; timestamp: number }>>([]);

  const pararTodoAudio = useCallback(() => {
    controladorFalaRef.current?.cancelar();
    controladorFalaRef.current = null;
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    pararFalaJessi();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  // Interrupção instantânea (Barge-in): Quando o usuário fala por cima da Jessi
  const handleUserBargeIn = useCallback(() => {
    if (!isSpeakingRef.current) return;

    // 1. Corta imediatamente todo áudio e fala da IA (< 30ms)
    pararTodoAudio();
    setIsInterrupted(true);
    setTimeout(() => setIsInterrupted(false), 1200);

    // 2. Zera buffers e retoma reconhecimento com o microfone limpo
    recognizerRef.current?.reset();
    setInterimTranscript("");
    setTimeout(() => {
      if (isContinuousModeRef.current && !isSpeakingRef.current) {
        recognizerRef.current?.resumeListening();
        setVoiceStatus("listening");
      }
    }, 60);
  }, [pararTodoAudio]);

  useEffect(() => {
    onTranscriptFinalRef.current = onTranscriptFinal;
  }, [onTranscriptFinal]);

  useEffect(() => {
    onAutoSendRef.current = onAutoSend;
  }, [onAutoSend]);

  useEffect(() => {
    isContinuousModeRef.current = isContinuousMode;
  }, [isContinuousMode]);

  useEffect(() => {
    // Inicializa detector de interrupção com Web Audio API
    bargeInDetectorRef.current = new JessiBargeInDetector({
      onBargeIn: handleUserBargeIn,
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      sensitivityThreshold: 0.045,
      minVoiceDurationMs: 120,
    });

    // Pre-carrega vozes do navegador para disponibilidade imediata
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            window.speechSynthesis.getVoices();
          } catch {}
        };
      } catch {}
    }

    recognizerRef.current = new VoiceRecognizer({
      silenceMs: 1200,
      onFinal: (texto) => {
        if (isSpeakingRef.current || (Date.now() - lastSpeakingEndTimeRef.current < 300)) return;
        const humanizado = humanizarTranscricao(texto);
        setFinalTranscript(humanizado);
        setInterimTranscript("");
        if (onTranscriptFinalRef.current) {
          onTranscriptFinalRef.current(humanizado);
        }
      },
      onInterim: (texto) => {
        if (isSpeakingRef.current || (Date.now() - lastSpeakingEndTimeRef.current < 300)) return;
        setInterimTranscript(texto);
      },
      onUtteranceComplete: (utterance: VoiceUtterance) => {
        // 1. Se a IA estiver falando ou em cooldown pós-fala, descarta imediatamente (Anti-Eco Absoluto)
        if (isSpeakingRef.current || (Date.now() - lastSpeakingEndTimeRef.current < 300)) {
          return;
        }
        const textoHumanizado = humanizarTranscricao(utterance.text);
        if (!ehFalaValida(textoHumanizado)) return;

        // 2. Se a transcrição for o eco da própria IA, descarta!
        if (ehEcoDaPropriaIa(textoHumanizado, ultimasFalasJessiRef.current)) {
          console.warn("[Jessi Voice Guard] Eco da própria IA descartado:", textoHumanizado);
          setInterimTranscript("");
          setFinalTranscript("");
          return;
        }

        if (onAutoSendRef.current) {
          pararTodoAudio();
          recognizerRef.current?.pauseListening();
          setInterimTranscript("");
          setFinalTranscript(textoHumanizado);
          onAutoSendRef.current(textoHumanizado);
        }
      },
      onStatusChange: (status) => {
        setVoiceStatus(status);
      },
      onError: (erro) => {
        console.warn("[Jessi Voice Error]:", erro);
        if (erro === "not-allowed" || erro === "permission-denied") {
          setIsContinuousMode(false);
          toast.error("Permissão de microfone negada. Toque no ícone de cadeado do navegador para permitir o microfone.");
        } else if (erro === "no-speech") {
          // Silencio regular
        } else if (erro === "network") {
          toast.error("Reconhecimento de voz offline ou instável. Verifique sua conexão.");
        } else if (erro === "audio-capture") {
          toast.error("Nenhum microfone detectado ou microfone ocupado por outro app.");
        } else if (erro === "service-not-allowed") {
          toast.error("Reconhecimento de voz bloqueado pelo navegador.");
        }
      },
    });

    return () => {
      pararTodoAudio();
      recognizerRef.current?.abort();
      bargeInDetectorRef.current?.stop();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, [pararTodoAudio, handleUserBargeIn]);

  const startContinuousMode = useCallback(async () => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Seu navegador não suporta reconhecimento de voz. Recomendamos o Google Chrome ou Microsoft Edge.");
        return;
      }
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }
    }

    if (!recognizerRef.current) return;
    setIsContinuousMode(true);
    setTtsEnabled(true);
    setInterimTranscript("");
    setFinalTranscript("");
    recognizerRef.current.startContinuous();

    // Ativa detector de interrupção full-duplex
    await bargeInDetectorRef.current?.start(() => isSpeakingRef.current);
    toast.success("Modo Voz Contínuo Ativo! Fale seus comandos naturalmente.");
  }, []);

  const stopContinuousMode = useCallback(() => {
    setIsContinuousMode(false);
    pararTodoAudio();
    recognizerRef.current?.stopContinuous();
    bargeInDetectorRef.current?.stop();
    setInterimTranscript("");
    setFinalTranscript("");
    setAudioLevel(0);
    toast.info("Modo Voz Contínuo desativado.");
  }, [pararTodoAudio]);

  const toggleContinuousMode = useCallback(() => {
    if (isContinuousMode) {
      stopContinuousMode();
    } else {
      startContinuousMode();
    }
  }, [isContinuousMode, startContinuousMode, stopContinuousMode]);

  const pauseListening = useCallback(() => {
    recognizerRef.current?.pauseListening();
    bargeInDetectorRef.current?.pause();
  }, []);

  const resumeListening = useCallback(() => {
    if (isContinuousMode && !isSpeakingRef.current) {
      recognizerRef.current?.resumeListening();
      bargeInDetectorRef.current?.resume();
    }
  }, [isContinuousMode]);

  const startListening = useCallback(async (textoAtual = "") => {
    pararTodoAudio();
    if (!recognizerRef.current) return;
    setFinalTranscript(textoAtual);
    setInterimTranscript("");
    recognizerRef.current.start(textoAtual);
    await bargeInDetectorRef.current?.start(() => isSpeakingRef.current);
  }, [pararTodoAudio]);

  const stopListening = useCallback(() => {
    if (!recognizerRef.current) return;
    recognizerRef.current.stop();
  }, []);

  const cancelListening = useCallback(() => {
    pararTodoAudio();
    if (!recognizerRef.current) return;
    recognizerRef.current.abort();
    bargeInDetectorRef.current?.pause();
    setInterimTranscript("");
    setFinalTranscript("");
    setVoiceStatus("idle");
    setAudioLevel(0);
  }, [pararTodoAudio]);

  const resetTranscript = useCallback(() => {
    recognizerRef.current?.reset();
    setInterimTranscript("");
    setFinalTranscript("");
  }, []);

  /** Sintese de voz TTS humanizada, fluida e natural em portugues do Brasil */
  const speakResponse = useCallback(
    (
      entrada: string | { texto: string; cards?: any[] },
      cardsOrOnFinish?: any[] | (() => void),
      onFinishCallback?: () => void
    ) => {
      if (typeof window === "undefined" || !ttsEnabled) {
        if (typeof cardsOrOnFinish === "function") cardsOrOnFinish();
        else onFinishCallback?.();
        return;
      }

      let cards: any[] | undefined = undefined;
      let onFinish: (() => void) | undefined = undefined;

      if (typeof cardsOrOnFinish === "function") {
        onFinish = cardsOrOnFinish;
      } else if (Array.isArray(cardsOrOnFinish)) {
        cards = cardsOrOnFinish;
        onFinish = onFinishCallback;
      }

      if (typeof entrada !== "string" && entrada.cards) {
        cards = entrada.cards;
      }

      const textoCru = typeof entrada === "string" ? entrada : entrada.texto;
      // Garante que a fala seja enxuta, humana e considere os cards ricos (ex: agendamento proposto)
      const texto = humanizarRespostaParaVoz(textoCru, cards, isContinuousModeRef.current);
      if (!texto.trim()) {
        onFinish?.();
        return;
      }

      // Cancela fala anterior e suspende escuta imediatamente
      pararTodoAudio();
      isSpeakingRef.current = true;
      lastSpeakingEndTimeRef.current = 0;
      setIsSpeaking(true);

      // CRÍTICO: Pausa o microfone com abort() antes de reproduzir áudio pelo alto-falante
      recognizerRef.current?.pauseListening();
      setInterimTranscript("");

      // Registra no histórico de falas da IA para proteção anti-eco
      const textoNorm = texto.toLowerCase().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, "").trim();
      ultimasFalasJessiRef.current.push({ texto: textoNorm, timestamp: Date.now() });
      if (ultimasFalasJessiRef.current.length > 5) {
        ultimasFalasJessiRef.current.shift();
      }

      // Em desktop continuo, mantemos o detector de barge-in ativo
      if (isContinuousModeRef.current && !ehDispositivoMovel()) {
        bargeInDetectorRef.current?.resume();
      }

      const finalizarFala = () => {
        isSpeakingRef.current = false;
        lastSpeakingEndTimeRef.current = Date.now();
        setIsSpeaking(false);
        controladorFalaRef.current = null;
        onFinish?.();

        // Cooldown de 150ms para que o som do alto-falante se dissipe completamente antes de reabrir o microfone
        if (isContinuousModeRef.current) {
          setTimeout(() => {
            if (isContinuousModeRef.current && !isSpeakingRef.current) {
              recognizerRef.current?.reset();
              setInterimTranscript("");
              recognizerRef.current?.resumeListening();
            }
          }, 150);
        }
      };

      controladorFalaRef.current = reproduzirFalaHumana(texto, {
        ttsEnabled,
        onStart: () => {
          isSpeakingRef.current = true;
          lastSpeakingEndTimeRef.current = 0;
          setIsSpeaking(true);
          recognizerRef.current?.pauseListening();
        },
        onFinish: finalizarFala,
        onError: finalizarFala,
      });
    },
    [ttsEnabled, pararTodoAudio]
  );

  const falarResposta = useCallback(
    (texto: string) => {
      speakResponse(texto);
    },
    [speakResponse]
  );

  const pararFala = useCallback(() => {
    pararTodoAudio();
  }, [pararTodoAudio]);

  return {
    voiceStatus,
    isListening: voiceStatus === "listening" || voiceStatus === "transcribing" || voiceStatus === "requesting_permission",
    isContinuousMode,
    isReviewing: voiceStatus === "reviewing",
    interimTranscript,
    finalTranscript,
    isSpeaking,
    audioLevel,
    isInterrupted,
    ttsEnabled,
    setTtsEnabled,
    startListening,
    stopListening,
    startContinuousMode,
    stopContinuousMode,
    toggleContinuousMode,
    pauseListening,
    resumeListening,
    cancelListening,
    resetTranscript,
    speakResponse,
    falarResposta,
    pararFala,
    cancelVoice: pararTodoAudio,
  };
}