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

import { humanizarTextoParaVoz, obterMelhorVozPtBr, segmentarEmFrases } from "./ia-voz-tts";

describe("Síntese de Voz Humanizada (TTS)", () => {
  it("converte valores monetários para pronúncia falada natural", () => {
    expect(humanizarTextoParaVoz("O banho simples custa R$ 75,00")).toBe("O banho simples custa 75 reais.");
    expect(humanizarTextoParaVoz("Total de R$ 120,50 a receber")).toBe("Total de 120 reais e 50 centavos a receber.");
    expect(humanizarTextoParaVoz("Faturamento de R$ 1.500")).toBe("Faturamento de 1500 reais.");
  });

  it("converte horários e datas para prosódia fluida", () => {
    expect(humanizarTextoParaVoz("Agendado para 14:30")).toBe("Agendado para 14 e meia.");
    expect(humanizarTextoParaVoz("Próximo cliente às 09:00")).toBe("Próximo cliente às 09 horas.");
    expect(humanizarTextoParaVoz("Data do atendimento: 12/09")).toBe("Data do atendimento: 12 de setembro.");
  });

  it("remove emojis e formatações markdown para não engasgar a leitura", () => {
    const markdownComEmoji = "🐶 Olá, Eli! ✨ Temos **3 agendamentos** para hoje: \n- Banho do Rex às 10h\n- Tosa do Thor às 14h";
    const textoFalado = humanizarTextoParaVoz(markdownComEmoji);
    expect(textoFalado).not.toContain("🐶");
    expect(textoFalado).not.toContain("✨");
    expect(textoFalado).not.toContain("**");
    expect(textoFalado).toContain("3 agendamentos");
  });

  it("seleciona a voz neural/natural mais expressiva do navegador", () => {
    const mockVoices = [
      { name: "Microsoft Maria Desktop - Portuguese(Brazil)", lang: "pt-BR" } as SpeechSynthesisVoice,
      { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" } as SpeechSynthesisVoice,
      { name: "English Voice", lang: "en-US" } as SpeechSynthesisVoice,
    ];

    const melhorVoz = obterMelhorVozPtBr(mockVoices);
    expect(melhorVoz?.name).toContain("Francisca");
  });

  it("segmenta textos em frases para cadência de respiração", () => {
    const frases = segmentarEmFrases("Olá, Eli! Preparei a sua agenda. Temos 4 atendimentos hoje.");
    expect(frases.length).toBe(3);
    expect(frases[0]).toBe("Olá, Eli!");
    expect(frases[1]).toBe("Preparei a sua agenda.");
    expect(frases[2]).toBe("Temos 4 atendimentos hoje.");
  });
});