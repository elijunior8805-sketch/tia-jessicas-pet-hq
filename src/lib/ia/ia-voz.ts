export type VoiceRecognitionStatus =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'finalizing'
  | 'reviewing'
  | 'error'
  | 'processing';

export interface VoiceRecognitionOptions {
  /** Chamado apenas com trechos FINAIS consolidados. */
  onFinal: (textoAcumulado: string) => void;
  /** Chamado com a transcrição provisória (apenas visual). */
  onInterim: (texto: string) => void;
  onStatusChange: (status: VoiceRecognitionStatus) => void;
  onError: (error: string) => void;
}

/** Remove repetições consecutivas de palavras/frases geradas pelo reconhecedor. */
export function consolidarTranscricao(texto: string): string {
  const limpo = (texto || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return '';

  const palavras = limpo.split(' ');
  const semRepeticaoSimples: string[] = [];
  for (const p of palavras) {
    const anterior = semRepeticaoSimples[semRepeticaoSimples.length - 1];
    if (anterior && anterior.toLowerCase() === p.toLowerCase()) continue;
    semRepeticaoSimples.push(p);
  }

  // Remove blocos duplicados (ex.: "agendar banho agendar banho")
  let resultado = semRepeticaoSimples.join(' ');
  for (let tamanho = Math.floor(semRepeticaoSimples.length / 2); tamanho >= 2; tamanho--) {
    const tokens = resultado.split(' ');
    for (let i = 0; i + tamanho * 2 <= tokens.length; i++) {
      const a = tokens.slice(i, i + tamanho).join(' ').toLowerCase();
      const b = tokens.slice(i + tamanho, i + tamanho * 2).join(' ').toLowerCase();
      if (a === b) {
        tokens.splice(i + tamanho, tamanho);
        resultado = tokens.join(' ');
        i--;
      }
    }
  }

  return resultado.trim();
}

/**
 * Reconhecedor de voz com estados estritos.
 * Regras: um único listener, uma gravação por vez, transcrição provisória nunca
 * dispara backend, e encerrar a gravação jamais apaga o texto capturado.
 */
export class VoiceRecognizer {
  private recognition: any = null;
  private status: VoiceRecognitionStatus = 'idle';
  private acumulado = '';
  private pararSolicitado = false;
  private iniciando = false;

  constructor(private options: VoiceRecognitionOptions) {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.options.onError('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-BR';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.iniciando = false;
      this.setStatus('listening');
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) final += ` ${result[0].transcript}`;
        else interim += ` ${result[0].transcript}`;
      }

      if (final.trim()) {
        this.acumulado = consolidarTranscricao(`${this.acumulado} ${final}`);
        this.options.onFinal(this.acumulado);
        this.options.onInterim('');
      }

      if (interim.trim() && this.status === 'listening') {
        this.options.onInterim(interim.trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      const err = event?.error;
      // Silêncio e abortos não são falhas: mantêm o texto e o ciclo.
      if (err === 'no-speech' || err === 'aborted') return;
      this.setStatus('error');
      this.options.onError(err || 'Erro no reconhecimento de voz.');
    };

    this.recognition.onend = () => {
      this.iniciando = false;

      // Reinício automático quando o navegador corta sozinho e o usuário não pediu parada.
      if (!this.pararSolicitado && this.status === 'listening') {
        try {
          this.recognition.start();
          return;
        } catch {
          /* segue para finalização */
        }
      }

      if (this.status === 'error') return;

      this.setStatus('finalizing');
      this.acumulado = consolidarTranscricao(this.acumulado);
      this.options.onInterim('');
      this.options.onFinal(this.acumulado);
      this.setStatus(this.acumulado ? 'reviewing' : 'idle');
      this.pararSolicitado = false;
    };
  }

  private setStatus(s: VoiceRecognitionStatus) {
    this.status = s;
    this.options.onStatusChange(s);
  }

  getStatus() {
    return this.status;
  }

  /** Inicia a captura preservando qualquer rascunho já revisado. */
  start(textoInicial = '') {
    if (!this.recognition) {
      this.options.onError('Reconhecimento de voz não suportado neste navegador.');
      return;
    }
    if (this.iniciando || this.status === 'listening' || this.status === 'requesting_permission') {
      return; // trava contra clique duplo / gravação simultânea
    }

    this.pararSolicitado = false;
    this.acumulado = consolidarTranscricao(textoInicial);
    this.iniciando = true;

    try {
      this.setStatus('requesting_permission');
      this.recognition.start();
    } catch {
      this.iniciando = false;
      // Já havia uma sessão ativa: apenas volta a escutar.
      this.setStatus('listening');
    }
  }

  /** Encerra a gravação e leva o texto para revisão (nunca apaga). */
  stop() {
    if (!this.recognition) return;
    this.pararSolicitado = true;
    if (this.status === 'listening' || this.status === 'requesting_permission') {
      this.setStatus('finalizing');
      try {
        this.recognition.stop();
      } catch {
        this.setStatus(this.acumulado ? 'reviewing' : 'idle');
      }
    }
  }

  /** Cancela e descarta o texto (ação explícita do usuário). */
  abort() {
    this.pararSolicitado = true;
    this.acumulado = '';
    try {
      this.recognition?.abort?.();
    } catch {
      /* ignore */
    }
    this.setStatus('idle');
  }

  reset() {
    this.acumulado = '';
  }
}
