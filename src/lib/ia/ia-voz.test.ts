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
});