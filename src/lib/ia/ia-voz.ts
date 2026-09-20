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

  getStatus(): VoiceRecognitionStatus {
    return this.status;
  }

  getIsContinuous(): boolean {
    return this.isContinuous;
  }
}

/**
 * Converte valor numérico para escrita em reais por extenso
 */
export function converterNumeroParaExtenso(valor: number): string {
  const v = Math.abs(Math.round(valor * 100) / 100);
  const inteiros = Math.floor(v);
  const centavos = Math.round((v - inteiros) * 100);

  if (inteiros === 0 && centavos === 0) return "zero reais";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function converterCentena(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);

    const resto = n % 100;
    if (resto >= 10 && resto <= 19) {
      partes.push(especiais[resto - 10]);
    } else {
      if (d > 0) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }
    return partes.join(" e ");
  }

  function converterMilhares(n: number): string {
    if (n === 0) return "";
    if (n < 1000) return converterCentena(n);

    const mil = Math.floor(n / 1000);
    const resto = n % 1000;

    let strMil = "";
    if (mil === 1) {
      strMil = "mil";
    } else {
      strMil = `${converterCentena(mil)} mil`;
    }

    if (resto === 0) return strMil;
    if (resto <= 100 || resto % 100 === 0) {
      return `${strMil} e ${converterCentena(resto)}`;
    }
    return `${strMil} ${converterCentena(resto)}`;
  }

  let extenso = "";
  if (inteiros > 0) {
    extenso = `${converterMilhares(inteiros)} ${inteiros === 1 ? "real" : "reais"}`;
  }

  if (centavos > 0) {
    const extCentavos = `${converterCentena(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
    extenso = extenso ? `${extenso} e ${extCentavos}` : extCentavos;
  }

  return extenso;
}

/**
 * Converte horário para fala natural ("14:00" -> "duas da tarde")
 */
export function formatarHorarioPorExtenso(horaStr: string): string {
  if (!horaStr) return "";
  const match = String(horaStr).match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return horaStr;

  const h = parseInt(match[1], 10);
  const m = parseInt(match[2] || "0", 10);

  let prefixoHora = "";
  let sufixoPeriodo = "";

  if (h === 0) {
    prefixoHora = "meia-noite";
  } else if (h === 12) {
    prefixoHora = "meio-dia";
  } else if (h === 1 || h === 13) {
    prefixoHora = "uma";
    sufixoPeriodo = h === 1 ? "da madrugada" : "da tarde";
  } else if (h === 2 || h === 14) {
    prefixoHora = "duas";
    sufixoPeriodo = h === 2 ? "da madrugada" : "da tarde";
  } else if (h === 3 || h === 15) {
    prefixoHora = "três";
    sufixoPeriodo = h === 3 ? "da madrugada" : "da tarde";
  } else if (h === 4 || h === 16) {
    prefixoHora = "quatro";
    sufixoPeriodo = h === 4 ? "da madrugada" : "da tarde";
  } else if (h === 5 || h === 17) {
    prefixoHora = "cinco";
    sufixoPeriodo = h === 5 ? "da manhã" : "da tarde";
  } else if (h === 6 || h === 18) {
    prefixoHora = "seis";
    sufixoPeriodo = h === 6 ? "da manhã" : "da tarde";
  } else if (h === 7 || h === 19) {
    prefixoHora = "sete";
    sufixoPeriodo = h === 7 ? "da manhã" : "da noite";
  } else if (h === 8 || h === 20) {
    prefixoHora = "oito";
    sufixoPeriodo = h === 8 ? "da manhã" : "da noite";
  } else if (h === 9 || h === 21) {
    prefixoHora = "nove";
    sufixoPeriodo = h === 9 ? "da manhã" : "da noite";
  } else if (h === 10 || h === 22) {
    prefixoHora = "dez";
    sufixoPeriodo = h === 10 ? "da manhã" : "da noite";
  } else if (h === 11 || h === 23) {
    prefixoHora = "onze";
    sufixoPeriodo = h === 11 ? "da manhã" : "da noite";
  }

  if (m === 0) {
    return sufixoPeriodo ? `${prefixoHora} ${sufixoPeriodo}` : prefixoHora;
  }
  if (m === 30) {
    return sufixoPeriodo ? `${prefixoHora} e meia ${sufixoPeriodo}` : `${prefixoHora} e meia`;
  }
  return sufixoPeriodo ? `${prefixoHora} e ${m} ${sufixoPeriodo}` : `${prefixoHora} e ${m}`;
}

/**
 * Converte data ISO ou DD/MM para fala por extenso ("2026-09-29" -> "29 de setembro")
 */
export function formatarDataPorExtenso(dataStr: string): string {
  if (!dataStr) return "";
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  let dia = 0;
  let mes = 0;

  if (dataStr.includes("-")) {
    const parts = dataStr.split("-");
    dia = parseInt(parts[2], 10);
    mes = parseInt(parts[1], 10);
  } else if (dataStr.includes("/")) {
    const parts = dataStr.split("/");
    dia = parseInt(parts[0], 10);
    mes = parseInt(parts[1], 10);
  }

  if (dia > 0 && mes >= 1 && mes <= 12) {
    const nomeMes = meses[mes - 1];
    return `${dia} de ${nomeMes}`;
  }
  return dataStr;
}

/**
 * Limpa e prepara o texto da resposta para a voz humana da Jéssica:
 * - Remove formatações markdown, listas longas, códigos e IDs
 * - Converte horários e valores para pronúncia natural
 * - Garante pausas adequadas com pontuação
 */
export function prepararTextoParaVoz(texto: string): string {
  if (!texto) return "";

  // 1. Pega apenas a introdução / resumo antes de listas longas ou tabelas
  let limpo = texto.split(/\n\s*[-*•]\s+/)[0]; // descarta itens de lista após a intro
  limpo = limpo.split(/\n\n+/)[0]; // foca no parágrafo principal ou pergunta

  // Se o texto original tem uma pergunta final curta ("Posso confirmar?", "Quer ver os detalhes?"), inclui-a
  const matchPergunta = texto.match(/((?:Posso confirmar|Quer ver os detalhes|Deseja agendar|Qual deles você prefere|Como posso ajudar|Posso ajudar)[^?\n]*\?)/i);
  if (matchPergunta && !limpo.includes(matchPergunta[1])) {
    limpo = `${limpo.trim()} ${matchPergunta[1].trim()}`;
  }

  // 2. Remove tags markdown
  limpo = limpo
    .replace(/[*_#`~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  // 3. Remove IDs técnicos ou códigos (ex: ID: abc..., Código SRD..., etc.)
  limpo = limpo
    .replace(/\b(?:ID|Código|UUID|uuid|id)\s*[:#-]?\s*[a-zA-Z0-9_-]{4,}\b/gi, "")
    .replace(/\bCódigo SRD\b/gi, "")
    .replace(/\bmesa atual\b/gi, "")
    .replace(/\bresumo financeiro consolidado\b/gi, "resumo financeiro");

  // 4. Substitui valores monetários (R$ 1.202,00 -> mil duzentos e dois reais)
  limpo = limpo.replace(/R\$\s*([\d.,]+)/g, (_, valStr) => {
    const num = parseFloat(valStr.replace(/\./g, "").replace(",", "."));
    return isNaN(num) ? valStr : converterNumeroParaExtenso(num);
  });

  // 5. Substitui horários (14:00 -> duas da tarde, às 17h -> às cinco da tarde)
  limpo = limpo.replace(/(?:às\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:horas?|h\b)?/gi, (match, h, m) => {
    const horaNum = parseInt(h, 10);
    if (horaNum >= 0 && horaNum <= 24) {
      const formatado = formatarHorarioPorExtenso(`${h}:${m || "00"}`);
      return `às ${formatado}`;
    }
    return match;
  });

  // 6. Higieniza pontuação para pausas naturais
  limpo = limpo
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\.\s*/g, ". ")
    .replace(/\s*:\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  return limpo;
}

/**
 * Sintetizador de voz com seleção de voz feminina pt-BR natural e cancelamento de sobreposição
 */
export function falarTextoJessi(texto: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  // Cancela qualquer fala anterior para não sobrepor áudios
  window.speechSynthesis.cancel();

  const textoParaFalar = prepararTextoParaVoz(texto);
  if (!textoParaFalar.trim()) return;

  const utterance = new SpeechSynthesisUtterance(textoParaFalar);
  utterance.lang = "pt-BR";
  utterance.rate = 0.98; // Ritmo natural, nem rápido nem arrastado
  utterance.pitch = 1.05; // Tom feminino acolhedor e profissional
  utterance.volume = 1.0;

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = () => onEnd();
  }

  // Tenta encontrar a melhor voz feminina neural / natural em pt-BR
  const vozes = window.speechSynthesis.getVoices();
  const vozSelecionada =
    vozes.find((v) => v.lang.startsWith("pt") && /(Francisca|Natural|Neural|Google português|Luciana|Maria|Vitória|Heloisa|Yara|Leticia)/i.test(v.name)) ||
    vozes.find((v) => v.lang.startsWith("pt") && /(female|mulher|feminina)/i.test(v.name)) ||
    vozes.find((v) => v.lang.startsWith("pt-BR") || v.lang.startsWith("pt_BR")) ||
    vozes.find((v) => v.lang.startsWith("pt"));

  if (vozSelecionada) {
    utterance.voice = vozSelecionada;
  }

  window.speechSynthesis.speak(utterance);
}

export function pararFalaJessi(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

