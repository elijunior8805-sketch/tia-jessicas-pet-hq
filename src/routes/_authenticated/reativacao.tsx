import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  HeartHandshake,
  Search,
  RefreshCcw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  AlertTriangle,
  CalendarClock,
  Loader2,
  PawPrint,
  Copy,
  Gift,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  listarPetsReativacao,
  getReativacaoKPIs,
  type ReativacaoRow,
} from "@/lib/reativacao.functions";
import {
  JessiCampanhasPromocionais,
  CAMPANHAS_PADRAO,
  type CampanhaPromocional,
} from "@/components/reativacao/JessiCampanhasPromocionais";
import {
  WhatsAppComposer,
  useWhatsAppComposer,
  openWhatsAppComposerGlobal,
} from "@/components/whatsapp-composer";
import { normalizarTelefoneBR } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/reativacao")({
  component: ReativacaoPage,
});

type Faixa = "todas" | "baixo" | "medio" | "alto" | "critico";

const FAIXA_INFO: Record<
  Exclude<Faixa, "todas">,
  { label: string; badge: string; classe: string }
> = {
  baixo: { label: "30-59 dias", badge: "Início", classe: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  medio: { label: "60-89 dias", badge: "Atenção", classe: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  alto: { label: "90-119 dias", badge: "Prioridade", classe: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  critico: { label: "120+ dias", badge: "Crítico", classe: "bg-red-500/15 text-red-700 border-red-500/30" },
};

function ReativacaoPage() {
  const [faixa, setFaixa] = useState<Faixa>("todas");
  const [busca, setBusca] = useState("");
  const [naoContatados, setNaoContatados] = useState(false);
  const [campanhaAtiva, setCampanhaAtiva] = useState<CampanhaPromocional>(CAMPANHAS_PADRAO[0]);

  const listar = useServerFn(listarPetsReativacao);
  const kpisFn = useServerFn(getReativacaoKPIs);

  const composer = useWhatsAppComposer();

  const lista = useQuery({
    queryKey: ["reativacao-lista", faixa, busca, naoContatados],
    queryFn: () => listar({ data: { faixa, busca, apenas_nao_contatados: naoContatados } }),
    staleTime: 30_000,
  });

  const kpis = useQuery({
    queryKey: ["reativacao-kpis"],
    queryFn: () => kpisFn(),
    staleTime: 30_000,
  });

  const rows = lista.data ?? [];
  const totais = kpis.data;

  const enviarWhatsAppDireto = (row: ReativacaoRow) => {
    const fone = row.cliente_whatsapp || row.cliente_telefone || "";
    if (!fone) {
      toast.error(`${row.cliente_nome} sem telefone ou WhatsApp cadastrado.`);
      return;
    }
    const tutorNome = row.cliente_nome.split(" ")[0] || "Tutor";
    const msg = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nAqui é da equipe do Spa de Pet Tia Jéssica! Estamos com muita saudade do(a) ${row.pet_nome} por aqui.\n\n${campanhaAtiva.textoOferta}\n\n${campanhaAtiva.chamadaAcao} Que tal agendarmos o dia de spa dele(a)? ✨💚`;

    const cleanPhone = fone.replace(/\D/g, "");
    const ddiPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${ddiPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const copiarMensagem = (row: ReativacaoRow) => {
    const tutorNome = row.cliente_nome.split(" ")[0] || "Tutor";
    const msg = `Oi, ${tutorNome}! 🐾 Tudo bem?\n\nAqui é da equipe do Spa de Pet Tia Jéssica! Estamos com muita saudade do(a) ${row.pet_nome} por aqui.\n\n${campanhaAtiva.textoOferta}\n\n${campanhaAtiva.chamadaAcao} Que tal agendarmos o dia de spa dele(a)? ✨💚`;
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem promocional copiada!");
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-primary" />
            Reativação de Clientes & Campanhas Promocionais
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie promoções inteligentes com a IA Jessi e resgate clientes inativos para gerar receita imediata.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={lista.isFetching || kpis.isFetching}
          onClick={async () => {
            await Promise.all([lista.refetch(), kpis.refetch()]);
            toast.success("Lista atualizada com sucesso!");
          }}
        >
          {lista.isFetching || kpis.isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Gerador de Campanhas & Ideias da IA Jessi */}
      <JessiCampanhasPromocionais
        totalInativos={totais?.total_candidatos ?? 16}
        ticketMedio={totais?.ticket_medio_potencial ?? 92.31}
        campanhaSelecionada={campanhaAtiva}
        onSelecionarCampanha={setCampanhaAtiva}
      />

      {/* Filtros e Segmentação */}
      <Card className="card-premium">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pet ou tutor…"
                className="pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border bg-muted/30 cursor-pointer font-medium">
              <Checkbox
                checked={naoContatados}
                onCheckedChange={(v) => setNaoContatados(Boolean(v))}
              />
              Só ainda não contatados
            </label>
          </div>
          <Tabs value={faixa} onValueChange={(v) => setFaixa(v as Faixa)}>
            <TabsList className="grid grid-cols-5 w-full md:w-auto">
              <TabsTrigger value="todas">Todas ({totais?.total_candidatos ?? 0})</TabsTrigger>
              <TabsTrigger value="baixo">30-59d ({totais?.por_faixa?.baixo ?? 0})</TabsTrigger>
              <TabsTrigger value="medio">60-89d ({totais?.por_faixa?.medio ?? 0})</TabsTrigger>
              <TabsTrigger value="alto">90-119d ({totais?.por_faixa?.alto ?? 0})</TabsTrigger>
              <TabsTrigger value="critico">120+d ({totais?.por_faixa?.critico ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Lista de Pets Inativos com a Oferta Ativa */}
      <Card className="card-premium">
        <CardHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>{lista.isLoading ? "Carregando…" : `${rows.length} pet(s) para reativar`}</span>
              <Badge className="bg-[#C8A951]/20 text-[#7A611B] border-[#C8A951]/40 text-xs">
                Oferta: {campanhaAtiva.titulo}
              </Badge>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Clique em "Enviar WhatsApp" para disparar a promoção com 1 clique.
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {lista.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum pet encontrado nessa faixa. 🎉
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {rows.map((row) => {
                const info = row.faixa === "sem_historico" || row.faixa === "recente"
                  ? null
                  : FAIXA_INFO[row.faixa];
                const tutorNome = row.cliente_nome.split(" ")[0] || "Tutor";
                const msgPreview = `Oi, ${tutorNome}! 🐾 Estamos com saudades do(a) ${row.pet_nome} (${row.dias_inativo}d sem visita).\n\n${campanhaAtiva.textoOferta}`;

                return (
                  <div
                    key={row.pet_id}
                    className="p-4 rounded-xl border bg-card hover:border-[#C8A951]/50 transition-all space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold overflow-hidden">
                          {row.pet_foto ? (
                            <img
                              src={row.pet_foto}
                              alt={row.pet_nome}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <PawPrint className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-display font-bold text-sm text-primary truncate">
                              {row.pet_nome}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              ({row.cliente_nome})
                            </span>
                            {info && (
                              <Badge variant="outline" className={cn("text-[9px] py-0", info.classe)}>
                                {info.badge} · {row.dias_inativo}d
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Última visita há {row.dias_inativo} dias · Ticket Médio: R$ {row.ticket_medio.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Preview da Mensagem Promocional */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {msgPreview}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copiarMensagem(row)}
                        className="h-8 text-xs gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => enviarWhatsAppDireto(row)}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar WhatsApp
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <WhatsAppComposer
        open={composer.state.open}
        onOpenChange={(v) => (v ? null : composer.close())}
        payload={composer.state.payload}
        onSent={() => {
          lista.refetch();
          kpis.refetch();
        }}
      />
    </div>
  );
}

