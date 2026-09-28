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

  let texto = respostaOriginal.trim();

  // 1. Tratamento de Ação Pendente / Confirmação Proposta
  const cardConfirmacao = (cards || []).find((c) => c.type === "confirmacao" || c.type === "confirmacao_agendamento");
  if (cardConfirmacao?.data) {
    const d = cardConfirmacao.data;
    // Se a ação já foi executada com sucesso, não repetir a pergunta de confirmação
    if (d.executado === true || d.pendingAction?.executado === true) {
      // Deixa o texto original da resposta (ex: "Agendamento confirmado!") ser falado
    } else {
      const pet = d.petNome || d.pet?.nome || d.pendingAction?.params?.petNome || "o pet";
      const servico = d.servicoNome || d.servico?.nome || d.pendingAction?.params?.servicoNome || "o serviço";
      const data = d.data || d.pendingAction?.params?.data || "hoje";
      const hora = (d.hora || d.pendingAction?.params?.hora) ? `às ${(d.hora || d.pendingAction?.params?.hora).slice(0, 5)}` : "";
      return `Preparei o agendamento do ${pet} para ${servico} ${data} ${hora}. Posso confirmar?`;
    }
  }

  // 2. Limpeza inteligente de formatação markdown e estruturação para leitura por voz
  let fala = limparMarcacaoTexto(texto);

  // Converte padrões de tópicos (• ou -) em fala contínua natural
  fala = fala
    .replace(/\s*[•*-]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  // Se a fala for muito longa (+450 caracteres), sintetiza para manter a agilidade na bancada sem perder o sentido
  if (fala.length > 450) {
    const sentencas = fala.match(/[^.!?]+[.!?]+/g) || [fala];
    if (sentencas.length >= 3) {
      // Fala as primeiras 2 a 3 frases essenciais
      fala = sentencas.slice(0, 3).join(" ").trim();
    }
  }

  return fala;
}

/**
 * Remove marcações técnicas, markdown, asteriscos, emojis e quebras de linha para áudio cristalino
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

  // Remove tabelas markdown
  t = t.replace(/\|[^\n]+\|/g, "");

  // Substitui emojis conhecidos por pausas ou remove se causarem ruído no TTS
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // Normaliza quebras de linha para vírgulas/pausas naturais
  t = t.replace(/\n+/g, ". ");

  // Normaliza pontuação e múltiplos espaços
  t = t.replace(/\s*([.,;?!])\s*/g, "$1 ");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

