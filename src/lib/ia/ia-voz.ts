export type VoiceRecognitionStatus =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "transcribing"
  | "sending"
  | "processing"
  | "reviewing"
  | "error";

export interface VoiceUtterance {
  id: string;
  text: string;
  timestamp: number;
}

export interface VoiceRecognitionOptions {
  /** Chamado apenas com trechos FINAIS consolidados */
  onFinal: (textoAcumulado: string) => void;
  /** Chamado com a transcrição provisória (apenas visual, nunca enviada) */
  onInterim: (texto: string) => void;
  /** Disparado quando um comando de fala completo é finalizado por silêncio de 1.5s */
  onUtteranceComplete?: (utterance: VoiceUtterance) => void;
  onStatusChange: (status: VoiceRecognitionStatus) => void;
  onError: (error: string) => void;
  /** Silêncio em ms para envio automático (padrão 1500ms) */
  silenceMs?: number;
}

/** Remove repetições consecutivas de palavras/frases geradas pelo reconhecedor. */
export function consolidarTranscricao(texto: string): string {
  const limpo = (texto || "").replace(/\s+/g, " ").trim();
  if (!limpo) return "";

  const palavras = limpo.split(" ");
  const semRepeticaoSimples: string[] = [];
  for (const p of palavras) {
    const anterior = semRepeticaoSimples[semRepeticaoSimples.length - 1];
    if (anterior && anterior.toLowerCase() === p.toLowerCase()) continue;
    semRepeticaoSimples.push(p);
  }

  // Remove blocos duplicados (ex.: "agendar banho agendar banho")
  let resultado = semRepeticaoSimples.join(" ");
  for (let tamanho = Math.floor(semRepeticaoSimples.length / 2); tamanho >= 2; tamanho--) {
    const tokens = resultado.split(" ");
    for (let i = 0; i + tamanho * 2 <= tokens.length; i++) {
      const a = tokens.slice(i, i + tamanho).join(" ").toLowerCase();
      const b = tokens.slice(i + tamanho, i + tamanho * 2).join(" ").toLowerCase();
      if (a === b) {
        tokens.splice(i + tamanho, tamanho);
        resultado = tokens.join(" ");
        i--;
      }
    }
  }

  return resultado.trim();
}

/** Valida se a transcrição contém fala real inteligível (descarta ruídos e estalos) */
export function ehFalaValida(texto: string): boolean {
  const limpo = texto.trim();
  if (!limpo || limpo.length < 2) return false;
  // Deve conter pelo menos 2 letras alfanuméricas
  const letras = limpo.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "");
  return letras.length >= 2;
}

/**
 * Reconhecedor de Voz Contínuo da Jessi V2 (Web Speech API)
 * Suporta escuta perpétua pós-ativação, detecção de silêncio de 1.5s,
 * pausa durante resposta e auto-reconecção segura.
 */
export class VoiceRecognizer {
  private recognition: any = null;
  private status: VoiceRecognitionStatus = "idle";
  private acumulado = "";
  private interimAtual = "";
  private isContinuous = false;
  private isPaused = false;
  private pararSolicitado = false;
  private iniciando = false;
  private silenceTimer: any = null;
  private silenceMs = 1500;
  private ultimaFalaEnviada = "";
  private ultimoEnvioTimestamp = 0;
  private reconnectAttempts = 0;
  private lastReconnectTime = 0;

  constructor(private options: VoiceRecognitionOptions) {
    this.silenceMs = options.silenceMs ?? 1500;
  }

  private initRecognition(): boolean {
    if (this.recognition) return true;
    if (typeof window === "undefined") return false;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.options.onError("Reconhecimento de voz não suportado neste navegador.");
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "pt-BR";
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.iniciando = false;
        this.reconnectAttempts = 0;
        this.setStatus("listening");
      };

      this.recognition.onspeechstart = () => {
        if (!this.isPaused && this.status === "listening") {
          this.setStatus("transcribing");
        }
      };

