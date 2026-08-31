import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  Heart,
  Calendar,
  Gift,
  Clock,
  Send,
  Copy,
  ChevronRight,
  UserPlus,
  PawPrint,
  TrendingUp,
  MessageCircle,
  Award,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface JessiClientesOverviewProps {
  onSelectCliente: (clienteId: string) => void;
}

export const JessiClientesOverview: React.FC<JessiClientesOverviewProps> = ({
  onSelectCliente,
}) => {
  const [mensagemPronta, setMensagemPronta] = useState<{ id: string; texto: string; fone: string } | null>(null);

  // 1. Radar de Cuidado e Retorno (Pets sem visita há mais de 25 dias)
  const { data: ausentes = [] } = useQuery({
    queryKey: ["jessi-clientes-ausentes"],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 25);
      const limiteIso = dataLimite.toISOString();

      const { data: atendimentos } = await supabase
        .from("atendimentos")
        .select("cliente_id, pet_id, data_inicio, clientes(id, nome, whatsapp, telefone), pets(id, nome, raca)")
        .not("encerrado_em", "is", null)
        .order("data_inicio", { ascending: false })
        .limit(150);

      const ultimosPorPet = new Map<string, any>();
      (atendimentos ?? []).forEach((at: any) => {
        if (!at.pet_id || !at.clientes) return;
        if (!ultimosPorPet.has(at.pet_id)) {
          ultimosPorPet.set(at.pet_id, at);
        }
      });

      const emRisco: any[] = [];
      ultimosPorPet.forEach((at) => {
        if (at.data_inicio < limiteIso) {
          const dias = Math.floor((new Date().getTime() - new Date(at.data_inicio).getTime()) / (1000 * 60 * 60 * 24));
          emRisco.push({ ...at, diasSemVisita: dias });
        }
      });

      return emRisco.sort((a, b) => b.diasSemVisita - a.diasSemVisita).slice(0, 4);
    },
  });

  // 2. Aniversariantes do Mês (Pets)
  const { data: aniversariantes = [] } = useQuery({
    queryKey: ["jessi-pets-aniversario"],
    queryFn: async () => {
      const mesAtual = new Date().getMonth() + 1;
      const { data: pets } = await supabase
        .from("pets")
        .select("id, nome, raca, data_nascimento, cliente_id, clientes(id, nome, whatsapp, telefone)")
        .not("data_nascimento", "is", null)
        .limit(100);

      const doMes = (pets ?? []).filter((p: any) => {
        if (!p.data_nascimento) return false;
        const [_, m] = String(p.data_nascimento).split("-");
        return Number(m) === mesAtual;
      });

      return doMes.slice(0, 3);
    },
  });

  // 3. Pets Mais Frequentes e Féis (Fidelidade do Spa)
  const { data: maisFrequentes = [] } = useQuery({
    queryKey: ["jessi-pets-frequentes"],
    queryFn: async () => {
      const { data: atendimentos } = await supabase
        .from("atendimentos")
        .select("pet_id, cliente_id, pets(id, nome, raca, foto_url), clientes(id, nome, whatsapp, telefone)")
        .eq("finalizado", true)
        .limit(200);

      const contagem = new Map<string, { count: number; pet: any; cliente: any }>();
      (atendimentos ?? []).forEach((at: any) => {
        if (!at.pets || !at.clientes) return;
        const current = contagem.get(at.pet_id) || { count: 0, pet: at.pets, cliente: at.clientes };
        current.count += 1;
        contagem.set(at.pet_id, current);
      });

      return Array.from(contagem.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    },
  });

  const handleGerarMensagemSaudade = (item: any) => {
    const nomeTutor = item.clientes?.nome?.split(" ")[0] || "Tutor";
    const nomePet = item.pets?.nome || "seu pet";
    const fone = item.clientes?.whatsapp || item.clientes?.telefone || "";

    const texto = `Oi, ${nomeTutor}! 🐾 Tudo bem por aí?\n\nAqui é da equipe do Spa de Pet Tia Jéssica. Estamos com muitas saudades do ${nomePet}! Já faz ${item.diasSemVisita} dias desde a última visitinha.\n\nQue tal aproveitarmos esta semana para um banho relaxante e aquele carinho especial? ✨💚`;

    setMensagemPronta({ id: item.pet_id, texto, fone });
  };

  const handleGerarMensagemParabens = (pet: any) => {
    const nomeTutor = pet.clientes?.nome?.split(" ")[0] || "Tutor";
    const nomePet = pet.nome;
    const fone = pet.clientes?.whatsapp || pet.clientes?.telefone || "";

    const texto = `Parabéns, ${nomeTutor}! 🎉🐾 Hoje é dia de comemorar o aniversário do ${nomePet}!\n\nToda a equipe do Spa de Pet Tia Jéssica deseja muita saúde, petiscos e alegria para esse aumigo tão amado! Que tal trazer ele(a) para um banho especial com direito a muito mimo comemorativo? 🎂✨💚`;

    setMensagemPronta({ id: pet.id, texto, fone });
  };

  const handleGerarMensagemFidelidade = (item: any) => {
    const nomeTutor = item.cliente?.nome?.split(" ")[0] || "Tutor";
    const nomePet = item.pet?.nome || "seu pet";
    const fone = item.cliente?.whatsapp || item.cliente?.telefone || "";

    const texto = `Oi, ${nomeTutor}! 🐾 Passando para agradecer todo o carinho e confiança no Spa de Pet Tia Jéssica! O ${nomePet} é um dos nossos aumigos mais especiais e queridos por toda a equipe. É sempre uma alegria cuidar dele(a)! ✨💚`;

    setMensagemPronta({ id: item.pet?.id, texto, fone });
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
    <div className="space-y-4 animate-in fade-in">
      {/* Banner Principal com a IA Jessi */}
      <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
              <Heart className="h-5 w-5 text-[#C8A951] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-white">
                  Central de Fidelização & Cuidado · Jessi
                </span>
                <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                  Relacionamento & Afeto
                </Badge>
              </div>
              <p className="text-xs text-white/70">
                Acompanhe o bem-estar dos pets, aniversários, retornos e envie carinho aos tutores
              </p>
            </div>
          </div>

          <Link to="/clientes/novo">
            <Button
              size="sm"
              className="h-8 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-lg gap-1.5 shadow-2xs self-start sm:self-auto"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Novo Cliente
            </Button>
          </Link>
        </div>

        {/* Mensagem em Destaque para Disparo */}
        {mensagemPronta && (
          <div className="p-3 rounded-xl bg-white text-zinc-900 border border-[#C8A951]/40 space-y-2 mb-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-1">
              <span className="font-bold text-[#123F2A] text-xs flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-[#C8A951]" />
                Mensagem Gerada com Carinho:
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(mensagemPronta.texto);
                    toast.success("Mensagem copiada!");
                  }}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAbrirWhatsApp(mensagemPronta.fone, mensagemPronta.texto)}
                  className="h-6 px-2.5 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
                >
                  <Send className="h-3 w-3" /> Enviar WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMensagemPronta(null)}
                  className="h-6 px-1.5 text-[10px] text-zinc-500"
                >
                  Fechar
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-zinc-800 text-[11px] leading-relaxed font-sans bg-zinc-50 p-2 rounded-lg border">
              {mensagemPronta.texto}
            </pre>
          </div>
        )}

        {/* Grid de Fidelização e Afeto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Card 1: Radar de Saudades / Retorno */}
          <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-200 flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-amber-300" />
                Saudades (+25d sem visita):
              </span>
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-[10px] py-0">
                {ausentes.length}
              </Badge>
            </div>

            {ausentes.length === 0 ? (
              <p className="text-white/60 text-[11px] py-2">Todos os pets estão com frequência em dia!</p>
            ) : (
              <div className="space-y-1.5">
                {ausentes.slice(0, 3).map((item: any) => (
                  <div
                    key={item.pet_id}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate text-xs">
                        🐾 {item.pets?.nome}
                      </div>
                      <span className="text-[10px] text-white/60 truncate block">{item.clientes?.nome} · {item.diasSemVisita}d</span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleGerarMensagemSaudade(item)}
                      className="h-6 px-2 text-[10px] bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-md shrink-0"
                    >
                      Saudades
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Aniversariantes do Mês */}
          <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-200 flex items-center gap-1.5 text-xs">
                <Gift className="h-3.5 w-3.5 text-emerald-300" />
                Aniversariantes do Mês:
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[10px] py-0">
                {aniversariantes.length}
              </Badge>
            </div>

            {aniversariantes.length === 0 ? (
              <p className="text-white/60 text-[11px] py-2">Nenhum aniversário registrado para este mês.</p>
            ) : (
              <div className="space-y-1.5">
                {aniversariantes.map((pet: any) => (
                  <div
                    key={pet.id}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate text-xs">
                        🎂 {pet.nome}
                      </div>
                      <span className="text-[10px] text-white/60 truncate block">{pet.clientes?.nome}</span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleGerarMensagemParabens(pet)}
                      className="h-6 px-2 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-md shrink-0"
                    >
                      Parabéns
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Pets Mais Frequentes (Fidelidade) */}
          <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#F5E6BE] flex items-center gap-1.5 text-xs">
                <Star className="h-3.5 w-3.5 text-[#C8A951] fill-current" />
                Mais Frequentes (Fidelidade):
              </span>
              <Badge className="bg-[#C8A951]/20 text-[#F5E6BE] border-[#C8A951]/30 text-[10px] py-0">
                Top 3
              </Badge>
            </div>

            {maisFrequentes.length === 0 ? (
              <p className="text-white/60 text-[11px] py-2">Carregando histórico de visitas...</p>
            ) : (
              <div className="space-y-1.5">
                {maisFrequentes.map((item: any) => (
                  <div
                    key={item.pet.id}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate text-xs flex items-center gap-1">
                        🐾 {item.pet.nome}
                        <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] text-[9px] py-0 px-1 border-0">
                          {item.count} banhos
                        </Badge>
                      </div>
                      <span className="text-[10px] text-white/60 truncate block">{item.cliente?.nome}</span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleGerarMensagemFidelidade(item)}
                      className="h-6 px-2 text-[10px] bg-white/10 hover:bg-white/20 text-white font-bold rounded-md shrink-0"
                    >
                      Agradecer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
