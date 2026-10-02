import React, { useState } from "react";
import {
  ShieldAlert,
  Clock,
  UserX,
  DollarSign,
  Send,
  Copy,
  Check,
  ExternalLink,
  PawPrint,
  AlertTriangle,
  CheckCircle2,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { SentinelaExecucaoGeral, type AlertaAtrasoSentinela } from "@/lib/ia-v2/adapters/sentinelas.adapter";

interface SentinelaCardProps {
  data: SentinelaExecucaoGeral | any;
  onActionClick?: (comando: string) => void;
}

export const SentinelaCard: React.FC<SentinelaCardProps> = ({ data, onActionClick }) => {
  const [activeTab, setActiveTab] = useState<"todos" | "atrasos" | "vagas" | "caixa">("todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sentinela: SentinelaExecucaoGeral = React.useMemo(() => {
    if (data?.fechamentoCaixa || data?.cancelamentosEVagas || data?.atrasosDetectados) {
      return data;
    }

    const rawAtrasos = Array.isArray(data?.atrasosDetectados)
      ? data.atrasosDetectados
      : Array.isArray(data?.atrasados)
      ? data.atrasados
      : Array.isArray(data?.atrasos)
      ? data.atrasos
      : [];

    const atrasosNormalizados: AlertaAtrasoSentinela[] = rawAtrasos.map((a: any, idx: number) => {
      if (a.agendamentoId && a.tempoAtrasoMinutos !== undefined) return a as AlertaAtrasoSentinela;
      const hora = (a.hora || "").slice(0, 5) || "09:00";
      return {
        agendamentoId: a.id || `atraso_${idx}`,
        clienteNome: a.clientes?.nome || a.clienteNome || a.tutor || "Cliente",
        petNome: a.pets?.nome || a.petNome || "Pet",
        servicoNome: a.servicos?.nome || a.servicoNome || "Serviço",
        horarioPrevisto: hora,
        tempoAtrasoMinutos: 30,
        telefoneCliente: a.clientes?.telefone || a.telefone || "",
        mensagemWhatsappSugerida: `Olá, ${a.clientes?.nome || "tudo bem"}? Estamos aguardando o ${a.pets?.nome || "seu pet"} para o atendimento das ${hora}.`,
      };
    });

    return {
      dataReferencia: new Date().toISOString().split("T")[0],
      totalAlertasAtivos: atrasosNormalizados.length || (Array.isArray(data) ? data.length : 1),
      cancelamentosEVagas: Array.isArray(data?.vagas) ? data.vagas : [],
      atrasosDetectados: atrasosNormalizados,
      fechamentoCaixa: data?.fechamento || null,
      statusGeral: atrasosNormalizados.length > 0 ? "atencao" : "operacao_normal",
      resumoVoz: "Diagnóstico das sentinelas concluído.",
    };
  }, [data]);

  const atrasos = sentinela.atrasosDetectados || [];
  const vagas = sentinela.cancelamentosEVagas || [];
  const caixa = sentinela.fechamentoCaixa;

  const handleCopiarTexto = async (texto: string, id: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(id);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
  };

  const handleEnviarWhatsApp = (url?: string) => {
    if (url) {
      abrirWhatsApp(url);
    } else {
      toast.error("Telefone ou link indisponível.");
    }
  };

  const brl = (val?: number) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 space-y-3.5 shadow-xs text-xs">
      {/* Topo do Card de Sentinela */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
              sentinela.statusGeral === "critico"
                ? "bg-red-600"
                : sentinela.totalAlertasAtivos > 0
                ? "bg-amber-600"
                : "bg-emerald-600"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-foreground">
                Sentinelas Autônomas em Background
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Live
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Monitoramento contínuo de atrasos, cancelamentos e caixa
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className={`text-[10px] font-semibold ${
            sentinela.statusGeral === "critico"
              ? "bg-red-50 text-red-700 border-red-200"
              : sentinela.totalAlertasAtivos > 0
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {sentinela.totalAlertasAtivos > 0
            ? `${sentinela.totalAlertasAtivos} alerta(s) ativo(s)`
            : "Operação 100% em dia"}
        </Badge>
      </div>

      {/* Navegação por Abas Rápidas */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60">
        <button
          onClick={() => setActiveTab("todos")}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === "todos"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab("atrasos")}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "atrasos"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Atrasos ({atrasos.length})
        </button>
        <button
          onClick={() => setActiveTab("vagas")}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "vagas"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Vagas ({vagas.length})
        </button>
        <button
          onClick={() => setActiveTab("caixa")}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "caixa"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Caixa Hoje
        </button>
      </div>

      {/* Conteúdo: Sentinela de Atrasos */}
      {(activeTab === "todos" || activeTab === "atrasos") && atrasos.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-900 flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              Atrasos Detectados na Chegada ({atrasos.length})
            </span>
            <span className="text-[10px] text-amber-700">Follow-up gentil pronto</span>
          </div>

          <div className="space-y-2">
            {atrasos.map((atr) => {
              const isCopied = copiedId === atr.id;
              return (
                <div
                  key={atr.id}
                  className="p-2.5 rounded-lg border border-amber-200 bg-background space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{atr.petNome}</span>
                        <span className="text-[11px] text-muted-foreground">({atr.clienteNome})</span>
                      </div>
                      <span className="text-[10px] text-amber-800 font-medium">
                        Agendado para {atr.horarioAgendado} •{" "}
                        <strong className="text-red-700 font-bold">{atr.minutosAtraso} min de atraso</strong>
                      </span>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                      Atrasado
                    </Badge>
                  </div>

                  <p className="text-[11px] bg-muted/40 p-2 rounded-md italic text-muted-foreground border border-border/40">
                    &ldquo;{atr.mensagemSugerida}&rdquo;
                  </p>

                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      size="sm"
                      onClick={() => handleEnviarWhatsApp(atr.linkWhatsApp)}
                      disabled={!atr.linkWhatsApp}
                      className="flex-1 h-7 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-medium gap-1 cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                      Perguntar no WhatsApp
                      <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopiarTexto(atr.mensagemSugerida, atr.id, "Mensagem")}
                      className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-muted-foreground" /> Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conteúdo: Sentinela de Cancelamentos / Vagas Ociosas */}
      {(activeTab === "todos" || activeTab === "vagas") && vagas.length > 0 && (
        <div className="space-y-2 rounded-xl border border-blue-200/80 bg-blue-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900 flex items-center gap-1.5 text-xs">
              <UserX className="h-3.5 w-3.5 text-blue-600" />
              Vagas Abertas / Cancelamentos ({vagas.length})
            </span>
            <span className="text-[10px] text-blue-700">Preenchimento instantâneo</span>
          </div>

          <div className="space-y-2.5">
            {vagas.map((vaga) => (
              <div
                key={vaga.id}
                className="p-2.5 rounded-lg border border-blue-200 bg-background space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    Horário Liberado: {vaga.horario} ({vaga.servicoNome || "Banho"})
                  </span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                    {vaga.tipo === "cancelamento" ? "Cancelamento" : "Vaga Ociosa"}
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Melhores Candidatos para Preencher:
                  </span>
                  {vaga.candidatos.map((cand, cIdx) => {
                    const cKey = `${vaga.id}_cand_${cIdx}`;
                    const isCopied = copiedId === cKey;
                    return (
                      <div
                        key={cKey}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/40 gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-[11px] block truncate text-foreground">
                            {cand.petNome} ({cand.clienteNome})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Ausente há {cand.diasInativo} dias
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleEnviarWhatsApp(cand.linkWhatsApp)}
                            disabled={!cand.linkWhatsApp}
                            className="h-6 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white gap-1 px-2 cursor-pointer"
                          >
                            <Send className="h-2.5 w-2.5" /> Convidar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopiarTexto(cand.mensagemSugerida, cKey, "Convite")}
                            className="h-6 px-1.5 text-[10px] cursor-pointer"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo: Sentinela de Fechamento de Caixa */}
      {(activeTab === "todos" || activeTab === "caixa") && caixa && (
        <div className="space-y-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-900 flex items-center gap-1.5 text-xs">
              <DollarSign className="h-3.5 w-3.5 text-emerald-700" />
              Fechamento de Caixa Diário ({caixa.data.split("-").reverse().join("/")})
            </span>
            <span className="text-[10px] text-emerald-700">Pronto para envio aos sócios</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-background border border-border/60 text-center">
              <span className="text-[10px] text-muted-foreground block">Total Recebido</span>
              <span className="font-bold text-xs text-emerald-700 block">{brl(caixa.totalRecebido)}</span>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border/60 text-center">
              <span className="text-[10px] text-muted-foreground block">💠 Pix</span>
              <span className="font-bold text-xs text-foreground block">{brl(caixa.recebidoPix)}</span>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border/60 text-center">
              <span className="text-[10px] text-muted-foreground block">💳 Cartão</span>
              <span className="font-bold text-xs text-foreground block">{brl(caixa.recebidoCartao)}</span>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border/60 text-center">
              <span className="text-[10px] text-muted-foreground block">⚠️ A Receber</span>
              <span className="font-bold text-xs text-amber-700 block">{brl(caixa.totalPendenteAReceber)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => handleEnviarWhatsApp(caixa.linkCompartilharWhatsApp)}
              disabled={!caixa.linkCompartilharWhatsApp}
              className="flex-1 h-7 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-medium gap-1.5 cursor-pointer shadow-2xs"
            >
              <Share2 className="h-3 w-3" />
              Compartilhar Fechamento no WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopiarTexto(caixa.textoRelatorioWhatsApp, "caixa_report", "Relatório de Caixa")}
              className="h-7 px-3 text-[11px] gap-1 cursor-pointer"
            >
              {copiedId === "caixa_report" ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-muted-foreground" /> Copiar Texto
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Rodapé Informativo */}
      <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>As sentinelas operam continuamente em background.</span>
        <button
          onClick={() => onActionClick?.("atualizar sentinelas")}
          className="font-semibold text-primary hover:underline cursor-pointer"
        >
          Atualizar Sentinelas
        </button>
      </div>
    </div>
  );
};
