import React, { useState } from "react";
import {
  Sparkles,
  Crown,
  Repeat,
  Scissors,
  Users2,
  TrendingUp,
  Flame,
  CheckCircle2,
  Wand2,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface MotorCampanha {
  id: string;
  titulo: string;
  subtitulo: string;
  tipo: "vip" | "clubinho" | "upsell" | "viral" | "custom";
  tag: string;
  corTag: string;
  icone: React.ComponentType<{ className?: string }>;
  publicoAlvo: string;
  textoOferta: string;
  chamadaAcao: string;
  impactoNegocio: string;
}

export const MOTORES_ESTRATEGICOS: MotorCampanha[] = [
  {
    id: "motor_vip",
    titulo: "👑 Reconhecimento VIP & Fidelidade",
    subtitulo: "Para clientes mais frequentes e assíduos",
    tipo: "vip",
    tag: "Retenção / Encantamento",
    corTag: "bg-amber-500/20 text-amber-200 border-amber-400/40",
    icone: Crown,
    publicoAlvo: "Clientes assíduos (+3 a 4 banhos/mês)",
    textoOferta: "Você e o {{pet}} são clientes muito especiais e VIPs no nosso Spa! 👑 Como forma de agradecimento pela confiança, no próximo banho preparamos de presente o acerto de patinhas e uma hidratação de pelos cortesia! 🛁💚",
    chamadaAcao: "Venha garantir esse mimo especial na próxima visita!",
    impactoNegocio: "Blindagem e fidelização dos clientes mais lucrativos",
  },
  {
    id: "motor_clubinho",
    titulo: "⭐ Conversão em Clubinho Mensal",
    tipo: "clubinho",
    subtitulo: "Receita antecipada & vaga fixa semanal",
    tag: "Receita Recorrente",
    corTag: "bg-blue-500/20 text-blue-200 border-blue-400/40",
    icone: Repeat,
    publicoAlvo: "Clientes avulsos com potencial de assinatura",
    textoOferta: "Que tal garantir uma rotina de banhos sempre cheirosos e economizar? Na adesão do Clubinho Mensal com 4 banhos garantidos, você ganha a 1ª tosa higiênica e taxa de Leva e Traz por nossa conta! 👑🐾",
    chamadaAcao: "Garanta a vaga fixa do {{pet}} toda semana!",
    impactoNegocio: "Receita garantida no início do mês e fim da inadimplência",
  },
  {
    id: "motor_upsell",
    titulo: "🛁 Up-sell: Banho + Tosa (20% OFF)",
    tipo: "upsell",
    subtitulo: "Combo completo para elevar o ticket médio",
    tag: "Aumento de Ticket",
    corTag: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
    icone: Scissors,
    publicoAlvo: "Clientes de banho simples ou tosa pendente",
    textoOferta: "O pelinho do {{pet}} merece uma renovação completa! Fechando o pacote de Banho + Tosa Completa (ou higiênica) esta semana, você ganha 20% de desconto exclusivo no combo! ✨🐾",
    chamadaAcao: "Vagas limitadas para tosa nesta semana!",
    impactoNegocio: "Aumento imediato do faturamento por atendimento",
  },
  {
    id: "motor_viral",
    titulo: "👥 Indique 2 e Ganhe 50% OFF",
    tipo: "viral",
    subtitulo: "Atraia novos clientes através dos atuais",
    tag: "Crescimento Orgânico",
    corTag: "bg-purple-500/20 text-purple-200 border-purple-400/40",
    icone: Users2,
    publicoAlvo: "Toda a carteira de tutores satisfeitos",
    textoOferta: "Você ama ver o {{pet}} cheiroso no nosso Spa? Indicando 2 amigos para conhecerem a nossa equipe, você ganha 50% de desconto no próximo banho completo dele(a)! 🎁✨",
    chamadaAcao: "Compartilhe com amigos e familiares!",
    impactoNegocio: "Aquisição de novos clientes a custo zero de anúncios",
  },
];

interface Props {
  totalClientes: number;
  motorAtivo: MotorCampanha;
  onSelecionarMotor: (m: MotorCampanha) => void;
}

export const JessiCampanhasProativasCopilot: React.FC<Props> = ({
  totalClientes = 18,
  motorAtivo,
  onSelecionarMotor,
}) => {
  const [motores, setMotores] = useState<MotorCampanha[]>(MOTORES_ESTRATEGICOS);
  const [temaPersonalizado, setTemaPersonalizado] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);

  const criarCampanhaComIA = () => {
    if (!temaPersonalizado.trim()) {
      toast.info("Digite um tema ou objetivo (ex: 'promoção de hidratação de ozônio', 'combo chuva').");
      return;
    }
    setGerandoIA(true);
    setTimeout(() => {
      const nova: MotorCampanha = {
        id: `custom_${Date.now()}`,
        titulo: `✨ ${temaPersonalizado.trim()}`,
        subtitulo: "Campanha personalizada criada pela IA Jessi",
        tipo: "custom",
        tag: "Gerada pela IA",
        corTag: "bg-pink-500/20 text-pink-200 border-pink-400/40",
        icone: Wand2,
        publicoAlvo: "Clientes segmentados por IA",
        textoOferta: `Preparamos uma condição exclusiva de ${temaPersonalizado.trim()} para você e o {{pet}} no Spa de Pet Tia Jéssica! Agendando esta semana, você aproveita essa vantagem especial. 🐾💚`,
        chamadaAcao: "Aproveite esta condição exclusiva!",
        impactoNegocio: "Atração direta sob demanda",
      };

      setMotores([nova, ...motores]);
      onSelecionarMotor(nova);
      setTemaPersonalizado("");
      setGerandoIA(false);
      toast.success("Nova campanha gerada e aplicada a todos os clientes!");
    }, 600);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-6 animate-in fade-in space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Central Proativa de Vendas & Fidelização · Jessi IA
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Motor de Resultados
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Escolha uma estratégia de oferta para prospectar, vender clubinhos e fidelizar clientes existentes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-black/30 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span>
            Base Ativa de Clientes:{" "}
            <strong className="text-emerald-300 font-bold">{totalClientes} tutores</strong>
          </span>
        </div>
      </div>

      {/* Grid dos 4 Motores Estratégicos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#F5E6BE] flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-[#C8A951]" />
            Selecione o Motor de Campanha Ativo:
          </span>
          <span className="text-[11px] text-white/60">
            Estratégia ativa: <strong className="text-white">{motorAtivo.titulo}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {motores.map((m) => {
            const isAtivo = motorAtivo.id === m.id;
            const IconeComponent = m.icone;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelecionarMotor(m);
                  toast.success(`Estratégia "${m.titulo}" ativada!`);
                }}
                className={`p-3 rounded-xl text-left border transition-all relative ${
                  isAtivo
                    ? "bg-[#C8A951]/25 border-[#C8A951] ring-1 ring-[#C8A951] shadow-md"
                    : "bg-black/25 border-white/10 hover:bg-black/40 hover:border-white/20"
                }`}
              >
                {isAtivo && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#C8A951] text-[#123F2A] px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
                  </div>
                )}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Badge className={`text-[9px] px-1.5 py-0 border ${m.corTag}`}>
                    {m.tag}
                  </Badge>
                </div>
                <h4 className="font-bold text-xs text-white leading-tight mb-0.5 pr-10">
                  {m.titulo}
                </h4>
                <p className="text-[10px] text-white/60 mb-2">{m.subtitulo}</p>
                <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-300/90 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  <span className="truncate">{m.impactoNegocio}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Criador de Ofertas Abertas com IA */}
      <div className="p-3 rounded-xl bg-black/35 border border-[#C8A951]/30 flex flex-col sm:flex-row items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[#F5E6BE] font-bold shrink-0">
          <Wand2 className="h-4 w-4 text-[#C8A951]" />
          Criar Campanha Sob Demanda:
        </div>
        <div className="flex-1 w-full flex items-center gap-2">
          <Input
            placeholder="Ex: 'Oferecer 15% para banhos na quinta-feira', 'Combo tosa + hidratação'..."
            value={temaPersonalizado}
            onChange={(e) => setTemaPersonalizado(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criarCampanhaComIA()}
            className="h-8 text-xs bg-black/40 border-white/15 text-white placeholder:text-white/40"
          />
          <Button
            size="sm"
            onClick={criarCampanhaComIA}
            disabled={gerandoIA}
            className="h-8 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold shrink-0"
          >
            {gerandoIA ? "Criando..." : "Gerar com IA"}
          </Button>
        </div>
      </div>
    </div>
  );
};
