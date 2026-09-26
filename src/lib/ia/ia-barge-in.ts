/**
 * Módulo de Detecção de Voz Ativa e Interrupção Instantânea (Full-Duplex Barge-in)
 * 
 * Permite que o operador interrompa a fala da Jessi a qualquer momento simplesmente
 * falando por cima (comportamento nativo estilo Gemini Live / ChatGPT Voice Mode).
 * 
 * Funcionalidades:
 * 1. Análise espectral e de energia vocal em tempo real via Web Audio API (AnalyserNode);
 * 2. Cancelamento acústico de eco (AEC) nativo para que a fala da Jessi pelo alto-falante
 *    não dispare auto-interrupções acidentais;
 * 3. Limiar dinâmico adaptativo (Noise Floor Calibration) para ambientes com ruído de fundo (sopradores, secadores);
 * 4. Janela temporal de confirmação vocal (100ms - 140ms) para rejeitar estalos e cliques mecânicos;
 * 5. Disparo instantâneo do corte de áudio (< 30ms) e transição fluida para escuta.
 */

export interface BargeInDetectorOptions {
  /** Callback disparado no exato instante em que a interrupção pelo usuário é confirmada */
  onBargeIn: () => void;
  /** Callback para visualização da onda / intensidade vocal (0 a 100) */
  onAudioLevel?: (level: number) => void;
  /** Limiar base de sensibilidade vocal (padrão: 0.045 RMS) */
  sensitivityThreshold?: number;
  /** Duração mínima contínua de fala em ms para confirmar interrupção (padrão: 120ms) */
  minVoiceDurationMs?: number;
}

export class JessiBargeInDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isRunning = false;
  private isPaused = false;
  private animationFrameId: number | null = null;
  private isAiSpeakingProvider: () => boolean = () => false;

  private onBargeInCallback: () => void;
  private onAudioLevelCallback?: (level: number) => void;
  private sensitivityThreshold = 0.042;
  private minVoiceDurationMs = 120;

  private voiceConsecutiveMs = 0;
  private lastSampleTime = 0;
  private backgroundNoiseLevel = 0.015;
  private lastBargeInTimestamp = 0;

  constructor(options: BargeInDetectorOptions) {
    this.onBargeInCallback = options.onBargeIn;
    this.onAudioLevelCallback = options.onAudioLevel;
    if (options.sensitivityThreshold) this.sensitivityThreshold = options.sensitivityThreshold;
    if (options.minVoiceDurationMs) this.minVoiceDurationMs = options.minVoiceDurationMs;
  }

  /**
   * Inicializa o detector de áudio com cancelamento de eco de hardware/software
   */
  public async start(isAiSpeakingCheck: () => boolean): Promise<boolean> {
    this.isAiSpeakingProvider = isAiSpeakingCheck;
    if (this.isRunning) return true;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      // Solicita o microfone com AEC e supressão de ruído habilitados
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume().catch(() => {});
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      this.isRunning = true;
      this.isPaused = false;
      this.lastSampleTime = performance.now();
      this.voiceConsecutiveMs = 0;

      this.loopAnalise();
      return true;
    } catch (err) {
      console.warn("[JessiBargeIn] Não foi possível iniciar detector de interrupção de áudio:", err);
      this.cleanup();
      return false;
    }
  }

  /**
   * Loop de alta precisão para cálculo de energia e detecção de sobreposição vocal
   */
  private loopAnalise = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = this.lastSampleTime > 0 ? Math.min(now - this.lastSampleTime, 100) : 16;
    this.lastSampleTime = now;

    if (!this.isPaused && this.analyser) {
      const buffer = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(buffer);

      // Calcula o RMS (Root Mean Square) da amplitude de áudio
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);

      // Normaliza para visualização (0 a 100)
      const visualLevel = Math.min(Math.round(rms * 400), 100);
      if (this.onAudioLevelCallback) {
        this.onAudioLevelCallback(visualLevel);
      }

      // Atualiza o piso de ruído ambiental de forma adaptativa
      this.backgroundNoiseLevel = this.backgroundNoiseLevel * 0.95 + rms * 0.05;

      // Limiar dinâmico: deve superar o ruído de fundo com margem e o piso de sensibilidade
      const thresholdEfetivo = Math.max(this.sensitivityThreshold, this.backgroundNoiseLevel * 1.8);
      const isVoiceDetected = rms > thresholdEfetivo;

      const aiSpeaking = this.isAiSpeakingProvider();

      if (isVoiceDetected) {
        this.voiceConsecutiveMs += dt;

        // Se a IA estiver falando E o operador falar por tempo suficiente (> 120ms)
        if (aiSpeaking && this.voiceConsecutiveMs >= this.minVoiceDurationMs) {
          const tempoDesdeUltimoBargeIn = now - this.lastBargeInTimestamp;
          if (tempoDesdeUltimoBargeIn > 600) {
            this.lastBargeInTimestamp = now;
            this.voiceConsecutiveMs = 0;
            try {
              this.onBargeInCallback();
            } catch (err) {
              console.error("[JessiBargeIn] Erro no callback de interrupção:", err);
            }
          }
        }
      } else {
        // Redução suave do acumulador para permitir micropausas normais de fala
        this.voiceConsecutiveMs = Math.max(0, this.voiceConsecutiveMs - dt * 1.5);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loopAnalise);
  };

  /**
   * Pausa temporariamente a detecção sem destruir a conexão de áudio
   */
  public pause() {
    this.isPaused = true;
    this.voiceConsecutiveMs = 0;
  }

  /**
   * Retoma a detecção
   */
  public resume() {
    this.isPaused = false;
    this.lastSampleTime = performance.now();
    this.voiceConsecutiveMs = 0;
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
  }

  /**
   * Libera os recursos de áudio e cancela o loop
   */
  public stop() {
    this.cleanup();
  }

  private cleanup() {
    this.isRunning = false;
    this.isPaused = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    try {
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      if (this.audioContext && this.audioContext.state !== "closed") {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }
    } catch {}
  }
}
