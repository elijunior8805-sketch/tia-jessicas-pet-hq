import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiMessage, JessiPendingAction } from "./jessi-contracts";
import { JessiContextState } from "./jessi-session";
import { classificarComandoIA, IAIntent } from "./ia-agente.server";
import { despacharFerramentaJessi, JESSI_TOOLS } from "./jessi-tools-registry";
import { registrarAuditoriaIA } from "./ia-auditoria.server";
import { JESSI_CONFIG } from "./jessi-config";

/**
 * Agente Operacional Inteligente Jessi - Servidor
 */

export interface JessiProcessInput {
  mensagem: string;
  contexto?: JessiContextState;
  historico?: JessiMessage[];
  confirmacaoAcaoPendenteId?: string | null;
  dadosConfirmacao?: Record<string, any> | null;
}

export interface JessiProcessOutput {
  respostaTexto: string;
  cards: Array<{
    type: "agenda" | "cliente" | "financeiro" | "programa" | "comprovante" | "confirmacao" | "alerta";
    data: any;
  }>;
  pendingAction?: JessiPendingAction | null;
  novoContexto?: Partial<JessiContextState>;
  intencao?: IAIntent;
  tempoProcessamentoMs: number;
}

export async function processarMensagemJessiCore(
  sb: SupabaseClient<Database>,
  input: JessiProcessInput,
  user?: { id: string; nome?: string; cargo?: string }
): Promise<JessiProcessOutput> {
  const inicioMs = Date.now();
  const cards: JessiProcessOutput["cards"] = [];
  let respostaTexto = "";
  let pendingAction: JessiPendingAction | null = null;
  let novoContexto: Partial<JessiContextState> = {};
  let intencao: IAIntent | undefined;

  try {
    // 1. Caso o usuário esteja respondendo a uma confirmação de ação pendente
    if (input.confirmacaoAcaoPendenteId && input.dadosConfirmacao) {
      const toolNome = input.dadosConfirmacao.tool;
      const params = input.dadosConfirmacao.params;

      const resultadoAcao = await despacharFerramentaJessi(sb, toolNome, params, { user });

      respostaTexto = resultadoAcao.summary || "Ação executada e confirmada com sucesso.";
      cards.push({
        type: "confirmacao",
        data: {
          executado: true,
          tool: toolNome,
          resultado: resultadoAcao,
        },
      });

      await registrarAuditoriaIA({
        user_id: user?.id,
        comando_original: `CONFIRMACAO: ${toolNome}`,
        intencao_detectada: toolNome,
        ferramenta_utilizada: toolNome,
        parametros: params,
        resposta_ia: respostaTexto,
        sucesso: true,
        tempo_resposta_ms: Date.now() - inicioMs,
      });

      return {
        respostaTexto,
        cards,
        pendingAction: null,
        novoContexto: { acaoPendente: null },
        tempoProcessamentoMs: Date.now() - inicioMs,
      };
    }

    // 2. Classifica a mensagem do usuário
    intencao = await classificarComandoIA(input.mensagem, {
      user,
      mensagens: input.historico?.slice(-6),
      contexto: input.contexto,
    });

    const nomeIntencao = intencao.intencao;
    const toolNome = intencao.ferramenta || nomeIntencao;
    const params = intencao.parametros || {};

    // 3. Verifica se a ferramenta existe no registro
    const toolDef = JESSI_TOOLS[toolNome] || JESSI_TOOLS[nomeIntencao];

    if (toolDef) {
      // Caso a ferramenta seja de ação e exija confirmação humana
      if (toolDef.tipo === "acao" && toolDef.exigeConfirmacao) {
        const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const resumoAcao = intencao.resumo_acao || `Deseja confirmar a execução de ${toolDef.descricao}?`;

        pendingAction = {
          id: actionId,
          type: toolDef.nome,
          tool: toolDef.nome,
          title: `Confirmação de ${toolDef.nome.replace(/_/g, " ")}`,
          summary: resumoAcao,
          params: params,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };

        respostaTexto = intencao.resposta_ia || `${resumoAcao}\n\nPor favor, confirme abaixo para eu registrar no sistema.`;

        cards.push({
          type: "confirmacao",
          data: {
            pendingAction,
            resumo: resumoAcao,
          },
        });

        novoContexto.acaoPendente = pendingAction;
      } else {
        // Ferramenta de consulta: executa diretamente
        const resQuery = await toolDef.executar(sb, params, { user, contexto: input.contexto });

        respostaTexto = intencao.resposta_ia || resQuery.summary || "Consulta realizada com sucesso.";

        // Identifica card especializado
        if (toolDef.especialista === "agenda") {
          cards.push({ type: "agenda", data: resQuery.data });
        } else if (toolDef.especialista === "clientes_pets") {
          cards.push({ type: "cliente", data: resQuery.data });
          if (Array.isArray(resQuery.data) && resQuery.data.length === 1) {
            novoContexto.clienteSelecionadoId = resQuery.data[0].id;
            novoContexto.clienteSelecionadoNome = resQuery.data[0].nome;
          }
        } else if (toolDef.especialista === "financeiro") {
          cards.push({ type: "financeiro", data: resQuery.data });
        } else if (toolDef.especialista === "programas_cuidado") {
          cards.push({ type: "programa", data: resQuery.data });
        }
      }
    } else {
      // Resposta conversacional direta
      respostaTexto = intencao.resposta_ia || "Entendido. Como posso ajudar com a agenda, clientes ou financeiro hoje?";
    }

    // 4. Registra auditoria
    await registrarAuditoriaIA({
      user_id: user?.id,
      comando_original: input.mensagem,
      intencao_detectada: intencao.intencao,
      especialista: intencao.especialista || undefined,
      ferramenta_utilizada: toolNome,
      parametros: params,
      resposta_ia: respostaTexto,
      sucesso: true,
      tempo_resposta_ms: Date.now() - inicioMs,
    });
  } catch (err: any) {
    console.error("[Jessi Core Error]:", err);
    respostaTexto = "Tive uma dificuldade ao processar esse pedido. Por favor, tente novamente ou verifique os dados informados.";
  }

  return {
    respostaTexto,
    cards,
    pendingAction,
    novoContexto,
    intencao,
    tempoProcessamentoMs: Date.now() - inicioMs,
  };
}
