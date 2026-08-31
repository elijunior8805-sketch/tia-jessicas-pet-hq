import React, { useState } from "react";
import {
  Sparkles,
  Heart,
  Calendar,
  Send,
  MessageCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface JessiPetDossieCardProps {
  petNome: string;
  tutorNome?: string | null;
  tutorWhatsapp?: string | null;
  totalAtendimentos: number;
  ultimaVisita?: string | null;
  possuiClubinho?: boolean;
  creditosRestantes?: number;
  temperamento?: string | null;
}

export const JessiPetDossieCard: React.FC<JessiPetDossieCardProps> = ({
  petNome,
  tutorNome = "Tutor",
  tutorWhatsapp,
  totalAtendimentos = 0,
  ultimaVisita,
  possuiClubinho = false,
  creditosRestantes = 0,
  temperamento,
}) => {
  const [mensagemGerada, setMensagemGerada] = useState<string | null>(null);

  // Cálculo de dias desde a última visita
  let diasSemVisita = 0;
  if (ultimaVisita) {
    const d = new Date(ultimaVisita);
    const hoje = new Date();
    diasSemVisita = Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Classificação de perfil pela Jessi
  const isEmRisco = diasSemVisita > 25 && totalAtendimentos > 0;
  const isFiel = totalAtendimentos >= 4;

  const handleGerarMensagemReengajamento = () => {
    const primeiroNome = (tutorNome || "Tutor").split(" ")[0];
    let msg = "";

    if (possuiClubinho && creditosRestantes > 0) {
      msg = `Oi, ${primeiroNome}! ✨ Tudo bem por aí?\n\nPassando para lembrar que o ${petNome} ainda tem *${creditosRestantes} crédito(s) do Clubinho* disponíveis para usar aqui no Spa de Pet Tia Jéssica! 🐾\n\nQue tal aproveitarmos esta semana para agendar o banho e deixar ele(a) cheiroso(a) e relaxado(a)? 💚`;
    } else if (isEmRisco) {
      msg = `Oi, ${primeiroNome}! 🐾 Tudo bem?\n\nAqui é do Spa de Pet Tia Jéssica. Estamos com muitas saudades do ${petNome}! Já faz quase um mês desde a última visita de vocês.\n\nTemos horários especiais esta semana! Quer que eu reserve um horário com todo carinho para o ${petNome}? ✨💚`;
    } else {
      msg = `Oi, ${primeiroNome}! 🐾 Passando com carinho para saber como está o ${petNome}!\n\nQuando quiser agendar o próximo banho no Spa de Pet Tia Jéssica, é só me avisar por aqui que separo o melhor horário para vocês! 💚`;
    }

    setMensagemGerada(msg);
  };

  const handleAbrirWhatsApp = () => {
    if (!tutorWhatsapp) {
      toast.error("Tutor sem WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = tutorWhatsapp.replace(/\D/g, "");
    const ddiPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${ddiPhone}?text=${encodeURIComponent(mensagemGerada || "")}`;
    window.open(url, "_blank");
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-4 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-4 w-4 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Dossiê Estratégico da Jessi · {petNome}
              </span>
              {isFiel && (
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-[10px] py-0">
                  Pet Fiel
                </Badge>
              )}
              {isEmRisco && (
                <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/40 text-[10px] py-0">
                  Ausente há {diasSemVisita} dias
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-white/70">
              Análise de assiduidade, ciclo de cuidados e relacionamento com o tutor
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Indicadores de Relacionamento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Total de Atendimentos</span>
          <span className="font-bold text-white text-sm">{totalAtendimentos} visita(s)</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Última Visita</span>
          <span className="font-bold text-white text-sm">
            {ultimaVisita ? `${diasSemVisita} dias atrás` : "Primeira visita"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Clubinho</span>
          <span className="font-bold text-[#F5E6BE] text-sm">
            {possuiClubinho ? `${creditosRestantes} banho(s)` : "Não aderiu"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Temperamento</span>
          <span className="font-bold text-white text-sm truncate">{temperamento || "Dócil"}</span>
        </div>
      </div>

      {/* Parecer Narrado e Ação Sugerida */}
      <div className="mt-3 p-3 rounded-xl bg-black/30 border border-[#C8A951]/30 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#F5E6BE] flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-[#C8A951]" />
            Parecer da Jessi para {tutorNome?.split(" ")[0]}:
          </span>
          {!mensagemGerada && (
            <Button
              size="sm"
              onClick={handleGerarMensagemReengajamento}
              className="h-7 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-lg shadow-2xs gap-1.5"
            >
              <MessageCircle className="h-3 w-3" />
              Gerar Mensagem Carinhosa
            </Button>
          )}
        </div>

        {mensagemGerada ? (
          <div className="p-3 rounded-xl bg-white text-zinc-900 border border-[#C8A951]/40 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-1">
              <span className="font-bold text-[#123F2A] text-xs">Sugestão de Mensagem (WhatsApp):</span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(mensagemGerada);
                    toast.success("Mensagem copiada!");
                  }}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
                {tutorWhatsapp && (
                  <Button
                    size="sm"
                    onClick={handleAbrirWhatsApp}
                    className="h-6 px-2.5 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
                  >
                    <Send className="h-3 w-3" /> Enviar WhatsApp
                  </Button>
                )}
              </div>
            </div>
            <p className="whitespace-pre-line text-zinc-800 text-xs leading-relaxed">{mensagemGerada}</p>
          </div>
        ) : (
          <p className="text-white/80 leading-relaxed text-[11px]">
            {isEmRisco
              ? `${petNome} está com o intervalo de retorno elevado (${diasSemVisita} dias). Recomendo enviar uma mensagem amigável no WhatsApp para lembrar o tutor sobre a higiene e o bem-estar do pet.`
              : possuiClubinho
              ? `${petNome} é cliente do Clubinho e tem ${creditosRestantes} banho(s) restante(s). O plano está ativo e com excelente frequência.`
              : `${petNome} possui um histórico saudável de ${totalAtendimentos} atendimento(s). Excelente candidato para ser convidado ao Clubinho de Banhos!`}
          </p>
        )}
      </div>
    </div>
  );
};
