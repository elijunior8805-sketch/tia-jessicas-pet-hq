/**
 * Módulo de Formatação Conversacional para Canal de Voz (Estilo ChatGPT / Gemini Live)
 * 
 * Transforma respostas técnicas/estruturadas em diálogos falados curtos, ágeis,
 * empáticos e humanizados (máximo 1 a 2 frases diretas), deixando o detalhamento
 * para os cartões visuais exibidos na tela.
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
    const pet = d.petNome || d.pet?.nome || "o pet";
    const servico = d.servicoNome || d.servico?.nome || "o serviço";
    const data = d.data || "hoje";
    const hora = d.hora ? `às ${d.hora.slice(0, 5)}` : "";
    return `Preparei o atendimento do ${pet} para ${servico} ${data} ${hora}. Posso confirmar?`;
  }

  // 2. Se a resposta já for curta e conversacional (<= 160 caracteres e sem listas)
  if (texto.length <= 160 && !texto.includes("\n-") && !texto.includes("\n•") && !texto.includes("|")) {
    return limparMarcacaoTexto(texto);
  }

  // 3. Tratamento de Agenda / Atendimentos (quando há múltiplos itens)
  const cardAgenda = (cards || []).find((c) => c.type === "agenda");
  if (cardAgenda?.data?.itens && Array.isArray(cardAgenda.data.itens) && cardAgenda.data.itens.length > 0) {
    const itens = cardAgenda.data.itens;
    const qtd = itens.length;
    const primeiro = itens[0];
    const petPri = primeiro.pets?.nome || primeiro.petNome || "o próximo pet";
    const horaPri = primeiro.hora ? `às ${primeiro.hora.slice(0, 5)}` : "";

    if (qtd === 1) {
      return `Você tem 1 atendimento agendado para hoje com o ${petPri} ${horaPri}. Detalhes na tela!`;
    }
    return `Você tem ${qtd} atendimentos agendados para hoje. O próximo é o ${petPri} ${horaPri}. Deixei a lista completa na tela.`;
  }

  // 4. Tratamento de Financeiro / Faturamento
  const cardFin = (cards || []).find((c) => c.type === "financeiro");
  if (cardFin?.data) {
    const d = cardFin.data;
    if (d.faturamento !== undefined || d.receitaBruta !== undefined) {
      const fat = d.faturamento || d.receitaBruta || 0;
      const rec = d.recebido || d.totalRecebido || 0;
      return `Seu faturamento acumulado está em R$ ${fat.toLocaleString("pt-BR")}, com R$ ${rec.toLocaleString("pt-BR")} já recebidos. Indicadores na tela.`;
    }
  }

  // 5. Tratamento Genérico: Extração das 1 ou 2 primeiras frases essenciais
  const textoLimpo = limparMarcacaoTexto(texto);

  // Divide por frases terminadas em ponto, exclamação ou interrogação
  const frases = textoLimpo.match(/[^.!?]+[.!?]+/g) || [textoLimpo];
  
  if (frases.length <= 2) {
    return frases.join(" ").trim();
  }

  // Pega a primeira frase (contexto) e a última se for uma pergunta de ação
  const primeiraFrase = frases[0].trim();
  const ultimaFrase = frases[frases.length - 1].trim();

  if (ultimaFrase.endsWith("?")) {
    return `${primeiraFrase} ${ultimaFrase}`;
  }

  return `${primeiraFrase} ${frases[1].trim()}`;
}

/**
 * Remove marcações técnicas, markdown, asteriscos, emojis e quebras de linha
 */
export function limparMarcacaoTexto(texto: string): string {
  let t = texto;

  // Remove blocos de código
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`[^`]+`/g, "");

  // Remove formatações markdown
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/\*(.*?)\*/g, "$1");
  t = t.replace(/_{1,2}(.*?)_{1,2}/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^[•*\-–—]\s+/gm, "");
  t = t.replace(/^\d+\.\s+/gm, "");
  t = t.replace(/\[id:[^\]]+\]/gi, "");
  t = t.replace(/\[(.*?)\]\([^)]+\)/g, "$1");

  // Remove tabelas markdown
  t = t.replace(/\|[^\n]+\|/g, "");

  // Remove quebras de linha duplas
  t = t.replace(/\n+/g, " ");

  // Remove múltiplos espaços
  t = t.replace(/\s+/g, " ").trim();

  return t;
}
