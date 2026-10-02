import React from "react";
import { CheckCircle, AlertTriangle, ShieldCheck, XCircle, Clock, Calendar, User, Dog, DollarSign, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmacaoCardProps {
  data: any;
  onConfirmar?: (pendingAction: any) => void;
  onCancelar?: () => void;
  onActionClick?: (commandText: string) => void;
  isLoading?: boolean;
}

export const ConfirmacaoCard: React.FC<ConfirmacaoCardProps> = ({
  data,
  onConfirmar,
  onCancelar,
  onActionClick,
  isLoading,
}) => {
  const pendingAction = data?.pendingAction || data?.acaoPendente || {
    id: data?.proposta?.id || data?.id || `idemp_${Date.now()}`,
    title: data?.proposta?.motivo || data?.title || "Confirmar Operação",
    summary: data?.proposta?.motivo || data?.resumo || "Deseja confirmar a execução?",
    tool: data?.proposta?.acao || data?.tool || data?.action || data?.acao || "criar_agendamento",
    params: data?.proposta?.estadoProposto || data?.params || data || {},
  };

  const executado = data?.executado;
  const proposta = data?.proposta;
  const resumoVisual = data?.resumoVisual || proposta?.resumoVisual;
  const resumo = data?.resumo || resumoVisual?.entendido || pendingAction?.summary || "Deseja confirmar a execução?";
  const params = pendingAction?.params || proposta?.estadoProposto || data?.params || data || {};

  const toolNome = data?.tool || pendingAction.tool || pendingAction.action || pendingAction.acao || "";

  const ehAgendamento =
    toolNome === "criar_agendamento" ||
    toolNome === "executar_agendamento" ||
    toolNome === "preparar_agendamento" ||
    pendingAction.type === "criar_agendamento" ||
    pendingAction.type === "preparar_agendamento" ||
    data?.acao === "criar_agendamento" ||
    data?.tipo === "agendamento" ||
    Boolean(params.petNome || params.data || params.hora);

  const ehCancelamento =
    toolNome === "cancelar_agendamento" ||
    toolNome === "executar_cancelamento" ||
    toolNome === "preparar_cancelamento" ||
    pendingAction.type === "cancelar_agendamento" ||
    pendingAction.type === "preparar_cancelamento" ||
    data?.acao === "cancelar_agendamento" ||
    data?.tipo === "cancelamento";

  const ehReagendamento =
    toolNome === "remarcar_agendamento" ||
    toolNome === "executar_remarcacao" ||
    toolNome === "reagendar_agendamento" ||
    toolNome === "reagendar" ||
    pendingAction.type === "remarcar_agendamento" ||
    data?.tipo === "reagendamento";

  // Validação de dados mínimos
  const clienteValido = Boolean(params.clienteId || params.clienteNome);
  const petValido = Boolean(params.petId || params.petNome);
  const dataValida = Boolean(params.data && /^\d{4}-\d{2}-\d{2}$/.test(params.data));
  const horaValida = Boolean(params.hora && /^([01]\d|2[0-3]):[0-5]\d/.test(params.hora));
  const servicoValido = Boolean(params.servicoNome || params.servico);

  const operacaoInvalida = !executado && ehAgendamento && (!clienteValido || !petValido || !dataValida || !horaValida || !servicoValido);

  const formatarDataAmigavel = (dataStr?: string) => {
    if (!dataStr) return "A definir";
    if (dataStr.includes("-")) {
      const [ano, mes, dia] = dataStr.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
  };

  const petNome = params.petNome || data?.resultado?.data?.petNome || "o Pet";
  const clienteNome = params.clienteNome || data?.resultado?.data?.clienteNome;

  if (executado) {
    if (ehCancelamento) {
      return (
        <div className="rounded-2xl border border-rose-300/80 bg-gradient-to-br from-rose-50/95 to-rose-100/60 p-4 space-y-2 text-xs text-rose-950 shadow-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 font-semibold text-rose-900 text-sm">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>Agendamento Cancelado com Sucesso</span>
          </div>
          <p className="text-[12px] text-rose-800 leading-relaxed font-medium">
            {data?.resultado?.summary || data?.summary || "O horário foi liberado na grade do Spa."}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/95 to-emerald-100/60 p-4 space-y-3 text-xs text-emerald-950 shadow-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
          <div className="flex items-center gap-2 font-semibold text-emerald-900 text-sm">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{ehReagendamento ? "Atendimento Remarcado!" : "Atendimento Confirmado e Registrado!"}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">
            Salvo na Grade
          </span>
        </div>

        {/* Resumo do Atendimento Confirmado */}
        {(params.petNome || params.data || params.hora) && (
          <div className="grid grid-cols-2 gap-2 bg-white/80 p-2.5 rounded-xl border border-emerald-200/70 text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <Dog className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span className="truncate font-semibold text-emerald-950">{petNome}</span>
            </div>
            {clienteNome && (
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span className="truncate text-emerald-800">{clienteNome}</span>
              </div>
            )}
            {params.data && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span className="font-semibold text-emerald-950">{formatarDataAmigavel(params.data)}</span>
              </div>
            )}
            {params.hora && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span className="font-bold text-emerald-900">{params.hora}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-[12px] text-emerald-800 leading-relaxed font-medium">
          {data?.resultado?.summary || data?.summary || "O agendamento já está registrado e garantido na grade."}
        </p>

        {/* Ações Rápidas Pós-Agendamento: Desmarcar / Remarcar */}
        {onActionClick && (
          <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => onActionClick(`cancelar agendamento do ${petNome}`)}
              className="flex-1 h-8 px-2.5 text-[11px] font-semibold text-rose-700 hover:text-rose-800 bg-white/90 hover:bg-rose-50 border-rose-200 gap-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
              <span>Desmarcar / Cancelar</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => onActionClick(`remarcar agendamento do ${petNome}`)}
              className="flex-1 h-8 px-2.5 text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 bg-white/90 hover:bg-emerald-50 border-emerald-200 gap-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span>Remarcar Horário</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${ehCancelamento ? "border-rose-300 bg-gradient-to-br from-rose-50/90 to-rose-100/50 text-rose-950 shadow-rose-100/50" : "border-emerald-200/90 bg-gradient-to-br from-card via-background to-emerald-50/30 text-foreground shadow-xs"} p-4 space-y-3.5 text-xs shadow-md transition-all`}>
      {/* Header do Cartão */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2 font-bold text-sm">
          {ehCancelamento ? (
            <>
              <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <XCircle className="h-4 w-4" />
              </div>
              <span className="text-rose-900">Cancelar Agendamento</span>
            </>
          ) : (
            <>
              <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-emerald-700" />
              </div>
              <span className="text-emerald-950">{ehReagendamento ? "Remarcar Atendimento" : "Resumo do Agendamento"}</span>
            </>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ehCancelamento ? "bg-rose-200/80 text-rose-900" : "bg-emerald-100 text-emerald-800"}`}>
          {ehCancelamento ? "Liberar Vaga" : "Pronto para Confirmar"}
        </span>
      </div>

      {/* Grid de Informações Chave */}
      <div className="space-y-2.5">
        {(ehAgendamento || ehCancelamento || ehReagendamento) && (
          <div className="grid grid-cols-2 gap-2 bg-background/80 p-3 rounded-xl border border-border/70 text-xs shadow-2xs">
            <div className="flex items-center gap-2 p-1">
              <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <Dog className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <span className="text-[10px] text-muted-foreground block">Pet</span>
                <span className="font-bold text-foreground text-xs truncate">{params.petNome || "Não informado"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1">
              <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <span className="text-[10px] text-muted-foreground block">Tutor</span>
                <span className="font-bold text-foreground text-xs truncate">{params.clienteNome || "Não informado"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1">
              <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Data</span>
                <span className="font-bold text-foreground text-xs">{formatarDataAmigavel(params.data)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1">
              <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Horário</span>
                <span className="font-bold text-emerald-800 text-xs">{params.hora || "A definir"}</span>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between pt-2 mt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                <span className="font-semibold text-foreground text-xs">{params.servicoNome || params.servico || "Banho"}</span>
              </div>
              {params.valor !== undefined && (
                <span className="font-bold text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md text-xs">
                  R$ {Number(params.valor || 0).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {operacaoInvalida && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Preencha os campos faltantes antes de confirmar.</span>
          </div>
        )}
      </div>

      {/* Botões de Ação Táteis */}
      {onConfirmar && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="default"
            disabled={isLoading || operacaoInvalida}
            onClick={() => onConfirmar(pendingAction)}
            className={`flex-1 ${
              ehCancelamento
                ? "bg-rose-700 hover:bg-rose-800 text-white"
                : "bg-emerald-800 hover:bg-emerald-900 text-white"
            } disabled:opacity-50 text-xs md:text-sm h-10 px-4 font-bold gap-2 rounded-xl shadow-xs transition-all active:scale-[0.98]`}
          >
            <CheckCircle className="h-4 w-4" />
            {isLoading
              ? "Processando..."
              : ehCancelamento
              ? "Confirmar Cancelamento"
              : "Confirmar Agendamento"}
          </Button>

          {onCancelar && (
            <Button
              size="default"
              variant="outline"
              disabled={isLoading}
              onClick={onCancelar}
              className={`h-10 px-4 text-xs font-semibold rounded-xl border-border/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all`}
            >
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
