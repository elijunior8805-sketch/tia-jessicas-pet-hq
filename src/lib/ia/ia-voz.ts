
export type VoiceRecognitionStatus = 'idle' | 'requesting_permission' | 'listening' | 'finalizing' | 'reviewing' | 'error' | 'processing';

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
      if (this.status === 'listening') {
        // Se parou mas o status ainda é listening, tentamos finalizar a transcrição
        this.status = 'finalizing';
        this.options.onStatusChange(this.status);
        
        // Aguarda um pouco para capturar resultados pendentes e então vai para revisão
        setTimeout(() => {
          if (this.status === 'finalizing') {
            this.status = 'reviewing';
            this.options.onStatusChange(this.status);
          }
        }, 500);
        return;
      }
      
      if (this.status !== 'error' && this.status !== 'processing') {
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