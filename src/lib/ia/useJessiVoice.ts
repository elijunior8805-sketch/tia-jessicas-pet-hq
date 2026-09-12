import { useState, useRef, useEffect, useCallback } from "react";
import {
  VoiceRecognizer,
  VoiceRecognitionStatus,
  VoiceUtterance,
  consolidarTranscricao,
  ehFalaValida,
} from "./ia-voz";
import { reproduzirFalaHumana, ControladorFala } from "./ia-voz-tts";
import { toast } from "sonner";

export interface UseJessiVoiceReturn {
  voiceStatus: VoiceRecognitionStatus;
  isListening: boolean;
  isContinuousMode: boolean;
  isReviewing: boolean;
  interimTranscript: string;
  finalTranscript: string;
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
  speakResponse: (texto: string, onFinish?: () => void) => void;
}

/**
 * Vocabulário específico do Spa para calibrar acurácia fonética em pt-BR
 */
const DICIONARIO_SPA: Record<string, string> = {
  "banho e tosa": "banho e tosa",
  "tosa higiênica": "tosa higiênica",
  "tosa higienica": "tosa higiênica",
  "banho simples": "banho simples",
  "banho premium": "banho premium",
  "hidratação": "hidratação",
  "hidratacao": "hidratação",
  "leva e traz": "leva e traz",
  "leva traz": "leva e traz",
  "eli junior": "Eli Júnior",
  "eli júnior": "Eli Júnior",
  "eli jr": "Eli Júnior",
  "thor": "Thor",
  "tor": "Thor",
  "rex": "Rex",
  "pix": "Pix",
  "débito": "débito",
  "crédito": "crédito",
  "comprovante": "comprovante",
  "agendar": "agendar",
  "reagendar": "reagendar",
  "remarcar": "remarcar",
  "cancelar": "cancelar",
  "faturamento": "faturamento",
};

export function aperfeicoarTextoSpa(texto: string): string {
  let corrigido = texto;
  for (const [termo, substituicao] of Object.entries(DICIONARIO_SPA)) {
    const regex = new RegExp(`\\b${termo}\\b`, "gi");
    corrigido = corrigido.replace(regex, substituicao);
  }
  return corrigido;
}

export function useJessiVoice(
  onTranscriptFinal?: (texto: string) => void,
  onAutoSend?: (texto: string) => void
): UseJessiVoiceReturn {
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>("idle");
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const onTranscriptFinalRef = useRef(onTranscriptFinal);
  const onAutoSendRef = useRef(onAutoSend);
  const isSpeakingRef = useRef(false);
  const controladorFalaRef = useRef<ControladorFala | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const pararTodoAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    controladorFalaRef.current?.cancelar();
    isSpeakingRef.current = false;
  }, []);

  useEffect(() => {
    onTranscriptFinalRef.current = onTranscriptFinal;
  }, [onTranscriptFinal]);

  useEffect(() => {
    onAutoSendRef.current = onAutoSend;
  }, [onAutoSend]);

  useEffect(() => {
    // Pré-carrega vozes do navegador para disponibilidade imediata
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    recognizerRef.current = new VoiceRecognizer({
      silenceMs: 1500, // 1.5s de silêncio para envio automático
      onFinal: (texto) => {
        const aperfeicoado = aperfeicoarTextoSpa(texto);
        setFinalTranscript(aperfeicoado);
        setInterimTranscript("");
        if (onTranscriptFinalRef.current) {
          onTranscriptFinalRef.current(aperfeicoado);
        }
      },
      onInterim: (texto) => {
        setInterimTranscript(texto);
      },
      onUtteranceComplete: (utterance: VoiceUtterance) => {
        const textoAperfeicoado = aperfeicoarTextoSpa(utterance.text).trim();
        if (ehFalaValida(textoAperfeicoado) && onAutoSendRef.current) {
          // Pausa temporariamente o microfone e interrompe qualquer áudio/fala anterior
          pararTodoAudio();
          recognizerRef.current?.pauseListening();
          setInterimTranscript("");
          setFinalTranscript(textoAperfeicoado);
          onAutoSendRef.current(textoAperfeicoado);
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
          // Silêncio momentâneo regular
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
        window.speechSynthesis.cancel();
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
      // Desbloqueia contexto de áudio em navegadores móveis (iOS/Android)
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
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
    if (!recognizerRef.current) return;
    setFinalTranscript(textoAtual);
    setInterimTranscript("");
    recognizerRef.current.start(textoAtual);
  }, []);

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

  /** Síntese de voz TTS ultra-humanizada e natural (Neural Cloud + Fallback Nativo) */
  const speakResponse = useCallback(
    async (texto: string, onFinish?: () => void) => {
      if (typeof window === "undefined" || !ttsEnabled) {
        onFinish?.();
        return;
      }

      // Cancela qualquer reprodução de áudio anterior imediatamente
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current = null;
      }
      controladorFalaRef.current?.cancelar();
      isSpeakingRef.current = true;
      pauseListening();

      const finalizarFala = () => {
        isSpeakingRef.current = false;
        controladorFalaRef.current = null;
        if (audioElementRef.current) {
          audioElementRef.current = null;
        }
        onFinish?.();
        if (isContinuousMode) {
          resumeListening();
        }
      };

      // 1. Tenta carregar áudio neural de altíssima definição (estúdio/humano)
      try {
        const textoCacheKey = texto.trim().slice(0, 300);
        let audioDataUrl = audioCacheRef.current.get(textoCacheKey);

        if (!audioDataUrl) {
          const { gerarAudioNeuralJessiFn } = await import("./ia-voz.functions");
          const res = await gerarAudioNeuralJessiFn({ data: { texto } });
          if (res?.audioDataUrl) {
            audioDataUrl = res.audioDataUrl;
            audioCacheRef.current.set(textoCacheKey, audioDataUrl);
          }
        }

        if (audioDataUrl && isSpeakingRef.current) {
          const audio = new Audio(audioDataUrl);
          audioElementRef.current = audio;
          audio.playbackRate = 1.0;

          audio.onended = () => {
            finalizarFala();
          };

          audio.onerror = () => {
            console.warn("[Neural Audio Player]: Falha ao tocar áudio, usando fallback");
            executarFallbackSintese(texto, finalizarFala);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("[Neural TTS]: Fallback para sintetizador local:", err);
      }

      // 2. Fallback fluído para o sintetizador neural do navegador
      executarFallbackSintese(texto, finalizarFala);
    },
    [ttsEnabled, isContinuousMode, pauseListening, resumeListening]
  );

  const executarFallbackSintese = (texto: string, onConcluir: () => void) => {
    controladorFalaRef.current = reproduzirFalaHumana(texto, {
      ttsEnabled,
      onStart: () => {
        isSpeakingRef.current = true;
      },
      onFinish: onConcluir,
      onError: onConcluir,
    });
  };

  return {
    voiceStatus,
    isListening: voiceStatus === "listening" || voiceStatus === "transcribing" || voiceStatus === "requesting_permission",
    isContinuousMode,
    isReviewing: voiceStatus === "reviewing",
    interimTranscript,
    finalTranscript,
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
  };
}
