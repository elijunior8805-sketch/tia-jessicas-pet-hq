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

  // 2. Remove tags HTML, IDs técnicos e observações entre parênteses
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "");
  t = t.replace(/\*?\s*\(Observação:.*?\)\s*\*?/gi, "");
  t = t.replace(/\*?\s*\(Obs:.*?\)\s*\*?/gi, "");

  // 3. Remove todos os Emojis (para não serem soletrados ou causarem pausas estranhas)
  t = t.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, "");

  // 4. Remove símbolos markdown de formatação, quotes e marcadores de lista
  t = t.replace(/^>\s*/gm, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/\*(.*?)\*/g, "$1");
  t = t.replace(/_{1,2}(.*?)_{1,2}/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^[•*\-–—]\s+/gm, "");
  t = t.replace(/^\d+\.\s+/gm, "");
  t = t.replace(/\n[•*\-–—]\s+/g, ", ");
  t = t.replace(/\n\d+\.\s+/g, ", ");

  // 5. Normalização de Moeda (R$ 75,00 -> 75 reais / R$ 1.500,00 -> 1.500 reais)
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

  // 6. Normalização de Horários e Períodos do Dia
  t = t.replace(/\b0?([0-9]|1[01]):00\b/g, "$1 da manhã");
  t = t.replace(/\b0?([0-9]|1[01]):30\b/g, "$1 e meia da manhã");
  t = t.replace(/\b12:00\b/g, "meio-dia");
  t = t.replace(/\b12:30\b/g, "meio-dia e meia");
  t = t.replace(/\b(1[3-9]|2[0-3]):00\b/g, (_, h) => `${parseInt(h, 10) - 12} da tarde`);
  t = t.replace(/\b(1[3-9]|2[0-3]):30\b/g, (_, h) => `${parseInt(h, 10) - 12} e meia da tarde`);
  t = t.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, "$1 e $2");

  t = t.replace(/\b0?([0-9]|1[01])h00\b/gi, "$1 da manhã");
  t = t.replace(/\b0?([0-9]|1[01])h30\b/gi, "$1 e meia da manhã");
  t = t.replace(/\b(1[3-9]|2[0-3])h00\b/gi, (_, h) => `${parseInt(h, 10) - 12} da tarde`);
  t = t.replace(/\b(1[3-9]|2[0-3])h30\b/gi, (_, h) => `${parseInt(h, 10) - 12} e meia da tarde`);
  t = t.replace(/\b([01]?\d|2[0-3])h([0-5]\d)\b/gi, "$1 e $2");
  t = t.replace(/\b([01]?\d|2[0-3])h\b/gi, "$1 horas");

  // 7. Normalização de Raças de Cães para Fonética Perfeita em Português
  t = t.replace(/\bshih\s*tzu\b|\bshihtzu\b/gi, "chitzu");
  t = t.replace(/\byorkshire\b|\byorkie\b/gi, "iorquechaire");
  t = t.replace(/\bpoodle\b|\bpudle\b/gi, "púdou");
  t = t.replace(/\bgolden\s*retriever\b|\bgolden\b/gi, "gôuden");
  t = t.replace(/\bpitbull\b|\bpit\s*bull\b/gi, "pitibul");
  t = t.replace(/\bbulldog\s*franc[eê]s\b/gi, "boudogue francês");
  t = t.replace(/\bbulldog\b|\bbulldogue\b/gi, "boudogue");
  t = t.replace(/\bspitz\s*alem[aã]o\b|\blulu\s*da\s*pomer[aâ]nia\b/gi, "espites alemão");
  t = t.replace(/\bspitz\b/gi, "espites");
  t = t.replace(/\bschnauzer\b/gi, "eschnauzer");
  t = t.replace(/\bchow\s*chow\b/gi, "tchao tchao");
  t = t.replace(/\bdachshund\b|\bteckel\b|\bsalsicha\b/gi, "dáchirund");
  t = t.replace(/\brotweiler\b|\brottweiler\b/gi, "roteváiler");
  t = t.replace(/\bbeagle\b/gi, "bígou");
  t = t.replace(/\bmalt[eê]s\b/gi, "maltês");

  // 8. Normalização de Datas em português (12/09 -> 12 de setembro)
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

  // 9. Normalização de Abreviações Comuns e Termos
  t = t.replace(/\bbanho simples\b/gi, "banho essencial");
  t = t.replace(/(\d+)%/g, "$1 por cento");
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

  // 10. Telefones: insere vírgulas para leitura pausada
  t = t.replace(/\(?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g, "$1, $2, $3");

  // 11. Limpeza de pontuação excessiva
  t = t.replace(/\.{2,}/g, ", ");
  t = t.replace(/!{2,}/g, "!");
  t = t.replace(/\?{2,}/g, "?");
  t = t.replace(/[:;]\s*$/g, ".");
  t = t.replace(/[:;]\s*\n/g, ".\n");

  // 12. Unidades e símbolos comuns para leitura natural
  t = t.replace(/\bn[º°.]\s*/gi, "número ");
  t = t.replace(/\b(\d+)\s?kg\b/gi, "$1 quilos");
  t = t.replace(/\b(\d+)\s?km\b/gi, "$1 quilômetros");
  t = t.replace(/\b(\d+)\s?ml\b/gi, "$1 mililitros");
  t = t.replace(/\b(\d+)\s?min\b/gi, "$1 minutos");
  t = t.replace(/(\d+)\s*x\s*(\d+)/gi, "$1 vezes $2");

  // 13. Remove quebras de linha desnecessárias e múltiplos espaços
  t = t.replace(/\n+/g, ". ");
  t = t.replace(/\s+/g, " ").trim();

  // 14. Pontuação final e limpeza de duplicidades
  t = t.replace(/\s+([.,!?])/g, "$1");
  t = t.replace(/([.!?])\s*\1+/g, "$1");
  t = t.replace(/,\s*,+/g, ",");
  t = t.replace(/,\s*([.!?])/g, "$1");
  if (t && !/[.!?…]$/.test(t)) {
    t += ".";
  }

  return t;
}

