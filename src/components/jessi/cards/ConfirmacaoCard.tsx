import React from "react";
import { CheckCircle, AlertTriangle, ShieldCheck, XCircle, Clock, Calendar, User, Dog, DollarSign, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmacaoCardProps {
  data: any;
  onConfirmar?: (pendingAction: any) => void;
  onCancelar?: () => void;
  isLoading?: boolean;
}

export const ConfirmacaoCard: React.FC<ConfirmacaoCardProps> = ({
  data,
  onConfirmar,
  onCancelar,
  isLoading,
}) => {
  const pendingAction = data?.pendingAction || data?.acaoPendente || {
    id: data?.proposta?.id || data?.id || `idemp_${Date.now()}`,
    title: data?.proposta?.motivo || "Confirmar Operação",
    summary: data?.proposta?.motivo || data?.resumo || "Deseja confirmar a execução?",
    tool: data?.proposta?.acao || data?.tool || "criar_agendamento",
    params: data?.proposta?.estadoProposto || data?.params || {},
  };

  const executado = data?.executado;
  const proposta = data?.proposta;
  const resumoVisual = data?.resumoVisual || proposta?.resumoVisual;
  const resumo = data?.resumo || resumoVisual?.entendido || pendingAction?.summary || "Deseja confirmar a execução?";
  const params = pendingAction?.params || proposta?.estadoProposto || {};

  const ehAgendamento =
    pendingAction.tool === "criar_agendamento" ||
    pendingAction.tool === "executar_agendamento" ||
    pendingAction.type === "criar_agendamento" ||
    pendingAction.type === "preparar_agendamento";

  const ehCancelamento =
    pendingAction.tool === "cancelar_agendamento" ||
    pendingAction.type === "cancelar_agendamento" ||
    pendingAction.type === "preparar_cancelamento";

  const ehReagendamento =
    pendingAction.tool === "remarcar_agendamento" ||
    pendingAction.tool === "reagendar" ||
    pendingAction.type === "remarcar_agendamento";

  // Validação restritiva de dados mínimos antes de permitir a confirmação física
  const clienteValido = Boolean(params.clienteId || params.clienteNome) && params.clienteNome !== "Cliente";
  const petValido = Boolean(params.petId || params.petNome) && params.petNome !== "Pet";
  const dataValida = Boolean(params.data && /^\d{4}-\d{2}-\d{2}$/.test(params.data));
  const horaValida = Boolean(params.hora && /^([01]\d|2[0-3]):[0-5]\d/.test(params.hora));
  const servicoValido = Boolean(params.servicoNome);

  const operacaoInvalida = ehAgendamento && (!clienteValido || !petValido || !dataValida || !horaValida || !servicoValido);

  if (executado) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 space-y-2.5 text-xs text-emerald-950 shadow-xs">
        <div className="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Ação Executada e Registrada com Sucesso</span>
        </div>
        <p className="text-[12px] text-emerald-900 leading-relaxed font-medium">
          {data?.resultado?.summary || data?.summary || "Operação realizada no sistema e auditada com sucesso."}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${ehCancelamento ? "border-rose-300 bg-rose-50/90 text-rose-950" : "border-amber-300 bg-amber-50/90 text-amber-950"} p-4 space-y-3 text-xs shadow-xs`}>
      <div className={`flex items-center justify-between border-b ${ehCancelamento ? "border-rose-200" : "border-amber-200"} pb-2.5`}>
        <div className={`flex items-center gap-1.5 font-semibold ${ehCancelamento ? "text-rose-900" : "text-amber-900"}`}>
          <ShieldCheck className={`h-4 w-4 ${ehCancelamento ? "text-rose-700" : "text-amber-700"} shrink-0`} />
          <span>{ehCancelamento ? "Confirmação de Cancelamento" : "Confirmação Operacional Obrigatória"}</span>
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${ehCancelamento ? "bg-rose-200/80 text-rose-900" : "bg-amber-200/80 text-amber-900"}`}>
          Supervisão Humana
        </span>
      </div>

      <div className="space-y-2">
        <p className={`text-[12px] font-medium leading-relaxed ${ehCancelamento ? "text-rose-950" : "text-amber-950"}`}>{resumo}</p>

        {(ehAgendamento || ehCancelamento || ehReagendamento) && (
          <div className="grid grid-cols-2 gap-2 bg-white/70 p-2.5 rounded-lg border border-border/60 text-[11px] text-slate-800">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span><strong>Tutor:</strong> {params.clienteNome || "Não identificado"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Dog className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span><strong>Pet:</strong> {params.petNome || "Não identificado"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span><strong>Serviço:</strong> {params.servicoNome || "Atendimento"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span><strong>Data:</strong> {params.data || "A definir"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span><strong>Horário:</strong> {params.hora || "A definir"}</span>
            </div>
            {params.valor !== undefined && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span><strong>Valor:</strong> R$ {Number(params.valor || 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {resumoVisual?.seraAlterado && (
          <p className={`text-[11px] ${ehCancelamento ? "text-rose-800" : "text-amber-800"}`}>
            <strong>Impacto no Sistema:</strong> {resumoVisual.seraAlterado}
          </p>
        )}

        {operacaoInvalida && (
          <div className="flex items-center gap-1.5 p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Existem campos obrigatórios ausentes. Não é permitido executar sem validação completa.</span>
          </div>
        )}
      </div>

      {onConfirmar && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            disabled={isLoading || operacaoInvalida}
            onClick={() => onConfirmar(pendingAction)}
            className={`${ehCancelamento ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-700 hover:bg-emerald-800"} disabled:opacity-50 text-white text-xs h-8 px-3 font-semibold gap-1.5 rounded-lg`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {isLoading
              ? "Processando e Verificando..."
              : ehCancelamento
              ? "Confirmar Cancelamento"
              : "Confirmar e Executar"}
          </Button>
          {onCancelar && (
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={onCancelar}
              className={`text-xs h-8 px-3 ${ehCancelamento ? "border-rose-300 text-rose-900 hover:bg-rose-100/60" : "border-amber-300 text-amber-900 hover:bg-amber-100/60"} gap-1 rounded-lg`}
            >
              <XCircle className="h-3.5 w-3.5" />
              {ehCancelamento ? "Manter Agendamento" : "Cancelar"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
