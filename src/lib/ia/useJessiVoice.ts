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
import { toast } from "sonner";

export interface UseJessiVoiceReturn {
  voiceStatus: VoiceRecognitionStatus;
  isListening: boolean;
  isContinuousMode: boolean;
  isReviewing: boolean;
  interimTranscript: string;
  finalTranscript: string;
  isSpeaking: boolean;
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
  speakResponse: (entrada: string | { texto: string }, onFinish?: () => void) => void;
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

export function useJessiVoice(
  onTranscriptFinal?: (texto: string) => void,
  onAutoSend?: (texto: string) => void
): UseJessiVoiceReturn {
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>("idle");
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const onTranscriptFinalRef = useRef(onTranscriptFinal);
  const onAutoSendRef = useRef(onAutoSend);
  const isSpeakingRef = useRef(false);
  const controladorFalaRef = useRef<ControladorFala | null>(null);

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

  useEffect(() => {
    onTranscriptFinalRef.current = onTranscriptFinal;
  }, [onTranscriptFinal]);

  useEffect(() => {
    onAutoSendRef.current = onAutoSend;
  }, [onAutoSend]);

  useEffect(() => {
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
      silenceMs: 1500, // 1.5s de silencio para envio natural sem interrupcoes precoces
      onFinal: (texto) => {
        const humanizado = humanizarTranscricao(texto);
        setFinalTranscript(humanizado);
        setInterimTranscript("");
        if (onTranscriptFinalRef.current) {
          onTranscriptFinalRef.current(humanizado);
        }
      },
      onInterim: (texto) => {
        setInterimTranscript(texto);
      },
      onUtteranceComplete: (utterance: VoiceUtterance) => {
        const textoHumanizado = humanizarTranscricao(utterance.text);
        if (ehFalaValida(textoHumanizado) && onAutoSendRef.current) {
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
          toast.error("Permissão de microfone negada. Clique no ícone de cadeado do navegador para permitir o microfone.");
        } else if (erro === "no-speech") {
          // Silencio momentaneo regular
        } else if (erro === "network") {
          toast.error("Reconhecimento de voz offline ou instável. Verifique sua conexão de rede.");
        } else if (erro === "audio-capture") {
          toast.error("Nenhum microfone detectado ou o dispositivo de áudio está ocupado.");
        } else if (erro === "service-not-allowed") {
          toast.error("Reconhecimento de voz bloqueado pelo navegador.");
        }
      },
    });

    return () => {
      pararTodoAudio();
      recognizerRef.current?.abort();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, [pararTodoAudio]);

  const startContinuousMode = useCallback(() => {
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
    toast.success("Modo Voz Contínuo Ativo! Fale seus comandos naturalmente.");
  }, []);

  const stopContinuousMode = useCallback(() => {
    setIsContinuousMode(false);
    pararTodoAudio();
    recognizerRef.current?.stopContinuous();
    setInterimTranscript("");
    setFinalTranscript("");
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
  }, []);

  const resumeListening = useCallback(() => {
    if (isContinuousMode && !isSpeakingRef.current) {
      recognizerRef.current?.resumeListening();
    }
  }, [isContinuousMode]);

  const startListening = useCallback((textoAtual = "") => {
    pararTodoAudio();
    if (!recognizerRef.current) return;
    setFinalTranscript(textoAtual);
    setInterimTranscript("");
    recognizerRef.current.start(textoAtual);
  }, [pararTodoAudio]);

  const stopListening = useCallback(() => {
    if (!recognizerRef.current) return;
    recognizerRef.current.stop();
  }, []);

  const cancelListening = useCallback(() => {
    pararTodoAudio();
    if (!recognizerRef.current) return;
    recognizerRef.current.abort();
    setInterimTranscript("");
    setFinalTranscript("");
    setVoiceStatus("idle");
  }, [pararTodoAudio]);

  const resetTranscript = useCallback(() => {
    recognizerRef.current?.reset();
    setInterimTranscript("");
    setFinalTranscript("");
  }, []);

  /** Sintese de voz TTS humanizada, fluida e natural em portugues do Brasil */
  const speakResponse = useCallback(
    (entrada: string | { texto: string }, onFinish?: () => void) => {
      if (typeof window === "undefined" || !ttsEnabled) {
        onFinish?.();
        return;
      }

      const texto = typeof entrada === "string" ? entrada : entrada.texto;

      // Cancela fala anterior se ainda estiver em andamento
      pararTodoAudio();
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      pauseListening();

      const finalizarFala = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        controladorFalaRef.current = null;
        onFinish?.();
        if (isContinuousMode) {
          resumeListening();
        }
      };

      controladorFalaRef.current = reproduzirFalaHumana(texto, {
        ttsEnabled,
        onStart: () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        },
        onFinish: finalizarFala,
        onError: finalizarFala,
      });
    },
    [ttsEnabled, isContinuousMode, pauseListening, resumeListening, pararTodoAudio]
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
  };
}