// Cache global de vozes do navegador
let vozesDisponiveisCache: SpeechSynthesisVoice[] = [];

if (typeof window !== "undefined" && window.speechSynthesis) {
  const carregarVozes = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        vozesDisponiveisCache = v;
      }
    } catch {}
  };
  carregarVozes();
  window.speechSynthesis.onvoiceschanged = carregarVozes;
}

/**
 * Seleciona a melhor voz natural disponível no sistema/navegador em Português do Brasil.
 * Dá prioridade absoluta a vozes neurais e expressivas (Edge Natural, Apple Siri/Enhanced, Google Cloud).
 */
export function obterMelhorVozPtBr(voices?: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let listaVozes = (voices && voices.length > 0) ? voices : vozesDisponiveisCache;
  if ((!listaVozes || listaVozes.length === 0) && typeof window !== "undefined" && window.speechSynthesis) {
    try {
      listaVozes = window.speechSynthesis.getVoices();
      if (listaVozes && listaVozes.length > 0) {
        vozesDisponiveisCache = listaVozes;
      }
    } catch {}
  }

  if (!listaVozes || listaVozes.length === 0) return null;

  const vozesPtBr = listaVozes.filter(
    (v) =>
      v.lang === "pt-BR" ||
      v.lang === "pt_BR" ||
      v.lang.toLowerCase().includes("brazil") ||
      v.lang.startsWith("pt")
  );

  if (vozesPtBr.length === 0) return null;

  // Sistema de pontuação refinado para vozes neurais expressivas e calorosas
  const pontuarVoz = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const nome = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();

    // Preferência rigorosa por pt-BR
    if (lang === "pt-br" || lang === "pt_BR") score += 50;

    // 1. Microsoft Edge / Windows Natural Neural Voices (altíssima fidelidade, quase indistinguível de humano)
    if (nome.includes("francisca") && (nome.includes("natural") || nome.includes("online") || nome.includes("neural"))) score += 200;
    if (nome.includes("thalita") && (nome.includes("natural") || nome.includes("online") || nome.includes("neural"))) score += 180;
    if (nome.includes("natural")) score += 150;
    if (nome.includes("neural")) score += 140;
    if (nome.includes("online")) score += 110;

    // 2. Apple Siri / Enhanced / Premium Voices (iOS / iPadOS / macOS)
    if (nome.includes("siri") || nome.includes("enhanced") || nome.includes("premium")) score += 160;
    if (nome.includes("luciana") || nome.includes("joana") || nome.includes("helena")) score += 140;

    // 3. Google Neural Voices (Chrome Desktop / Android)
    if (nome.includes("google") && (nome.includes("português") || nome.includes("brasil") || nome.includes("pt-br"))) score += 130;

    // 4. Vozes femininas suaves em Português
    if (nome.includes("francisca")) score += 120;
    if (nome.includes("thalita") || nome.includes("leticia") || nome.includes("camila") || nome.includes("vitoria") || nome.includes("yara")) score += 100;
    if (nome.includes("maria") && nome.includes("natural")) score += 105;

    // 5. Penalização para vozes robóticas antigas (SAPI5 de 2006)
    if (nome.includes("desktop") && !nome.includes("natural")) score -= 150;

    return score;
  };

  const vozesOrdenadas = [...vozesPtBr].sort((a, b) => pontuarVoz(b) - pontuarVoz(a));
  return vozesOrdenadas[0] || null;
}

