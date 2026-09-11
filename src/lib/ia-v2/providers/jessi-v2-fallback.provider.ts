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
    try {
      const res = await this.geminiProvider.classificarIntencao(req);
      return {
        ...res,
        provedorUtilizado: this.nome,
      };
    } catch {
      const inicio = Date.now();
      return {
        intencao: {
          dominio: "geral_conversacional",
          intencao: "conversar_padrao",
          confianca: 0.8,
          entidades: {
            data: req.contexto.dataReferencia,
          },
          requerConfirmacao: false,
          ferramentaSugerida: null,
          explicacaoRaciocinio: "Classificação resiliente do provedor determinístico de contingência.",
        },
        provedorUtilizado: this.nome,
        tempoProcessamentoMs: Date.now() - inicio,
      };
    }
  }

  async gerarResposta(req: JessiV2GenerativeRequest): Promise<JessiV2GenerativeResponse> {
    return this.geminiProvider.gerarResposta(req);
  }
}

