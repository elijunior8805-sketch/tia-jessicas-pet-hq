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
import { sugerirMensagemWhatsApp } from "@/lib/comunicacao.functions";
import {
  WhatsAppComposer,
  useWhatsAppComposer,
  openWhatsAppComposerGlobal,
} from "@/components/whatsapp-composer";
import { renderTemplate } from "@/lib/whatsapp-templates";
import { normalizarTelefoneBR } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/reativacao")({
  component: ReativacaoPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="mb-3 text-sm text-destructive">
        Não foi possível carregar a reativação: {error.message}
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  ),
  notFoundComponent: () => <p className="p-6">Não encontrado.</p>,
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
  const [gerandoIA, setGerandoIA] = useState<string | null>(null);

  const listar = useServerFn(listarPetsReativacao);
  const kpisFn = useServerFn(getReativacaoKPIs);
  const gerar = useServerFn(sugerirMensagemWhatsApp);

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

  const abrirComposer = async (row: ReativacaoRow, comIA: boolean) => {
    const tel = row.cliente_whatsapp || row.cliente_telefone || "";
    const norm = normalizarTelefoneBR(tel);
    if (!norm.ok) {
      toast.error(`${row.cliente_nome} sem telefone válido`);
      return;
    }

    let mensagem = "";
    if (comIA) {
      setGerandoIA(row.pet_id);
      try {
        const r = await gerar({
          data: {
            tipo: "reengajamento",
            clienteNome: row.cliente_nome,
            petNome: row.pet_nome,
            tom: "carinhoso",
            contexto: `Sem visitar há ${row.dias_inativo} dias. Ticket médio R$ ${row.ticket_medio.toFixed(2)}.`,
          },
        });
        mensagem = r.mensagem;
      } catch (e: any) {
        toast.error(e?.message ?? "Falha na IA");
        setGerandoIA(null);
        return;
      }
      setGerandoIA(null);
    } else {
      mensagem = renderTemplate("reativacao_cliente", {
        tutor: row.cliente_nome.split(" ")[0],
        pet: row.pet_nome,
      });
    }

    openWhatsAppComposerGlobal({
      tipo: "reativacao_cliente",
      destinatario: row.cliente_nome,
      telefone: norm.e164,
      mensagem,
      motivo: `Pet ${row.pet_nome} sem visita há ${row.dias_inativo} dias`,
      cliente_id: row.cliente_id,
    });
  };

  const totais = kpis.data;
  const funil = useMemo(() => {
    if (!totais) return { pct: 0 };
    return {
      pct: totais.total_candidatos > 0
        ? Math.round((totais.contatados_mes / totais.total_candidatos) * 100)
        : 0,
    };
  }, [totais]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-primary" />
            Reativação de clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Pets sem retornar há 30 dias ou mais, sem agendamento futuro.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={lista.isFetching || kpis.isFetching}
          onClick={async () => {
            await Promise.all([lista.refetch(), kpis.refetch()]);
            toast.success("Lista atualizada");
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Candidatos</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl md:text-3xl font-semibold mt-1">
              {totais?.total_candidatos ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Críticos: {totais?.por_faixa.critico ?? 0} · Alto: {totais?.por_faixa.alto ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Contatados no mês</span>
              <Send className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl md:text-3xl font-semibold mt-1">
              {totais?.contatados_mes ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {funil.pct}% da base
            </p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Recuperados</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl md:text-3xl font-semibold mt-1 text-emerald-700">
              {totais?.recuperados_mes ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Conversão: {totais?.taxa_conversao ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ticket potencial</span>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl md:text-3xl font-semibold mt-1">
              R$ {(totais?.ticket_medio_potencial ?? 0).toFixed(2)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Média por pet inativo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
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
            <label className="flex items-center gap-2 text-sm px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={naoContatados}
                onCheckedChange={(v) => setNaoContatados(Boolean(v))}
              />
              Só ainda não contatados
            </label>
          </div>
          <Tabs value={faixa} onValueChange={(v) => setFaixa(v as Faixa)}>
            <TabsList className="grid grid-cols-5 w-full md:w-auto">
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="baixo">30-59d</TabsTrigger>
              <TabsTrigger value="medio">60-89d</TabsTrigger>
              <TabsTrigger value="alto">90-119d</TabsTrigger>
              <TabsTrigger value="critico">120+d</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {lista.isLoading
              ? "Carregando…"
              : `${rows.length} pet(s) para reativar`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lista.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum pet nessa faixa. 🎉
            </div>
          ) : (
            <div className="grid gap-2">
              {rows.map((row) => {
                const info = row.faixa === "sem_historico" || row.faixa === "recente"
                  ? null
                  : FAIXA_INFO[row.faixa];
                const contatado = !!row.ultimo_contato_reativacao_em;
                const recuperado = row.retornou_apos_contato;
                return (
                  <div
                    key={row.pet_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition",
                      recuperado && "border-emerald-500/40 bg-emerald-500/5"
                    )}
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 overflow-hidden">
                      {row.pet_foto ? (
                        <img
                          src={row.pet_foto}
                          alt={row.pet_nome}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PawPrint className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{row.pet_nome}</p>
                        {info && (
                          <Badge variant="outline" className={cn("text-[10px]", info.classe)}>
                            {info.badge}
                          </Badge>
                        )}
                        {recuperado && (
                          <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                            Recuperado
                          </Badge>
                        )}
                        {contatado && !recuperado && (
                          <Badge variant="secondary" className="text-[10px]">
                            Contatado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.cliente_nome} · {row.dias_inativo}d sem visita
                        {row.ticket_medio > 0 && ` · ticket R$ ${row.ticket_medio.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirComposer(row, false)}
                      >
                        <Send className="h-4 w-4 md:mr-1" />
                        <span className="hidden md:inline">Enviar</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => abrirComposer(row, true)}
                        disabled={gerandoIA === row.pet_id}
                      >
                        {gerandoIA === row.pet_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 md:mr-1" />
                        )}
                        <span className="hidden md:inline">Com IA</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Cada envio pelo composer é registrado automaticamente na Central de Mensagens e conta como tentativa de reativação.
        </p>
      )}

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
