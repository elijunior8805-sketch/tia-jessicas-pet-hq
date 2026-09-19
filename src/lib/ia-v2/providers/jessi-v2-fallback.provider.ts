import {
  IJessiV2AIProvider,
  JessiV2NLURequest,
  JessiV2NLUResponse,
  JessiV2GenerativeRequest,
  JessiV2GenerativeResponse,
} from "./jessi-v2-provider.interface";
import { JessiV2GeminiProvider } from "./jessi-v2-gemini.provider";

/**
 * Provedor de Fallback Determinístico e Resiliente para a Jessi V2
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

export class JessiV2FallbackProvider implements IJessiV2AIProvider {
  readonly nome = "Deterministic-Rule-Fallback-V2";
  private geminiProvider = new JessiV2GeminiProvider();

  async classificarIntencao(req: JessiV2NLURequest): Promise<JessiV2NLUResponse> {
    return await this.geminiProvider.classificarIntencao(req);
  }

  async gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse> {
    return {
      texto: "Estou pronta para consultar dados operacionais, verificar a agenda ou preparar ações supervisionadas. O que você gostaria de conferir?",
      sugestoesAcoes: ["Agenda de hoje", "Faturamento do mês", "Buscar clientes e pets"],
      provedorUtilizado: this.nome,
    };
  }
}

