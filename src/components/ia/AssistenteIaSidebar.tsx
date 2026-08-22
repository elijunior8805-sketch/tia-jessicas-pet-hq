import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Send, 
  RotateCcw, 
  CheckCircle2,
  ExternalLink,
  User,
  Dog,
  DollarSign,
  Sparkles,
  MessageSquare,
  Minus,
  Maximize2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Loader2,
  Trash2,
  Eye
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
  consultarResumoOperacionalIA,
  analisarRiscoEvasaoIA
} from '@/lib/ia/ia-consultas.functions';
import {
  validarAgendamentoIA,
  executarCriacaoAgendamento,
} from '@/lib/ia/ia-acoes.functions';
import { 
  executarBaixaPagamento, 
  processarComprovanteIA,
} from '@/lib/ia/ia-financeiro.functions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AssistenteIaSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistenteIaSidebar({ isOpen, onClose }: AssistenteIaSidebarProps) {
  const [messages, setMessages] = useState<IAMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceRecognitionStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<IAIntent | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null); 
  const [searchResults, setSearchResults] = useState<{clientes: any[], pets: any[]} | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analiseResult, setAnaliseResult] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WEBP ou PDF.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (prev) => setFilePreview(prev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview('pdf');
    }
  };

  const handleAnalizarComprovante = async () => {
    if (!selectedFile || !filePreview) return;
    
    setIsProcessing(true);
    setMessages(prev => [...prev, {
      role: 'user',
      content: `[Arquivo: ${selectedFile.name}] Analisar este comprovante.`,
      timestamp: new Date().toISOString()
    }]);

    try {
      // 1. Converter para Base64 para análise (IA Vision)
      let base64 = "";
      if (selectedFile.type.startsWith('image/')) {
        base64 = filePreview.split(',')[1];
      } else {
        // PDF handling would go here - for now let's assume image
        const reader = new FileReader();
        base64 = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(selectedFile);
        });
      }

      const res = await processarComprovanteIA({
        data: { imagemBase64: base64, contentType: selectedFile.type }
      });

      if (res.sucesso) {
        setAnaliseResult(res);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Li o comprovante! Aqui estão os dados identificados:\n\n` +
                   `- **Valor**: R$ ${res.valor.toFixed(2)}\n` +
                   `- **Data**: ${res.data}\n` +
                   `- **Pagador**: ${res.pagador}\n` +
                   `- **Instituição**: ${res.instituicao}\n\n` +
                   `Estou procurando a pendência correspondente...`,
          timestamp: new Date().toISOString()
        }]);

        // 2. Upload para Storage Privado
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('comprovantes')
          .upload(filePath, selectedFile);
          
        if (uploadError) throw uploadError;

        // 3. Buscar pendências automáticas
        const searchRes = await consultarFinanceiroIA({
          data: { termo: res.pagador, apenas_pendentes: true }
        });

        const pendenciaExata = searchRes?.find((p: any) => 
          Math.abs((p.valor_total - (p.valor_pago || 0)) - res.valor) < 0.01
        );

        if (pendenciaExata) {
          const petNome = (pendenciaExata.atendimentos as any)?.pets?.nome || 
                         (pendenciaExata as any).atendimentos?.pets?.nome || 
                         'Pet';
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Encontrei uma pendência exata para **${petNome}** no valor de **R$ ${res.valor.toFixed(2)}**.\n\nDeseja confirmar a baixa agora?`,
            intent: {
              intencao: 'confirmar_baixa',
              valor: res.valor,
              forma_pagamento: 'pix',
              observacoes: `Baixa via comprovante (ID: ${res.id_transacao || 'N/A'})`,
              nivel_confianca: 1
            } as any,
            timestamp: new Date().toISOString(),
            meta: { 
              pagamento_id: pendenciaExata.id, 
              comprovante_path: filePath, 
              id_transacao: res.id_transacao 
            }
          } as any]);
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Não encontrei uma pendência automática de valor exato. Por favor, selecione o atendimento manualmente ou me dê mais detalhes.`,
            timestamp: new Date().toISOString()
          }]);
        }
      } else {
        toast.error(res.mensagem || "Não consegui ler o comprovante.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar comprovante.");
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setFilePreview(null);
    }
  };

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
      const intent = await classificarIntencao({
        data: {
          texto: text,
          contexto: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
        }
      });

      let dadosReais: any = null;
      let respostaFinal = intent.resposta_ia || "Processando...";
      const startTime = Date.now();
      setSearchResults(null);

      if (intent.intencao === 'consulta_agenda') {
        dadosReais = await consultarAgendaIA({
          data: {
            data: intent.data || undefined,
            pet_nome: intent.pet_nome || undefined,
            cliente_nome: intent.cliente_nome || undefined
          }
        });
        
        if (dadosReais && dadosReais.length > 0) {
          respostaFinal = `Encontrei **${dadosReais.length} agendamentos**. Aqui estão os principais:\n\n` + 
            dadosReais.slice(0, 3).map((a: any) => `- **${a.pets?.nome}** (${a.clientes?.nome}) às ${a.hora.slice(0, 5)}`).join('\n');
        } else {
          respostaFinal = "Não encontrei agendamentos para este critério.";
        }
      } else if (intent.intencao === 'consulta_cliente' || intent.intencao === 'consulta_pet' || (intent.intencao === 'criar_agendamento' && !selectedEntity)) {
        const termo = intent.cliente_nome || intent.pet_nome || text;
        const results = await consultarClientesPetsIA({ data: { termo } });
        setSearchResults(results);
        
        if (results.clientes.length > 0 || results.pets.length > 0) {
          respostaFinal = "Localizei estes registros. **Selecione o correto** para prosseguirmos:";
        } else {
          respostaFinal = `Não localizei nenhum cliente ou pet com "${termo}". Deseja cadastrar um novo?`;
        }
      } else if (intent.intencao === 'consulta_financeira') {
        dadosReais = await consultarFinanceiroIA({
          data: { apenas_pendentes: true }
        });
        
        if (dadosReais && dadosReais.length > 0) {
          const total = dadosReais.reduce((acc: number, p: any) => acc + (p.valor_total - (p.valor_pago || 0)), 0);
          respostaFinal = `Você tem **${dadosReais.length} pendências** totalizando **R$ ${total.toFixed(2)}**.`;
        } else {
          respostaFinal = "Não encontrei pendências financeiras em aberto.";
        }
      } else if (intent.intencao === 'solicitar_resumo_operacional') {
        const resumo = await consultarResumoOperacionalIA();
        respostaFinal = `### 📊 Resumo Operacional (${resumo.data})\n\n- **Agendamentos**: ${resumo.total_agenda} (${resumo.confirmados} confirmados)\n- **Leva e Traz**: ${resumo.leva_traz} viagens\n- **Financeiro Pendente**: R$ ${resumo.valor_pendente.toFixed(2)}\n- **Promessas para Hoje**: ${resumo.promessas_hoje}`;
      }

      const assistantMessage: IAMessage = {
        role: 'assistant',
        content: respostaFinal,
        intent: intent,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentIntent(intent);

      await registrarAuditoriaIA({
        data: {
          comando_original: text,
          intencao_identificada: intent.intencao,
          dados_extraidos: { ...intent, tempo_processamento: Date.now() - startTime },
          status: 'sucesso'
        }
      });
    } catch (error) {
      console.error('Erro IA:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Aconteceu um erro. Tente novamente.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmarAgendamento = async (intent: IAIntent) => {
    setIsProcessing(true);
    try {
      // Usar IDs se já vierem na intenção, senão buscar por nome
      let clienteId = intent.cliente_id;
      let petId = intent.pet_id;
      let servicosIds = intent.servicos_ids;

      if (!clienteId && intent.cliente_nome) {
        const { data: cData } = await supabase.from('clientes').select('id').ilike('nome', `%${intent.cliente_nome}%`).limit(1);
        clienteId = cData?.[0]?.id;
      }
      
      if (!petId && intent.pet_nome && clienteId) {
        const { data: pData } = await supabase.from('pets').select('id').eq('cliente_id', clienteId).ilike('nome', `%${intent.pet_nome}%`).limit(1);
        petId = pData?.[0]?.id;
      }
      
      if (!clienteId || !petId) throw new Error("Cliente ou Pet não localizado. Por favor, seja mais específico.");

      let servicosParaCriar: { id: string, nome: string, valor: number }[] = [];
      
      if (servicosIds && servicosIds.length > 0) {
        const { data: sData } = await supabase.from('servicos').select('id, nome, valor').in('id', servicosIds);
        servicosParaCriar = sData || [];
      } else if (intent.servicos && intent.servicos.length > 0) {
        const { data: sData } = await supabase.from('servicos').select('id, nome, valor').in('nome', intent.servicos);
        servicosParaCriar = sData || [];
      }

      if (!servicosParaCriar.length) throw new Error("Não identifiquei os serviços solicitados no cadastro.");

      // Re-validar disponibilidade no backend antes de gravar
      const validacao = await validarAgendamentoIA({
        data: {
          data: intent.data!,
          hora: intent.horario!,
          cliente_id: clienteId,
          pet_id: petId,
          servicos: servicosParaCriar.map(s => s.id)
        }
      });

      if (!validacao.disponivel) {
        throw new Error(validacao.motivo || "Horário indisponível.");
      }

      await executarCriacaoAgendamento({
        data: {
          cliente_id: clienteId,
          pet_id: petId,
          data: intent.data!,
          hora: intent.horario!,
          servicos: servicosParaCriar,
          transporte: intent.transporte || false,
          taxa_transporte: intent.taxa_transporte || 0,
          observacoes: intent.observacoes || "Agendado via Agente IA"
        }
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Agendamento realizado!**\n\n- **Pet**: ${intent.pet_nome}\n- **Data**: ${intent.data}\n- **Hora**: ${intent.horario}\n- **Serviços**: ${servicosParaCriar.map(s => s.nome).join(', ')}`,
        timestamp: new Date().toISOString()
      }]);
      setCurrentIntent(null);
      toast.success("Agendado com sucesso!");
    } catch (error: any) {
      toast.error(error.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Não consegui concluir:** ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmarBaixaIA = async (msg: any) => {
    setIsProcessing(true);
    try {
      const { meta, intent } = msg;
      if (!meta?.pagamento_id) throw new Error("ID do pagamento não localizado no contexto.");

      await executarBaixaPagamento({
        data: {
          pagamento_id: meta.pagamento_id,
          valor_pago: intent.valor,
          forma: intent.forma_pagamento || 'pix',
          comprovante_path: meta.comprovante_path,
          id_transacao: meta.id_transacao,
          observacoes: intent.observacoes
        }
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Baixa realizada com sucesso!** O comprovante foi vinculado e o financeiro atualizado.`,
        timestamp: new Date().toISOString()
      }]);
      toast.success("Pagamento baixado!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao realizar baixa.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoice = () => {
    if (voiceStatus === 'listening') recognizerRef.current?.stop();
    else recognizerRef.current?.start();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] md:bg-black/40" 
            onClick={onClose} 
          />
          
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-[#F5F2EA] w-full md:w-[480px] h-full flex flex-col shadow-2xl relative z-10 border-l border-white/20"
          >
            {/* Premium Header */}
            <div className="px-6 py-5 border-b border-[#C99845]/10 flex items-center justify-between bg-[#123F2A] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C99845]/20 flex items-center justify-center border border-[#C99845]/30 shadow-inner">
                  <Sparkles className="w-5 h-5 text-[#C99845] animate-pulse" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-lg tracking-tight leading-none">
                    Assistente IA
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-[#C99845] animate-pulse" />
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/60">
                      Spa Tia Jéssica • Online
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 hidden md:flex">
                  <Minus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6 max-w-full mx-auto">
                {messages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn(
                      "group relative max-w-[85%] rounded-2xl px-5 py-4 shadow-sm",
                      msg.role === 'user' 
                        ? 'bg-[#C99845] text-white rounded-tr-none' 
                        : 'bg-white text-[#123F2A] border border-[#C99845]/10 rounded-tl-none shadow-black/5'
                    )}>
                      <div className={cn(
                        "text-[14px] leading-relaxed prose prose-sm max-w-none",
                        msg.role === 'user' ? 'prose-invert text-white' : 'text-[#123F2A]'
                      )}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>

                      {/* Search Results */}
                      {msg.role === 'assistant' && i === messages.length - 1 && searchResults && (
                        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-[#C99845]/10 pt-4">
                          {searchResults.clientes.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() => handleSend(`Selecionado: Cliente ${c.nome}`)}
                              className="flex items-center justify-between p-3 rounded-xl border border-[#C99845]/10 bg-[#F5F2EA]/50 hover:bg-[#F5F2EA] transition-all text-left"
                            >
                              <div className="flex items-center gap-3">
                                <User className="w-4 h-4 text-[#C99845]" />
                                <span className="text-sm font-bold">{c.nome}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] border-[#C99845]/30 text-[#C99845]">CLIENTE</Badge>
                            </button>
                          ))}
                          {searchResults.pets.map((p: any) => (
                            <button
                              key={p.id}
                              onClick={() => handleSend(`Selecionado: Pet ${p.nome}`)}
                              className="flex items-center justify-between p-3 rounded-xl border border-[#C99845]/10 bg-[#F5F2EA]/50 hover:bg-[#F5F2EA] transition-all text-left"
                            >
                              <div className="flex items-center gap-3">
                                <Dog className="w-4 h-4 text-[#C99845]" />
                                <span className="text-sm font-bold">{p.nome}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] border-[#C99845]/30 text-[#C99845]">PET</Badge>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Intent Actions */}
                      {msg.intent && i === messages.length - 1 && (
                        <div className="mt-4 pt-4 border-t border-current/10 flex flex-wrap gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className={cn("h-8 text-[11px] font-bold rounded-lg px-3", msg.role === 'user' ? 'text-white hover:bg-white/10' : 'text-[#C99845] hover:bg-[#C99845]/5')}
                            onClick={() => window.open('/dashboard', '_blank')}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir Sistema
                          </Button>
                          
                          {msg.intent.intencao === 'criar_agendamento' && msg.intent.cliente_nome && (
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-bold bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-lg px-3 shadow-md"
                              onClick={() => handleConfirmarAgendamento(msg.intent!)}
                              disabled={isProcessing}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar
                            </Button>
                          )}
                          {msg.intent.intencao === 'confirmar_baixa' && (
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-bold bg-[#C99845] hover:bg-[#C99845]/90 text-white rounded-lg px-3 shadow-md"
                              onClick={() => handleConfirmarBaixaIA(msg)}
                              disabled={isProcessing}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar Baixa
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-[#C99845]/10 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-3 shadow-sm">
                      <div className="flex gap-1">
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-[#C99845]" />
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-[#C99845]" />
                        <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-[#C99845]" />
                      </div>
                      <span className="text-[11px] font-bold text-[#123F2A]/60 uppercase tracking-widest">Processando</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-[#C99845]/10 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              {/* File Preview Area */}
              {filePreview && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-2xl bg-[#F5F2EA] border border-[#C99845]/20 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-white overflow-hidden flex items-center justify-center border border-[#C99845]/10">
                    {filePreview === 'pdf' ? (
                      <FileText className="w-6 h-6 text-[#C99845]" />
                    ) : (
                      <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#123F2A] truncate uppercase tracking-tight">
                      {selectedFile?.name}
                    </p>
                    <p className="text-[9px] text-[#123F2A]/60 font-medium">
                      {(selectedFile?.size || 0) / 1024 > 1024 
                        ? `${((selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB` 
                        : `${((selectedFile?.size || 0) / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50"
                      onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg text-[#123F2A] hover:bg-[#123F2A]/5"
                      onClick={handleAnalizarComprovante}
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              <div className="relative group">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                />
                <Textarea
                  placeholder="Como posso ajudar?"
                  className="min-h-[56px] max-h-[160px] border-[#C99845]/20 focus-visible:ring-[#C99845]/30 resize-none py-4 px-5 pr-32 text-[14px] font-medium rounded-2xl bg-[#F5F2EA]/30 transition-all"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputText);
                    }
                  }}
                />
                <div className="absolute right-2 bottom-2 flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-xl h-10 w-10 text-[#C99845] hover:bg-[#C99845]/10"
                    onClick={() => fileInputRef.current?.click()}
                    title="Anexar comprovante"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "rounded-xl h-10 w-10 transition-all",
                      voiceStatus === 'listening' ? 'bg-red-50 text-red-600' : 'hover:bg-[#C99845]/10 text-[#C99845]'
                    )}
                    onClick={toggleVoice}
                  >
                    {voiceStatus === 'listening' ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button 
                    size="icon" 
                    className="bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-xl shadow-lg h-10 w-10 disabled:opacity-50 transition-all"
                    onClick={() => handleSend(inputText)}
                    disabled={!inputText.trim() || isProcessing}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 px-1 text-[9px] text-[#123F2A]/40 font-bold uppercase tracking-[0.2em]">
                <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> INTELIGÊNCIA OPERACIONAL</span>
                <button 
                  onClick={() => setMessages([])} 
                  className="flex items-center gap-1.5 hover:text-[#C99845] transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> REINICIAR
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
