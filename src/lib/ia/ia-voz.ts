
export type VoiceRecognitionStatus = 'idle' | 'requesting_permission' | 'listening' | 'reviewing' | 'error';

export interface VoiceRecognitionOptions {
  onResult: (text: string, isFinal: boolean) => void;
  onStatusChange: (status: VoiceRecognitionStatus) => void;
  onError: (error: string) => void;
}

export class VoiceRecognizer {
  private recognition: any = null;
  private status: VoiceRecognitionStatus = 'idle';

  constructor(private options: VoiceRecognitionOptions) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
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
      this.status = 'listening';
      this.options.onStatusChange(this.status);
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Evita disparar resultados vazios ou repetidos se possível
      if (finalTranscript.trim()) {
        this.options.onResult(finalTranscript.trim(), true);
      }
      
      if (interimTranscript.trim()) {
        this.options.onResult(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      
      this.status = 'error';
      this.options.onStatusChange(this.status);
      this.options.onError(event.error || 'Erro no reconhecimento de voz.');
    };

    this.recognition.onend = () => {
      // Se parou inesperadamente enquanto deveria estar ouvindo, tenta reiniciar uma vez
      if (this.status === 'listening') {
        try {
          this.recognition.start();
          return;
        } catch (e) {
          console.error("Erro ao tentar reiniciar reconhecimento:", e);
        }
      }
      
      if (this.status === 'listening') {
        this.status = 'reviewing';
        this.options.onStatusChange(this.status);
      } else if (this.status !== 'error') {
        this.status = 'idle';
        this.options.onStatusChange(this.status);
      }
    };
  }

  start() {
    if (this.recognition && (this.status === 'idle' || this.status === 'reviewing' || this.status === 'error')) {
      try {
        this.status = 'requesting_permission';
        this.options.onStatusChange(this.status);
        this.recognition.start();
      } catch (err) {
        console.error('Falha ao iniciar reconhecimento:', err);
        this.status = 'error';
        this.options.onStatusChange(this.status);
        this.options.onError('Falha ao acessar microfone.');
      }
    }
  }

  stop() {
    if (this.recognition && this.status === 'listening') {
      this.status = 'reviewing';
      this.recognition.stop();
    }
  }
}