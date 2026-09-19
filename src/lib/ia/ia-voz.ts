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

