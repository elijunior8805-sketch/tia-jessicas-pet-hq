import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Heart,
  Briefcase,
  CalendarCheck,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { processarMensagemJessi } from "@/lib/ia/jessi-agent.functions";
import { normalizarTelefoneBR, montarWaUrl, abrirWhatsApp } from "@/lib/whatsapp";

interface JessiThreadSuggesterProps {
  cliente: {
    id: string;
    nome: string;
    whatsapp?: string | null;
    telefone?: string | null;
  } | null | undefined;
  pets?: { id: string; nome: string }[];
  proximoAgendamento?: any;
  mensagensRecentes?: { direcao: string; corpo: string; created_at: string }[];
  onUsarMensagem: (texto: string) => void;
}

export function JessiThreadSuggester({
  cliente,
  pets,
  proximoAgendamento,
  mensagensRecentes,
  onUsarMensagem,
}: JessiThreadSuggesterProps) {
  const processarMensagemFn = useServerFn(processarMensagemJessi);

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState<{
    amigavel?: string;
    direta?: string;
    proativa?: string;
  } | null>(null);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);

  const tutorNome = cliente?.nome?.trim().split(/\s+/)[0] || "Cliente";
  const petNome = pets?.[0]?.nome || "seu pet";

  const gerarAbordagens = async () => {
    if (!cliente) return;
    setLoading(true);
    setIsOpen(true);

    try {
      const historicoTexto = (mensagensRecentes || [])
        .slice(-5)
        .map((m) => `${m.direcao === "in" ? "Cliente" : "Spa"}: ${m.corpo}`)
        .join("\n");

      const promptIA = `Você é a Jessi, assistente inteligente do Spa de Pet Tia Jéssica.
Analise o contexto do cliente abaixo e gere exatamente 3 abordagens curtas, humanas e prontas para WhatsApp:

Tutor: ${tutorNome} (${cliente.nome})
Pet: ${petNome}
Próximo Agendamento: ${proximoAgendamento ? `Dia ${new Date(proximoAgendamento.data).toLocaleDateString('pt-BR')} às ${String(proximoAgendamento.hora).slice(0, 5)}` : 'Nenhum agendamento futuro'}
Últimas mensagens:
${historicoTexto || 'Nenhuma mensagem recente registrada.'}

Responda em formato JSON estrito:
{
  "amigavel": "texto da mensagem acolhedora e calorosa focada no carinho com o pet",
  "direta": "texto objetivo e rápido para tirar dúvidas ou confirmar atendimento",
  "proativa": "texto com convite proativo para banho, retorno ou lembrete de cuidados"
}`;

      const res = await processarMensagemFn({
        data: {
          mensagem: promptIA,
          contexto: {
            origem: "thread_suggester",
            clienteId: cliente.id,
          },
        },
      });

      // Tenta parsear JSON da resposta
      let jsonParsed: any = null;
      try {
        const jsonMatch = res.respostaTexto.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonParsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn("Falha ao parsear JSON direto, usando fallback estruturado");
      }

      if (jsonParsed && (jsonParsed.amigavel || jsonParsed.direta || jsonParsed.proativa)) {
        setSugestoes(jsonParsed);
      } else {
        // Fallback inteligente
        setSugestoes({
          amigavel: `Olá, ${tutorNome}! Como está o(a) ${petNome}? 🐾 Estamos com saudades por aqui no Spa Tia Jéssica. Como posso te ajudar hoje?`,
          direta: `Olá, ${tutorNome}! Aqui é do Spa de Pet Tia Jéssica. Como podemos te auxiliar com o(a) ${petNome}?`,
          proativa: `Olá, ${tutorNome}! Que tal agendarmos o próximo momento de cuidado e bem-estar do(a) ${petNome}? Temos horários especiais disponíveis essa semana! ✨`,
        });
      }
      toast.success("Sugestões da Jessi geradas!");
    } catch (err: any) {
      console.error("Erro ao gerar sugestões com a Jessi:", err);
      toast.error("Falha ao gerar sugestões com a IA.");
      // Fallback
      setSugestoes({
        amigavel: `Olá, ${tutorNome}! Tudo bem com você e o(a) ${petNome}? 🐾 Estou à disposição para o que precisar.`,
        direta: `Olá, ${tutorNome}! Spa de Pet Tia Jéssica à disposição para te atender.`,
        proativa: `Olá, ${tutorNome}! Passando para saber se o(a) ${petNome} está precisando de banho ou cuidados essa semana! 🐶✨`,
      });
    } finally {
      setLoading(false);
    }
  };

  const copiarOuAbrir = (txt: string, idx: number, abrirZap: boolean) => {
    navigator.clipboard.writeText(txt);
    setCopiadoIdx(idx);
    setTimeout(() => setCopiadoIdx(null), 2500);

    if (abrirZap) {
      const tel = normalizarTelefoneBR(cliente?.whatsapp ?? cliente?.telefone);
      if (tel.ok) {
        abrirWhatsApp(montarWaUrl(tel.e164, txt));
        toast.success("Mensagem copiada e WhatsApp aberto!");
      } else {
        toast.info("Mensagem copiada para a área de transferência!");
      }
    } else {
      toast.success("Texto copiado!");
    }
  };

  const cards = [
    {
      id: 1,
      titulo: "Amigável & Afetuosa",
      icone: <Heart className="h-3.5 w-3.5 text-rose-500" />,
      texto: sugestoes?.amigavel,
      bg: "bg-rose-50/60 border-rose-200/80 text-rose-950",
    },
    {
      id: 2,
      titulo: "Direta & Prática",
      icone: <Briefcase className="h-3.5 w-3.5 text-blue-500" />,
      texto: sugestoes?.direta,
      bg: "bg-blue-50/60 border-blue-200/80 text-blue-950",
    },
    {
      id: 3,
      titulo: "Proativa & Retorno",
      icone: <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />,
      texto: sugestoes?.proativa,
      bg: "bg-emerald-50/60 border-emerald-200/80 text-emerald-950",
    },
  ];

  return (
    <div className="rounded-xl border border-[#C8A951]/40 bg-[#FAF8F3] p-3 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#C8A951]/20 flex items-center justify-center text-[#123F2A]">
            <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
          </div>
          <span className="font-bold text-xs text-[#123F2A]">
            Sugestões Inteligentes da Jessi
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={gerarAbordagens}
            disabled={loading}
            className="h-7 text-xs bg-white hover:bg-emerald-50 border-[#C8A951]/50 text-[#123F2A] font-semibold gap-1 rounded-lg"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#C8A951]" />
            ) : (
              <Sparkles className="h-3 w-3 text-[#C8A951]" />
            )}
            <span>{sugestoes ? "Regerar" : "Gerar 3 Abordagens"}</span>
          </Button>

          {sugestoes && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen(!isOpen)}
              className="h-7 w-7 p-0 text-muted-foreground"
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo das 3 abordagens */}
      {isOpen && sugestoes && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 animate-in fade-in">
          {cards.map((c, i) => (
            <div
              key={c.id}
              className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between space-y-2 ${c.bg} shadow-2xs`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                  {c.icone}
                  <span>{c.titulo}</span>
                </div>
                <p className="text-[11px] leading-relaxed italic text-foreground/90">
                  "{c.texto}"
                </p>
              </div>

              <div className="flex items-center gap-1 pt-1 border-t border-black/5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => c.texto && onUsarMensagem(c.texto)}
                  className="h-6 text-[10px] px-2 bg-white/90 hover:bg-white flex-1 font-medium"
                >
                  <MessageCircle className="h-2.5 w-2.5 mr-1" />
                  Inserir no chat
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => c.texto && copiarOuAbrir(c.texto, i, true)}
                  className="h-6 text-[10px] px-2 bg-white/90 hover:bg-white text-emerald-800 font-semibold"
                  title="Abrir no WhatsApp Web"
                >
                  {copiadoIdx === i ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <ExternalLink className="h-2.5 w-2.5 text-emerald-600" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
