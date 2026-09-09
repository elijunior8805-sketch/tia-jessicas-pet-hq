import { useState, useRef, useEffect, useCallback } from "react";
import { VoiceRecognizer, VoiceRecognitionStatus, consolidarTranscricao } from "./ia-voz";
import { toast } from "sonner";

export interface UseJessiVoiceReturn {
  voiceStatus: VoiceRecognitionStatus;
  isListening: boolean;
  isReviewing: boolean;
  interimTranscript: string;
  finalTranscript: string;
  startListening: (textoAtual?: string) => void;
  stopListening: () => void;
  cancelListening: () => void;
  resetTranscript: () => void;
}

/**
 * Vocabulário específico do Spa para melhorar acurácia fonética
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

function aperfeicoarTextoSpa(texto: string): string {
  let corrigido = texto;
  for (const [termo, substituicao] of Object.entries(DICIONARIO_SPA)) {
    const regex = new RegExp(`\\b${termo}\\b`, "gi");
    corrigido = corrigido.replace(regex, substituicao);
  }
  return corrigido;
}

export function useJessiVoice(onTranscriptFinal?: (texto: string) => void): UseJessiVoiceReturn {
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const onTranscriptFinalRef = useRef(onTranscriptFinal);
  const silenceTimerRef = useRef<any>(null);

  // Mantém a ref sempre atualizada sem disparar re-render do useEffect
  useEffect(() => {
    onTranscriptFinalRef.current = onTranscriptFinal;
  }, [onTranscriptFinal]);

  const limparTimerSilencio = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const reiniciarTimerSilencio = useCallback((ms = 2200) => {
    limparTimerSilencio();
    silenceTimerRef.current = setTimeout(() => {
      if (recognizerRef.current && (recognizerRef.current.getStatus() === "listening" || recognizerRef.current.getStatus() === "requesting_permission")) {
        recognizerRef.current.stop();
      }
    }, ms);
  }, [limparTimerSilencio]);

  useEffect(() => {
    recognizerRef.current = new VoiceRecognizer({
      onFinal: (texto) => {
        const aperfeicoado = aperfeicoarTextoSpa(texto);
        setFinalTranscript(aperfeicoado);
        setInterimTranscript("");
        if (onTranscriptFinalRef.current) {
          onTranscriptFinalRef.current(aperfeicoado);
        }
        // Quando uma frase final for detectada, aguarda 2s de silêncio para concluir automaticamente
        reiniciarTimerSilencio(2200);
      },
      onInterim: (texto) => {
        setInterimTranscript(texto);
        // Enquanto o usuário está falando, reinicia o contador
        reiniciarTimerSilencio(3500);
      },
      onStatusChange: (status) => {
        setVoiceStatus(status);
        if (status === "idle" || status === "error" || status === "reviewing") {
          limparTimerSilencio();
        }
      },
      onError: (erro) => {
        limparTimerSilencio();
        console.warn("[Jessi Voice Error]:", erro);
        if (erro === "not-allowed" || erro === "permission-denied") {
          toast.error("Permissão de microfone negada. Clique no ícone de cadeado/permissões no navegador e permita o microfone.");
        } else if (erro === "no-speech") {
          // Apenas silêncio momentâneo, não exibir erro ao usuário
        } else if (erro === "network") {
          toast.error("Serviço de voz indisponível na prévia integrada. Abra o sistema em uma aba do Google Chrome ou Edge para usar o microfone.");
        } else if (erro === "audio-capture") {
          toast.error("Nenhum microfone detectado no dispositivo ou ele está em uso.");
        } else if (erro === "service-not-allowed") {
          toast.error("Reconhecimento de voz bloqueado nesta janela. Abra diretamente no navegador Chrome/Edge.");
        } else {
          toast.error(`Aviso no microfone: ${erro}`);
        }
      },
    });

    return () => {
      limparTimerSilencio();
      recognizerRef.current?.abort();
    };
  }, [reiniciarTimerSilencio, limparTimerSilencio]);

  const startListening = useCallback((textoAtual = "") => {
    if (!recognizerRef.current) return;
    setFinalTranscript(textoAtual);
    setInterimTranscript("");
    recognizerRef.current.start(textoAtual);
    // Timeout inicial de 8s se não houver nenhuma fala
    reiniciarTimerSilencio(8000);
  }, [reiniciarTimerSilencio]);

  const stopListening = useCallback(() => {
    limparTimerSilencio();
    if (!recognizerRef.current) return;
    recognizerRef.current.stop();
  }, [limparTimerSilencio]);

  const cancelListening = useCallback(() => {
    limparTimerSilencio();
    if (!recognizerRef.current) return;
    recognizerRef.current.abort();
    setInterimTranscript("");
    setFinalTranscript("");
    setVoiceStatus("idle");
  }, [limparTimerSilencio]);

  const resetTranscript = useCallback(() => {
    limparTimerSilencio();
    recognizerRef.current?.reset();
    setInterimTranscript("");
    setFinalTranscript("");
  }, [limparTimerSilencio]);

  return {
    voiceStatus,
    isListening: voiceStatus === "listening" || voiceStatus === "requesting_permission",
    isReviewing: voiceStatus === "reviewing",
    interimTranscript,
    finalTranscript,
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
  };
}
