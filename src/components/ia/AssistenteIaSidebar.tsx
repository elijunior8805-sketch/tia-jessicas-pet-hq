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
        content: `Olá! Sou sua Assistente IA. Como posso ajudar no Spa da Tia Jéssica hoje?`,
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
      setSearchResults(null);

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
          respostaFinal = `Encontrei **${dadosReais.length} agendamentos**. Aqui estão os detalhes:`;
        } else {
          respostaFinal = "Não encontrei agendamentos para os critérios informados.";
        }
      } else if (intent.intencao === 'consulta_cliente' || intent.intencao === 'consulta_pet' || (intent.intencao === 'criar_agendamento' && !selectedEntity)) {
        const termo = intent.cliente_nome || intent.pet_nome || text;
        const results = await consultarClientesPetsIA({ data: { termo } });
        setSearchResults(results);
        
        if (results.clientes.length > 0 || results.pets.length > 0) {
          respostaFinal = "Localizei estes registros. **Clique em um deles** para confirmar e prosseguir:";
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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            onClick={onClose} 
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-background border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-2xl h-[700px] flex flex-col overflow-hidden relative z-10"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b flex items-center justify-between bg-gradient-to-r from-muted/50 to-background">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20 shadow-inner">
                  <Sparkles className="w-5 h-5 text-gold animate-pulse" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-xl tracking-tight leading-none text-foreground">
                    Assistente Operacional IA
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                      SPA DE PET TIA JÉSSICA • INTELIGÊNCIA ATIVA
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] bg-muted/5" ref={scrollRef}>
              <div className="space-y-8 max-w-[95%] mx-auto py-4">
                {messages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={cn(
                      "group relative max-w-[85%] rounded-2xl px-5 py-4 shadow-sm transition-all hover:shadow-md",
                      msg.role === 'user' 
                        ? 'bg-gold text-white rounded-tr-none shadow-gold/20' 
                        : 'bg-white border rounded-tl-none shadow-black/5'
                    )}>
                      {msg.role === 'assistant' && (
                        <div className="absolute -left-10 top-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center border text-gold shadow-sm">
                          <Sparkles className="w-4 h-4" />
                        </div>
                      )}

                      <div className={cn(
                        "text-[15px] leading-relaxed prose prose-sm max-w-none",
                        msg.role === 'user' ? 'prose-invert text-white' : 'text-foreground prose-headings:text-gold prose-a:text-gold'
                      )}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>

                      {/* Render Search Results for Confirmation */}
                      {msg.role === 'assistant' && i === messages.length - 1 && searchResults && (
                        <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-4">
                          {searchResults.clientes.map((c: any) => (
                            <motion.button
                              whileHover={{ scale: 1.02, backgroundColor: 'rgba(212, 175, 55, 0.05)' }}
                              whileTap={{ scale: 0.98 }}
                              key={c.id}
                              onClick={() => {
                                setCurrentIntent(prev => prev ? { ...prev, cliente_nome: c.nome } : null);
                                setSearchResults(null);
                                handleSend(`Selecionado: Cliente ${c.nome}`);
                              }}
                              className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 hover:border-gold/30 transition-all text-left group/card"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold group-hover/card:bg-gold group-hover/card:text-white transition-colors">
                                  <User className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-foreground">{c.nome}</p>
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{c.telefone || '(00) 00000-0000'}</p>
                                </div>
                              </div>
                              <div className="bg-gold/10 text-gold text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity">
                                SELECIONAR
                              </div>
                            </motion.button>
                          ))}
                          {searchResults.pets.map((p: any) => (
                            <motion.button
                              whileHover={{ scale: 1.02, backgroundColor: 'rgba(212, 175, 55, 0.05)' }}
                              whileTap={{ scale: 0.98 }}
                              key={p.id}
                              onClick={() => {
                                setCurrentIntent(prev => prev ? { ...prev, pet_nome: p.nome, cliente_nome: p.clientes?.nome } : null);
                                setSearchResults(null);
                                handleSend(`Selecionado: Pet ${p.nome} de ${p.clientes?.nome}`);
                              }}
                              className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 hover:border-gold/30 transition-all text-left group/card"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold group-hover/card:bg-gold group-hover/card:text-white transition-colors">
                                  <Dog className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-foreground">{p.nome}</p>
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tutor: {p.clientes?.nome}</p>
                                </div>
                              </div>
                              <div className="bg-gold/10 text-gold text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity">
                                SELECIONAR
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                      
                      {msg.intent && (
                        <div className={cn(
                          "mt-4 pt-4 border-t text-[11px] font-medium space-y-4",
                          msg.role === 'user' ? 'border-white/20' : 'border-black/5'
                        )}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              "text-[9px] uppercase tracking-widest px-2 py-0.5 border-gold/20",
                              msg.role === 'user' ? 'bg-white/20 text-white border-white/30' : 'bg-gold/5 text-gold'
                            )}>
                              {msg.intent.intencao.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap gap-2.5">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className={cn(
                                "h-9 px-4 text-[11px] font-bold rounded-xl border-gold/20 shadow-sm transition-all",
                                msg.role === 'user' ? 'bg-white/10 text-white hover:bg-white/20 hover:border-white/50' : 'bg-white hover:bg-gold/5 hover:border-gold/40'
                              )}
                              onClick={() => {
                                const path = msg.intent?.intencao === 'consulta_agenda' ? '/agenda' : 
                                           msg.intent?.intencao === 'consulta_financeira' ? '/financeiro' : 
                                           msg.intent?.intencao === 'consulta_cliente' ? '/clientes' : '/dashboard';
                                window.open(path, '_blank');
                              }}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Acessar Sistema
                            </Button>

                            {msg.intent.intencao === 'criar_agendamento' && 
                             msg.intent.cliente_nome && 
                             msg.intent.pet_nome && 
                             msg.intent.horario && (
                              <Button 
                                size="sm" 
                                className="h-9 px-4 text-[11px] font-black bg-green-600 hover:bg-green-700 text-white border-none shadow-[0_4px_12px_rgba(22,163,74,0.3)] rounded-xl"
                                onClick={() => handleConfirmarAgendamento(msg.intent!)}
                                disabled={isProcessing}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Confirmar Agora
                              </Button>
                            )}

                            {msg.intent.intencao === 'registrar_pagamento' && selectedEntity && (
                              <Button 
                                size="sm" 
                                className="h-9 px-4 text-[11px] font-black bg-green-600 hover:bg-green-700 text-white border-none shadow-[0_4px_12px_rgba(22,163,74,0.3)] rounded-xl"
                                onClick={() => handleConfirmarPagamento(selectedEntity, msg.intent!)}
                                disabled={isProcessing}
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-2" /> Efetuar Baixa
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isProcessing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start pl-2"
                  >
                    <div className="bg-white border rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-4 shadow-sm">
                      <div className="flex gap-1.5">
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-gold" />
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-gold" />
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-gold" />
                      </div>
                      <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-tighter">Analizando...</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-6 border-t bg-gradient-to-b from-background to-muted/20">
              <div className="flex gap-4 items-end max-w-[98%] mx-auto">
                <div className="flex-1 bg-white border-2 border-muted rounded-[20px] overflow-hidden focus-within:border-gold/30 transition-all shadow-sm flex items-end pr-2">
                  <Textarea
                    placeholder="Solicite agendamento, baixas ou consultas..."
                    className="min-h-[56px] max-h-[160px] border-none focus-visible:ring-0 resize-none py-4 px-6 text-[15px] font-medium placeholder:text-muted-foreground/50"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(inputText);
                      }
                    }}
                  />
                  <div className="flex gap-2 p-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "rounded-xl transition-all h-11 w-11",
                        voiceStatus === 'listening' ? 'bg-red-50 text-red-600 shadow-inner' : 'hover:bg-muted'
                      )}
                      onClick={toggleVoice}
                    >
                      {voiceStatus === 'listening' ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                    </Button>
                    <Button 
                      size="icon" 
                      className="bg-gold hover:bg-gold-dark text-white rounded-xl shadow-[0_8px_16px_rgba(212,175,55,0.25)] h-11 w-11 disabled:opacity-50 transition-all active:scale-95"
                      onClick={() => handleSend(inputText)}
                      disabled={!inputText.trim() || isProcessing}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-5 px-3 text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
                <div className="flex gap-5">
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> INTELIGÊNCIA EM TEMPO REAL</span>
                </div>
                <button 
                  onClick={() => setMessages([])} 
                  className="flex items-center gap-2 hover:text-red-500 transition-colors py-1 px-2 rounded-lg hover:bg-red-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> REINICIAR FLUXO
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

