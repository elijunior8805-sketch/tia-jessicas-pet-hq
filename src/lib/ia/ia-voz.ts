
export type VoiceRecognitionStatus = 'idle' | 'listening' | 'processing' | 'reviewing' | 'error';

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
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.options.onResult(finalTranscript, true);
      }
      
      if (interimTranscript) {
        this.options.onResult(interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      
      this.status = 'error';
      this.options.onStatusChange(this.status);
      this.options.onError(event.error || 'Erro no reconhecimento de voz.');
    };

    this.recognition.onend = () => {
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
        this.recognition.start();
      } catch (err) {
        console.error('Falha ao iniciar reconhecimento:', err);
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