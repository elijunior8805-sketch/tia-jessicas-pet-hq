/**
 * Módulo de Formatação Conversacional para Canal de Voz (Estilo ChatGPT / Gemini Live)
 * 
 * Transforma respostas ricas da IA em diálogos falados naturais, ágeis,
 * empáticos e humanizados para síntese de voz (TTS), mantendo a inteligência
 * e conselhos operacionais sem engessar a fala.
 */

export function humanizarRespostaParaVoz(
  respostaOriginal: string,
  cards?: any[],
  modoBancada?: boolean,
  userName = "Eli"
): string {
  if (!respostaOriginal) return "Prontinho!";

  const texto = respostaOriginal.trim();

  // Limpeza inteligente de formatação markdown e estruturação para leitura por voz
  let fala = limparMarcacaoTexto(texto);

  // Converte padrões de tópicos (• ou -) em fala contínua natural
  fala = fala
    .replace(/\s*[•*-]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  // Se o texto for longo (> 200 caracteres), prioriza as 2 a 3 frases principais para fala dinâmica e ágil
  if (fala.length > 220) {
    const sentencas = fala.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
    if (sentencas.length > 2) {
      fala = `${sentencas[0]} ${sentencas[1]}`;
    }
  }

  return fala;
}

/**
 * Remove marcações técnicas, markdown, asteriscos, emojis, parênteses plurais e quebras de linha para áudio cristalino
 */
export function limparMarcacaoTexto(texto: string): string {
  let t = texto;

  // Remove blocos de código
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`[^`]+`/g, "");

  // Remove formatações markdown (negrito, itálico, títulos)
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/\*(.*?)\*/g, "$1");
  t = t.replace(/_{1,2}(.*?)_{1,2}/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\[id:[^\]]+\]/gi, "");
  t = t.replace(/\[(.*?)\]\([^)]+\)/g, "$1");

  // Remove parênteses plurais que soam robóticos no sintetizador de voz (TTS)
  t = t.replace(/\bcliente\(s\)/gi, "clientes");
  t = t.replace(/\bpet\(s\)/gi, "pets");
  t = t.replace(/\batendimento\(s\)/gi, "atendimentos");
  t = t.replace(/\bhorário\(s\)/gi, "horários");
  t = t.replace(/\bhorario\(s\)/gi, "horários");
  t = t.replace(/\btutor\(es\)/gi, "tutores");
  t = t.replace(/\bopção\(ões\)/gi, "opções");
  t = t.replace(/\(\s*s\s*\)/gi, "s");
  t = t.replace(/\(\s*es\s*\)/gi, "es");

  // Remove tabelas markdown
  t = t.replace(/\|[^\n]+\|/g, "");

  // Substitui emojis por pausas ou remove se causarem ruído no TTS
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // Normaliza quebras de linha para vírgulas/pausas naturais
  t = t.replace(/\n+/g, ". ");

  // Normaliza pontuação e múltiplos espaços
  t = t.replace(/\s*([.,;?!])\s*/g, "$1 ");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

