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
    return `Preparei o agendamento do ${pet} para ${servico} ${data} ${hora}. Posso confirmar?`;
  }

  // 2. Tratamento de Desambiguação / Múltiplas Opções de Pets ou Tutores
  if (texto.includes("Selecione") || texto.includes("candidatos") || texto.includes("opções") || texto.includes("opcoes") || texto.includes("mais de um")) {
    if (texto.includes("pet") || texto.includes("pets")) {
      return "Encontrei mais de um pet cadastrado. De qual deles você gostaria de cuidar?";
    }
    if (texto.includes("cliente") || texto.includes("tutor")) {
      return "Encontrei mais de um tutor com esse nome. Deixei as opções na tela para você escolher.";
    }
  }

  // 3. Tratamento de Lembretes / WhatsApp / Confirmações
  if (texto.includes("lembrete") || texto.includes("WhatsApp") || texto.includes("confirmação de presença")) {
    return "Preparei as mensagens de confirmação para os clientes na tela. Quer que eu envie?";
  }

  // 4. Se a resposta já for curta e conversacional (<= 140 caracteres e sem listas)
  if (texto.length <= 140 && !texto.includes("\n-") && !texto.includes("\n•") && !texto.includes("|") && !texto.includes("1.")) {
    return limparMarcacaoTexto(texto);
  }

  // 5. Tratamento de Agenda / Atendimentos / Próximo Pet / Bancada
  const cardAgenda = (cards || []).find((c) => c.type === "agenda");
  if (cardAgenda?.data) {
    if (cardAgenda.data.tipo === "proximo_pet") {
      const proximo = cardAgenda.data.proximo;
      if (!proximo) {
        return "Não há próximos atendimentos pendentes na grade de hoje.";
      }
      const pet = proximo.pets?.nome || "o pet";
      const servico = proximo.servicos?.nome || "atendimento";
      const hora = proximo.hora ? `às ${String(proximo.hora).slice(0, 5)}` : "";
      const tutor = proximo.clientes?.nome ? `, do tutor ${proximo.clientes.nome.split(" ")[0]}` : "";
      return `O próximo pet na fila é o ${pet} para ${servico} ${hora}${tutor}.`;
    }

    if (cardAgenda.data.tipo === "em_atendimento") {
      const itens = cardAgenda.data.itens || [];
      if (itens.length === 0) {
        return "No momento não há nenhum pet em atendimento na bancada.";
      }
      const nomes = itens.map((a: any) => a.pets?.nome || "Pet").join(", ");
      return `Temos ${itens.length} pet(s) em atendimento agora: ${nomes}.`;
    }

    const itensAgenda = Array.isArray(cardAgenda.data)
      ? cardAgenda.data
      : Array.isArray(cardAgenda.data.itens)
      ? cardAgenda.data.itens
      : cardAgenda.data.todosAtivos || [];

    if (itensAgenda.length > 0) {
      const qtd = itensAgenda.length;
      const primeiro = itensAgenda[0];
      const petPri = primeiro.pets?.nome || primeiro.petNome || "o próximo pet";
      const horaPri = primeiro.hora ? `às ${String(primeiro.hora).slice(0, 5)}` : "";

      if (qtd === 1) {
        return `Você tem 1 atendimento hoje com o ${petPri} ${horaPri}. Detalhes no painel!`;
      }
      return `Você tem ${qtd} atendimentos agendados para hoje. O próximo é o ${petPri} ${horaPri}.`;
    }

    if (texto.includes("grade está 100% livre") || texto.includes("Não há agendamentos") || texto.includes("não há nenhum atendimento")) {
      return "Hoje a grade de atendimentos está livre, sem nenhum agendamento marcado.";
    }
  }

  // 6. Tratamento de Financeiro / Faturamento
  const cardFin = (cards || []).find((c) => c.type === "financeiro");
  if (cardFin?.data) {
    const d = cardFin.data;
    if (d.faturamento !== undefined || d.receitaBruta !== undefined || d.faturamentoBruto !== undefined) {
      const fat = d.faturamento || d.receitaBruta || d.faturamentoBruto || 0;
      const rec = d.recebido || d.totalRecebido || d.valoresRecebidos || 0;
      const pend = d.pendente || d.valoresAReceber || 0;
      return `O faturamento do mês está em R$ ${fat.toLocaleString("pt-BR")}, com R$ ${rec.toLocaleString("pt-BR")} recebidos e R$ ${pend.toLocaleString("pt-BR")} em aberto.`;
    }
  }

  // 7. Tratamento Genérico: Extração das 1 ou 2 primeiras frases essenciais
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
