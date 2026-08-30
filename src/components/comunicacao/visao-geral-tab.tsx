import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Clock,
  CalendarClock,
  CheckCircle2,
  MessageSquareWarning,
  Banknote,
  PhoneOff,
  CalendarX2,
  HelpCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  visaoGeralComunicacao,
  resumoInteligente,
  painelOperacional,
} from "@/lib/comunicacao-central.functions";
import { JessiComunicacaoPanel } from "./JessiComunicacaoPanel";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface SmartKpiProps {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "alerta" | "ok" | "critico";
  explicacao: {
    titulo: string;
    origem: string;
    detalhes: string;
    acaoRecomendada: string;
    comandoJessi: string;
  };
  onExplicar: (exp: SmartKpiProps["explicacao"]) => void;
}

function SmartKpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  explicacao,
  onExplicar,
}: SmartKpiProps) {
  const tones: Record<string, string> = {
    default: "border-border/80 bg-card",
    ok: "border-emerald-200 bg-emerald-50/40",
    alerta: "border-amber-200 bg-amber-50/40",
    critico: "border-rose-200 bg-rose-50/40",
  };

  return (
    <Card
      onClick={() => onExplicar(explicacao)}
      className={`p-4 rounded-2xl cursor-pointer transition-all hover:shadow-md hover:border-emerald-600/50 ${tones[tone]} group relative`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate font-medium">{label}</p>
          <p className="text-2xl font-bold tracking-tight mt-1 text-foreground">{value}</p>
          {hint ? <p className="text-[11px] text-muted-foreground mt-1 font-medium">{hint}</p> : null}
        </div>
        <div className="p-2 rounded-xl bg-background/80 border border-border/60 text-emerald-800 group-hover:bg-emerald-100/60 transition-colors">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="group-hover:text-emerald-800 font-semibold flex items-center gap-1">
          Explicar indicador <ArrowRight className="h-2.5 w-2.5" />
        </span>
        <HelpCircle className="h-3 w-3 opacity-60" />
      </div>
    </Card>
  );
}

export function VisaoGeralTab({
  onIrParaFila,
  onIrParaInbox,
  onIrParaPromessas,
}: {
  onIrParaFila?: () => void;
  onIrParaInbox?: (clienteId?: string) => void;
  onIrParaPromessas?: () => void;
}) {
  const visaoFn = useServerFn(visaoGeralComunicacao);
  const painelFn = useServerFn(painelOperacional);

  const [modalExplicacao, setModalExplicacao] = useState<{
    titulo: string;
    origem: string;
    detalhes: string;
    acaoRecomendada: string;
    comandoJessi: string;
  } | null>(null);

  const q = useQuery({
    queryKey: ["comunicacao", "visao-geral"],
    queryFn: () => visaoFn(),
    refetchInterval: 60_000,
  });

  const painelQ = useQuery({
    queryKey: ["comunicacao", "painel-operacional"],
    queryFn: () => painelFn(),
    refetchInterval: 120_000,
  });

  const d = q.data as any;

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpisData = {
    aguardandoRevisao: d?.aguardandoRevisao ?? 0,
    cobrancasVencidas: d?.cobrancasVencidas ?? 0,
    valorVencido: d?.valorVencido ?? 0,
    promessasHoje: d?.promessasHoje ?? 0,
    mensagensAgendadas: d?.mensagensAgendadas ?? 0,
    enviadasHoje: d?.enviadasHoje ?? 0,
    pagosAposCobranca: d?.pagosAposCobranca ?? 0,
    clientesSemResposta: d?.clientesSemResposta ?? 0,
    precisamAtencaoHumana: d?.precisamAtencaoHumana ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. Painel Resumo e Pergunte à Jessi integrado no topo */}
      <JessiComunicacaoPanel
        kpis={kpisData}
        onNavegarAba={(aba) => {
          if (aba === "fila" && onIrParaFila) onIrParaFila();
          if (aba === "inbox" && onIrParaInbox) onIrParaInbox();
          if (aba === "promessas" && onIrParaPromessas) onIrParaPromessas();
        }}
        onRefresh={() => {
          q.refetch();
          painelQ.refetch();
        }}
        isRefreshing={q.isFetching}
      />

      {/* 2. Grid de Cards Inteligentes e Explicáveis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-display">
            Indicadores de Relacionamento (Clique para ver a análise da Jessi):
          </h2>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <SmartKpi
            icon={Sparkles}
            label="Aguardando revisão"
            value={String(kpisData.aguardandoRevisao)}
            hint="Mensagens na fila proativa"
            tone={kpisData.aguardandoRevisao ? "alerta" : "default"}
            explicacao={{
              titulo: "Mensagens Aguardando Revisão",
              origem: "Tabela 'mensagem_sugestoes' com status 'pendente'",
              detalhes: `Existem ${kpisData.aguardandoRevisao} abordagens preparadas pela IA aguardando sua aprovação humana antes de qualquer envio.`,
              acaoRecomendada: "Abrir a Fila Proativa para aprovar, editar ou gerar versões alternativas.",
              comandoJessi: "Revisar mensagens na fila proativa",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={AlertTriangle}
            label="Cobranças vencidas"
            value={String(kpisData.cobrancasVencidas)}
            hint={brl(kpisData.valorVencido)}
            tone={kpisData.cobrancasVencidas ? "critico" : "ok"}
            explicacao={{
              titulo: "Cobranças Vencidas em Aberto",
              origem: "Tabela 'pagamentos' (status 'pendente'/'atrasado' com vencimento anterior a hoje)",
              detalhes: `Total de ${kpisData.cobrancasVencidas} faturas vencidas somando ${brl(kpisData.valorVencido)}. A Jessi priorizou os clientes com maior tempo de atraso que ainda não possuem promessa de pagamento ativa.`,
              acaoRecomendada: "Gerar abordagens de cobrança personalizadas no tom adequado a cada cliente.",
              comandoJessi: "Quais são as 5 cobranças mais antigas?",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={CalendarClock}
            label="Promessas para hoje"
            value={String(kpisData.promessasHoje)}
            hint="Aguardar confirmação Pix"
            tone={kpisData.promessasHoje ? "alerta" : "default"}
            explicacao={{
              titulo: "Promessas de Pagamento Vencendo Hoje",
              origem: "Tabela 'promessas_pagamento' com data_prometida igual a hoje",
              detalhes: `${kpisData.promessasHoje} cliente(s) combinaram de realizar o pagamento hoje. A Jessi recomenda aguardar até o encerramento do expediente antes de enviar nova cobrança.`,
              acaoRecomendada: "Acompanhar extrato Pix para conciliar os comprovantes recebidos.",
              comandoJessi: "Quem prometeu pagar hoje?",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={Clock}
            label="Mensagens agendadas"
            value={String(kpisData.mensagensAgendadas)}
            hint="Adiadas para depois"
            tone="default"
            explicacao={{
              titulo: "Mensagens Agendadas e Adiadas",
              origem: "Tabela 'mensagem_sugestoes' com campo 'adiada_para' futuro",
              detalhes: `${kpisData.mensagensAgendadas} mensagens foram reprogramadas para evitar contato em horários inoportunos ou para respeitar acordos prévios com os tutores.`,
              acaoRecomendada: "Nenhuma ação necessária agora; a fila voltará automaticamente na data estipulada.",
              comandoJessi: "Quais mensagens estão agendadas para amanhã?",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={CheckCircle2}
            label="Enviadas hoje"
            value={String(kpisData.enviadasHoje)}
            hint="Registros manuais auditados"
            tone="ok"
            explicacao={{
              titulo: "Comunicações Enviadas Hoje",
              origem: "Tabela 'mensagem_historico' com created_at no dia atual",
              detalhes: `${kpisData.enviadasHoje} mensagens foram revisadas e enviadas aos tutores hoje via WhatsApp Web com consentimento registrado.`,
              acaoRecomendada: "Acompanhar respostas no Inbox Inteligente.",
              comandoJessi: "Resumo dos envios de hoje",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={Banknote}
            label="Pagos após cobrança"
            value={String(kpisData.pagosAposCobranca)}
            hint="Efetividade de cobrança"
            tone="ok"
            explicacao={{
              titulo: "Pagamentos Confirmados Pós-Cobrança",
              origem: "Cruzamento entre pagamentos quitados e histórico de contatos nos últimos 7 dias",
              detalhes: `${kpisData.pagosAposCobranca} fatura(s) foram regularizadas após o recebimento de mensagem enviada pela equipe.`,
              acaoRecomendada: "Enviar mensagem de agradecimento ou confirmação do crédito.",
              comandoJessi: "Quem pagou depois da última cobrança?",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={MessageSquareWarning}
            label="Sem resposta há +48h"
            value={String(kpisData.clientesSemResposta)}
            hint="Necessita nova abordagem"
            tone={kpisData.clientesSemResposta ? "alerta" : "default"}
            explicacao={{
              titulo: "Clientes Sem Resposta há mais de 48h",
              origem: "Conversas com última mensagem enviada pelo Spa sem retorno do tutor",
              detalhes: `${kpisData.clientesSemResposta} tutores receberam comunicação há mais de 2 dias e ainda não responderam.`,
              acaoRecomendada: "Avaliar se cabe reenvio em tom mais cordial ou pausa para não gerar atrito.",
              comandoJessi: "Quais clientes não responderam há mais de 48 horas?",
            }}
            onExplicar={setModalExplicacao}
          />

          <SmartKpi
            icon={CalendarX2}
            label="Atenção humana urgente"
            value={String(kpisData.precisamAtencaoHumana)}
            hint="3+ tentativas sem acordo"
            tone={kpisData.precisamAtencaoHumana ? "critico" : "default"}
            explicacao={{
              titulo: "Clientes que Precisam de Atenção Humana",
              origem: "Registros com 3 ou mais contatos sem liquidação ou com quebra de acordo",
              detalhes: `${kpisData.precisamAtencaoHumana} caso(s) exigem contato telefônico direto do proprietário para alinhamento amigável e personalizado.`,
              acaoRecomendada: "Realizar ligação direta em vez de envio de mensagem automática.",
              comandoJessi: "Quem são os clientes que precisam de atenção humana urgente?",
            }}
            onExplicar={setModalExplicacao}
          />
        </div>
      </div>

      {/* Modal Explicativo da Jessi para o KPI */}
      <Dialog open={!!modalExplicacao} onOpenChange={(open) => !open && setModalExplicacao(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Explicação Analítica da Jessi</span>
            </div>
            <DialogTitle className="text-base font-bold font-display">
              {modalExplicacao?.titulo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Fonte técnica: {modalExplicacao?.origem}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/50 border border-border/60">
              <span className="font-semibold block mb-1 text-foreground">Diagnóstico da IA:</span>
              <p className="text-muted-foreground leading-relaxed">
                {modalExplicacao?.detalhes}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
              <span className="font-semibold block mb-1 text-emerald-950">Próxima Melhor Ação:</span>
              <p className="text-emerald-900 leading-relaxed font-medium">
                {modalExplicacao?.acaoRecomendada}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalExplicacao(null)}
              className="text-xs rounded-xl"
            >
              Fechar
            </Button>
            {onIrParaFila && (
              <Button
                size="sm"
                onClick={() => {
                  setModalExplicacao(null);
                  onIrParaFila();
                }}
                className="text-xs bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold"
              >
                Abrir Fila de Ação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
