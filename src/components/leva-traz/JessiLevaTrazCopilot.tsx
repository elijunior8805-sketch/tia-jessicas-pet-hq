import React, { useState } from "react";
import {
  Sparkles,
  Truck,
  MapPin,
  MessageCircle,
  Clock,
  Send,
  Copy,
  CheckCircle2,
  Navigation,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TarefaLTItem {
  id: string;
  tipo: "busca" | "entrega";
  hora_prevista: string;
  status: string;
  cliente?: { nome: string; whatsapp: string | null; telefone: string | null } | null;
  pet?: { nome: string } | null;
  endereco?: { rua?: string; bairro?: string; numero?: string } | null;
}

interface JessiLevaTrazCopilotProps {
  tarefas: TarefaLTItem[];
  dataSelecionada: string;
}

export const JessiLevaTrazCopilot: React.FC<JessiLevaTrazCopilotProps> = ({
  tarefas = [],
  dataSelecionada,
}) => {
  const [mensagemRota, setMensagemRota] = useState<{ id: string; texto: string; fone: string } | null>(null);

  const pendentesBusca = tarefas.filter((t) => t.tipo === "busca" && (t.status === "agendado" || t.status === "aguardando_responsavel"));
  const aCaminho = tarefas.filter((t) => t.status === "a_caminho_busca" || t.status === "a_caminho_entrega");
  const concluidas = tarefas.filter((t) => t.status === "pet_entregue" || t.status === "chegou_spa");

  const handleGerarAvisoChegada = (tarefa: TarefaLTItem) => {
    const nomeTutor = tarefa.cliente?.nome?.split(" ")[0] || "Tutor";
    const nomePet = tarefa.pet?.nome || "seu pet";
    const fone = tarefa.cliente?.whatsapp || tarefa.cliente?.telefone || "";

    const texto = tarefa.tipo === "busca"
      ? `Olá, ${nomeTutor}! 🚗🐾\n\nNosso motorista do *Spa de Pet Tia Jéssica* já está a caminho para buscar o *${nomePet}*!\n\nPor favor, já deixe ele(a) prontinho(a) com coleira/guia. Qualquer dúvida é só nos avisar! ✨💚`
      : `Olá, ${nomeTutor}! ✨🐾\n\nO *${nomePet}* já finalizou o atendimento e nosso motorista do *Spa de Pet Tia Jéssica* está a caminho para entregá-lo(a) cheiroso(a) e feliz em sua casa!\n\nPrevisão de chegada em instantes. 💚`;

    setMensagemRota({ id: tarefa.id, texto, fone });
  };

  const handleAbrirWhatsApp = (fone: string, texto: string) => {
    if (!fone) {
      toast.error("Cliente sem telefone ou WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = fone.replace(/\D/g, "");
    const ddiPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${ddiPhone}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-5 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-4 w-4 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Copiloto de Rotas e Logística · Jessi
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Otimização em Tempo Real
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Acompanhamento de coletas, entregas e disparos de "estamos a caminho" via WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Indicadores de Logística */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Total de Viagens Hoje</span>
          <span className="font-bold text-white text-sm">{tarefas.length} corrida(s)</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Buscas Pendentes</span>
          <span className="font-bold text-amber-300 text-sm">{pendentesBusca.length} pet(s)</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Em Trânsito Agora</span>
          <span className="font-bold text-blue-300 text-sm">{aCaminho.length} viagem(ns)</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Concluídas com Sucesso</span>
          <span className="font-bold text-emerald-300 text-sm">{concluidas.length} entrega(s)</span>
        </div>
      </div>

      {/* Mensagem de Aviso em Destaque */}
      {mensagemRota && (
        <div className="mt-3 p-3.5 rounded-xl bg-white text-zinc-900 border border-[#C8A951]/40 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
            <span className="font-bold text-[#123F2A] text-xs flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-[#C8A951]" />
              Aviso de Transporte ao Tutor (WhatsApp):
            </span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(mensagemRota.texto);
                  toast.success("Mensagem copiada!");
                }}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar
              </Button>
              <Button
                size="sm"
                onClick={() => handleAbrirWhatsApp(mensagemRota.fone, mensagemRota.texto)}
                className="h-6 px-2.5 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
              >
                <Send className="h-3 w-3" /> Enviar WhatsApp
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMensagemRota(null)}
                className="h-6 px-1.5 text-[10px] text-zinc-500"
              >
                Fechar
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-zinc-800 text-[11px] leading-relaxed font-sans bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
            {mensagemRota.texto}
          </pre>
        </div>
      )}

      {/* Ações Rápidas por Tarefa Ativa */}
      {tarefas.length > 0 && !mensagemRota && (
        <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/70 font-medium">Avisos Rápidos:</span>
          {tarefas.slice(0, 3).map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant="outline"
              onClick={() => handleGerarAvisoChegada(t)}
              className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-lg gap-1.5 shadow-2xs"
            >
              <Truck className="h-3 w-3 text-[#C8A951]" />
              Avisar {t.cliente?.nome?.split(" ")[0]} ({t.pet?.nome})
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