/**
 * Segmenta um texto longo apenas em frases completas (terminadas em ponto, interrogação ou exclamação).
 * NUNCA fatia no meio de vírgulas para evitar quebras mecânicas e robóticas na voz.
 */
export function segmentarEmFrases(texto: string): string[] {
  if (!texto) return [];

  // Quebra por pontos finais, interrogações e exclamações, preservando a frase inteira
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

// Conjunto de retenção para evitar o bug de Garbage Collection do Chromium/Safari
const utterancesAtivas = new Set<SpeechSynthesisUtterance>();

/**
 * Reproduz o texto com síntese de voz fluida, humana e natural no navegador (Mobile e Desktop).
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

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
  } catch {}

  const melhorVoz = obterMelhorVozPtBr();
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

    try {
      const utterance = new SpeechSynthesisUtterance(fraseAtual);
      utterance.lang = "pt-BR";
      // Ritmo fluido, dinâmico e conversacional (evita voz lenta/arrastada)
      const ehLonga = fraseAtual.length > 120;
      const ehPergunta = /\?\s*$/.test(fraseAtual);
      utterance.rate = ehLonga ? 1.02 : 1.05;
      // Perguntas ganham entonação ascendente calorosa; afirmativas soam firmes e empáticas
      utterance.pitch = ehPergunta ? 1.08 : 1.02;
      utterance.volume = 1.0;

      if (melhorVoz) {
        utterance.voice = melhorVoz;
      }

      // Retém referência para evitar GC prematuro no Chromium / Safari
      utterancesAtivas.add(utterance);

      const limparUtterance = () => {
        utterancesAtivas.delete(utterance);
      };

      utterance.onstart = () => {
        if (indexFrase === 1) {
          onStart?.();
        }
      };

      utterance.onend = () => {
        limparUtterance();
        if (cancelado) return;
        // Respiração natural: micropausa fluida entre orações sem silêncio morto
        const pausa = ehPergunta ? 160 : ehLonga ? 110 : 80;
        setTimeout(() => {
          falarProximaFrase();
        }, pausa);
      };

      utterance.onerror = (e) => {
        limparUtterance();
        if (cancelado) return;
        console.warn("[TTS Warning]:", e);
        onError?.(e);
        falarProximaFrase();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[TTS Exception]:", err);
      falarProximaFrase();
    }
  };

  // Timer de segurança geral contra congelamentos do navegador
  const tempoTotalEstimado = Math.max(3000, textoHumanizado.length * 80 + 3000);
  timerSafety = setTimeout(() => {
    if (!cancelado) {
      onFinish?.();
    }
  }, tempoTotalEstimado);

  // Inicia a fala imediatamente de forma suave
  falarProximaFrase();

  return {
    cancelar: () => {
      cancelado = true;
      if (timerSafety) clearTimeout(timerSafety);
      utterancesAtivas.clear();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    },
  };
}
