import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  ArrowUpRight,
  UserX,
  Cake,
  DollarSign,
  Loader2,
  Smile,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  gerarEstrategiaCampanhaIA,
  type EstrategiaCampanhaIA,
} from "@/lib/campanhas.functions";

export interface MotorCampanha {
  id: string;
  titulo: string;
  subtitulo: string;
  tipo: "vip" | "clubinho" | "upsell" | "inativos" | "aniversario" | "viral" | "custom";
  tag: string;
  corTag: string;
  icone: React.ComponentType<{ className?: string }>;
  publicoAlvo: string;
  textoOferta: string;
  chamadaAcao: string;
  impactoNegocio: string;
  conversaoEstimadaPct?: number;
  retornoProjetadoTexto?: string;
}

export const MOTORES_ESTRATEGICOS: MotorCampanha[] = [
  {
    id: "motor_inativos",
    titulo: "🎯 Recuperação de Clientes Sumidos",
    subtitulo: "Para pets sem visita há mais de 25-30 dias",
    tipo: "inativos",
    tag: "Reativação de Caixa",
    corTag: "bg-rose-500/25 text-rose-200 border-rose-400/40",
    icone: UserX,
    publicoAlvo: "Clientes inativos há mais de 25 dias",
    textoOferta: "Sentimos muita saudade do {{pet}} por aqui! 🐾💚 Preparamos uma condição especial de carinho para o retorno dele(a): agendando o banho esta semana, você ganha de presente um acerto de patinhas e uma hidratação de pelos completa cortesia do Spa!",
    chamadaAcao: "Podemos reservar um horário com esse mimo especial pro {{pet}} esta semana?",
    impactoNegocio: "Recuperação imediata de receita com zero custo de mídia",
    conversaoEstimadaPct: 28,
    retornoProjetadoTexto: "+R$ 1.500 a R$ 2.400 em retorno de clientes inativos",
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
    conversaoEstimadaPct: 20,
    retornoProjetadoTexto: "+R$ 2.800/mês recorrente garantido no caixa",
  },
  {
    id: "motor_upsell",
    titulo: "🛁 Up-sell: Banho + Tosa & Hidratação",
    tipo: "upsell",
    subtitulo: "Combo completo para elevar o ticket médio",
    tag: "Aumento de Ticket",
    corTag: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
    icone: Scissors,
    publicoAlvo: "Clientes de banho essencial ou tosa pendente",
    textoOferta: "O pelinho do {{pet}} merece uma renovação completa! Fechando o pacote de Banho + Tosa Completa (ou higiênica) esta semana, você ganha 20% de desconto exclusivo no combo! ✨🐾",
    chamadaAcao: "Vagas limitadas para tosa nesta semana!",
    impactoNegocio: "Aumento imediato do faturamento por atendimento",
    conversaoEstimadaPct: 35,
    retornoProjetadoTexto: "Elevação do ticket médio em +30% por pet",
  },
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
    conversaoEstimadaPct: 45,
    retornoProjetadoTexto: "Blindagem de cancelamentos e LTV máximo",
  },
  {
    id: "motor_aniversario",
    titulo: "🎂 Aniversariantes do Mês",
    tipo: "aniversario",
    subtitulo: "Mimo e comemoração do aniversário do pet",
    tag: "Encantamento Puro",
    corTag: "bg-purple-500/20 text-purple-200 border-purple-400/40",
    icone: Cake,
    publicoAlvo: "Pets que fazem aniversário no mês atual",
    textoOferta: "Parabéns pro {{pet}} pelo mês de aniversário! 🎈🐾 Preparamos uma comemoração especial no Spa: no banho de aniversário dele(a), ele ganha bandana comemorativa, hidratação de pelos e foto temática de presente! 🎁✨",
    chamadaAcao: "Venha comemorar com a gente!",
    impactoNegocio: "Engajamento afetivo altíssimo e indicação orgânica",
    conversaoEstimadaPct: 50,
    retornoProjetadoTexto: "Conversão recorde e fotos nos stories",
  },
  {
    id: "motor_viral",
    titulo: "👥 Indique 2 e Ganhe 50% OFF",
    tipo: "viral",
    subtitulo: "Atraia novos clientes através dos atuais",
    tag: "Crescimento Orgânico",
    corTag: "bg-pink-500/20 text-pink-200 border-pink-400/40",
    icone: Users2,
    publicoAlvo: "Toda a carteira de tutores satisfeitos",
    textoOferta: "Você ama ver o {{pet}} cheiroso no nosso Spa? Indicando 2 amigos para conhecerem a nossa equipe, você ganha 50% de desconto no próximo banho completo dele(a)! 🎁✨",
    chamadaAcao: "Compartilhe com amigos e familiares!",
    impactoNegocio: "Aquisição de novos clientes a custo zero de anúncios",
    conversaoEstimadaPct: 20,
    retornoProjetadoTexto: "+10 a 20 novos clientes a custo zero",
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
  const [tomSelecionado, setTomSelecionado] = useState<"carinhoso" | "vip" | "urgencia" | "pet_lover">("carinhoso");
  const [gerandoIA, setGerandoIA] = useState(false);

  const gerarCampanhaFn = useServerFn(gerarEstrategiaCampanhaIA);

  const criarCampanhaComIA = async () => {
    if (!temaPersonalizado.trim()) {
      toast.info("Digite um tema ou objetivo (ex: 'Hidratação de Ozônio na quarta-feira', 'Recuperação de Shitzu').");
      return;
    }
    setGerandoIA(true);

    try {
      const res = await gerarCampanhaFn({
        data: {
          tema: temaPersonalizado.trim(),
          tom: tomSelecionado,
        },
      });

      const nova: MotorCampanha = {
        id: res.id || `custom_${Date.now()}`,
        titulo: res.titulo,
        subtitulo: res.subtitulo,
        tipo: res.tipo || "custom",
        tag: res.tag || "IA Generativa",
        corTag: res.corTag || "bg-pink-500/20 text-pink-200 border-pink-400/40",
        icone: Wand2,
        publicoAlvo: res.publicoAlvo,
        textoOferta: res.textoOferta,
        chamadaAcao: res.chamadaAcao,
        impactoNegocio: res.impactoNegocio,
        conversaoEstimadaPct: res.conversaoEstimadaPct,
        retornoProjetadoTexto: res.retornoProjetadoTexto,
      };

      setMotores([nova, ...motores]);
      onSelecionarMotor(nova);
      setTemaPersonalizado("");
      toast.success("Nova campanha de alta conversão gerada pela IA Jessi!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar com IA");
    } finally {
      setGerandoIA(false);
    }
  };

  const chipsSugestao = [
    "Oferecer hidratação de ozônio para dias chuvosos",
    "Combo tosa na tesoura + banho relaxante",
    "Preencher horários de terça e quarta-feira",
    "Desconto para tutores com mais de 1 pet",
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 md:p-5 shadow-md border border-[#C8A951]/40 mb-6 animate-in fade-in space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs shrink-0">
            <Sparkles className="h-5 w-5 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-sm md:text-base text-white">
                Central Proativa de Vendas & Fidelização · Jessi IA 100%
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2 font-bold">
                Motor de Resultados
              </Badge>
            </div>
            <p className="text-[11px] text-white/75">
              Copywriting de alta conversão, gatilhos de afeto e retorno financeiro imediato via WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>
              Base Ativa: <strong className="text-emerald-300 font-bold">{totalClientes} tutores</strong>
            </span>
          </div>

          {motorAtivo.retornoProjetadoTexto && (
            <div className="flex items-center gap-1.5 bg-[#C8A951]/20 px-3 py-1.5 rounded-xl border border-[#C8A951]/40 text-xs text-[#F5E6BE]">
              <DollarSign className="h-4 w-4 text-[#C8A951]" />
              <span className="font-bold">{motorAtivo.retornoProjetadoTexto}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid dos Motores Estratégicos */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <span className="text-xs font-bold text-[#F5E6BE] flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-[#C8A951]" />
            Selecione a Estratégia Ativa:
          </span>
          <span className="text-[11px] text-white/60">
            Estratégia ativa: <strong className="text-white">{motorAtivo.titulo}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                className={`p-3 rounded-xl text-left border transition-all relative cursor-pointer ${
                  isAtivo
                    ? "bg-[#C8A951]/25 border-[#C8A951] ring-2 ring-[#C8A951]/70 shadow-md"
                    : "bg-black/25 border-white/10 hover:bg-black/40 hover:border-white/20"
                }`}
              >
                {isAtivo && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#C8A951] text-[#123F2A] px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase shadow-xs">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
                  </div>
                )}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Badge className={`text-[9px] px-1.5 py-0 border ${m.corTag}`}>
                    {m.tag}
                  </Badge>
                  {m.conversaoEstimadaPct && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-white/20 text-white/70">
                      Conv. est.: {m.conversaoEstimadaPct}%
                    </Badge>
                  )}
                </div>
                <h4 className="font-bold text-xs text-white leading-tight mb-0.5 pr-10 flex items-center gap-1.5">
                  <IconeComponent className="h-3.5 w-3.5 text-[#C8A951] shrink-0" />
                  <span className="truncate">{m.titulo}</span>
                </h4>
                <p className="text-[10px] text-white/65 mb-2 line-clamp-1">{m.subtitulo}</p>
                <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-300/90 flex items-center justify-between gap-1">
                  <span className="truncate">{m.impactoNegocio}</span>
                  <ArrowUpRight className="h-3 w-3 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Criador de Ofertas Sob Demanda com IA Generativa Real */}
      <div className="p-3.5 rounded-xl bg-black/40 border border-[#C8A951]/40 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#F5E6BE] font-bold">
            <Wand2 className="h-4 w-4 text-[#C8A951]" />
            Gerar Campanha com Inteligência Artificial (Gemini 1.5):
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-white/60 mr-1">Tom:</span>
            {[
              { id: "carinhoso", label: "Carinhoso & Empático", icon: Smile },
              { id: "vip", label: "VIP & Exclusivo", icon: Crown },
              { id: "urgencia", label: "Urgência Saudável", icon: Zap },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTomSelecionado(t.id as any)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  tomSelecionado === t.id
                    ? "bg-[#C8A951] text-[#123F2A]"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Input
            placeholder="Digite o objetivo da campanha (ex: 'Oferecer 20% no banho de quinta-feira', 'Recuperação de cães peludos')..."
            value={temaPersonalizado}
            onChange={(e) => setTemaPersonalizado(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criarCampanhaComIA()}
            className="h-9 text-xs bg-black/50 border-white/20 text-white placeholder:text-white/40 rounded-xl"
          />
          <Button
            onClick={criarCampanhaComIA}
            disabled={gerandoIA || !temaPersonalizado.trim()}
            className="h-9 px-4 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold shrink-0 w-full sm:w-auto rounded-xl shadow-xs"
          >
            {gerandoIA ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Gerando com IA...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar com IA
              </>
            )}
          </Button>
        </div>

        {/* Chips de Ideias Prontas */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] text-white/50">Sugestões rápidas:</span>
          {chipsSugestao.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTemaPersonalizado(s)}
              className="text-[10px] bg-white/5 hover:bg-white/15 text-white/80 border border-white/10 rounded-lg px-2 py-0.5 transition-all text-left"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
