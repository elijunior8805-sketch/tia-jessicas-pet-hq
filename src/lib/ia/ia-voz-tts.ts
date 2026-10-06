/**
 * Módulo de Síntese de Voz Natural & Humanizada (TTS) da Jessi V2
 * 
 * Oferece:
 * 1. Seleção inteligente das vozes neurais/naturais mais expressivas (Edge Natural, Google Cloud, Apple Enhanced);
 * 2. Normalização fonética e prosódica de moedas (R$), horários, datas, abreviações e termos pet;
 * 3. Remoção total de emojis, códigos técnicos e símbolos que causam gagueira no sintetizador;
 * 4. Cadência de respiração e segmentação por frases para evitar voz robótica ou corte do navegador.
 */

import {
  sintetizarVozNeural,
  NeuralVoiceConfig,
} from "./ia-voz-neural.service";

/**
 * Converte um número inteiro (0 a 999.999.999) para texto por extenso em Português do Brasil.
 */
export function numeroPorExtensoPtBr(n: number): string {
  if (isNaN(n)) return "";
  if (n === 0) return "zero";
  if (n < 0) return `menos ${numeroPorExtensoPtBr(Math.abs(n))}`;

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (n < 10) return unidades[n];
  if (n >= 10 && n < 20) return especiais[n - 10];
  if (n >= 20 && n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (n === 100) return "cem";
  if (n > 100 && n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto === 0 ? centenas[c] : `${centenas[c]} e ${numeroPorExtensoPtBr(resto)}`;
  }
  if (n >= 1000 && n < 1000000) {
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const prefixo = mil === 1 ? "mil" : `${numeroPorExtensoPtBr(mil)} mil`;
    if (resto === 0) return prefixo;
    if (resto < 100 || resto % 100 === 0) return `${prefixo} e ${numeroPorExtensoPtBr(resto)}`;
    return `${prefixo}, ${numeroPorExtensoPtBr(resto)}`;
  }
  if (n >= 1000000 && n < 1000000000) {
    const milhao = Math.floor(n / 1000000);
    const resto = n % 1000000;
    const sufixo = milhao === 1 ? "um milhão" : `${numeroPorExtensoPtBr(milhao)} milhões`;
    if (resto === 0) return sufixo;
    return `${sufixo} e ${numeroPorExtensoPtBr(resto)}`;
  }
  return String(n);
}

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

  // 5. Normalização de Moeda (R$ 75,00 -> setenta e cinco reais / R$ 1.500,00 -> mil e quinhentos reais)
  t = t.replace(/R\$\s*(\d+(?:\.\d{3})*),(\d{2})/gi, (_, inteiros, centavos) => {
    const numLimpo = parseInt(inteiros.replace(/\./g, ""), 10);
    const numExtenso = numeroPorExtensoPtBr(numLimpo);
    const centavosNum = parseInt(centavos, 10);
    if (centavosNum === 0) {
      return `${numExtenso} reais`;
    }
    const centExtenso = numeroPorExtensoPtBr(centavosNum);
    return `${numExtenso} reais e ${centExtenso} centavos`;
  });
  t = t.replace(/R\$\s*(\d+(?:\.\d{3})*)/gi, (_, val) => {
    const numLimpo = parseInt(val.replace(/\./g, ""), 10);
    return `${numeroPorExtensoPtBr(numLimpo)} reais`;
  });

  // 6. Normalização de Datas ISO (YYYY-MM-DD -> dia de mês de ano)
  const meses = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  t = t.replace(/\b(\d{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/g, (_, ano, mes, dia) => {
    const nomeMes = meses[parseInt(mes, 10)];
    const diaExt = numeroPorExtensoPtBr(parseInt(dia, 10));
    const anoExt = numeroPorExtensoPtBr(parseInt(ano, 10));
    return `${diaExt} de ${nomeMes} de ${anoExt}`;
  });

  // 7. Normalização de Datas com barras (10/10/2026 ou 10/10)
  t = t.replace(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(\d{2,4}))?\b/g, (_, dia, mes, ano) => {
    const nomeMes = meses[parseInt(mes, 10)];
    const diaExt = numeroPorExtensoPtBr(parseInt(dia, 10));
    if (ano) {
      const anoNum = ano.length === 2 ? parseInt(`20${ano}`, 10) : parseInt(ano, 10);
      return `${diaExt} de ${nomeMes} de ${numeroPorExtensoPtBr(anoNum)}`;
    }
    return `${diaExt} de ${nomeMes}`;
  });

  // 8. Normalização de Horários e Períodos do Dia (10:00 -> dez da manhã / 14:00 -> duas da tarde)
  t = t.replace(/\b0?([0-9]|1[01]):00(?::00)?\b/g, (_, h) => `${numeroPorExtensoPtBr(parseInt(h, 10))} da manhã`);
  t = t.replace(/\b0?([0-9]|1[01]):30(?::00)?\b/g, (_, h) => `${numeroPorExtensoPtBr(parseInt(h, 10))} e meia da manhã`);
  t = t.replace(/\b12:00(?::00)?\b/g, "meio-dia");
  t = t.replace(/\b12:30(?::00)?\b/g, "meio-dia e meia");
  t = t.replace(/\b00:00(?::00)?\b/g, "meia-noite");
  t = t.replace(/\b(1[3-9]|2[0-3]):00(?::00)?\b/g, (_, h) => {
    const h12 = parseInt(h, 10) - 12;
    const hLabel = h12 === 1 ? "uma" : h12 === 2 ? "duas" : numeroPorExtensoPtBr(h12);
    const periodo = parseInt(h, 10) >= 18 ? "da noite" : "da tarde";
    return `${hLabel} ${periodo}`;
  });
  t = t.replace(/\b(1[3-9]|2[0-3]):30(?::00)?\b/g, (_, h) => {
    const h12 = parseInt(h, 10) - 12;
    const hLabel = h12 === 1 ? "uma" : h12 === 2 ? "duas" : numeroPorExtensoPtBr(h12);
    const periodo = parseInt(h, 10) >= 18 ? "da noite" : "da tarde";
    return `${hLabel} e meia ${periodo}`;
  });
  t = t.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?::00)?\b/g, (_, h, m) => {
    return `${numeroPorExtensoPtBr(parseInt(h, 10))} e ${numeroPorExtensoPtBr(parseInt(m, 10))}`;
  });

  t = t.replace(/\b0?([0-9]|1[01])h00\b/gi, (_, h) => `${numeroPorExtensoPtBr(parseInt(h, 10))} da manhã`);
  t = t.replace(/\b0?([0-9]|1[01])h30\b/gi, (_, h) => `${numeroPorExtensoPtBr(parseInt(h, 10))} e meia da manhã`);
  t = t.replace(/\b(1[3-9]|2[0-3])h00\b/gi, (_, h) => {
    const h12 = parseInt(h, 10) - 12;
    const hLabel = h12 === 1 ? "uma" : h12 === 2 ? "duas" : numeroPorExtensoPtBr(h12);
    const periodo = parseInt(h, 10) >= 18 ? "da noite" : "da tarde";
    return `${hLabel} ${periodo}`;
  });
  t = t.replace(/\b(1[3-9]|2[0-3])h30\b/gi, (_, h) => {
    const h12 = parseInt(h, 10) - 12;
    const hLabel = h12 === 1 ? "uma" : h12 === 2 ? "duas" : numeroPorExtensoPtBr(h12);
    const periodo = parseInt(h, 10) >= 18 ? "da noite" : "da tarde";
    return `${hLabel} e meia ${periodo}`;
  });
  t = t.replace(/\b([01]?\d|2[0-3])h([0-5]\d)\b/gi, (_, h, m) => `${numeroPorExtensoPtBr(parseInt(h, 10))} e ${numeroPorExtensoPtBr(parseInt(m, 10))}`);
  t = t.replace(/\b([01]?\d|2[0-3])h\b/gi, (_, h) => `${numeroPorExtensoPtBr(parseInt(h, 10))} horas`);

  // 9. Normalização de Raças de Cães para Fonética Perfeita em Português
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

  // 10. Normalização de Abreviações Comuns e Termos
  t = t.replace(/\bbanho simples\b/gi, "banho essencial");
  t = t.replace(/(\d+)%/g, (_, num) => `${numeroPorExtensoPtBr(parseInt(num, 10))} por cento`);
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

  // 11. Telefones: insere vírgulas para leitura pausada
  t = t.replace(/\(?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g, "$1, $2, $3");

  // 12. Unidades e símbolos comuns para leitura natural
  t = t.replace(/\bn[º°.]\s*(\d+)/gi, (_, n) => `número ${numeroPorExtensoPtBr(parseInt(n, 10))}`);
  t = t.replace(/\b(\d+)\s?kg\b/gi, (_, n) => `${numeroPorExtensoPtBr(parseInt(n, 10))} quilos`);
  t = t.replace(/\b(\d+)\s?km\b/gi, (_, n) => `${numeroPorExtensoPtBr(parseInt(n, 10))} quilômetros`);
  t = t.replace(/\b(\d+)\s?ml\b/gi, (_, n) => `${numeroPorExtensoPtBr(parseInt(n, 10))} mililitros`);
  t = t.replace(/\b(\d+)\s?min\b/gi, (_, n) => `${numeroPorExtensoPtBr(parseInt(n, 10))} minutos`);
  t = t.replace(/(\d+)\s*x\s*(\d+)/gi, (_, a, b) => `${numeroPorExtensoPtBr(parseInt(a, 10))} vezes ${numeroPorExtensoPtBr(parseInt(b, 10))}`);

  // 13. Converte TODOS os números inteiros isolados restantes para palavras por extenso!
  // (Ex: "10 atendimentos" -> "dez atendimentos", "dia 1" -> "dia um")
  t = t.replace(/\b\d+\b/g, (digitos) => {
    const num = parseInt(digitos, 10);
    if (!isNaN(num) && num >= 0 && num < 1000000) {
      return numeroPorExtensoPtBr(num);
    }
    return digitos;
  });

  // 14. Limpeza de pontuação excessiva
  t = t.replace(/\.{2,}/g, ", ");
  t = t.replace(/!{2,}/g, "!");
  t = t.replace(/\?{2,}/g, "?");
  t = t.replace(/[:;]\s*$/g, ".");
  t = t.replace(/[:;]\s*\n/g, ".\n");

  // 15. Remove quebras de linha desnecessárias e múltiplos espaços
  t = t.replace(/\n+/g, ". ");
  t = t.replace(/\s+/g, " ").trim();

  // 16. Pontuação final e limpeza de duplicidades
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
  // Só encerra a frase quando a pontuação precede um espaço ou o fim do texto;
  // um ponto entre dígitos (75.50) pertence ao número, não à pausa.
  const regex = /[\s\S]*?[.!?](?=\s|$)/g;
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
  preferNeural?: boolean;
  neuralConfig?: Partial<NeuralVoiceConfig>;
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
 * Reproduz o texto com síntese de voz fluida, humana e natural.
 * Prioriza áudio neural de estúdio (OpenAI TTS / ElevenLabs) com fallback instantâneo
 * para o motor fonético nativo do navegador.
 */
export function reproduzirFalaHumana(
  textoOriginal: string,
  options: ReproduzirFalaOptions = {}
): ControladorFala {
  const { ttsEnabled = true, preferNeural = true, neuralConfig, onStart, onFinish, onError } = options;

  if (!ttsEnabled || !textoOriginal || typeof window === "undefined") {
    onFinish?.();
    return { cancelar: () => {} };
  }

  const textoHumanizado = humanizarTextoParaVoz(textoOriginal);
  if (!textoHumanizado) {
    onFinish?.();
    return { cancelar: () => {} };
  }

  let cancelado = false;
  let audioNeuralElement: HTMLAudioElement | null = null;
  let abortController: AbortController | null = null;
  let timerSafety: any = null;

  const fallbackNativoWebSpeech = () => {
    if (cancelado) return;

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
        const ehLonga = fraseAtual.length > 120;
        const ehPergunta = /\?\s*$/.test(fraseAtual);
        utterance.rate = ehLonga ? 0.96 : 0.99;
        utterance.pitch = ehPergunta ? 1.06 : 1.02;
        utterance.volume = 1.0;

        if (melhorVoz) {
          utterance.voice = melhorVoz;
        }

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
          const pausa = ehPergunta ? 160 : ehLonga ? 110 : 80;
          setTimeout(() => {
            falarProximaFrase();
          }, pausa);
        };

        utterance.onerror = (e) => {
          limparUtterance();
          if (cancelado) return;
          console.warn("[TTS Fallback Warning]:", e);
          onError?.(e);
          falarProximaFrase();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("[TTS Fallback Exception]:", err);
        falarProximaFrase();
      }
    };

    const tempoTotalEstimado = Math.max(3000, textoHumanizado.length * 80 + 3000);
    timerSafety = setTimeout(() => {
      if (!cancelado) {
        onFinish?.();
      }
    }, tempoTotalEstimado);

    falarProximaFrase();
  };

  // 1. Tenta sintetizar voz neural de estúdio (Edge Neural 24kHz 100% gratuita, ElevenLabs ou OpenAI)
  if (preferNeural) {
    abortController = new AbortController();

    sintetizarVozNeural(textoHumanizado, neuralConfig, abortController.signal)
      .then((res) => {
        if (cancelado) {
          if (res?.url) URL.revokeObjectURL(res.url);
          return;
        }

        if (!res || !res.url) {
          // Fallback para Web Speech nativo
          fallbackNativoWebSpeech();
          return;
        }

        audioNeuralElement = new Audio(res.url);
        audioNeuralElement.onplay = () => {
          onStart?.();
        };
        audioNeuralElement.onended = () => {
          URL.revokeObjectURL(res.url);
          audioNeuralElement = null;
          onFinish?.();
        };
        audioNeuralElement.onerror = (err) => {
          console.warn("[Neural Audio Playback Error]:", err);
          URL.revokeObjectURL(res.url);
          audioNeuralElement = null;
          fallbackNativoWebSpeech();
        };

        audioNeuralElement.play().catch((playErr) => {
          console.warn("[Neural Audio Play Exception, falling back]:", playErr);
          URL.revokeObjectURL(res.url);
          audioNeuralElement = null;
          fallbackNativoWebSpeech();
        });
      })
      .catch((err) => {
        console.warn("[Neural TTS Service Error, falling back]:", err);
        fallbackNativoWebSpeech();
      });
  } else {
    // 2. Executa imediatamente o motor fonético nativo do navegador
    fallbackNativoWebSpeech();
  }

  return {
    cancelar: () => {
      cancelado = true;
      if (abortController) {
        try {
          abortController.abort();
        } catch {}
      }
      if (audioNeuralElement) {
        try {
          audioNeuralElement.pause();
          audioNeuralElement.currentTime = 0;
          audioNeuralElement = null;
        } catch {}
      }
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
