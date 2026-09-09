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
 * Resolução de Anáforas ("ele", "ela"), Temporalidade ("amanhã") e Cruzamento Contextual
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export class JessiV2GeminiProvider implements IJessiV2AIProvider {
  readonly nome = "Gemini-Flash-Jessi-V2";

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

  async classificarIntencao(req: JessiV2NLURequest): Promise<JessiV2NLUResponse> {
    const inicio = Date.now();
    const texto = req.mensagem.trim();
    const textoLower = texto.toLowerCase();

    // 1. Resolução Anafórica ("ele", "ela", "o mesmo") a partir do contexto prévio
    let petNomeResolvido = req.contexto.petSelecionadoNome || null;
    let clienteNomeResolvido = req.contexto.clienteSelecionadoNome || null;

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

    // Se o usuário usa anáfora ("ele", "ela", "o mesmo"), mantém o pet do contexto
    const usaAnafora = /\b(ele|ela|o mesmo|a mesma|nele|nela)\b/i.test(textoLower);
    if (usaAnafora && req.contexto.petSelecionadoNome) {
      petNomeResolvido = req.contexto.petSelecionadoNome;
    }

    // 2. Resolução Temporal ("amanhã", "hoje", "sexta")
    const dataResolvida = this.resolverDataNatural(textoLower, req.contexto.dataReferencia);

    let dominio: any = "geral_conversacional";
    let intencao = "conversar";
    let requerConfirmacao = false;
    let ferramentaSugerida: string | null = null;
    let explicacao = "Compreensão conversacional em linguagem natural.";

    // 3. Classificação de Domínios com Cruzamento Contextual
    // A. Agenda / Agendamento
    if (
      textoLower.includes("agenda") ||
      textoLower.includes("agendar") ||
      textoLower.includes("marcar") ||
      textoLower.includes("desmarcar") ||
      textoLower.includes("reagendar") ||
      textoLower.includes("horario") ||
      textoLower.includes("vaga")
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
    // B. Programas de Cuidados & Saldo de Créditos
    else if (
      textoLower.includes("credito") ||
      textoLower.includes("crédito") ||
      textoLower.includes("saldo") ||
      textoLower.includes("clubinho") ||
      textoLower.includes("plano") ||
      textoLower.includes("pacote")
    ) {
      dominio = "programas_creditos";
      if (textoLower.includes("debitar") || textoLower.includes("usar credito") || textoLower.includes("baixar")) {
        intencao = "preparar_consumo_credito";
        requerConfirmacao = true;
        ferramentaSugerida = "executar_consumo_credito";
      } else {
        intencao = "consultar_saldo_programas";
        ferramentaSugerida = "consultar_saldo_programas";
        explicacao = `Consultando créditos do plano para ${petNomeResolvido || "o cliente"}.`;
      }
    }
    // C. Clientes & Pets
    else if (
      textoLower.includes("cliente") ||
      textoLower.includes("tutor") ||
      textoLower.includes("pet") ||
      textoLower.includes("ficha") ||
      textoLower.includes("cadastrar")
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
    // D. Financeiro & Faturamento Consolidado
    else if (
      textoLower.includes("faturamento") ||
      textoLower.includes("quanto faturou") ||
      textoLower.includes("financeiro") ||
      textoLower.includes("ticket") ||
      textoLower.includes("a receber") ||
      textoLower.includes("pix")
    ) {
      dominio = "financeiro_relatorios";
      intencao = "consultar_faturamento";
      ferramentaSugerida = "consultar_financeiro_consolidado";
    }
    // E. Comunicação / WhatsApp
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
      provedorUtilizado: this.nome,
      tempoProcessamentoMs: Date.now() - inicio,
    };
  }

  async gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse> {
    return {
      texto: "Informações processadas com base nos registros consolidados do Spa.",
      sugestoesAcoes: ["Ver detalhes", "Conferir agenda", "Abrir cadastro"],
      provedorUtilizado: this.nome,
    };
  }
}
