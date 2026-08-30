import React from "react";
import { Calendar, Clock, User, Scissors, Car, ArrowRight, MessageSquare, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AgendaCardProps {
  data: any;
  onActionClick?: (cmd: string) => void;
}

export const AgendaCard: React.FC<AgendaCardProps> = ({ data, onActionClick }) => {
  const agendamentos = Array.isArray(data) ? data : data?.agendamentos || [];

  if (!agendamentos.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
        Nenhum agendamento encontrado para os filtros informados.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "confirmado" || s === "concluido" || s === "finalizado") {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0">{status}</Badge>;
    }
    if (s === "em_atendimento") {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] px-1.5 py-0">Em Atendimento</Badge>;
    }
    if (s === "cancelado") {
      return <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] px-1.5 py-0">Cancelado</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-800 bg-amber-50 border-amber-300">Aguardando</Badge>;
  };

  return (
    <div className="space-y-2.5 my-2">
      <div className="text-xs font-semibold text-emerald-950 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-emerald-700" />
          <span>Agendamentos ({agendamentos.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
        {agendamentos.map((item: any, idx: number) => {
          const clienteNome = item.clientes?.nome || item.cliente_nome || "Cliente";
          const petNome = item.pets?.nome || item.pet_nome || "Pet";
          const servico = item.servicos?.nome || item.servico_nome || "Banho";
          const hora = item.hora?.slice(0, 5) || (item.data ? item.data.split("T")[1]?.slice(0, 5) : "--:--");
          const status = item.status || "agendado";
          const temLevaTraz = item.leva_traz_modalidade && item.leva_traz_modalidade !== "nao_utilizar";

          return (
            <div
              key={item.id || idx}
              className="rounded-xl border border-border/80 bg-background/95 p-3 text-xs shadow-xs space-y-2 hover:border-emerald-600/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                  <User className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">{clienteNome}</span>
                  <span className="text-emerald-800 font-bold">({petNome})</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {temLevaTraz && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-800 border-purple-200 gap-0.5">
                      <Car className="h-2.5 w-2.5" /> Leva e Traz
                    </Badge>
                  )}
                  {getStatusBadge(status)}
                </div>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40 text-[11px]">
                <span className="flex items-center gap-1 text-foreground font-medium">
                  <Scissors className="h-3 w-3 text-emerald-700" />
                  {servico}
                </span>
                <span className="flex items-center gap-1 font-bold text-emerald-800">
                  <Clock className="h-3 w-3 text-emerald-700" />
                  {hora}
                </span>
              </div>

              {/* Botões de Ação Interativa no Card */}
              {onActionClick && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onActionClick(`Localize o cliente ${clienteNome}`)}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-emerald-800 hover:bg-emerald-50 rounded-md font-medium"
                  >
                    Ver Tutor
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onActionClick(`Quero reagendar o atendimento do ${petNome}`)}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-blue-800 hover:bg-blue-50 rounded-md font-medium"
                  >
                    <RefreshCw className="h-2.5 w-2.5 mr-1" /> Reagendar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onActionClick(`Preparar mensagem de lembrete para ${clienteNome}`)}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-emerald-800 hover:bg-emerald-50 rounded-md font-medium ml-auto"
                  >
                    <MessageSquare className="h-2.5 w-2.5 mr-1" /> Lembrete
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
