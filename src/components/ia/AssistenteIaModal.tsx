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
  DollarSign
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
  consultarDisponibilidadeIA 
} from '@/lib/ia/ia-consultas.functions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';


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
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<VoiceRecognizer | null>(null);

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

      // 2. Executar Consulta Baseada na Intenção
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
      } else if (intent.intencao === 'consulta_cliente' || intent.intencao === 'consulta_pet') {
        const termo = intent.cliente_nome || intent.pet_nome || text;
        const { clientes, pets } = await consultarClientesPetsIA({ data: { termo } });
        
        if (clientes.length > 0 || pets.length > 0) {
          respostaFinal = "Localizei os seguintes registros:\n\n";
          clientes.forEach((c: any) => respostaFinal += `- 👤 **Cliente**: ${c.nome} (${c.telefone || 'Sem tel'})\n`);
          pets.forEach((p: any) => respostaFinal += `- 🐾 **Pet**: ${p.nome} (Tutor: ${p.clientes?.nome})\n`);
        } else {
          respostaFinal = "Desculpe, não localizei nenhum cliente ou pet com esse nome.";
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
              <p className="text-xs text-muted-foreground mt-1">Sempre pronta para ajudar</p>
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
                    Você pode dizer "Ver agenda de hoje", "Cadastrar novo pet" ou "Resumo financeiro".
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
                  
                  {msg.intent && msg.intent.intencao !== 'comando_nao_reconhecido' && (
                    <div className="mt-3 pt-3 border-t border-black/10 text-xs font-medium space-y-2">
                      <div className="flex items-center gap-1.5 opacity-80">
                        {msg.intent.intencao === 'consulta_agenda' && <Calendar className="w-3 h-3" />}
                        {msg.intent.intencao === 'consulta_cliente' && <User className="w-3 h-3" />}
                        {msg.intent.intencao === 'consulta_pet' && <Dog className="w-3 h-3" />}
                        {msg.intent.intencao === 'consulta_financeira' && <DollarSign className="w-3 h-3" />}
                        <span>Consulta: {msg.intent.intencao.replace('consulta_', '')}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] bg-white/10 hover:bg-white/20 border-white/20"
                          onClick={() => {
                            if (msg.intent?.intencao === 'consulta_agenda') window.location.href = '/agenda';
                            if (msg.intent?.intencao === 'consulta_financeira') window.location.href = '/financeiro';
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Ver no Módulo
                        </Button>
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
                  <span className="text-sm text-muted-foreground">Processando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-6 border-t bg-muted/10 space-y-4">
          <div className="relative">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={voiceStatus === 'listening' ? "Ouvindo..." : "Digite seu comando..."}
              className="min-h-[100px] resize-none pr-12 pb-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(inputText);
                }
              }}
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setInputText('')}
                disabled={!inputText}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button 
                variant={voiceStatus === 'listening' ? 'destructive' : 'secondary'} 
                size="icon"
                onClick={toggleVoice}
                className={voiceStatus === 'listening' ? 'animate-pulse' : ''}
              >
                {voiceStatus === 'listening' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button 
                variant="default" 
                size="icon"
                onClick={() => handleSend(inputText)}
                disabled={!inputText || isProcessing}
                className="bg-gold hover:bg-gold/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Fase 1: Estrutura & Interpretação
            </p>
            <div className="flex items-center gap-4">
              <Button variant="link" className="h-auto p-0 text-[10px] text-muted-foreground" onClick={() => setMessages([])}>
                <RotateCcw className="w-3 h-3 mr-1" />
                Limpar Conversa
              </Button>
              <Button variant="link" className="h-auto p-0 text-[10px] text-muted-foreground" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
