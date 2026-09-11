import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceRecognizer } from "./ia-voz";

class SpeechRecognitionMock {
  static instance: SpeechRecognitionMock;
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart?: () => void;
  onresult?: (event: unknown) => void;
  onerror?: (event: unknown) => void;
  onend?: () => void;

  constructor() {
    SpeechRecognitionMock.instance = this;
  }

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }

  abort() {}

  emitInterim(text: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: text } }],
    });
  }
}

describe("VoiceRecognizer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (window as any).SpeechRecognition = SpeechRecognitionMock;
  });

  it("preserva a frase provisória quando a fala é concluída manualmente", () => {
    const onFinal = vi.fn();
    const recognizer = new VoiceRecognizer({
      onFinal,
      onInterim: vi.fn(),
      onStatusChange: vi.fn(),
      onError: vi.fn(),
    });

    recognizer.start();
    SpeechRecognitionMock.instance.emitInterim("como está meu financeiro hoje");
    recognizer.stop();

    expect(onFinal).toHaveBeenLastCalledWith("como está meu financeiro hoje");
    expect(recognizer.getStatus()).toBe("reviewing");
  });

  it("dispara onUtteranceComplete automaticamente após 1.5s de silêncio no modo contínuo", () => {
    const onUtteranceComplete = vi.fn();
    const recognizer = new VoiceRecognizer({
      onFinal: vi.fn(),
      onInterim: vi.fn(),
      onUtteranceComplete,
      onStatusChange: vi.fn(),
      onError: vi.fn(),
      silenceMs: 1500,
    });

    recognizer.startContinuous();
    expect(recognizer.getIsContinuous()).toBe(true);

    // Usuário fala
    SpeechRecognitionMock.instance.emitInterim("consultar agenda de hoje");
    expect(onUtteranceComplete).not.toHaveBeenCalled();

    // Passam-se 1.5s de silêncio
    vi.advanceTimersByTime(1500);

    expect(onUtteranceComplete).toHaveBeenCalledTimes(1);
    expect(onUtteranceComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "consultar agenda de hoje",
      })
    );
  });

  it("ignora ruídos de 1 caractere ou vazios no envio automático", () => {
    const onUtteranceComplete = vi.fn();
    const recognizer = new VoiceRecognizer({
      onFinal: vi.fn(),
      onInterim: vi.fn(),
      onUtteranceComplete,
      onStatusChange: vi.fn(),
      onError: vi.fn(),
      silenceMs: 1500,
    });

    recognizer.startContinuous();
    SpeechRecognitionMock.instance.emitInterim(".");
    vi.advanceTimersByTime(1500);

    expect(onUtteranceComplete).not.toHaveBeenCalled();
  });

  it("pausa e retoma a escuta durante o ciclo de resposta", () => {
    const recognizer = new VoiceRecognizer({
      onFinal: vi.fn(),
      onInterim: vi.fn(),
      onStatusChange: vi.fn(),
      onError: vi.fn(),
    });

    recognizer.startContinuous();
    expect(recognizer.getStatus()).toBe("listening");

    recognizer.pauseListening();
    expect(recognizer.getStatus()).toBe("processing");

    recognizer.resumeListening();
    expect(recognizer.getStatus()).toBe("listening");
  });
});