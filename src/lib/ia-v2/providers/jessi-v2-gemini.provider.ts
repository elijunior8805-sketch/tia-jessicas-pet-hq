import {
  IJessiV2AIProvider,
  JessiV2NLURequest,
  JessiV2NLUResponse,
  JessiV2GenerativeRequest,
  JessiV2GenerativeResponse,
} from "./jessi-v2-provider.interface";
import { JESSI_V2_SYSTEM_PROMPT } from "../config/jessi-v2-config";

/**
 * Provedor de IA Baseado no Gemini para a Jessi V2
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export class JessiV2GeminiProvider implements IJessiV2AIProvider {
  readonly nome = "Gemini-Flash-Jessi-V2";

  async classificarIntencao(req: JessiV2NLURequest): Promise<JessiV2NLUResponse> {
    const inicio = Date.now();
    const texto = req.mensagem.trim();
    const textoLower = texto.toLowerCase();

    // Heurística de pré-classificação rápida e resiliente
    let dominio: any = "geral_conversacional";
    let intencao = "conversar";
    let requerConfirmacao = false;
    let ferramentaSugerida: string | null = null;
    const entidades: Record<string, any> = {
      clienteNome: req.contexto.clienteSelecionadoNome || null,
      clienteId: req.contexto.clienteSelecionadoId || null,
      petNome: req.contexto.petSelecionadoNome || null,
      petId: req.contexto.petSelecionadoId || null,
      data: req.contexto.dataReferencia || null,
      termoBusca: null,
    };

    // 1. Domínio Agenda
    if (
      textoLower.includes("agenda") ||
      textoLower.includes("horario") ||
      textoLower.includes("agendamento") ||
      textoLower.includes("agendar") ||
      textoLower.includes("desmarcar") ||
      textoLower.includes("reagendar") ||
      textoLower.includes("vaga")
    ) {
      dominio = "agenda";
      if (textoLower.includes("agendar") || textoLower.includes("marcar")) {
        intencao = "preparar_agendamento";
        requerConfirmacao = true;
        ferramentaSugerida = "preparar_agendamento";
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
    // 2. Domínio Clientes e Pets
    else if (
      textoLower.includes("cliente") ||
      textoLower.includes("tutor") ||
      textoLower.includes("pet") ||
      textoLower.includes("cachorro") ||
      textoLower.includes("gato") ||
      textoLower.includes("buscar") ||
      textoLower.includes("ficha") ||
      textoLower.includes("cadastrar")
    ) {
      dominio = "clientes_pets";
      if (textoLower.includes("cadastrar") || textoLower.includes("adicionar")) {
        intencao = "preparar_cadastro_cliente";
        requerConfirmacao = true;
        ferramentaSugerida = "preparar_cadastro_cliente";
      } else {
        intencao = "buscar_clientes_pets";
        ferramentaSugerida = "buscar_clientes_pets";
        entidades.termoBusca = texto.replace(/(buscar|cliente|pet|tutor|ver|consultar)/gi, "").trim();
      }
    }
    // 3. Domínio Financeiro e Relatórios
    else if (
      textoLower.includes("faturamento") ||
      textoLower.includes("financeiro") ||
      textoLower.includes("quanto faturou") ||
      textoLower.includes("ticket") ||
      textoLower.includes("a receber") ||
      textoLower.includes("pix") ||
      textoLower.includes("inadimplent") ||
      textoLower.includes("relatorio")
    ) {
      dominio = "financeiro_relatorios";
      intencao = "consultar_faturamento";
      ferramentaSugerida = "consultar_financeiro_consolidado";
    }
    // 4. Domínio Programas de Cuidado / Clubinho
    else if (
      textoLower.includes("programa") ||
      textoLower.includes("plano") ||
      textoLower.includes("clubinho") ||
      textoLower.includes("credito") ||
      textoLower.includes("saldo") ||
      textoLower.includes("pacote")
    ) {
      dominio = "programas_creditos";
      if (textoLower.includes("debitar") || textoLower.includes("usar credito") || textoLower.includes("baixar")) {
        intencao = "preparar_consumo_credito";
        requerConfirmacao = true;
        ferramentaSugerida = "preparar_consumo_credito";
      } else {
        intencao = "consultar_saldo_programas";
        ferramentaSugerida = "consultar_saldo_programas";
      }
    }
    // 5. Domínio Comunicação & WhatsApp
    else if (
      textoLower.includes("whatsapp") ||
      textoLower.includes("lembrete") ||
      textoLower.includes("mensagem") ||
      textoLower.includes("avisar")
    ) {
      dominio = "comunicacao_mensagens";
      intencao = "gerar_mensagem_whatsapp";
      ferramentaSugerida = "gerar_mensagem_whatsapp";
    }

    return {
      intencao: {
        dominio,
        intencao,
        confianca: 0.95,
        entidades: entidades as any,
        requerConfirmacao,
        ferramentaSugerida,
        explicacaoRaciocinio: `Classificado no domínio ${dominio} com intenção ${intencao}`,
      },
      provedorUtilizado: this.nome,
      tempoProcessamentoMs: Date.now() - inicio,
    };
  }

  async gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse> {
    return {
      texto: `Com base nos dados operacionais do Spa: ${JSON.stringify(req.dadosOperacionais)}`,
      sugestoesAcoes: ["Consultar detalhes", "Verificar agenda", "Abrir ficha do pet"],
      provedorUtilizado: this.nome,
    };
  }
}
