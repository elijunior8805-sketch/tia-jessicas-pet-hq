/**
 * Desbloqueador de Áudio & Síntese de Voz para Dispositivos Móveis (iOS Safari & Android)
 * Garante que o navegador permita a reprodução de áudio e fala após respostas assíncronas de IA.
 */

let audioDesbloqueado = false;
let audioGlobalElement: HTMLAudioElement | null = null;

export function obterAudioGlobalElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioGlobalElement) {
    try {
      audioGlobalElement = new Audio();
      audioGlobalElement.preload = "auto";
    } catch {}
  }
  return audioGlobalElement;
}

export function desbloquearAudioMobile(): void {
  if (typeof window === "undefined") return;

  // 1. Desbloqueia Web SpeechSynthesis
  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.resume();
      if (!audioDesbloqueado) {
        // Toca um micro-utterance silencioso no primeiro toque do usuário
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0.01;
        u.rate = 2.0;
        window.speechSynthesis.speak(u);
      }
    } catch {}
  }

  // 2. Desbloqueia elemento HTML5 Audio
  try {
    const audio = obterAudioGlobalElement();
    if (audio && !audioDesbloqueado) {
      // 100ms de silêncio em base64 WAV para liberar permissão de autoplay no mobile
      audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      audio.volume = 0.01;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1.0;
        }).catch(() => {});
      }
    }
  } catch {}

  // 3. Desbloqueia Web AudioContext se disponível
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }
  } catch {}

  audioDesbloqueado = true;
}