      this.recognition.onresult = (event: any) => {
        if (this.isPaused) return;

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            final += ` ${result[0].transcript}`;
          } else {
            interim += ` ${result[0].transcript}`;
          }
        }

        if (final.trim()) {
          this.reconnectAttempts = 0;
          this.acumulado = consolidarTranscricao(`${this.acumulado} ${final}`);
          this.interimAtual = "";
          this.options.onFinal(this.acumulado);
          this.options.onInterim("");
        }

        if (interim.trim()) {
          this.reconnectAttempts = 0;
          this.interimAtual = interim.trim();
          this.setStatus("transcribing");
          this.options.onInterim(this.interimAtual);
        }

        // Reinicia o timer de silêncio de 1.5s após qualquer trecho falado
        this.agendarDisparoSilencio();
      };

      this.recognition.onerror = (event: any) => {
        this.iniciando = false;
        const err = event?.error;

        // Silêncio e abortos intencionais não são erros fatais
        if (err === "no-speech" || err === "aborted") {
          return;
        }

        console.warn("[VoiceRecognizer] Aviso no microfone:", err);
        if (err === "not-allowed" || err === "service-not-allowed") {
          this.isContinuous = false;
          this.setStatus("error");
          this.options.onError(err);
          return;
        }

        // Erro não fatal transitório (ex: network glitch temporário)
        if (this.isContinuous && !this.pararSolicitado && !this.isPaused) {
          setTimeout(() => {
            this.tentarReconectar();
          }, 600);
        } else {
          this.setStatus("error");
          this.options.onError(err || "Erro no reconhecimento de voz.");
        }
      };

      this.recognition.onend = () => {
        this.iniciando = false;

        // Se o modo contínuo estiver ativo e não foi solicitada parada manual nem pausa
        if (this.isContinuous && !this.pararSolicitado && !this.isPaused) {
          this.tentarReconectar();
          return;
        }

        if (this.status === "error") return;

        if (this.acumulado.trim()) {
          this.acumulado = consolidarTranscricao(this.acumulado);
          this.options.onInterim("");
          this.options.onFinal(this.acumulado);
          this.setStatus("reviewing");
        } else {
          this.setStatus("idle");
        }
        this.pararSolicitado = false;
      };

      return true;
    } catch (e: any) {
      console.warn("[VoiceRecognizer] Erro ao instanciar SpeechRecognition:", e);
      this.options.onError("Falha ao inicializar o microfone no navegador.");
      return false;
    }
  }

  private setStatus(s: VoiceRecognitionStatus) {
    if (this.status !== s) {
      this.status = s;
      this.options.onStatusChange(s);
    }
  }

  private agendarDisparoSilencio() {
    this.limparTimerSilencio();

    // Se houver fala acumulada ou interim ativo, conta 1.5s de silêncio
    this.silenceTimer = setTimeout(() => {
      this.processarSilencioDetectado();
    }, this.silenceMs);
  }

  private limparTimerSilencio() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private processarSilencioDetectado() {
    const textoCompleto = consolidarTranscricao(`${this.acumulado} ${this.interimAtual}`);

    if (!ehFalaValida(textoCompleto)) {
      // Fala vazia ou ruído descartado
      this.interimAtual = "";
      this.options.onInterim("");
      if (this.isContinuous && !this.isPaused) {
        this.setStatus("listening");
      }
      return;
    }

    const agora = Date.now();
    // Proteção rigorosa contra envio duplicado da mesma frase em janela curta (< 2s)
    if (
      this.ultimaFalaEnviada.toLowerCase() === textoCompleto.toLowerCase() &&
      agora - this.ultimoEnvioTimestamp < 2500
    ) {
      return;
    }

    const utteranceId = `fala_${agora}_${Math.random().toString(36).substring(2, 7)}`;
    this.ultimaFalaEnviada = textoCompleto;
    this.ultimoEnvioTimestamp = agora;

    // Notifica conclusão do comando de voz
    if (this.options.onUtteranceComplete) {
      this.setStatus("sending");
      this.options.onUtteranceComplete({
        id: utteranceId,
        text: textoCompleto,
        timestamp: agora,
      });
    }

    // Limpa os buffers locais de texto para a próxima fala
    this.acumulado = "";
    this.interimAtual = "";
    this.options.onInterim("");
  }

  private tentarReconectar() {
    const agora = Date.now();
    if (agora - this.lastReconnectTime > 5000) {
      this.reconnectAttempts = 0;
    }
    this.lastReconnectTime = agora;
    this.reconnectAttempts++;

    // Prevenção de loop infinito de reconexão
    if (this.reconnectAttempts > 8) {
      console.warn("[VoiceRecognizer] Limite de reconexões atingido.");
      this.isContinuous = false;
      this.setStatus("idle");
      this.options.onError("Muitas desconexões seguidas no microfone. Clique no microfone para reativar.");
      return;
    }

    const delay = this.reconnectAttempts > 3 ? 400 : 80;
    setTimeout(() => {
      if (this.isContinuous && !this.pararSolicitado && !this.isPaused) {
        try {
          this.recognition?.start();
        } catch {
          /* Já está ativo ou em transição */
        }
      }
    }, delay);
  }

  getStatus() {
    return this.status;
  }

  getIsContinuous() {
    return this.isContinuous;
  }

  /** Ativa o Modo Contínuo de Voz com uma única permissão do usuário */
  startContinuous(textoInicial = "") {
    if (!this.initRecognition()) return;

    this.isContinuous = true;
    this.isPaused = false;
    this.pararSolicitado = false;
    this.acumulado = consolidarTranscricao(textoInicial);
    this.interimAtual = "";
    this.reconnectAttempts = 0;

    try {
      this.setStatus("requesting_permission");
      this.recognition.start();
    } catch {
      this.setStatus("listening");
    }
  }

  /** Desativa o Modo Contínuo e encerra o hardware de áudio */
  stopContinuous() {
    this.isContinuous = false;
    this.isPaused = false;
    this.pararSolicitado = true;
    this.limparTimerSilencio();

    try {
      this.recognition?.stop();
    } catch {
      /* ignore */
    }
    this.setStatus("idle");
  }

  /** Pausa o microfone enquanto a Jessi está gerando resposta ou falando TTS */
  pauseListening() {
    this.isPaused = true;
    this.limparTimerSilencio();
    try {
      this.recognition?.stop();
    } catch {
      /* ignore */
    }
    this.setStatus("processing");
  }

  /** Retoma automaticamente a escuta após a resposta da Jessi */
  resumeListening() {
    if (!this.isContinuous) return;

    this.isPaused = false;
    this.pararSolicitado = false;
    this.acumulado = "";
    this.interimAtual = "";
    this.limparTimerSilencio();

    try {
      this.setStatus("listening");
      this.recognition?.start();
    } catch {
      // Já está em escuta ou inicializando
    }
  }

  /** Inicia captura pontual (modo manual legado) */
  start(textoInicial = "") {
    if (!this.initRecognition()) return;
    if (this.iniciando || this.status === "listening" || this.status === "requesting_permission") return;

    this.isContinuous = false;
    this.isPaused = false;
    this.pararSolicitado = false;
    this.acumulado = consolidarTranscricao(textoInicial);
    this.interimAtual = "";
    this.iniciando = true;

    try {
      this.setStatus("requesting_permission");
      this.recognition.start();
    } catch {
      this.iniciando = false;
      this.setStatus("listening");
    }
  }

  /** Encerra a gravação pontual */
  stop() {
    this.limparTimerSilencio();
    this.pararSolicitado = true;
    if (this.interimAtual) {
      this.acumulado = consolidarTranscricao(`${this.acumulado} ${this.interimAtual}`);
      this.interimAtual = "";
      this.options.onInterim("");
      this.options.onFinal(this.acumulado);
    }
    try {
      this.recognition?.stop();
    } catch {
      this.setStatus(this.acumulado ? "reviewing" : "idle");
    }
  }

  /** Aborta a gravação e descarta texto */
  abort() {
    this.isContinuous = false;
    this.isPaused = false;
    this.pararSolicitado = true;
    this.limparTimerSilencio();
    this.acumulado = "";
    this.interimAtual = "";
    try {
      this.recognition?.abort?.();
    } catch {
      /* ignore */
    }
    this.setStatus("idle");
  }

  reset() {
    this.limparTimerSilencio();
    this.acumulado = "";
    this.interimAtual = "";
  }
}
