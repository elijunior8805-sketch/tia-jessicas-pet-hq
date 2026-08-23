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
  buscarClientesIA,
  buscarPetsDoClienteIA,
  consultarFinanceiroIA, 
  consultarResumoOperacionalIA,
  analisarRiscoEvasaoIA,
  buscarServicosIA,
  consultarHistoricoPetIA
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
import { format, parseISO } from 'date-fns';
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
        content: `Olá! Sou sua Assistente Operacional. Posso consultar agenda, atendimentos, clientes, pets, financeiro e ajudar a executar tarefas autorizadas do Spa. O que você precisa?`,
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
                   `- **Valor**: R$ ${res.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
                   `- **Data**: ${res.data}\n` +
                   `- **Pagador**: ${res.pagador}\n` +
                   `- **Instituição**: ${res.instituicao}\n` +
                   (res.id_transacao ? `- **ID Transação**: \`${res.id_transacao}\`\n` : '') +
                   `\nEstou procurando a pendência correspondente...`,
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
        const response = await consultarFinanceiroIA({
          data: { termo: res.pagador, apenas_pendentes: true }
        });

        const searchResList = (response.result || []) as any[];
        
        // Regra de Correspondência: Valor exato
        const pendenciasValorExato = searchResList?.filter((p: any) => {
          const saldo = Number(p.valor_total) - Number(p.valor_pago || 0);
          return Math.abs(saldo - res.valor) < 0.01;
        });

        if (pendenciasValorExato && pendenciasValorExato.length === 1) {
          const p = pendenciasValorExato[0];
          const petNome = p.atendimentos?.pets?.nome || 'Pet';
          const saldoAnterior = Number(p.valor_total) - Number(p.valor_pago || 0);
          const saldoPosterior = Math.max(0, saldoAnterior - res.valor);

          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Encontrei uma pendência exata para **${petNome}**!\n\n` +
                     `- **Saldo Anterior**: R$ ${saldoAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
                     `- **Valor Comprovante**: R$ ${res.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
                     `- **Saldo Posterior**: R$ ${saldoPosterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
                     `Deseja confirmar a baixa agora?`,
            intent: {
              intencao: 'confirmar_baixa',
              valor: res.valor,
              forma_pagamento: 'pix',
              observacoes: `Baixa via comprovante IA (ID: ${res.id_transacao || 'N/A'})`,
              nivel_confianca: 1
            } as any,
            timestamp: new Date().toISOString(),
            meta: { 
              pagamento_id: p.id, 
              comprovante_path: filePath, 
              id_transacao: res.id_transacao 
            }
          } as any]);
        } else if (pendenciasValorExato && pendenciasValorExato.length > 1) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Encontrei **${pendenciasValorExato.length} pendências** com o mesmo valor para este pagador. Qual delas você deseja baixar?`,
            timestamp: new Date().toISOString()
          }]);
          // Aqui poderíamos exibir uma lista para seleção
        } else {
          // Tentar busca por valor parcial ou simplesmente informar que não achou
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Não encontrei uma pendência automática de valor exato (R$ ${res.valor.toFixed(2)}) para "${res.pagador}".\n\nPor favor, selecione o atendimento manualmente ou verifique se o valor está correto.`,
            timestamp: new Date().toISOString()
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ **Erro na análise**: ${res.mensagem || "Não consegui ler o comprovante."}`,
          timestamp: new Date().toISOString()
        }]);
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

      if (intent.intencao === 'consulta_agenda' || intent.intencao === 'listar_atendimentos' || intent.intencao === 'contar_atendimentos') {
        const response = await consultarAgendaIA({
          data: {
            data: intent.data || undefined,
            periodo_inicio: intent.periodo_inicio || undefined,
            periodo_fim: intent.periodo_fim || undefined,
            status: intent.status || undefined,
            pet_nome: intent.pet_nome || undefined,
            cliente_nome: intent.cliente_nome || undefined,
            servico_nome: intent.filtros?.servico_nome || undefined,
            leva_e_traz: intent.filtros?.leva_e_traz
          }
        });
        
        dadosReais = response.result || [];
        const count = dadosReais.length;
        
        if (intent.intencao === 'contar_atendimentos') {
          const stats = {
            total: dadosReais.length,
            confirmados: dadosReais.filter((a: any) => a.status === 'confirmado').length,
            em_atendimento: dadosReais.filter((a: any) => a.status === 'em_atendimento').length,
            finalizados: dadosReais.filter((a: any) => a.status === 'finalizado').length,
            agendados: dadosReais.filter((a: any) => a.status === 'agendado').length,
            aguardando: dadosReais.filter((a: any) => a.status === 'aguardando').length,
            cancelados: dadosReais.filter((a: any) => a.status === 'cancelado').length,
            faltas: dadosReais.filter((a: any) => a.status === 'falta').length,
          };

          respostaFinal = `Hoje existem **${stats.total} atendimentos** agendados:\n\n` +
            `- ✅ **Confirmados**: ${stats.confirmados}\n` +
            `- ⏳ **Agendados**: ${stats.agendados}\n` +
            `- ⏳ **Aguardando Confirmação**: ${stats.aguardando}\n` +
            `- 🚿 **Em atendimento**: ${stats.em_atendimento}\n` +
            `- ✨ **Finalizados**: ${stats.finalizados}\n` +
            `- ❌ **Cancelados/Faltas**: ${stats.cancelados + stats.faltas}`;
        } else if (dadosReais.length > 0) {
          const dataFormatada = intent.data ? format(parseISO(intent.data), 'dd/MM') : 'hoje';
          respostaFinal = `### 📅 Agenda de ${dataFormatada} (${dadosReais.length})\n\n` +
            `| Horário | Pet | Serviço | Status |\n` +
            `| :--- | :--- | :--- | :--- |\n` +
            dadosReais.slice(0, 20).map((a: any) => 
              `| ${a.hora.slice(0, 5)} | **${a.pets?.nome}** | ${a.servicos?.nome || 'Serviço'} | ${a.status === 'confirmado' ? '✅' : '⏳'} ${a.status} |`
            ).join('\n');
          
          if (dadosReais.length > 20) {
            respostaFinal += `\n\n*Exibindo os primeiros 20 de ${dadosReais.length} agendamentos.*`;
          }
        } else {
          respostaFinal = "Não existem agendamentos para o critério solicitado.";
        }

      } else if (intent.intencao === 'consulta_cliente' || intent.intencao === 'consulta_pet' || (['criar_agendamento', 'remarcar_agendamento', 'cancelar_agendamento'].includes(intent.intencao) && !selectedEntity)) {
        const termo = intent.cliente_nome || intent.pet_nome || text;
        const response = await buscarClientesIA({ data: { termo } });
        const results = { clientes: (response.result || []) as any[], pets: [] as any[] };
        setSearchResults(results);
        
        if (results.clientes.length > 0) {
          const c = results.clientes[0];
          const matchesTermo = c.nome.toLowerCase().includes(termo.toLowerCase());
          
          if (results.clientes.length === 1 && matchesTermo) {
            if (intent.intencao === 'remarcar_agendamento' || intent.intencao === 'cancelar_agendamento') {
              // Buscar agendamentos do cliente para escolha
              const agendaRes = await consultarAgendaIA({ data: { cliente_nome: c.nome, status: 'confirmado' } });
              const agendamentos = agendaRes.result || [];
              if (agendamentos.length > 0) {
                respostaFinal = `Encontrei o cliente **${c.nome}**. Qual destes agendamentos você deseja ${intent.intencao === 'remarcar_agendamento' ? 'remarcar' : 'cancelar'}?\n\n` +
                  agendamentos.map((a: any) => `- **${a.hora.slice(0, 5)}** - ${a.pets?.nome} (${a.servicos?.nome || 'Serviço'})`).join('\n');
              } else {
                respostaFinal = `O cliente **${c.nome}** não possui agendamentos ativos para ${intent.intencao === 'remarcar_agendamento' ? 'remarcar' : 'cancelar'}.`;
              }
            } else {
              respostaFinal = `Encontrei o cliente **${c.nome}**. Ele possui os seguintes pets: ${c.pets?.map((p: any) => p.nome).join(', ') || 'nenhum'}.\n\nO que deseja fazer?`;
            }
          } else {
            respostaFinal = `Não encontrei uma correspondência exata para "${termo}". Você quis dizer algum destes clientes?\n\n` +
              results.clientes.map((c: any) => `- **${c.nome}** (${c.bairro || 'Sem bairro'})`).join('\n');
          }
        } else {
          respostaFinal = `Cliente não cadastrado. Deseja cadastrá-lo agora?`;
        }
      } else if (intent.intencao === 'consulta_financeira' || intent.intencao === 'consultar_resumo_financeiro' || intent.intencao === 'consultar_pendencias') {
        const response = await consultarFinanceiroIA({
          data: { 
            apenas_pendentes: intent.intencao === 'consultar_pendencias',
            termo: intent.cliente_nome || undefined,
            period: intent.status as any || intent.data as any || undefined, // Mapeamento temporário
            periodo_inicio: intent.periodo_inicio || undefined,
            periodo_fim: intent.periodo_fim || undefined
          }
        });
        
        if (intent.intencao === 'consultar_resumo_financeiro') {
          const { metricas, periodo } = response.result || {};
          if (metricas) {
            respostaFinal = `### 💰 Resumo Financeiro (${periodo.from} a ${periodo.to})\n\n` +
              `- **Faturamento (Competência)**: R$ ${metricas.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **Recebido (Caixa)**: R$ ${metricas.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **Despesas**: R$ ${metricas.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **Resultado (Lucro)**: R$ ${metricas.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **Saldo em Caixa**: R$ ${metricas.saldoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **Ticket Médio**: R$ ${metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **A Receber Total**: R$ ${metricas.aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
              `- **Vencidos**: R$ ${metricas.vencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
              `*Fonte: Financeiro Oficial.*`;
          } else {
            respostaFinal = "Não consegui extrair as métricas financeiras para este período.";
          }
        } else {
          dadosReais = response.result || [];
          if (dadosReais && dadosReais.length > 0) {
            const total = dadosReais.reduce((acc: number, p: any) => acc + (Number(p.valor_total || 0) - Number(p.valor_pago || 0)), 0);
            respostaFinal = `Identifiquei **${dadosReais.length} registros** totalizando **R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** em aberto.`;
          } else {
            respostaFinal = "Não encontrei registros financeiros pendentes.";
          }
        }

      } else if (intent.intencao === 'solicitar_resumo_operacional') {
        const response = await consultarResumoOperacionalIA();
        const resumo = response.result || {};
        respostaFinal = `### 📊 Resumo Operacional (${resumo.data})\n\n` +
          `#### 🕒 Próximo Atendimento\n` +
          (resumo.proximo_atendimento 
            ? `**${resumo.proximo_atendimento.hora}** — **${resumo.proximo_atendimento.pet}** (${resumo.proximo_atendimento.cliente}) — ${resumo.proximo_atendimento.servico}\n\n`
            : `Nenhum agendamento futuro para hoje.\n\n`) +
          `#### 📈 Indicadores\n` +
          `- **Agendamentos**: ${resumo.total_agenda} (${resumo.confirmados} confirmados, ${resumo.em_atendimento} em curso)\n` +
          `- **Finalizados**: ${resumo.finalizados}\n` +
          `- **Leva e Traz**: ${resumo.leva_traz} viagens\n` +
          `- **Promessas de Pagamento**: ${resumo.promessas_hoje}\n\n` +
          `#### 💰 Financeiro (Hoje)\n` +
          `- **Faturamento**: **R$ ${resumo.faturamento_hoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**\n` +
          `- **Recebido**: **R$ ${resumo.recebido_hoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**\n` +
          `- **Total Pendente (Geral)**: **R$ ${resumo.valor_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**`;
      }

      const assistantMessage: IAMessage = {
        role: 'assistant',
        content: respostaFinal,
        intent: intent,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentIntent(intent);

      // Scroll to bottom after state update
      setTimeout(() => {
        if (scrollRef.current) {
          const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }, 100);

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
      // 1. Resolver IDs
      let clienteId = intent.cliente_id;
      let petId = intent.pet_id;
      let servicosIds = intent.servicos_ids;

      if (!clienteId && intent.cliente_nome) {
        const { data: cData } = await supabase.from('clientes').select('id, nome').ilike('nome', `%${intent.cliente_nome}%`).limit(2);
        if (cData && cData.length > 1) {
          throw new Error(`Encontrei mais de um cliente com o nome "${intent.cliente_nome}". Por favor, informe o nome completo ou telefone.`);
        }
        clienteId = cData?.[0]?.id;
      }
      
      if (!petId && intent.pet_nome && clienteId) {
        const { data: pData } = await supabase.from('pets').select('id').eq('cliente_id', clienteId).ilike('nome', `%${intent.pet_nome}%`).limit(1);
        petId = pData?.[0]?.id;
      }
      
      if (!clienteId) throw new Error("Cliente não localizado. Deseja cadastrá-lo?");
      if (!petId) throw new Error("Pet não localizado para este cliente.");

      // 2. Resolver Serviços e Valores
      let servicosParaCriar: { id: string, nome: string, valor: number }[] = [];
      
      if (servicosIds && servicosIds.length > 0) {
        const { data: sData } = await supabase.from('servicos').select('id, nome, valor').in('id', servicosIds);
        servicosParaCriar = sData || [];
      } else if (intent.servicos && intent.servicos.length > 0) {
        const { data: sData } = await supabase.from('servicos').select('id, nome, valor').in('nome', intent.servicos);
        servicosParaCriar = sData || [];
      }

      if (!servicosParaCriar.length) throw new Error("Não identifiquei os serviços solicitados no cadastro oficial.");

      // 3. Re-validar disponibilidade e duplicidade real (Server-side)
      const validation = await validarAgendamentoIA({
        data: {
          data: intent.data!,
          hora: intent.horario!,
          cliente_id: clienteId,
          pet_id: petId,
          servicos: servicosParaCriar.map(s => s.id)
        }
      });

      if (!validation.success) {
        throw new Error(validation.warnings?.[0] || "Horário indisponível.");
      }

      // 4. Executar Gravação Real
      const res = await executarCriacaoAgendamento({
        data: {
          cliente_id: clienteId,
          pet_id: petId,
          data: intent.data!,
          hora: intent.horario!,
          servicos: servicosParaCriar,
          transporte: intent.transporte || false,
          taxa_transporte: intent.taxa_transporte || 0,
          observacoes: intent.observacoes || "Agendado via Agente IA",
          duracao_min: 60 // Valor padrão
        }
      });

      const recordId = res.record_id || res.result?.id;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Agendamento confirmado com sucesso!**\n\n- **ID**: \`${recordId}\`\n- **Pet**: ${intent.pet_nome}\n- **Data**: ${intent.data}\n- **Hora**: ${intent.horario}\n- **Serviços**: ${servicosParaCriar.map(s => s.nome).join(', ')}\n\nO registro já está visível na Agenda.`,
        timestamp: new Date().toISOString(),
        meta: { recordId }
      } as any]);
      
      setCurrentIntent(null);
      toast.success("Agendamento realizado!");
    } catch (error: any) {
      toast.error(error.message);
      
      // Se for erro de horário ocupado, sugerir alternativas
      if (error.message.includes("indisponível") || error.message.includes("ocupado")) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ **Horário ocupado.** Deseja tentar em outro horário?`,
          timestamp: new Date().toISOString()
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ **Não consegui concluir:** ${error.message}`,
          timestamp: new Date().toISOString()
        }]);
      }
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
                            onClick={() => {
                              if (msg.intent?.intencao?.includes('agenda')) window.open('/agenda', '_blank');
                              else if (msg.intent?.intencao?.includes('financeiro') || msg.intent?.intencao?.includes('pendencia')) window.open('/financeiro', '_blank');
                              else if (msg.intent?.intencao === 'solicitar_resumo_operacional') window.open('/dashboard', '_blank');
                              else window.open('/dashboard', '_blank');
                            }}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> 
                            {msg.intent?.intencao?.includes('agenda') ? 'Abrir Agenda' : 
                             msg.intent?.intencao?.includes('financeiro') || msg.intent?.intencao?.includes('pendencia') ? 'Abrir Financeiro' : 
                             msg.intent?.intencao === 'solicitar_resumo_operacional' ? 'Abrir Dashboard' : 'Abrir Sistema'}
                          </Button>
                          
                          {msg.intent.intencao === 'consulta_cliente' && searchResults?.clientes && searchResults.clientes.length > 0 && (
                             <Button 
                               size="sm" 
                               className="h-8 text-[11px] font-bold bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-lg px-3 shadow-md"
                               onClick={() => window.open(`/clientes?id=${searchResults.clientes[0].id}`, '_blank')}
                             >
                               <User className="w-3.5 h-3.5 mr-1.5" /> Ver Detalhes do Cliente
                             </Button>
                          )}

                          {msg.intent.intencao === 'consulta_cliente' && (!searchResults?.clientes || searchResults.clientes.length === 0) && (
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-bold bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-lg px-3 shadow-md"
                              onClick={() => window.open('/clientes?novo=true', '_blank')}
                            >
                              <User className="w-3.5 h-3.5 mr-1.5" /> Cadastrar Cliente
                            </Button>
                          )}

                          {msg.intent.intencao === 'comando_nao_reconhecido' && msg.content.includes('não cadastrado') && (
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-bold bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-lg px-3 shadow-md"
                              onClick={() => window.open('/clientes?novo=true', '_blank')}
                            >
                              <User className="w-3.5 h-3.5 mr-1.5" /> Cadastrar Cliente
                            </Button>
                          )}
                          
                          {['criar_agendamento', 'remarcar_agendamento'].includes(msg.intent.intencao) && (
                            <div className="flex gap-2">
                              {msg.intent.cliente_nome && (
                                <Button 
                                  size="sm" 
                                  className="h-8 text-[11px] font-bold bg-[#123F2A] hover:bg-[#123F2A]/90 text-white rounded-lg px-3 shadow-md"
                                  onClick={() => {
                                    if (msg.intent?.intencao === 'remarcar_agendamento') {
                                      // Se for remarcação, precisamos do ID do agendamento que pode estar no texto ou meta
                                      handleConfirmarRemarcacao(msg);
                                    } else {
                                      handleConfirmarAgendamento(msg.intent!);
                                    }
                                  }}
                                  disabled={isProcessing}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> 
                                  {msg.intent.intencao === 'remarcar_agendamento' ? 'Confirmar Remarcação' : 'Confirmar Agendamento'}
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 text-[11px] font-bold rounded-lg px-3 border-[#C99845]/20 text-[#123F2A]"
                                onClick={() => window.open('/agenda', '_blank')}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir Agenda
                              </Button>
                            </div>
                          )}
                          {msg.intent.intencao === 'cancelar_agendamento' && (
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 shadow-md"
                              onClick={() => handleConfirmarCancelamento(msg)}
                              disabled={isProcessing}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Confirmar Cancelamento
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

            {/* Sugestões Rápidas */}
            <div className="px-6 py-4 flex flex-wrap gap-2 border-t border-[#C99845]/5">
              {[
                "Agenda de hoje",
                "Quantos atendimentos tenho",
                "Criar agendamento",
                "Faturamento do mês",
                "Valores a receber",
                "Resumo do dia"
              ].map((sugestao) => (
                <Button
                  key={sugestao}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-[10px] font-bold h-7 bg-white/50 border-[#C99845]/20 text-[#123F2A] hover:bg-[#C99845]/10 hover:border-[#C99845]/40 transition-all duration-300"
                  onClick={() => handleSend(sugestao)}
                  disabled={isProcessing}
                >
                  {sugestao}
                </Button>
              ))}
            </div>

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
