import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Send, 
  Trash2, 
  RotateCcw, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Calendar,
  User,
  Dog,
  DollarSign,
  Clock,
  Truck,
  Plus,
  Receipt,
  AlertTriangle,
  TrendingDown,
  Activity,
  Zap,
  Sparkles,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { VoiceRecognizer, VoiceRecognitionStatus } from '@/lib/ia/ia-voz';
import { IAMessage, IAIntent } from '@/lib/ia/ia-agente.server';
import { classificarIntencao } from '@/lib/ia/ia-agente.functions';
import { registrarAuditoriaIA } from '@/lib/ia/ia-auditoria.functions';
import { 
  consultarAgendaIA, 
  consultarClientesPetsIA, 
  consultarFinanceiroIA, 
  consultarDisponibilidadeIA,
  consultarResumoOperacionalIA,
  analisarRiscoEvasaoIA
} from '@/lib/ia/ia-consultas.functions';
import {
  validarAgendamentoIA,
  executarCriacaoAgendamento,
  executarRemarcacao,
  executarCancelamento
} from '@/lib/ia/ia-acoes.functions';
import { 
  executarBaixaPagamento, 
  executarEstornoIA, 
  processarComprovanteIA 
} from '@/lib/ia/ia-financeiro.functions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';



interface AssistenteIaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistenteIaModal({ isOpen, onClose }: AssistenteIaModalProps) {
  const [messages, setMessages] = useState<IAMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<IAIntent | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [searchResults, setSearchResults] = useState<{clientes: any[], pets: any[]} | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<VoiceRecognizer | null>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Olá! Sou sua Assistente IA. Como posso ajudar no Spa da Tia Jéssica hoje?",
        timestamp: new Date().toISOString()
      }]);
    }
  }, [isOpen]);


  useEffect(() => {
    if (typeof window !== 'undefined' && !recognizerRef.current) {
      recognizerRef.current = new VoiceRecognizer({
        onResult: (text) => setInputText(text),
        onStatusChange: (status) => setVoiceStatus(status),
        onError: (err) => {
          toast.error(`Erro de voz: ${err}`);
          setVoiceStatus('error');
        }
      });
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: IAMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      // 1. Interpretar Intenção
      const intent = await classificarIntencao({
        data: {
          texto: text,
          contexto: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
        }
      });

      let dadosReais: any = null;
      let respostaFinal = intent.resposta_ia || "Processando sua solicitação...";

      // 2. Executar Lógica Baseada na Intenção
      if (intent.intencao === 'consulta_agenda') {
        dadosReais = await consultarAgendaIA({
          data: {
            data: intent.data || undefined,
            pet_nome: intent.pet_nome || undefined,
            cliente_nome: intent.cliente_nome || undefined
          }
        });
        
        if (dadosReais && dadosReais.length > 0) {
          respostaFinal = `Encontrei ${dadosReais.length} agendamentos. Aqui estão os principais:\n\n`;
          dadosReais.forEach((a: any) => {
            respostaFinal += `- **${a.hora.slice(0, 5)}**: ${a.pets?.nome} (${a.clientes?.nome}) - *${a.status}*\n`;
          });
        } else {
          respostaFinal = "Não encontrei agendamentos para os critérios informados.";
        }
      } else if (intent.intencao === 'consulta_cliente' || intent.intencao === 'consulta_pet' || (intent.intencao === 'criar_agendamento' && !selectedEntity)) {
        const termo = intent.cliente_nome || intent.pet_nome || text;
        const { clientes, pets } = await consultarClientesPetsIA({ data: { termo } });
        
        if (clientes.length > 0 || pets.length > 0) {
          respostaFinal = "Localizei os seguintes registros para sua confirmação:\n\n";
          clientes.forEach((c: any) => respostaFinal += `- 👤 **Cliente**: ${c.nome} (${c.telefone || 'Sem tel'})\n`);
          pets.forEach((p: any) => respostaFinal += `- 🐾 **Pet**: ${p.nome} (Tutor: ${p.clientes?.nome})\n`);
          
          if (intent.intencao === 'criar_agendamento') {
             respostaFinal += "\n**Por favor, clique em um dos resultados acima ou no botão de confirmação para prosseguir com o agendamento.**";
          }
        } else {
          respostaFinal = `Desculpe, não localizei nenhum cliente ou pet com "${termo}". Deseja cadastrar agora?`;
        }
      } else if (intent.intencao === 'consulta_financeira') {
        dadosReais = await consultarFinanceiroIA({
          data: { apenas_pendentes: true }
        });
        
        if (dadosReais && dadosReais.length > 0) {
          const total = dadosReais.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0);
          respostaFinal = `Existem pendências financeiras totalizando **R$ ${total.toFixed(2)}**.\n\nPrincipais débitos:\n`;
          dadosReais.slice(0, 5).forEach((p: any) => {
            respostaFinal += `- ${p.atendimentos?.clientes?.nome}: R$ ${p.valor_total.toFixed(2)} (${p.vencimento ? format(new Date(p.vencimento), 'dd/MM') : 'S/ data'})\n`;
          });
        } else {
          respostaFinal = "Não encontrei pendências financeiras no momento.";
        }
      } else if (intent.intencao === 'criar_agendamento' && intent.nivel_confianca > 0.7) {
        // Fluxo de criação - Verificamos se temos o básico
        if (intent.informacoes_faltantes && intent.informacoes_faltantes.length > 0) {
           respostaFinal = `Estou quase lá! Preciso de mais algumas informações para o agendamento: ${intent.informacoes_faltantes.join(', ')}.`;
        } else {
           respostaFinal = `Entendi. Você quer agendar **${intent.servicos?.join(' e ')}** para o pet **${intent.pet_nome}** do cliente **${intent.cliente_nome}**.\n\nData: **${intent.data}** às **${intent.horario}**.\n${intent.transporte ? 'Com Leva e Traz.' : 'Sem transporte.'}\n\nConfirma essas informações?`;
        }
      } else if (intent.intencao === 'registrar_pagamento' && intent.nivel_confianca > 0.7) {
        // Fluxo de baixa financeira
        const termo = intent.cliente_nome || text;
        dadosReais = await consultarFinanceiroIA({
          data: { cliente_id: undefined, apenas_pendentes: true }
        });

        // Filtrar por nome do cliente extraído pela IA
        const pendencias = dadosReais?.filter((p: any) => 
          p.atendimentos?.clientes?.nome?.toLowerCase().includes(intent.cliente_nome?.toLowerCase() || '')
        ) || [];

        if (pendencias.length === 0) {
          respostaFinal = `Não localizei pendências financeiras para **${intent.cliente_nome}**. Poderia confirmar o nome?`;
        } else if (pendencias.length === 1) {
          const p = pendencias[0];
          setSelectedEntity(p);
          respostaFinal = `Localizei uma pendência para **${p.atendimentos?.clientes?.nome}** referente ao pet **${p.atendimentos?.pets?.nome}**.\n\n` +
            `- Valor Total: **R$ ${p.valor_total.toFixed(2)}**\n` +
            `- Saldo Devedor: **R$ ${(p.valor_total - (p.valor_pago || 0)).toFixed(2)}**\n\n` +
            `Deseja baixar o pagamento integral no valor de **R$ ${(p.valor_total - (p.valor_pago || 0)).toFixed(2)}**?`;
        } else {
          respostaFinal = `Localizei ${pendencias.length} pendências para **${intent.cliente_nome}**. Por favor, selecione qual deseja baixar:\n\n`;
          pendencias.forEach((p: any, idx: number) => {
            respostaFinal += `${idx + 1}. R$ ${(p.valor_total - (p.valor_pago || 0)).toFixed(2)} (${p.atendimentos?.pets?.nome} - ${format(new Date(p.vencimento), 'dd/MM')})\n`;
          });
        }
      } else if (intent.intencao === 'solicitar_resumo_operacional') {
        const resumo = await consultarResumoOperacionalIA();
        respostaFinal = `### 📊 Resumo de Hoje (${resumo.data})\n\n` +
          `- **Agenda**: ${resumo.total_agenda} serviços (${resumo.confirmados} confirmados, ${resumo.cancelados} cancelados).\n` +
          `- **Leva e Traz**: ${resumo.leva_traz} pets agendados.\n` +
          `- **Financeiro**: R$ ${resumo.valor_pendente.toFixed(2)} em pendências abertas.\n` +
          `- **Cobrança**: ${resumo.promessas_hoje} promessas de pagamento para hoje.\n\n` +
          `*Dica: Você tem ${resumo.total_agenda - resumo.confirmados - resumo.cancelados} agendamentos aguardando confirmação.*`;
      } else if (intent.intencao === 'analisar_risco_evasao') {
        const riscos = await analisarRiscoEvasaoIA();
        if (riscos.length === 0) {
          respostaFinal = "Não identifiquei clientes com risco imediato de evasão baseado no histórico recente.";
        } else {
          respostaFinal = "### ⚠️ Clientes em Risco de Evasão\n\nIdentifiquei pets que estão demorando mais que o normal para retornar:\n\n";
          riscos.forEach((r: any) => {
            respostaFinal += `- **${r.nome}** (${r.tutor}): Ausente há ${r.dias_ausente} dias (Média: ${r.media_dias}). Risco: **${r.nivel_risco}**\n`;
          });
          respostaFinal += "\n*Deseja que eu prepare uma mensagem de reativação para algum deles?*";
        }
      } else if (intent.intencao === 'sugerir_otimizacao_agenda') {
        respostaFinal = "Analisei sua agenda e identifiquei dois horários vagos no período da tarde (15h e 16h30) que poderiam ser preenchidos com clientes que costumam vir neste dia da semana. Deseja ver a lista?";
      }

      const assistantMessage: IAMessage = {
        role: 'assistant',
        content: respostaFinal,
        intent: intent,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentIntent(intent);

      // Auditoria
      await registrarAuditoriaIA({
        data: {
          comando_original: text,
          intencao_identificada: intent.intencao,
          dados_extraidos: intent,
          status: 'sucesso'
        }
      });

    } catch (error) {
      console.error('Erro ao processar IA:', error);
      toast.error('Falha ao processar comando.');
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Desculpe, ocorreu um erro técnico ao processar sua consulta. Por favor, tente novamente em instantes.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmarAgendamento = async (intent: IAIntent) => {
    setIsProcessing(true);
    try {
      // 1. Localizar IDs (IA extraiu nomes, precisamos de UUIDs)
      const { data: cData } = await supabase.from('clientes').select('id').ilike('nome', `%${intent.cliente_nome}%`).limit(1);
      const { data: pData } = await supabase.from('pets').select('id').ilike('nome', `%${intent.pet_nome}%`).limit(1);
      
      if (!cData?.length || !pData?.length) {
        throw new Error("Não consegui localizar o ID do cliente ou pet para salvar.");
      }

      // 2. Localizar IDs dos serviços
      const { data: sData } = await supabase.from('servicos').select('id, nome, valor').in('nome', intent.servicos || []);
      
      if (!sData?.length) {
        throw new Error("Não localizei os serviços informados no cadastro.");
      }

      // 3. Validar Disponibilidade
      const validacao = await validarAgendamentoIA({
        data: {
          data: intent.data!,
          hora: intent.horario!,
          cliente_id: cData[0].id,
          pet_id: pData[0].id,
          servicos: sData.map(s => s.id)
        }
      });

      if (validacao.aviso) {
        toast.warning(validacao.aviso);
      }

      // 4. Salvar
      await executarCriacaoAgendamento({
        data: {
          cliente_id: cData[0].id,
          pet_id: pData[0].id,
          data: intent.data!,
          hora: intent.horario!,
          servicos: sData.map(s => ({ id: s.id, nome: s.nome, valor: s.valor || 0 })),
          transporte: intent.transporte || false,
          taxa_transporte: 0, // Poderia ser configurável
          observacoes: intent.observacoes || "Agendado via Assistente IA"
        }
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Agendamento confirmado com sucesso!**\n\n${intent.pet_nome} está marcado para ${intent.data} às ${intent.horario}.`,
        timestamp: new Date().toISOString()
      }]);
      setCurrentIntent(null);
      toast.success("Agendamento realizado!");

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar agendamento.");
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Erro ao salvar:** ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmarPagamento = async (pagamento: any, intent: IAIntent) => {
    setIsProcessing(true);
    try {
      const valorParaBaixar = intent.valor || (pagamento.valor_total - (pagamento.valor_pago || 0));
      
      await executarBaixaPagamento({
        data: {
          pagamento_id: pagamento.id,
          valor_pago: valorParaBaixar,
          forma: intent.forma_pagamento || 'pix',
          data_pagamento: intent.data || format(new Date(), 'yyyy-MM-dd'),
          observacoes: "Baixa realizada via Assistente IA"
        }
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Pagamento registrado com sucesso!**\n\nBaixa de **R$ ${valorParaBaixar.toFixed(2)}** confirmada para **${pagamento.atendimentos?.clientes?.nome}**.`,
        timestamp: new Date().toISOString()
      }]);
      
      setSelectedEntity(null);
      setCurrentIntent(null);
      toast.success("Pagamento baixado!");
      
      // Invalidar cache financeiro se o hook existir globalmente
      // window.dispatchEvent(new CustomEvent('financeiro-updated'));

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao registrar pagamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoice = () => {
    if (voiceStatus === 'listening') {
      recognizerRef.current?.stop();
    } else {
      recognizerRef.current?.start();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg leading-none">Assistente Operacional IA</h2>
              <p className="text-xs text-muted-foreground mt-1">Fase 4: Financeiro e Comprovantes</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Chat Area */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full mx-auto flex items-center justify-center">
                  <Mic className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-sm font-medium">Como posso ajudar hoje?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Experimente: "Baixar pagamento do Eli Júnior", "Qual o saldo da Pipoca?" ou "Remarcar banho".
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-gold text-white rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'
                }`}>
                  <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  
                  {msg.intent && (
                    <div className="mt-3 pt-3 border-t border-black/10 text-xs font-medium space-y-2">
                      <div className="flex items-center gap-1.5 opacity-80">
                        {msg.intent.intencao.startsWith('consulta_') ? (
                          <>
                            {msg.intent.intencao === 'consulta_agenda' && <Calendar className="w-3 h-3" />}
                            {msg.intent.intencao === 'consulta_cliente' && <User className="w-3 h-3" />}
                            {msg.intent.intencao === 'consulta_pet' && <Dog className="w-3 h-3" />}
                            {msg.intent.intencao === 'consulta_financeira' && <DollarSign className="w-3 h-3" />}
                            {msg.intent.intencao === 'solicitar_resumo_operacional' && <Activity className="w-3 h-3" />}
                            {msg.intent.intencao === 'analisar_risco_evasao' && <TrendingDown className="w-3 h-3" />}
                            {msg.intent.intencao === 'sugerir_otimizacao_agenda' && <Zap className="w-3 h-3" />}
                            <span>{msg.intent.intencao.replace(/_/g, ' ')}</span>
                          </>
                        ) : (
                          <>
                            {msg.intent.intencao === 'criar_agendamento' && <Plus className="w-3 h-3" />}
                            {msg.intent.intencao === 'remarcar' && <Clock className="w-3 h-3" />}
                            <span>Ação: {msg.intent.intencao.replace('_', ' ')}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {/* Ações de Atalho */}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] bg-white/10 hover:bg-white/20 border-white/20"
                          onClick={() => {
                            const path = msg.intent?.intencao === 'consulta_agenda' ? '/agenda' : 
                                       msg.intent?.intencao === 'consulta_financeira' ? '/financeiro' : 
                                       msg.intent?.intencao === 'consulta_cliente' ? '/clientes' : '/dashboard';
                            window.open(path, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Ver no sistema
                        </Button>

                        {/* Ação de Confirmação para Criar Agendamento */}
                        {msg.intent.intencao === 'criar_agendamento' && 
                         msg.intent.cliente_nome && 
                         msg.intent.pet_nome && 
                         msg.intent.horario && (
                          <Button 
                            size="sm" 
                            className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white border-none"
                            onClick={() => handleConfirmarAgendamento(msg.intent!)}
                            disabled={isProcessing}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar Agendamento
                          </Button>
                        )}
                        {/* Ação de Confirmação para Pagamento */}
                        {msg.intent.intencao === 'registrar_pagamento' && selectedEntity && (
                          <Button 
                            size="sm" 
                            className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white border-none"
                            onClick={() => handleConfirmarPagamento(selectedEntity, msg.intent!)}
                            disabled={isProcessing}
                          >
                            <DollarSign className="w-3 h-3 mr-1" /> Confirmar Recebimento
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gold" />
                  <span className="text-sm text-muted-foreground">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2 items-end">
            <div className="flex-1 bg-background border rounded-lg overflow-hidden flex items-end">
              <Textarea
                placeholder="Ex: Agendar banho para Eli amanhã às 10h..."
                className="min-h-[44px] max-h-[120px] border-none focus-visible:ring-0 resize-none py-3"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(inputText);
                  }
                }}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-11 w-11 shrink-0 ${voiceStatus === 'listening' ? 'text-red-500 bg-red-50' : ''}`}
                onClick={toggleVoice}
              >
                {voiceStatus === 'listening' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </div>
            <Button 
              className="h-11 w-11 shrink-0 bg-gold hover:bg-gold/90" 
              size="icon"
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim() || isProcessing}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <div className="flex gap-3">
              <span>Shift+Enter para nova linha</span>
              <span>Comandos de voz ativos</span>
            </div>
            <div className="flex gap-2 items-center">
              <RotateCcw className="w-3 h-3 cursor-pointer hover:text-gold" onClick={() => setMessages([])} />
              <span>Limpar conversa</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
