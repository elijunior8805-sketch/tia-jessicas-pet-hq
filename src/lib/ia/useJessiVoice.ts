import { useState, useRef, useEffect, useCallback } from "react";
import { VoiceRecognizer, VoiceRecognitionStatus, consolidarTranscricao, falarTextoJessi, pararFalaJessi } from "./ia-voz";
import { toast } from "sonner";

export interface UseJessiVoiceReturn {
  voiceStatus: VoiceRecognitionStatus;
  isListening: boolean;
  isReviewing: boolean;
  interimTranscript: string;
  finalTranscript: string;
  isSpeaking: boolean;
  startListening: (textoAtual?: string) => void;
  stopListening: () => void;
  cancelListening: () => void;
  resetTranscript: () => void;
  falarResposta: (texto: string) => void;
  pararFala: () => void;
}

/**
 * Vocabulário específico do Spa para melhorar acurácia fonética
 */
const DICIONARIO_SPA: Record<string, string> = {
  "banho e tosa": "banho e tosa",
  "banho essencial": "banho essencial",
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
  "belinha": "Belinha",
  "cleusa": "Cleusa",
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognizerRef = useRef<VoiceRecognizer | null>(null);

  useEffect(() => {
    recognizerRef.current = new VoiceRecognizer({
      onFinal: (texto) => {
        const aperfeicoado = aperfeicoarTextoSpa(texto);
        setFinalTranscript(aperfeicoado);
        setInterimTranscript("");
        if (onTranscriptFinal) {
          onTranscriptFinal(aperfeicoado);
        }
      },
      onInterim: (texto) => {
        setInterimTranscript(texto);
      },
      onStatusChange: (status) => {
        setVoiceStatus(status);
      },
      onError: (erro) => {
        console.warn("[Jessi Voice Error]:", erro);
        if (erro === "not-allowed" || erro === "permission-denied") {
          toast.error("Permissão de microfone negada no navegador. Permita o acesso nas configurações do site.");
        } else if (erro === "no-speech") {
          // Apenas silêncio, não é erro crítico
        } else {
          toast.error(`Aviso no microfone: ${erro}`);
        }
      },
    });

    return () => {
      recognizerRef.current?.abort();
      pararFalaJessi();
    };
  }, [onTranscriptFinal]);

  const startListening = useCallback((textoAtual = "") => {
    pararFalaJessi();
    setIsSpeaking(false);
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
    if (!recognizerRef.current) return;
    recognizerRef.current.abort();
    setInterimTranscript("");
    setFinalTranscript("");
    setVoiceStatus("idle");
  }, []);

  const resetTranscript = useCallback(() => {
    recognizerRef.current?.reset();
    setInterimTranscript("");
    setFinalTranscript("");
  }, []);

  const falarResposta = useCallback((texto: string) => {
    setIsSpeaking(true);
    falarTextoJessi(texto, () => {
      setIsSpeaking(false);
    });
  }, []);

  const pararFala = useCallback(() => {
    pararFalaJessi();
    setIsSpeaking(false);
  }, []);

  return {
    voiceStatus,
    isListening: voiceStatus === "listening" || voiceStatus === "requesting_permission",
    isReviewing: voiceStatus === "reviewing",
    interimTranscript,
    finalTranscript,
    isSpeaking,
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
    falarResposta,
    pararFala,
  };
}

