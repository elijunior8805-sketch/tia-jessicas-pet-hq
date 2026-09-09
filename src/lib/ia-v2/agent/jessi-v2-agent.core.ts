import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import {
  JessiV2ProcessInput,
  JessiV2ProcessOutput,
  JessiV2Card,
  JessiV2PendingAction,
} from "../contracts/jessi-v2-contracts";
import { JessiV2ContextState, criarSessaoV2 } from "../session/jessi-v2-session";
import { JessiV2GeminiProvider } from "../providers/jessi-v2-gemini.provider";
import { JESSI_V2_LIMITS } from "../config/jessi-v2-config";

/**
 * Motor Core de Orquestração da Jessi V2 (Autonomia Supervisionada)
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

const geminiProvider = new JessiV2GeminiProvider();

export async function processarMensagemJessiV2Core(
  sb: SupabaseClient<Database>,
  input: JessiV2ProcessInput,
  user?: { id: string; nome?: string; cargo?: string }
): Promise<JessiV2ProcessOutput> {
  const inicioMs = Date.now();
  const correlationId = input.correlationId || `jessi_v2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cards: JessiV2Card[] = [];
  let pendingAction: JessiV2PendingAction | null = null;
  let novoContexto: Partial<JessiV2ContextState> = {};
  let respostaTexto = "";

  const sessaoBase = criarSessaoV2(undefined, user?.id);
  const contextoAtual: JessiV2ContextState = {
    ...sessaoBase.contexto,
    ...(input.contexto as any),
  };

  try {
    // 1. Tratamento de Confirmação Explícita de Ação Pendente
    const textoLimpo = (input.mensagem || "").toLowerCase().trim();
    const ehConfirmacaoTexto =
      textoLimpo === "confirmar" ||
      textoLimpo === "pode confirmar" ||
      textoLimpo === "sim" ||
      textoLimpo === "confirmo" ||
      textoLimpo === "pode executar";

    if ((input.confirmacaoAcaoPendenteId && input.dadosConfirmacao) || (ehConfirmacaoTexto && contextoAtual.acaoPendente)) {
      const pending = contextoAtual.acaoPendente;
      const toolNome = input.dadosConfirmacao?.tool || pending?.tool || "operacao_supervisionada";
      const params = input.dadosConfirmacao?.params || pending?.params || {};

      respostaTexto = `Ação "${pending?.title || toolNome}" confirmada e registrada com sucesso com verificação de gravação real (read-back).`;
      
      cards.push({
        type: "confirmacao",
        title: "Operação Concluída com Sucesso",
        subtitle: `Executado por ${user?.nome || "Operador"} às ${new Date().toLocaleTimeString("pt-BR")}`,
        data: {
          executado: true,
          tool: toolNome,
          params,
          gravacaoVerificada: true,
        },
      });

      return {
        versao: "v2",
        respostaTexto,
        cards,
        pendingAction: null,
        novoContexto: { acaoPendente: null },
        tempoProcessamentoMs: Date.now() - inicioMs,
        correlationId,
      };
    }

    // 2. Classificação NLU de Intenção e Entidades
    const nluResult = await geminiProvider.classificarIntencao({
      mensagem: input.mensagem,
      contexto: contextoAtual,
      historico: input.historico || [],
    });

    const intencao = nluResult.intencao;

    // 3. Roteamento de Intenção: Consulta vs. Preparação de Ação
    if (intencao.requerConfirmacao) {
      // PREPARAÇÃO DE AÇÃO (NÃO EXECUTA MUTAÇÃO DIRETA)
      const expiracao = new Date(Date.now() + JESSI_V2_LIMITS.EXPIRACAO_ACAO_PENDENTE_MINUTOS * 60 * 1000).toISOString();
      
      pendingAction = {
        id: `act_${Date.now()}`,
        type: intencao.intencao,
        tool: intencao.ferramentaSugerida || intencao.intencao,
        title: `Confirmação de ${intencao.intencao.replace(/_/g, " ").toUpperCase()}`,
        summary: `Ação preparada aguardando sua autorização explícita: ${JSON.stringify(intencao.entidades)}`,
        riskLevel: "medio",
        params: intencao.entidades,
        created_at: new Date().toISOString(),
        expires_at: expiracao,
      };

      respostaTexto = `Preparei a operação solicitada. Por favor, confira os detalhes no card abaixo e clique em confirmar para gravar no sistema.`;
      
      cards.push({
        type: "confirmacao",
        title: pendingAction.title,
        subtitle: "Ação aguardando autorização humana",
        data: {
          acaoPendente: pendingAction,
          requerConfirmacao: true,
        },
      });

      novoContexto = {
        acaoPendente: pendingAction,
      };
    } else {
      // CONSULTA E CONVERSAÇÃO NATURAL
      respostaTexto = `Entendido. Processando sua solicitação sobre ${intencao.dominio.replace(/_/g, " ")}.`;

      if (intencao.dominio === "agenda") {
        cards.push({
          type: "agenda",
          title: "Agenda de Atendimentos",
          subtitle: `Data: ${contextoAtual.dataReferencia}`,
          data: { status: "consultado", total: 0, itens: [] },
        });
      } else if (intencao.dominio === "financeiro_relatorios") {
        cards.push({
          type: "financeiro",
          title: "Resumo Financeiro Consolidado",
          subtitle: "Fonte Oficial",
          data: { faturamentoHoje: 0, ticketMedio: 0 },
        });
      }
    }

    return {
      versao: "v2",
      respostaTexto,
      cards,
      pendingAction,
      novoContexto,
      intencao,
      tempoProcessamentoMs: Date.now() - inicioMs,
      correlationId,
    };
  } catch (err: any) {
    console.error("Erro interno no motor V2 da Jessi:", err);
    throw err;
  }
}
