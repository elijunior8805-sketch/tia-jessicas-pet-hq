import React, { useState } from "react";
import {
  Sparkles,
  Gift,
  Users2,
  CalendarCheck,
  TrendingUp,
  Percent,
  Zap,
  CheckCircle2,
  ArrowRight,
  Flame,
  PlusCircle,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface CampanhaPromocional {
  id: string;
  titulo: string;
  tag: string;
  descricao: string;
  textoOferta: string;
  chamadaAcao: string;
  corTag: string;
}

export const CAMPANHAS_PADRAO: CampanhaPromocional[] = [
  {
    id: "indique_ganhe",
    titulo: "🐾 Indique 2 e Ganhe 50% OFF",
    tag: "Viral / Captação",
    descricao: "Incentiva o tutor a trazer novos clientes para ganhar metade do valor do banho.",
    textoOferta: "Indicando 2 amigos para conhecerem o nosso Spa de Pet, você ganha 50% de desconto no próximo banho completo do seu peludo! 🎁✨",
    chamadaAcao: "Compartilhe com as mamães e papais de pet da família!",
    corTag: "bg-purple-500/20 text-purple-200 border-purple-400/40",
  },
  {
    id: "volta_com_mimo",
    titulo: "✨ Volta com Mimo: Hidratação Cortesia",
    tag: "Resgate Rápido",
    descricao: "Oferece um tratamento estético cortesia para incentivar o retorno imediato.",
    textoOferta: "Estamos com muita saudade! Agendando o banho esta semana, você ganha uma Hidratação Profunda de Pelos cortesia para deixar ele(a) super macio(a) e cheiroso(a)! 🛁💚",
    chamadaAcao: "Válido para agendamentos até este sábado!",
    corTag: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  },
  {
    id: "terca_quarta_spa",
    titulo: "🛁 Terça & Quarta do Spa (20% OFF)",
    tag: "Preencher Dias Calmos",
    descricao: "Condição especial focada em lotar os dias com menor movimento da semana.",
    textoOferta: "Preparamos um desconto especial de 20% no banho e tosa para agendamentos de Terça ou Quarta-feira! É o momento perfeito para cuidar com calma e carinho do seu aumigo. 🐾✨",
    chamadaAcao: "Vagas limitadas para início da semana!",
    corTag: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  },
  {
    id: "clubinho_vip",
    titulo: "⭐ Upgrade para Clubinho Mensal",
    tag: "Fidelização",
    descricao: "Proposta para transformar cliente avulso em assinante recorrente.",
    textoOferta: "Que tal garantir uma rotina de banhos sempre cheirosos e economizar? Na adesão do Clubinho Mensal este mês, a primeira tosa higiênica e a taxa de leva e traz são por nossa conta! 👑🐾",
    chamadaAcao: "Garanta a vaga fixa na agenda semanal!",
    corTag: "bg-blue-500/20 text-blue-200 border-blue-400/40",
  },
];

interface Props {
  totalInativos: number;
  ticketMedio: number;
  campanhaSelecionada: CampanhaPromocional;
  onSelecionarCampanha: (c: CampanhaPromocional) => void;
}

export const JessiCampanhasPromocionais: React.FC<Props> = ({
  totalInativos = 16,
  ticketMedio = 92.31,
  campanhaSelecionada,
  onSelecionarCampanha,
}) => {
  const [campanhas, setCampanhas] = useState<CampanhaPromocional[]>(CAMPANHAS_PADRAO);
  const [novaIdeiaTema, setNovaIdeiaTema] = useState("");
  const [gerandoNova, setGerandoNova] = useState(false);

  const receitaPotencial = totalInativos * ticketMedio;
  const estimativaRecuperados = Math.round(totalInativos * 0.35); // 35% de conversão estimada
  const receitaEstimada = estimativaRecuperados * ticketMedio;

  const gerarNovaIdeiaComIA = () => {
    if (!novaIdeiaTema.trim()) {
      toast.info("Digite um tema ou objetivo (ex: 'promoção de tosa higiênica', 'combo feriado').");
      return;
    }
    setGerandoNova(true);
    setTimeout(() => {
      const nova: CampanhaPromocional = {
        id: `custom_${Date.now()}`,
        titulo: `✨ ${novaIdeiaTema.trim()}`,
        tag: "Gerada pela IA",
        descricao: `Campanha personalizada focada em: ${novaIdeiaTema.trim()}`,
        textoOferta: `Preparamos uma condição exclusiva de ${novaIdeiaTema.trim()} para você e seu peludo! Agende esta semana e venha aproveitar esse carinho especial. 🐾💚`,
        chamadaAcao: "Aproveite esta condição exclusiva!",
        corTag: "bg-pink-500/20 text-pink-200 border-pink-400/40",
      };

      setCampanhas([nova, ...campanhas]);
      onSelecionarCampanha(nova);
      setNovaIdeiaTema("");
      setGerandoNova(false);
      toast.success("Nova campanha gerada pela Jessi e aplicada a todos os clientes!");
    }, 600);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-6 animate-in fade-in space-y-4">
      {/* Header com Jessi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Gerador de Campanhas & Promoções · Jessi IA
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Motor de Vendas
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Crie ofertas atrativas, selecione uma campanha e gere mensagens persuasivas para reativar clientes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-black/30 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span>
            Potencial de Resgate:{" "}
            <strong className="text-emerald-300 font-bold">
              {receitaPotencial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>
          </span>
        </div>
      </div>

      {/* Grid de Modelos de Campanhas Prontas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#F5E6BE] flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-[#C8A951]" />
            Escolha uma Campanha Ativa para Aplicar nos Clientes:
          </span>
          <span className="text-[11px] text-white/60">
            Oferta atual: <strong className="text-white">{campanhaSelecionada.titulo}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {campanhas.map((c) => {
            const isAtiva = campanhaSelecionada.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelecionarCampanha(c);
                  toast.success(`Campanha "${c.titulo}" ativada para todos os clientes!`);
                }}
                className={`p-3 rounded-xl text-left border transition-all relative ${
                  isAtiva
                    ? "bg-[#C8A951]/25 border-[#C8A951] ring-1 ring-[#C8A951] shadow-md"
                    : "bg-black/25 border-white/10 hover:bg-black/40 hover:border-white/20"
                }`}
              >
                {isAtiva && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#C8A951] text-[#123F2A] px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
                  </div>
                )}
                <Badge className={`text-[9px] px-1.5 py-0 mb-1 border ${c.corTag}`}>
                  {c.tag}
                </Badge>
                <h4 className="font-bold text-xs text-white leading-tight mb-1 pr-10">
                  {c.titulo}
                </h4>
                <p className="text-[10.5px] text-white/70 line-clamp-2 leading-relaxed">
                  {c.descricao}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Criador de Ideia Promocional com IA */}
      <div className="p-3 rounded-xl bg-black/35 border border-[#C8A951]/30 flex flex-col sm:flex-row items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[#F5E6BE] font-bold shrink-0">
          <Wand2 className="h-4 w-4 text-[#C8A951]" />
          Criar Promoção Personalizada:
        </div>
        <div className="flex-1 w-full flex items-center gap-2">
          <Input
            placeholder="Ex: 'Ganhe tosa higiênica no combo de 2 banhos', 'Especial de Sexta-feira'..."
            value={novaIdeiaTema}
            onChange={(e) => setNovaIdeiaTema(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && gerarNovaIdeiaComIA()}
            className="h-8 text-xs bg-black/40 border-white/15 text-white placeholder:text-white/40"
          />
          <Button
            size="sm"
            onClick={gerarNovaIdeiaComIA}
            disabled={gerandoNova}
            className="h-8 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold shrink-0"
          >
            {gerandoNova ? "Gerando..." : "Criar com IA"}
          </Button>
        </div>
      </div>
    </div>
  );
};
