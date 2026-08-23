
export type VoiceRecognitionStatus = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceRecognitionOptions {
  onResult: (text: string) => void;
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
    this.recognition.continuous = false; // Mudar para true se quiser manter o microfone aberto
    this.recognition.interimResults = false; // Desabilitar resultados parciais para evitar ruído no input final

    this.recognition.onstart = () => {
      this.status = 'listening';
      this.options.onStatusChange(this.status);
    };

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      this.options.onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      this.status = 'error';
      this.options.onStatusChange(this.status);
      this.options.onError(event.error || 'Erro no reconhecimento de voz.');
    };

    this.recognition.onend = () => {
      if (this.status !== 'error') {
        this.status = 'idle';
        this.options.onStatusChange(this.status);
      }
    };
  }

  start() {
    if (this.recognition && this.status === 'idle') {
      try {
        this.recognition.start();
      } catch (err) {
        console.error('Falha ao iniciar reconhecimento:', err);
      }
    }
  }

  stop() {
    if (this.recognition && this.status === 'listening') {
      this.recognition.stop();
    }
  }
}
