import { useState, useRef, useEffect, useCallback } from "react";
import { VoiceRecognizer, VoiceRecognitionStatus } from "@/lib/ia/ia-voz";
import { IAMessage, IAIntent } from "@/lib/ia/ia-agente.server";
import { IAStatus, IAResults } from "../types";
import { toast } from "sonner";
import { classificarIntencao } from "@/lib/ia/ia-agente.functions";
import { registrarAuditoriaIA } from "@/lib/ia/ia-auditoria.functions";
import {
  consultarAgendaIA,
} from "@/lib/ia/ia-consultas.functions";
import {
  validarAgendamentoIA,
  executarCriacaoAgendamento,
} from "@/lib/ia/ia-acoes.functions";
import { 
  consultarMensagensIA, 
  identificarAniversariantesIA, 
  analisarReativacaoIA 
} from "@/lib/ia/ia-comunicacao.functions";
import { 
  getEstoqueIA, 
  getSugestoesCompraIA 
} from "@/lib/ia/ia-estoque.functions";
import { 
  getResumoProprietarioIA, 
  getQualidadeIA 
} from "@/lib/ia/ia-auditoria.functions";
import { processarComprovanteIA } from "@/lib/ia/ia-financeiro.functions";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export function useAssistenteActions(isOpen: boolean, onClose: () => void) {
  const [messages, setMessages] = useState<IAMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [iaStatus, setIaStatus] = useState<IAStatus>("idle");
  const [searchResults, setSearchResults] = useState<IAResults | null>(null);
  
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isReviewingVoice, setIsReviewingVoice] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [analiseResult, setAnaliseResult] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  
  const activeCommandRef = useRef<{
    commandId: string;
    idempotencyKey: string;
    sessionId: string;
    correlationId: string;
  } | null>(null);

  const processingRef = useRef(false);

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
        onResult: (text, isFinal) => {
          if (isFinal) {
            // Consolidar transcrição final removendo duplicações simples
            setFinalTranscript(prev => {
              const cleaned = text.trim();
              if (prev.endsWith(cleaned)) return prev;
              return (prev + " " + cleaned).trim();
            });
            setInterimTranscript("");
          } else {
            // A transcrição parcial aparece apenas como prévia
            setInterimTranscript(text);
          }
        },
        onStatusChange: (status) => {
          setVoiceStatus(status);
          if (status === 'reviewing') {
            setIsReviewingVoice(true);
            setIaStatus("reviewing_transcription");
          } else if (status === 'listening') {
            setIaStatus("listening");
          } else if (status === 'requesting_permission') {
            setIaStatus("requesting_permission");
          }
        },
        onError: (err) => {
          console.error("Erro de reconhecimento de voz:", err);
          setVoiceStatus("error");
          setIaStatus("error");
          toast.error("Erro no microfone: " + err);
          setTimeout(() => {
            setVoiceStatus("idle");
            setIaStatus("idle");
          }, 2000);
        },
      });
    }
    
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
        // Garantir limpeza total da instância
        recognizerRef.current = null;
      }
    };
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || processingRef.current || iaStatus === "sending" || iaStatus === "processing") return;

    // Idempotency and Session IDs
    const commandId = crypto.randomUUID();
    const idempotencyKey = `idemp-${commandId}`;
    const correlationId = `corr-${Date.now()}`;
    const sessionId = activeCommandRef.current?.sessionId || crypto.randomUUID();

    activeCommandRef.current = { commandId, idempotencyKey, sessionId, correlationId };

    processingRef.current = true;
    setIsProcessing(true);
    setIaStatus("sending");
    setIsReviewingVoice(false);
    setFinalTranscript("");
    setInterimTranscript("");

    const startTime = Date.now();

    const userMessage: IAMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    try {
      setIaStatus("interpretando");
      const intent = await classificarIntencao({
        data: {
          texto: text,
          contexto: {
            mensagens: messages.slice(-5).map((m) => ({ role: m.role, content: m.content })),
            data_atual: new Date().toISOString(),
          },
          comando_original: text
        },
      });

      // Normalizar parâmetros para evitar Zod Errors em funções subsequentes
      if (!intent.parametros) {
        (intent as any).parametros = { comando_original: text };
      } else if (!(intent.parametros as any).comando_original) {
        (intent.parametros as any).comando_original = text;
      }

      let dadosReais: any = null;
      let respostaFinal = intent.resposta_ia || "Operação concluída.";
      setSearchResults(null);

      // --- Especialistas ---
      if (intent.especialista === "comunicacao") {
        setIaStatus("processing");
        if (intent.intencao === "consultar_mensagens") {
          const res = await consultarMensagensIA({ data: { cliente_id: intent.parametros?.cliente_id, comando_original: text } });
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
        setIaStatus("processing");
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
        setIaStatus("processing");
        if (intent.intencao === "consulta_estoque") {
          const res = await getEstoqueIA({ data: { termo: intent.parametros?.termo, apenasBaixo: intent.parametros?.baixo_estoque, comando_original: text } });
          dadosReais = res;
          respostaFinal = (res as any[]).length > 0 ? `### 📦 Estoque\n\n` + (res as any[]).map((p: any) => `- **${p.nome}**: ${p.quantidade} (Mín: ${p.estoque_minimo || 0})`).join("\n") : "Nenhum produto encontrado.";
        } else if (intent.intencao === "sugerir_reposicao") {
          const res = await getSugestoesCompraIA();
          dadosReais = res;
          respostaFinal = `### 🛒 Reposição\n\n` + (res as any[]).map((s: any) => `- **${s.nome}**: Comprar **${s.sugestao}**`).join("\n");
        }
      }

      if (intent.intencao === "consulta_agenda" || intent.intencao === "listar_atendimentos" || intent.intencao === "contar_atendimentos" || intent.intencao === "consultar_agenda") {
        setIaStatus("processing");
        const res = await consultarAgendaIA({ data: { ...(intent.parametros || {}), comando_original: text } });
        dadosReais = res.data || [];
        
        if (intent.intencao === "contar_atendimentos") {
          const stats = {
            total: dadosReais.length,
            confirmados: dadosReais.filter((a: any) => a.status === 'confirmado').length,
            agendados: dadosReais.filter((a: any) => a.status === 'agendado').length,
            em_atendimento: dadosReais.filter((a: any) => a.status === 'em_atendimento').length,
            concluidos: dadosReais.filter((a: any) => a.status === 'finalizado').length,
            cancelados: dadosReais.filter((a: any) => a.status === 'cancelado').length,
            faltas: dadosReais.filter((a: any) => a.status === 'nao_compareceu').length,
          };
          respostaFinal = `### 📉 Resumo de Atendimentos (Hoje)\n\n` +
            `- **Total**: ${stats.total}\n` +
            `- **Confirmados**: ${stats.confirmados}\n` +
            `- **Agendados**: ${stats.agendados}\n` +
            `- **Em Atendimento**: ${stats.em_atendimento}\n` +
            `- **Concluídos**: ${stats.concluidos}\n` +
            `- **Cancelados**: ${stats.cancelados}\n` +
            `- **Faltas**: ${stats.faltas}`;
        } else {
          respostaFinal = `### 📅 Agenda de Hoje\n\n` + 
            (dadosReais.length > 0 
              ? dadosReais.map((a: any) => `- **${a.hora.slice(0,5)}**: ${a.pets?.nome} (${a.servicos?.nome}) - ${a.clientes?.nome} [${a.status}]`).join("\n")
              : "Nenhum atendimento agendado para hoje.");
        }
      }

      if (intent.intencao === "consultar_faturamento") {
        setIaStatus("processing");
        const res = await consultarFinanceiroIA({ data: { period: "mes", comando_original: text } });
        const kpis = (res.data as any).metricas;
        respostaFinal = `### 💰 Faturamento do Mês\n\n` +
          `- **Período**: Mês Atual\n` +
          `- **Total Faturado**: R$ ${kpis.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- **Quantidade**: ${kpis.quantidade_servicos} serviços\n` +
          `- **Ticket Médio**: R$ ${kpis.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
          `*Fonte: vw_financeiro_indicadores*`;
      }

      if (intent.intencao === "consultar_valores_a_receber") {
        setIaStatus("processing");
        const res = await consultarFinanceiroIA({ data: { apenas_pendentes: true, comando_original: text, intencao: "consultar_valores_a_receber" } as any });
        const pendencias = res.data as any[];
        const total = pendencias.reduce((acc, p) => acc + (p.valor_total - (p.valor_pago || 0)), 0);
        const vencidos = pendencias.filter(p => new Date(p.vencimento) < new Date()).reduce((acc, p) => acc + (p.valor_total - (p.valor_pago || 0)), 0);
        
        respostaFinal = `### 💸 Valores a Receber\n\n` +
          `- **Total Pendente**: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- **Vencidos**: R$ ${vencidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- **A Vencer**: R$ ${(total - vencidos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- **Clientes Pendentes**: ${new Set(pendencias.map(p => p.cliente_id)).size}\n\n` +
          `Deseja ver a lista detalhada ou iniciar uma cobrança?`;
      }

      if (intent.intencao === "consultar_resumo_operacional") {
        setIaStatus("processing");
        const res = await consultarResumoOperacionalIA();
        const r = res.data as any;
        respostaFinal = `### 🚀 Resumo Operacional (${format(parseISO(r.data), "dd/MM")})\n\n` +
          `**Agenda:**\n` +
          `- Atendimentos: ${r.total_agenda} (${r.confirmados} conf.)\n` +
          `- Leva e Traz: ${r.leva_traz} pets\n\n` +
          `**Financeiro:**\n` +
          `- Recebido Hoje: R$ ${r.recebido_hoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- Pendências: R$ ${r.valor_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
          (r.proximo_atendimento ? `**Próximo:** ${r.proximo_atendimento.hora} - ${r.proximo_atendimento.pet} (${r.proximo_atendimento.servico})` : "");
      }


      const assistantMessage: IAMessage = {
        role: "assistant",
        content: respostaFinal,
        intent: intent as any,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIaStatus(intent.informacoes_faltantes?.length ? "aguardando_informacao" : "concluido");
      await registrarAuditoriaIA({
        data: {
          comando: text,
          intencao: intent.intencao,
          sucesso: true,
          tempo_ms: Date.now() - startTime,
          metadata: { intent, dados: dadosReais, ...(activeCommandRef.current || {}) },
        },
      });
      activeCommandRef.current = null; // Libera trava após auditoria

    } catch (error: any) {
      console.error(error);
      setIaStatus("error");
      const errorMessage = `A resposta foi interrompida ou ocorreu um erro: ${error.message}. ID: ${activeCommandRef.current?.correlationId || 'N/A'}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorMessage, timestamp: new Date().toISOString() }]);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [messages]);

  const toggleVoice = () => {
    if (voiceStatus === "listening") {
      recognizerRef.current?.stop();
    } else {
      setFinalTranscript("");
      setInterimTranscript("");
      setIsReviewingVoice(false);
      recognizerRef.current?.start();
    }
  };

  const cancelVoice = () => {
    recognizerRef.current?.stop();
    setFinalTranscript("");
    setInterimTranscript("");
    setIsReviewingVoice(false);
    setVoiceStatus("idle");
    setIaStatus("cancelado");
    setTimeout(() => setIaStatus("idle"), 1500);
  };

  const handleConfirmarAgendamento = async (intent: any) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setIaStatus("processing");
    try {
      const resVal = (await validarAgendamentoIA({ data: intent.parametros })) as any;
      if (resVal.disponivel === false) throw new Error(resVal.mensagem || "Horário indisponível");
      
      setIaStatus("executando");
      await executarCriacaoAgendamento({ data: intent.parametros });
      
      setMessages((prev) => [...prev, { role: "assistant", content: `✅ **Agendamento realizado com sucesso!**`, timestamp: new Date().toISOString() }]);
      setIaStatus("concluido");
    } catch (error: any) {
      toast.error(error.message);
      setIaStatus("error");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
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
    cancelVoice,
    scrollRef,
    setSelectedFile,
    setFilePreview,
    setIaStatus,
    setMessages,
    setIsProcessing,
    handleConfirmarAgendamento,
    selectedFile,
    selectedEntity,
    setSelectedEntity,
    interimTranscript,
    finalTranscript,
    isReviewingVoice,
    setFinalTranscript,
    analiseResult,
    setAnaliseResult
  };
}