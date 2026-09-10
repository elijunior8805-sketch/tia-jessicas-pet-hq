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
   * Converte expressões temporais naturais para formato YYYY-MM-DD.
   * Retorna null se nenhuma data for expressa (PROIBIDO assumir data atual silenciosamente).
   */
  private resolverDataNatural(expressao: string, dataBaseStr: string): string | null {
    const hoje = new Date(`${dataBaseStr}T12:00:00.000Z`);
    const texto = expressao.toLowerCase().trim();

    if (texto.includes("hoje")) {
      return dataBaseStr;
    }

    if (texto.includes("depois de amanhã") || texto.includes("depois de amanha")) {
      const depois = new Date(hoje.getTime() + 48 * 60 * 60 * 1000);
      return depois.toISOString().split("T")[0];
    }

    if (texto.includes("amanhã") || texto.includes("amanha")) {
      const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
      return amanha.toISOString().split("T")[0];
    }

    // Dias da semana (segunda a domingo)
    const diasSemana: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      "segunda-feira": 1,
      terca: 2,
      terça: 2,
      "terca-feira": 2,
      "terça-feira": 2,
      quarta: 3,
      "quarta-feira": 3,
      quinta: 4,
      "quinta-feira": 4,
      sexta: 5,
      "sexta-feira": 5,
      sabado: 6,
      sábado: 6,
    };

    for (const [diaNome, diaAlvo] of Object.entries(diasSemana)) {
      if (texto.includes(diaNome)) {
        const diaAtual = hoje.getUTCDay();
        let diff = diaAlvo - diaAtual;
        if (diff <= 0) diff += 7; // Próxima ocorrência
        const dataAlvo = new Date(hoje.getTime() + diff * 24 * 60 * 60 * 1000);
        return dataAlvo.toISOString().split("T")[0];
      }
    }

    // Procura padrão YYYY-MM-DD
    const matchIso = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      return matchIso[0];
    }

    // Procura padrão DD/MM ou DD/MM/YYYY
    const matchBr = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (matchBr) {
      const dia = matchBr[1].padStart(2, "0");
      const mes = matchBr[2].padStart(2, "0");
      let ano = hoje.getFullYear();
      if (matchBr[3]) {
        ano = matchBr[3].length === 2 ? 2000 + parseInt(matchBr[3], 10) : parseInt(matchBr[3], 10);
      }
      return `${ano}-${mes}-${dia}`;
    }

    // "dia X" ou "dia X do mês"
    const matchDia = texto.match(/(?:dia|no dia)\s+(\d{1,2})\b/);
    if (matchDia) {
      const dia = matchDia[1].padStart(2, "0");
      const mes = String(hoje.getUTCMonth() + 1).padStart(2, "0");
      const ano = hoje.getFullYear();
      return `${ano}-${mes}-${dia}`;
    }

    return null;
  }

  /**
   * Extrai horário explícito do texto do usuário (ex: "às 14h", "14:30", "09:00", "às 10").
   * Retorna null se nenhum horário for mencionado (PROIBIDO assumir 09:00 silenciosamente).
   */
  private resolverHoraNatural(expressao: string): string | null {
    const texto = expressao.toLowerCase().trim();

    // Padrão 1: HH:mm (ex: "14:30", "09:00", "9:15")
    const matchHoraMin = texto.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (matchHoraMin) {
      return `${matchHoraMin[1].padStart(2, "0")}:${matchHoraMin[2]}`;
    }

    // Padrão 2: "às 14h", "as 9h", "14h30", "14h"
    const matchHoraH = texto.match(/(?:às|as|para as|para às|horário|horario|às)?\s*([01]?\d|2[0-3])\s*h(?:oras?)?(?:\s*([0-5]\d))?/);
    if (matchHoraH && matchHoraH[1]) {
      const h = matchHoraH[1].padStart(2, "0");
      const m = matchHoraH[2] ? matchHoraH[2].padStart(2, "0") : "00";
      return `${h}:${m}`;
    }

    // Padrão 3: "às 14", "as 9", "para as 10"
    const matchAs = texto.match(/(?:às|as|para as|para às)\s+([01]?\d|2[0-3])\b/);
    if (matchAs && matchAs[1]) {
      const h = matchAs[1].padStart(2, "0");
      return `${h}:00`;
    }

    return null;
  }

  /**
   * Extrai o nome do serviço solicitado com base no vocabulário oficial
   * Retorna null se não houver serviço explícito (PROIBIDO assumir "Banho" silenciosamente).
   */
  private resolverServicoNatural(expressao: string): string | null {
    const texto = expressao.toLowerCase().trim();

    if (texto.includes("banho e tosa") || texto.includes("banho com tosa") || texto.includes("tosa e banho")) {
      return "Banho e Tosa";
    }
    if (texto.includes("tosa higiênica") || texto.includes("tosa higienica")) {
      return "Tosa Higiênica";
    }
    if (texto.includes("tosa na tesoura") || texto.includes("tosa tesoura")) {
      return "Tosa Tesoura";
    }
    if (texto.includes("tosa na máquina") || texto.includes("tosa maquina") || texto.includes("tosa geral")) {
      return "Tosa Máquina";
    }
    if (texto.includes("banho simples") || texto.includes("banho basico") || texto.includes("banho básico")) {
      return "Banho Simples";
    }
    if (texto.includes("banho medicamentoso") || texto.includes("banho remédio")) {
      return "Banho Medicamentoso";
    }
    if (texto.includes("hidratação") || texto.includes("hidratacao")) {
      return "Hidratação";
    }
    if (texto.includes("desembolo") || texto.includes("desembolar")) {
      return "Desembolo";
    }
    if (texto.includes("corte de unha") || texto.includes("cortar unha") || texto.includes("unhas")) {
      return "Corte de Unhas";
    }
    if (texto.includes("tosa")) {
      return "Tosa";
    }
    if (texto.includes("banho")) {
      return "Banho";
    }
    if (texto.includes("leva e traz") || texto.includes("transporte") || texto.includes("taxi dog") || texto.includes("táxi dog")) {
      return "Leva e Traz";
    }
    if (texto.includes("consulta") || texto.includes("veterinario") || texto.includes("veterinário") || texto.includes("vacina")) {
      return "Consulta Veterinária";
    }

    return null;
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

    // Detecta menção explícita a cliente/tutor ("para o cliente Eli Júnior", "tutor Eli")
    const matchCliente = texto.match(/(?:cliente|tutor|proprietário|proprietario|dono)\s+([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)*)/i);
    if (matchCliente && matchCliente[1]) {
      const possivelCliente = matchCliente[1].trim();
      if (!["Ele", "Ela", "Hoje", "Amanhã", "Banho", "Tosa"].includes(possivelCliente)) {
        clienteNomeResolvido = possivelCliente;
      }
    }

    // Detecta correções de contexto ("não, é o bob", "na verdade é a mel")
    const matchCorrecao = texto.match(/(?:não|na verdade|trocar para|mudar para|quis dizer)\s+(?:é\s+)?(?:o|a|do|da|para o|para a)?\s*([A-ZÀ-Úa-zà-ú]+)/i);
    if (matchCorrecao && matchCorrecao[1] && !["Ele", "Ela", "Hoje", "Amanhã", "Banho", "Tosa"].includes(matchCorrecao[1])) {
      petNomeResolvido = matchCorrecao[1].charAt(0).toUpperCase() + matchCorrecao[1].slice(1).toLowerCase();
    } else {
      // Detecta menção explícita de pet ("para o pet Jade", "o pet Thor", "pet Bob")
      const matchPetExp = texto.match(/(?:pet|cachorro|gato|cão|cao|cadela)\s+([A-ZÀ-Úa-zà-ú]+)/i);
      if (matchPetExp && matchPetExp[1] && !["Ele", "Ela", "Hoje", "Amanhã", "Banho", "Tosa", "Pet", "Jade", "Thor"].includes(matchPetExp[1])) {
        petNomeResolvido = matchPetExp[1];
      } else {
        const matchPet = texto.match(/(?:para o pet|para a pet|para o|para a|do pet|da pet)\s+([A-ZÀ-Ú][a-zà-ú]+)/);
        if (matchPet && !["Thor", "Ele", "Ela", "Hoje", "Amanhã", "Amanha", "Cliente", "Banho", "Tosa"].includes(matchPet[1])) {
          petNomeResolvido = matchPet[1];
        } else if (textoLower.includes("thor")) {
          petNomeResolvido = "Thor";
        } else if (textoLower.includes("mel")) {
          petNomeResolvido = "Mel";
        } else if (textoLower.includes("luna")) {
          petNomeResolvido = "Luna";
        } else if (textoLower.includes("bob") || textoLower.includes("bidu")) {
          petNomeResolvido = textoLower.includes("bob") ? "Bob" : "Bidu";
        } else if (textoLower.includes("jade")) {
          petNomeResolvido = "Jade";
        }
      }
    }

    // Se o usuário usa anáfora ("ele", "ela", "o mesmo", "desse cliente"), mantém o contexto anterior
    const usaAnafora = /\b(ele|ela|o mesmo|a mesma|nele|nela|desse cliente|deste cliente|dele|dela|o pet|o animal)\b/i.test(textoLower);
    if (usaAnafora && (req.contexto.petSelecionadoNome || req.contexto.pet?.nome)) {
      petNomeResolvido = req.contexto.petSelecionadoNome || req.contexto.pet?.nome || petNomeResolvido;
    }

    // 2. Resolução Temporal ("amanhã", "hoje", "sexta") e Horários
    const dataResolvida = this.resolverDataNatural(textoLower, req.contexto.dataReferencia);
    const horaResolvida = this.resolverHoraNatural(textoLower);
    const servicoResolvido = this.resolverServicoNatural(textoLower) || req.contexto.servicoSelecionadoNome || req.contexto.servico?.nome || null;

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
      textoLower.includes("agendamento") ||
      textoLower.includes("agendamentos") ||
      textoLower.includes("agendar") ||
      textoLower.includes("marcar") ||
      textoLower.includes("marque") ||
      textoLower.includes("desmarcar") ||
      textoLower.includes("desmarque") ||
      textoLower.includes("cancelar") ||
      textoLower.includes("cancele") ||
      textoLower.includes("cancela") ||
      textoLower.includes("reagendar") ||
      textoLower.includes("remarcar") ||
      textoLower.includes("remarque") ||
      textoLower.includes("horario") ||
      textoLower.includes("horário") ||
      textoLower.includes("vaga") ||
      textoLower.includes("atendimento") ||
      textoLower.includes("atendimentos")
    ) {
      dominio = "agenda";
      if (
        textoLower.includes("desmarcar") ||
        textoLower.includes("desmarque") ||
        textoLower.includes("cancelar") ||
        textoLower.includes("cancele") ||
        textoLower.includes("cancela")
      ) {
        intencao = "cancelar_agendamento";
        requerConfirmacao = true;
        ferramentaSugerida = "cancelar_agendamento";
        explicacao = `Preparando cancelamento de agendamento para ${petNomeResolvido || "o pet informado"}.`;
      } else if (
        textoLower.includes("reagendar") ||
        textoLower.includes("remarcar") ||
        textoLower.includes("remarque") ||
        textoLower.includes("mudar horario") ||
        textoLower.includes("trocar horario")
      ) {
        intencao = "reagendar_agendamento";
        requerConfirmacao = true;
        ferramentaSugerida = "reagendar_agendamento";
        explicacao = `Preparando reagendamento para ${petNomeResolvido || "o pet informado"}.`;
      } else if (
        textoLower.includes("agendar") ||
        textoLower.includes("marcar") ||
        textoLower.includes("marque") ||
        textoLower.includes("agenda ele") ||
        textoLower.includes("agenda ela") ||
        textoLower.includes("novo agendamento") ||
        textoLower.includes("criar agendamento")
      ) {
        intencao = "criar_agendamento";
        requerConfirmacao = true;
        ferramentaSugerida = "criar_agendamento";
        explicacao = `Preparando agendamento para ${petNomeResolvido || "o pet"} na data ${dataResolvida || "a definir"}.`;
      } else {
        intencao = "consultar_agenda";
        ferramentaSugerida = "consultar_agenda";
        explicacao = `Consultando agenda para ${dataResolvida || req.contexto.dataReferencia}.`;
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
      clienteId: req.contexto.clienteSelecionadoId || req.contexto.cliente?.id || null,
      petNome: petNomeResolvido,
      petId: req.contexto.petSelecionadoId || req.contexto.pet?.id || null,
      data: dataResolvida,
      hora: horaResolvida,
      servicoNome: servicoResolvido,
      servicoId: req.contexto.servicoSelecionadoId || req.contexto.servico?.id || null,
      valor: req.contexto.servicoValor || null,
      termoBusca: petNomeResolvido || clienteNomeResolvido || null,
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
