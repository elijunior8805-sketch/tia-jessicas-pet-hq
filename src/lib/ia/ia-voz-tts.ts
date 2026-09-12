/**
 * Módulo de Síntese de Voz Natural & Humanizada (TTS) da Jessi V2
 * 
 * Oferece:
 * 1. Seleção inteligente das vozes neurais/naturais mais expressivas (Edge Natural, Google Cloud, Apple Enhanced);
 * 2. Normalização fonética e prosódica de moedas (R$), horários, datas, abreviações e termos pet;
 * 3. Remoção total de emojis, códigos técnicos e símbolos que causam gagueira no sintetizador;
 * 4. Cadência de respiração e segmentação por frases para evitar voz robótica ou corte do navegador.
 */

/**
 * Normaliza o texto cru da IA para uma leitura fonética e conversacional 100% natural em pt-BR.
 */
export function humanizarTextoParaVoz(texto: string): string {
  if (!texto) return "";

  let t = texto;

  // 1. Remove blocos de código e marcações técnicas
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`[^`]+`/g, "");
  t = t.replace(/\[id:[^\]]+\]/gi, "");
  t = t.replace(/\[(.*?)\]\([^)]+\)/g, "$1"); // Links markdown -> apenas o texto

  // 2. Remove tags HTML e IDs técnicos
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "");

  // 3. Remove todos os Emojis (para não serem soletrados ou causarem pausas estranhas)
  t = t.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, "");

  // 4. Remove símbolos markdown de formatação
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/\*(.*?)\*/g, "$1");
  t = t.replace(/_{1,2}(.*?)_{1,2}/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^[•*\-–—]\s+/gm, "");
  t = t.replace(/\n[•*\-–—]\s+/g, ", ");

  // 5. Normalização de Moeda (R$ 75,00 -> 75 reais)
  t = t.replace(/R\$\s*(\d+(?:\.\d{3})*),(\d{2})/gi, (_, inteiros, centavos) => {
    const valLimpo = inteiros.replace(/\./g, "");
    if (centavos === "00") {
      return `${valLimpo} reais`;
    }
    return `${valLimpo} reais e ${parseInt(centavos, 10)} centavos`;
  });
  t = t.replace(/R\$\s*(\d+(?:\.\d{3})*)/gi, (_, val) => {
    return `${val.replace(/\./g, "")} reais`;
  });

  // 6. Normalização de Horários (14:30 -> 14 e meia / 14:00 -> 14 horas)
  t = t.replace(/\b([01]?\d|2[0-3]):00\b/g, "$1 horas");
  t = t.replace(/\b([01]?\d|2[0-3]):30\b/g, "$1 e meia");
  t = t.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, "$1 e $2");
  t = t.replace(/\b([01]?\d|2[0-3])h00\b/gi, "$1 horas");
  t = t.replace(/\b([01]?\d|2[0-3])h30\b/gi, "$1 e meia");
  t = t.replace(/\b([01]?\d|2[0-3])h([0-5]\d)\b/gi, "$1 e $2");
  t = t.replace(/\b([01]?\d|2[0-3])h\b/gi, "$1 horas");

  // 7. Normalização de Datas em português (12/09 -> 12 de setembro)
  const meses = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  t = t.replace(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(\d{4}))?\b/g, (_, dia, mes, ano) => {
    const nomeMes = meses[parseInt(mes, 10)];
    const diaNum = parseInt(dia, 10);
    if (ano) {
      return `${diaNum} de ${nomeMes} de ${ano}`;
    }
    return `${diaNum} de ${nomeMes}`;
  });

  // 8. Normalização de Abreviações Comuns
  t = t.replace(/\bDr\.\s*/gi, "Doutor ");
  t = t.replace(/\bDra\.\s*/gi, "Doutora ");
  t = t.replace(/\bSr\.\s*/gi, "Senhor ");
  t = t.replace(/\bSra\.\s*/gi, "Senhora ");
  t = t.replace(/\bex\.:\s*/gi, "por exemplo, ");
  t = t.replace(/\bex\.\s*/gi, "por exemplo, ");
  t = t.replace(/\betc\.\b/gi, "e assim por diante");
  t = t.replace(/\bdisp\.\b/gi, "disponíveis");
  t = t.replace(/\bqtd\.\b/gi, "quantidade");
  t = t.replace(/\bobs\.:\s*/gi, "observação, ");
  t = t.replace(/\bvenc\.:\s*/gi, "vencimento em ");
  t = t.replace(/\bvenc:\s*/gi, "vencimento em ");
  t = t.replace(/\bwhats\b|\bzap\b/gi, "WhatsApp");

  // 9. Telefones: insere vírgulas para leitura pausada
  t = t.replace(/\(?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g, "$1, $2, $3");

  // 10. Limpeza de pontuação excessiva
  t = t.replace(/\.{2,}/g, ", ");
  t = t.replace(/!{2,}/g, "!");
  t = t.replace(/\?{2,}/g, "?");
  t = t.replace(/[:;]\s*$/g, ".");
  t = t.replace(/[:;]\s*\n/g, ".\n");

  // 11. Remove quebras de linha desnecessárias e múltiplos espaços
  t = t.replace(/\n+/g, ". ");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/**
 * Seleciona a melhor voz natural disponível no sistema/navegador em Português do Brasil.
 * Dá prioridade absoluta a vozes neurais e expressivas (Microsoft Online/Natural, Google Cloud, Apple Enhanced).
 */
export function obterMelhorVozPtBr(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const vozesPtBr = voices.filter(
    (v) =>
      v.lang === "pt-BR" ||
      v.lang === "pt_BR" ||
      v.lang.toLowerCase().includes("brazil") ||
      v.lang.startsWith("pt")
  );

  if (vozesPtBr.length === 0) return null;

  // Sistema de pontuação para encontrar a voz mais humanizada e expressiva
  const pontuarVoz = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const nome = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();

    // Preferência rigorosa por pt-BR
    if (lang === "pt-br" || lang === "pt_br") score += 50;

    // 1. Vozes Neurais / Online / Naturais de altíssima qualidade
    if (nome.includes("natural")) score += 120;
    if (nome.includes("neural")) score += 110;
    if (nome.includes("online")) score += 80;

    // 2. Vozes femininas favoritas da Jessi (Microsoft Edge & Windows Natural)
    if (nome.includes("francisca")) score += 100;
    if (nome.includes("thalita") || nome.includes("leticia") || nome.includes("camila") || nome.includes("vitoria") || nome.includes("yara")) score += 90;
    if (nome.includes("maria") && nome.includes("natural")) score += 95;

    // 3. Vozes do Google Chrome de alta qualidade
    if (nome.includes("google") && (nome.includes("português") || nome.includes("brasil") || nome.includes("pt-br"))) score += 85;

    // 4. Vozes da Apple (iOS / macOS Siri & Enhanced)
    if (nome.includes("enhanced") || nome.includes("premium")) score += 75;
    if (nome.includes("luciana") || nome.includes("joana") || nome.includes("siri")) score += 70;

    // 5. Penalização para vozes robóticas antigas do Windows Desktop (SAPI5 de 2006)
    if (nome.includes("desktop") && !nome.includes("natural")) score -= 60;

    return score;
  };

  const vozesOrdenadas = [...vozesPtBr].sort((a, b) => pontuarVoz(b) - pontuarVoz(a));
  return vozesOrdenadas[0] || null;
}

/**
 * Segmenta um texto longo em frases coerentes para pronúncia fluida com ritmo natural.
 */
export function segmentarEmFrases(texto: string): string[] {
  if (!texto) return [];

  // Quebra por pontos finais, interrogações e exclamações, mantendo a pontuação
  const regex = /([^.?!]+[.?!]+)/g;
  const matches = texto.match(regex);

  if (!matches || matches.length === 0) {
    return [texto.trim()];
  }

  const frases: string[] = [];
  matches.forEach((m) => {
    const f = m.trim();
    if (f.length > 0) {
      frases.push(f);
    }
  });

  // Se sobrou algum trecho sem pontuação no final
  const resto = texto.replace(regex, "").trim();
  if (resto.length > 0) {
    frases.push(resto);
  }

  return frases;
}

export interface ReproduzirFalaOptions {
  ttsEnabled?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  onError?: (erro: any) => void;
}

export interface ControladorFala {
  cancelar: () => void;
}

/**
 * Reproduz o texto com síntese de voz fluida, humana e natural.
 */
export function reproduzirFalaHumana(
  textoOriginal: string,
  options: ReproduzirFalaOptions = {}
): ControladorFala {
  const { ttsEnabled = true, onStart, onFinish, onError } = options;

  if (typeof window === "undefined" || !window.speechSynthesis || !ttsEnabled) {
    onFinish?.();
    return { cancelar: () => {} };
  }

  const textoHumanizado = humanizarTextoParaVoz(textoOriginal);
  if (!textoHumanizado) {
    onFinish?.();
    return { cancelar: () => {} };
  }

  let cancelado = false;
  let timerSafety: any = null;

  // Limpa sintetizador anterior e desbloqueia áudio
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();

  const voices = window.speechSynthesis.getVoices();
  const melhorVoz = obterMelhorVozPtBr(voices);

  const frases = segmentarEmFrases(textoHumanizado);
  let indexFrase = 0;

  const falarProximaFrase = () => {
    if (cancelado) return;

    if (indexFrase >= frases.length) {
      if (timerSafety) clearTimeout(timerSafety);
      onFinish?.();
      return;
    }

    const fraseAtual = frases[indexFrase];
    indexFrase++;

    const utterance = new SpeechSynthesisUtterance(fraseAtual);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0; // Velocidade perfeitamente natural e clara
    utterance.pitch = 1.04; // Tom amigável, receptivo e caloroso
    utterance.volume = 1.0;

    if (melhorVoz) {
      utterance.voice = melhorVoz;
    }

    utterance.onstart = () => {
      if (indexFrase === 1) {
        onStart?.();
      }
    };

    utterance.onend = () => {
      if (cancelado) return;
      // Pequena pausa natural de 90ms entre frases para respiração fluida
      setTimeout(() => {
        falarProximaFrase();
      }, 90);
    };

    utterance.onerror = (e) => {
      if (cancelado) return;
      console.warn("[TTS Warning]:", e);
      onError?.(e);
      falarProximaFrase();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Timer de segurança geral contra congelamentos do navegador
  const tempoTotalEstimado = Math.max(3000, textoHumanizado.length * 80 + 2000);
  timerSafety = setTimeout(() => {
    if (!cancelado) {
      onFinish?.();
    }
  }, tempoTotalEstimado);

  falarProximaFrase();

  return {
    cancelar: () => {
      cancelado = true;
      if (timerSafety) clearTimeout(timerSafety);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
  };
}
