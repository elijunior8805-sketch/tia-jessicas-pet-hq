import { useState, useRef, useEffect } from "react";
import { VoiceRecognizer, VoiceRecognitionStatus } from "@/lib/ia/ia-voz";
import { IAMessage, IAIntent } from "@/lib/ia/ia-agente.server";
import { IAStatus, IAResults } from "../types";
import { toast } from "sonner";
import { classificarIntencao } from "@/lib/ia/ia-agente.functions";
import { registrarAuditoriaIA } from "@/lib/ia/ia-auditoria.functions";
import {
  consultarAgendaIA,
  buscarClientesIA,
  consultarFinanceiroIA,
  consultarResumoOperacionalIA,
  analisarRiscoEvasaoIA,
  buscarServicosIA,
  consultarHistoricoPetIA,
  consultarVisao360ClienteIA,
  consultarVisao360PetIA,
  consultarAuditoriaDadosIA,
  compararPeriodosFinanceirosIA,
} from "@/lib/ia/ia-consultas.functions";
import {
  consultarFilaCobrancaIA,
  gerarMensagensCobrancaIA,
  registrarPromessaPagamentoIA,
} from "@/lib/ia/ia-cobranca.functions";
import {
  validarAgendamentoIA,
  executarCriacaoAgendamento,
  executarRemarcacao,
  executarCancelamento,
} from "@/lib/ia/ia-acoes.functions";
import { executarBaixaPagamento, processarComprovanteIA } from "@/lib/ia/ia-financeiro.functions";
import {
  consultarMensagensIA,
  identificarAniversariantesIA,
  analisarReativacaoIA,
} from "@/lib/ia/ia-comunicacao.functions";
import {
  getEstoqueIA,
  getComprasIA,
  getFornecedoresIA,
  getSugestoesCompraIA,
  getAnomaliasEstoqueIA,
} from "@/lib/ia/ia-estoque.functions";
import { getResumoProprietarioIA, getQualidadeIA } from "@/lib/ia/ia-auditoria.functions";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export function useAssistenteActions(isOpen: boolean, onClose: () => void) {
  const [messages, setMessages] = useState<IAMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [iaStatus, setIaStatus] = useState<IAStatus>("idle");
  const [currentIntent, setCurrentIntent] = useState<IAIntent | null>(null);
  const [searchResults, setSearchResults] = useState<IAResults | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [analiseResult, setAnaliseResult] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<VoiceRecognizer | null>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `Olá! Sou a Assistente Operacional e Estratégica do Spa de Pet Tia Jéssica. Como posso ajudar você na gestão do Pet Shop agora?`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window !== "undefined" && !recognizerRef.current) {
      recognizerRef.current = new VoiceRecognizer({
        onResult: (text) => {
          setInputText(text);
          if (text.length > 10) {
            handleSend(text);
          }
        },
        onStatusChange: (status) => setVoiceStatus(status),
        onError: (err) => {
          console.error("Erro de reconhecimento de voz:", err);
          setVoiceStatus("error");
          setTimeout(() => {
            if (voiceStatus === "error") setVoiceStatus("idle");
          }, 2000);
        },
      });
    }
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: IAMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsProcessing(true);

    try {
      setIaStatus("interpretando");
      const intent = await classificarIntencao({
        texto: text,
        contexto: {
          mensagens: messages.slice(-5).map((m) => ({ role: m.role, content: m.content })),
          data_atual: new Date().toISOString(),
        },
      });

      let dadosReais: any = null;
      let respostaFinal = intent.resposta_ia || "Processando...";
      const startTime = Date.now();
      setSearchResults(null);

      if (intent.informacoes_faltantes && intent.informacoes_faltantes.length > 0) {
        setIaStatus("aguardando_informacao");
      }

      // --- Início da Lógica de Especialistas ---

      if (intent.especialista === "comunicacao") {
        setIaStatus("pesquisando");
        if (intent.intencao === "consultar_mensagens") {
          const res = await consultarMensagensIA({
            cliente_id: intent.parametros?.cliente_id
          });
          dadosReais = res.data;
          respostaFinal = `### 💬 Mensagens Recentes\n\n` + (dadosReais as any[]).map((m: any) => `- [${format(parseISO(m.created_at), "dd/MM HH:mm")}] **${m.clientes?.nome || "Sistema"}**: ${m.mensagem}`).join("\n");
        } else if (intent.intencao === "consultar_aniversariantes") {
          const res = await identificarAniversariantesIA();
          dadosReais = res.data;
          respostaFinal = (dadosReais as any[]).length > 0 
            ? `### 🎂 Aniversariantes de Hoje!\n\n` + (dadosReais as any[]).map((p: any) => `- **${p.nome}** (${p.raca}) - Tutor: ${p.clientes?.nome}`).join("\n")
            : "Não encontrei aniversariantes para hoje.";
        } else if (intent.intencao === "analisar_reativacao") {
          const res = await analisarReativacaoIA();
          dadosReais = res.data;
          respostaFinal = `### 🔄 Risco de Evasão (Reativação)\n\n` + (dadosReais as any[]).map((c: any) => `- **${c.nome}** (${c.dias_inatividade} dias sem vir) - ${c.justificativa}`).join("\n");
        }
      }

      if (intent.especialista === "gestao_estrategica" || intent.especialista === "relatorios") {
        setIaStatus("pesquisando");
        if (intent.intencao === "resumo_negocio") {
          const res = await getResumoProprietarioIA();
          dadosReais = res;
          respostaFinal = `### 📊 Resumo do Negócio\n\n- **Agenda**: ${res.agenda.hoje} atendimentos hoje.\n- **Financeiro**: ${res.financeiro.pendencias} pendências.\n- **Estoque**: ${res.estoque.itens_criticos} itens críticos.`;
        } else if (intent.intencao === "consultar_qualidade_ia") {
          const res = await getQualidadeIA();
          dadosReais = res;
          respostaFinal = `### 🛠️ Qualidade da IA\n\n- **Total**: ${res.total_comandos}\n- **Sucesso**: ${res.taxa_sucesso.toFixed(1)}%\n- **Tempo**: ${res.tempo_medio_ms.toFixed(0)}ms`;
        }
      }

      if (intent.especialista === "estoque_compras") {
        setIaStatus("pesquisando");
        if (intent.intencao === "consulta_estoque") {
          const res = await getEstoqueIA({ termo: intent.parametros?.termo, apenasBaixo: intent.parametros?.baixo_estoque });
          dadosReais = res;
          respostaFinal = (res as any[]).length > 0 ? `### 📦 Estoque\n\n` + (res as any[]).map((p: any) => `- **${p.nome}**: ${p.quantidade} (Mín: ${p.estoque_minimo || 0})`).join("\n") : "Nenhum produto encontrado.";
        } else if (intent.intencao === "sugerir_reposicao") {
          const res = await getSugestoesCompraIA();
          dadosReais = res;
          respostaFinal = `### 🛒 Reposição\n\n` + (res as any[]).map((s: any) => `- **${s.nome}**: Comprar **${s.sugestao}**`).join("\n");
        }
      }

      if (intent.intencao === "consulta_agenda" || intent.intencao === "listar_atendimentos" || intent.intencao === "contar_atendimentos") {
        setIaStatus("pesquisando");
        const res = await consultarAgendaIA(intent.parametros || {});
        dadosReais = res.data || [];
        respostaFinal = intent.intencao === "contar_atendimentos" 
          ? `Hoje existem **${dadosReais.length} atendimentos** agendados.`
          : `### 📅 Agenda\n\nExibindo ${dadosReais.length} atendimentos.`;
      }
      
      // --- Fim da Lógica de Especialistas ---

      const assistantMessage: IAMessage = {
        role: "assistant",
        content: respostaFinal,
        intent: intent as any,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIaStatus(intent.informacoes_faltantes?.length ? "aguardando_informacao" : "concluido");

      await registrarAuditoriaIA({
        comando: text,
        intencao: intent.intencao,
        sucesso: true,
        tempo_ms: Date.now() - startTime,
        metadata: { intent, dados: dadosReais },
      });

    } catch (error: any) {
      console.error(error);
      setIaStatus("erro");
      setMessages((prev) => [...prev, { role: "assistant", content: `Erro: ${error.message}`, timestamp: new Date().toISOString() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoice = () => {
    if (voiceStatus === "listening") recognizerRef.current?.stop();
    else recognizerRef.current?.start();
  };

  const handleConfirmarAgendamento = async (intent: any) => {
    setIsProcessing(true);
    setIaStatus("validando");
    try {
      const resVal = (await validarAgendamentoIA(intent.parametros)) as any;
      if (resVal.disponivel === false) throw new Error(resVal.mensagem || resVal.message || "Horário indisponível");
      
      setIaStatus("executando");
      await executarCriacaoAgendamento(intent.parametros);
      
      setMessages((prev) => [...prev, { role: "assistant", content: `✅ **Agendamento realizado!**`, timestamp: new Date().toISOString() }]);
      setIaStatus("concluido");
    } catch (error: any) {
      toast.error(error.message);
      setIaStatus("erro");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    messages,
    inputText,
    setInputText,
    voiceStatus,
    isProcessing,
    iaStatus,
    searchResults,
    filePreview,
    handleSend,
    toggleVoice,
    scrollRef,
    setSelectedFile,
    setFilePreview,
    setIaStatus,
    setMessages,
    setIsProcessing,
    setSearchResults,
    handleConfirmarAgendamento,
    selectedFile,
    selectedEntity,
    setSelectedEntity,
    analiseResult
  };
}
