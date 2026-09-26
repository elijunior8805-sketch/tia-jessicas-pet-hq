import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JessiInputBar } from "./JessiInputBar";

const baseProps = {
  inputText: "",
  setInputText: vi.fn(),
  onSend: vi.fn(),
  isLoading: false,
  voiceStatus: "idle" as const,
  isContinuousMode: false,
  onToggleContinuousVoice: vi.fn(),
  onCancelVoice: vi.fn(),
  interimTranscript: "",
  ttsEnabled: true,
  onToggleTts: vi.fn(),
  selectedFile: null,
  onSelectFile: vi.fn(),
  onRemoveFile: vi.fn(),
};

describe("JessiInputBar", () => {
  it("mantém o comando por microfone visível quando a voz está inativa", () => {
    render(<JessiInputBar {...baseProps} />);
    expect(screen.getByRole("button", { name: "Ativar comando por voz" })).toBeInTheDocument();
  });

  it("mostra a transcrição durante a escuta e permite interromper", () => {
    render(
      <JessiInputBar
        {...baseProps}
        voiceStatus="listening"
        isContinuousMode
        interimTranscript="marcar Belinha"
      />,
    );
    expect(screen.getByText("marcar Belinha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parar comando por voz" })).toBeInTheDocument();
  });
});
