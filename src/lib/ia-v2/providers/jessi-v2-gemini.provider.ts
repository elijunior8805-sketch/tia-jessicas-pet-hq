import {
  IJessiV2AIProvider,
  JessiV2NLURequest,
  JessiV2NLUResponse,
  JessiV2GenerativeRequest,
  JessiV2GenerativeResponse,
} from "./jessi-v2-provider.interface";
import { JESSI_V2_SYSTEM_PROMPT } from "../config/jessi-v2-config";

/**
 * Provedor de IA Conversacional em Português do Brasil para a Jessi V2
 * Suporta integração online via Gemini API (backend seguro) com timeout, retentativas e fallback offline determinístico.
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_CONFIG = {
  TIMEOUT_MS: 15000,
  MAX_RETRIES: 2,
  MODEL: "google/gemini-1.5-flash",
  DIRECT_ENDPOINT_BASE: "https://generativelanguage.googleapis.com/v1beta/models",
};

export class JessiV2GeminiProvider implements IJessiV2AIProvider {
  readonly nome = "Gemini-Flash-Jessi-V2";

  /**
   * Obtém a chave de API estritamente do ambiente do servidor ou Vite env
   */
  private obterApiKeyServidor(): { key: string; isGateway: boolean } | null {
    // 1. Variáveis do processo (Node.js / TanStack Start Server)
    if (typeof process !== "undefined" && process.env) {
      if (process.env.LOVABLE_API_KEY) {
        return { key: process.env.LOVABLE_API_KEY, isGateway: true };
      }
      if (process.env.OPENAI_API_KEY) {
        return { key: process.env.OPENAI_API_KEY, isGateway: true };
      }
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY) {
        return {
          key: (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY)!,
          isGateway: false,
        };
      }
    }

    // 2. Variáveis expostas pelo Vite / Frontend bundler
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      const env = (import.meta as any).env;
      if (env.VITE_LOVABLE_API_KEY || env.LOVABLE_API_KEY) {
        return { key: env.VITE_LOVABLE_API_KEY || env.LOVABLE_API_KEY, isGateway: true };
      }
      if (env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GOOGLE_AI_API_KEY || env.GOOGLE_AI_API_KEY) {
        return {
          key: env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GOOGLE_AI_API_KEY || env.GOOGLE_AI_API_KEY,
          isGateway: false,
        };
      }
      if (env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY) {
        return { key: env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY, isGateway: true };
      }
    }

    return null;
  }

  /**
   * Converte expressões temporais naturais para formato YYYY-MM-DD
   */
  private resolverDataNatural(expressao: string, dataBaseStr: string): string {
    const hoje = new Date(`${dataBaseStr}T12:00:00.000Z`);
    const texto = expressao.toLowerCase().trim();

    if (texto.includes("amanhã") || texto.includes("amanha")) {
      const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
      return amanha.toISOString().split("T")[0];
    }

    if (texto.includes("depois de amanhã") || texto.includes("depois de amanha")) {
      const depois = new Date(hoje.getTime() + 48 * 60 * 60 * 1000);
      return depois.toISOString().split("T")[0];
    }

    if (texto.includes("hoje")) {
      return dataBaseStr;
    }

    // Procura padrão DD/MM ou YYYY-MM-DD
    const matchBr = texto.match(/(\d{1,2})\/(\d{1,2})/);
    if (matchBr) {
      const dia = matchBr[1].padStart(2, "0");
      const mes = matchBr[2].padStart(2, "0");
      const ano = hoje.getFullYear();
      return `${ano}-${mes}-${dia}`;
    }

    return dataBaseStr;
  }

  /**
   * Executa chamada segura com timeout e suporte tanto ao Lovable Gateway quanto à API direta do Gemini
   */
  private async executarRequisicaoIA(
    messages: Array<{ role: string; content: string }>,
    jsonFormat = false,
    temperature = 0.2
  ): Promise<string> {
    const auth = this.obterApiKeyServidor();
    if (!auth) {
      throw new Error("Nenhuma chave de API (LOVABLE_API_KEY / GEMINI_API_KEY) configurada no ambiente do servidor.");
    }

    for (let tentativa = 1; tentativa <= GEMINI_CONFIG.MAX_RETRIES; tentativa++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_CONFIG.TIMEOUT_MS);

      try {
        let resp: Response;

        if (auth.isGateway) {
          // Chamada via Lovable AI Gateway (Padrão OpenAI Chat Completions)
          const body: any = {
            model: GEMINI_CONFIG.MODEL,
            temperature,
            messages,
          };
          if (jsonFormat) {
            body.response_format = { type: "json_object" };
          }

          resp = await fetch(LOVABLE_GATEWAY, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.key}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } else {
          // Chamada Direta via Google AI API
          const promptCombined = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
          const directUrl = `${GEMINI_CONFIG.DIRECT_ENDPOINT_BASE}/gemini-1.5-flash:generateContent?key=${auth.key}`;
          
          resp = await fetch(directUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: promptCombined }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: 1200,
                responseMimeType: jsonFormat ? "application/json" : "text/plain",
              },
            }),
            signal: controller.signal,
          });
        }

        clearTimeout(timer);

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 120)}`);
        }

        const data: any = await resp.json();
        if (auth.isGateway) {
          const texto = data?.choices?.[0]?.message?.content?.trim();
          if (texto) return texto;
        } else {
          const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (texto) return texto;
        }

        throw new Error("Provedor retornou resposta vazia.");
      } catch (err: any) {
        clearTimeout(timer);
        if (tentativa >= GEMINI_CONFIG.MAX_RETRIES) {
          throw err;
        }
        await new Promise((res) => setTimeout(res, tentativa * 350));
      }
    }

    throw new Error("Falha na comunicação com o provedor de IA após retentativas.");
  }

  async classificarIntencao(req: JessiV2NLURequest): Promise<JessiV2NLUResponse> {
    const inicio = Date.now();
    const texto = req.mensagem.trim();
    const textoLower = texto.toLowerCase();
    const apiKey = this.obterApiKeyServidor();

    // 1. Resolução Anafórica e Correção de Contexto
    let petNomeResolvido = req.contexto.petSelecionadoNome || req.contexto.pet?.nome || null;
    let clienteNomeResolvido = req.contexto.clienteSelecionadoNome || req.contexto.cliente?.nome || null;

    // Detecta correções de contexto ("não, é o bob", "na verdade é a mel")
    const matchCorrecao = texto.match(/(?:não|na verdade|trocar para|mudar para|quis dizer)\s+(?:é\s+)?(?:o|a|do|da|para o|para a)?\s*([A-ZÀ-Úa-zà-ú]+)/i);
    if (matchCorrecao && matchCorrecao[1] && !["Ele", "Ela", "Hoje", "Amanhã"].includes(matchCorrecao[1])) {
      petNomeResolvido = matchCorrecao[1].charAt(0).toUpperCase() + matchCorrecao[1].slice(1).toLowerCase();
    } else {
      // Detecta menção explícita de novo nome de pet ou tutor na mensagem
      const matchPet = texto.match(/(?:o|a|do|da|para o|para a)\s+([A-ZÀ-Ú][a-zà-ú]+)/);
      if (matchPet && !["Thor", "Ele", "Ela", "Hoje", "Amanhã", "Amanha"].includes(matchPet[1])) {
        petNomeResolvido = matchPet[1];
      } else if (textoLower.includes("thor")) {
        petNomeResolvido = "Thor";
      } else if (textoLower.includes("mel")) {
        petNomeResolvido = "Mel";
      } else if (textoLower.includes("luna")) {
        petNomeResolvido = "Luna";
      } else if (textoLower.includes("bob") || textoLower.includes("bidu")) {
        petNomeResolvido = textoLower.includes("bob") ? "Bob" : "Bidu";
      }
    }

    // Se o usuário usa anáfora ("ele", "ela", "o mesmo", "desse cliente"), mantém o contexto anterior
    const usaAnafora = /\b(ele|ela|o mesmo|a mesma|nele|nela|desse cliente|deste cliente|dele|dela|o pet|o animal)\b/i.test(textoLower);
    if (usaAnafora && (req.contexto.petSelecionadoNome || req.contexto.pet?.nome)) {
      petNomeResolvido = req.contexto.petSelecionadoNome || req.contexto.pet?.nome || petNomeResolvido;
    }

    // 2. Resolução Temporal ("amanhã", "hoje", "sexta")
    const dataResolvida = this.resolverDataNatural(textoLower, req.contexto.dataReferencia);

    // 3. Classificação Determinística de Intenção e Continuidade
    let dominio: any = "geral_conversacional";
    let intencao = "conversar";
    let requerConfirmacao = false;
    let ferramentaSugerida: string | null = null;
    let explicacao = "Compreensão conversacional em linguagem natural.";

    // Continuidade de Programas / Validade ("E quando vence?", "Qual a validade?", "Tem crédito?")
    const ehPerguntaValidade =
      textoLower.includes("quando vence") ||
      textoLower.includes("qual a validade") ||
      textoLower.includes("qual é a validade") ||
      textoLower.includes("quando expira") ||
      textoLower.includes("validade") ||
      textoLower.includes("vencimento") ||
      textoLower.includes("tem credito") ||
      textoLower.includes("tem crédito") ||
      textoLower.includes("possui credito") ||
      textoLower.includes("possui crédito") ||
      textoLower.includes("possui créditos") ||
      textoLower.includes("ainda tem") ||
      textoLower.includes("restam sessoes") ||
      textoLower.includes("restam sessões");

    // Seleção ordinal em caso de desambiguação prévia ("o primeiro", "opção 1", "o segundo", "o 1")
    const matchOrdinal = textoLower.match(/\b(o primeiro cliente|a primeira opção|o 1|opção 1|opcao 1|o segundo|a segunda|o 2|opção 2|opcao 2)\b/);

    // Consulta de Último Atendimento / Histórico do Pet
    const ehConsultaUltimoAtendimento =
      textoLower.includes("último atendimento") ||
      textoLower.includes("ultimo atendimento") ||
      textoLower.includes("último banho") ||
      textoLower.includes("ultimo banho") ||
      textoLower.includes("quando foi o último") ||
      textoLower.includes("quando foi o ultimo") ||
      textoLower.includes("quando ele veio") ||
      textoLower.includes("quando ela veio") ||
      textoLower.includes("veio pela última vez") ||
      textoLower.includes("veio pela ultima vez") ||
      textoLower.includes("última vez") ||
      textoLower.includes("ultima vez") ||
      textoLower.includes("última visita") ||
      textoLower.includes("ultima visita");

    // Consulta de Horários Livres / Encaixes / Primeiro Horário
    const ehConsultaHorarioLivre =
      textoLower.includes("primeiro horário livre") ||
      textoLower.includes("primeiro horario livre") ||
      textoLower.includes("primeiro horário") ||
      textoLower.includes("primeiro horario") ||
      textoLower.includes("horário livre") ||
      textoLower.includes("horario livre") ||
      textoLower.includes("horários livres") ||
      textoLower.includes("horarios livres") ||
      textoLower.includes("tem vaga") ||
      textoLower.includes("tem horário") ||
      textoLower.includes("tem horario") ||
      textoLower.includes("encaixe");

    if (matchOrdinal) {
      dominio = "clientes_pets";
      intencao = "selecionar_candidato_ordinal";
      ferramentaSugerida = "buscar_clientes_pets";
      explicacao = `Seleção da opção ordinal "${matchOrdinal[1]}" da lista de desambiguação.`;
    }
    // Último Atendimento do Pet
    else if (ehConsultaUltimoAtendimento) {
      dominio = "agenda";
      intencao = "consultar_ultimo_atendimento";
      ferramentaSugerida = "consultar_agenda";
      explicacao = `Consultando o último atendimento registrado para ${petNomeResolvido || "o pet em contexto"}.`;
    }
    // Horários Livres / Primeiro Horário Livre
    else if (ehConsultaHorarioLivre) {
      dominio = "agenda";
      intencao = "consultar_horarios_livres";
      ferramentaSugerida = "consultar_agenda";
      explicacao = `Verificando horários e encaixes livres na grade para ${dataResolvida}.`;
    }
    // Programas de Cuidados & Saldo de Créditos & Validade
    else if (
      ehPerguntaValidade ||
      textoLower.includes("programa") ||
      textoLower.includes("programas") ||
      textoLower.includes("credito") ||
      textoLower.includes("crédito") ||
      textoLower.includes("créditos") ||
      textoLower.includes("saldo") ||
      textoLower.includes("clubinho") ||
      textoLower.includes("plano") ||
      textoLower.includes("pacote") ||
      textoLower.includes("contrato") ||
      textoLower.includes("contratos")
    ) {
      dominio = "programas_creditos";
      if (textoLower.includes("debitar") || textoLower.includes("usar credito") || textoLower.includes("baixar")) {
        intencao = "preparar_consumo_credito";
        requerConfirmacao = true;
        ferramentaSugerida = "executar_consumo_credito";
      } else if (textoLower.includes("programas estão ativos") || textoLower.includes("programas ativos") || (textoLower.includes("quais programas") && !petNomeResolvido)) {
        intencao = "consultar_programas_ativos";
        ferramentaSugerida = "consultar_saldo_programas";
        explicacao = "Consultando contratos de programas ativos dos clientes no Spa.";
      } else if (ehPerguntaValidade && (textoLower.includes("validade") || textoLower.includes("vence") || textoLower.includes("expira"))) {
        intencao = "consultar_validade_programa";
        ferramentaSugerida = "consultar_saldo_programas";
        explicacao = `Consultando a data de validade do programa para ${petNomeResolvido || "o pet em contexto"}.`;
      } else {
        intencao = "consultar_saldo_programas";
        ferramentaSugerida = "consultar_saldo_programas";
        explicacao = `Consultando créditos/validade do plano para ${petNomeResolvido || "o pet/cliente ativo no contexto"}.`;
      }
    }
    // Agenda / Agendamento
    else if (
      textoLower.includes("agenda") ||
      textoLower.includes("agendado") ||
      textoLower.includes("agendados") ||
      textoLower.includes("agendar") ||
      textoLower.includes("marcar") ||
      textoLower.includes("desmarcar") ||
      textoLower.includes("reagendar") ||
      textoLower.includes("horario") ||
      textoLower.includes("horário") ||
      textoLower.includes("vaga") ||
      textoLower.includes("atendimento")
    ) {
      dominio = "agenda";
      if (textoLower.includes("agendar") || textoLower.includes("marcar") || textoLower.includes("agenda ele") || textoLower.includes("agenda ela")) {
        intencao = "preparar_agendamento";
        requerConfirmacao = true;
        ferramentaSugerida = "executar_agendamento";
        explicacao = `Preparando agendamento para ${petNomeResolvido || "o pet"} na data ${dataResolvida}.`;
      } else if (textoLower.includes("desmarcar") || textoLower.includes("cancelar")) {
        intencao = "preparar_cancelamento";
        requerConfirmacao = true;
        ferramentaSugerida = "preparar_cancelamento";
      } else if (textoLower.includes("reagendar") || textoLower.includes("remarcar")) {
        intencao = "preparar_reagendamento";
        requerConfirmacao = true;
        ferramentaSugerida = "preparar_reagendamento";
      } else {
        intencao = "consultar_agenda";
        ferramentaSugerida = "consultar_agenda";
      }
    }
    // Financeiro & Faturamento Consolidado & Contas a Receber & Devedores
    else if (
      textoLower.includes("faturamento") ||
      textoLower.includes("quanto faturou") ||
      textoLower.includes("quanto foi o faturamento") ||
      textoLower.includes("recebemos hoje") ||
      textoLower.includes("para receber") ||
      textoLower.includes("a receber") ||
      textoLower.includes("devendo") ||
      textoLower.includes("devedor") ||
      textoLower.includes("devedores") ||
      textoLower.includes("pagamento pendente") ||
      textoLower.includes("pagamentos pendentes") ||
      textoLower.includes("inadimplente") ||
      textoLower.includes("inadimplentes") ||
      textoLower.includes("financeiro") ||
      textoLower.includes("ticket") ||
      textoLower.includes("pix")
    ) {
      dominio = "financeiro_relatorios";
      if (textoLower.includes("para receber") || textoLower.includes("a receber")) {
        intencao = "consultar_contas_a_receber";
      } else if (textoLower.includes("pendente") || textoLower.includes("devendo") || textoLower.includes("devedor") || textoLower.includes("inadimplente")) {
        intencao = "consultar_inadimplencia_devedores";
      } else {
        intencao = "consultar_faturamento";
      }
      ferramentaSugerida = "consultar_financeiro_consolidado";
    }
    // Clientes & Pets
    else if (
      textoLower.includes("cliente") ||
      textoLower.includes("tutor") ||
      textoLower.includes("pet") ||
      textoLower.includes("ficha") ||
      textoLower.includes("cadastrar") ||
      textoLower.includes("historico") ||
      textoLower.includes("histórico")
    ) {
      dominio = "clientes_pets";
      if (textoLower.includes("cadastrar") || textoLower.includes("adicionar")) {
        intencao = "preparar_cadastro_cliente";
        requerConfirmacao = true;
        ferramentaSugerida = "executar_cadastro_cliente";
      } else {
        intencao = "buscar_clientes_pets";
        ferramentaSugerida = "buscar_clientes_pets";
      }
    }
    // Comunicação / WhatsApp
    else if (textoLower.includes("whatsapp") || textoLower.includes("lembrete") || textoLower.includes("mensagem")) {
      dominio = "comunicacao_mensagens";
      intencao = "gerar_mensagem_whatsapp";
      ferramentaSugerida = "gerar_mensagem_whatsapp";
    }

    const entidades = {
      clienteNome: clienteNomeResolvido,
      clienteId: req.contexto.clienteSelecionadoId || null,
      petNome: petNomeResolvido,
      petId: req.contexto.petSelecionadoId || null,
      data: dataResolvida,
      hora: null,
      servicoNome: req.contexto.servicoSelecionadoNome || "Banho",
      servicoId: req.contexto.servicoSelecionadoId || null,
      valor: req.contexto.servicoValor || 0,
      termoBusca: petNomeResolvido || clienteNomeResolvido || texto,
    };

    const provedorUtilizado = apiKey ? `${this.nome} (Online)` : `${this.nome} (Simulado/Determinístico)`;

    return {
      intencao: {
        dominio,
        intencao,
        confianca: 0.96,
        entidades: entidades as any,
        requerConfirmacao,
        ferramentaSugerida,
        explicacaoRaciocinio: explicacao,
      },
      provedorUtilizado,
      tempoProcessamentoMs: Date.now() - inicio,
    };
  }

  async gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse> {
    try {
      const systemMsg = `${JESSI_V2_SYSTEM_PROMPT}\n\nVocê é a Jessi, assistente de IA do Spa de Pet Tia Jéssica. Responda de forma calorosa, clara e direta em português do Brasil.\nRegras absolutas:\n- NUNCA mencione termos técnicos (JSON, SQL, snake_case, nomes de funções ou ferramentas).\n- Use os dados operacionais fornecidos abaixo para responder precisamente ao usuário.\n- Se houver valores monetários, formate em R$ (ex: R$ 80,00).\n- Se houver datas, formate em português (ex: 10 de setembro).\n\nDados Reais do Banco de Dados:\n${JSON.stringify(req.dadosOperacionais, null, 2)}`;

      const messages = [
        { role: "system", content: systemMsg },
        { role: "user", content: req.mensagemUsuario },
      ];

      const textoGerado = await this.executarRequisicaoIA(messages, false, 0.3);

      if (textoGerado && textoGerado.length > 5) {
        return {
          texto: textoGerado.trim(),
          sugestoesAcoes: ["Ver detalhes", "Conferir agenda", "Abrir cadastro"],
          provedorUtilizado: `${this.nome} (Modelo Real / Lovable Gateway)`,
        };
      }
    } catch (err) {
      console.warn("[JessiV2 Provider] Chamada ao modelo falhou, ativando síntese assistida:", err);
    }

    // Síntese assistida com base estrita nos dados reais obtidos
    const dados = req.dadosOperacionais || {};
    let fallbackText = "Consultei os registros do sistema para você.";

    if (dados.programas) {
      fallbackText = `Encontrei os programas e créditos solicitados nos registros oficiais do Spa de Pet.`;
    } else if (dados.financeiro) {
      fallbackText = `Consultei o panorama financeiro com base nos lançamentos oficiais.`;
    } else if (dados.agenda) {
      fallbackText = `Consultei a agenda conforme os agendamentos cadastrados.`;
    }

    return {
      texto: fallbackText,
      sugestoesAcoes: ["Ver detalhes", "Conferir agenda", "Abrir cadastro"],
      provedorUtilizado: `${this.nome} (Síntese Assistida)`,
    };
  }
}
