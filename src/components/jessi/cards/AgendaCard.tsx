import React from "react";
import { Calendar, Clock, User, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AgendaCardProps {
  data: any;
}

export const AgendaCard: React.FC<AgendaCardProps> = ({ data }) => {
  const agendamentos = Array.isArray(data) ? data : data?.agendamentos || [];

  if (!agendamentos.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
        Nenhum agendamento encontrado para os filtros informados.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-emerald-700" />
        <span>Agendamentos Localizados ({agendamentos.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
        {agendamentos.map((item: any, idx: number) => {
          const clienteNome = item.clientes?.nome || item.cliente_nome || "Cliente";
          const petNome = item.pets?.nome || item.pet_nome || "Pet";
          const servico = item.servicos?.nome || item.servico_nome || "Serviço";
          const hora = item.hora || (item.data ? item.data.split("T")[1]?.slice(0, 5) : "--:--");
          const status = item.status || "agendado";

          return (
            <div
              key={item.id || idx}
              className="rounded-lg border border-border/80 bg-background/90 p-3 text-xs shadow-xs hover:border-emerald-600/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{clienteNome}</span>
                  <span className="text-muted-foreground font-normal">({petNome})</span>
                </div>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                  {status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
                <span className="flex items-center gap-1">
                  <Scissors className="h-3 w-3" />
                  {servico}
                </span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Clock className="h-3 w-3 text-emerald-700" />
                  {hora}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
