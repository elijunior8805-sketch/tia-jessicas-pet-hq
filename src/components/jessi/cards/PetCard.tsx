import React from "react";
import { User, PawPrint, Heart, Calendar, CalendarPlus, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PetCardProps {
  data: any;
  onActionClick?: (text: string) => void;
}

export const PetCard: React.FC<PetCardProps> = ({ data, onActionClick }) => {
  const pets = React.useMemo(() => {
    if (Array.isArray(data)) return data;
    if (data?.pets && Array.isArray(data.pets)) return data.pets;
    if (data?.pet && typeof data.pet === "object") return [data.pet];
    if (data?.id && data?.nome) return [data];
    return [];
  }, [data]);

  if (!pets.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
        Nenhum pet localizado.
      </div>
    );
  }

  return (
    <div className="space-y-2.5 my-2">
      <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
        <PawPrint className="h-3.5 w-3.5 text-emerald-700" />
        <span>Ficha de Pets ({pets.length})</span>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
        {pets.map((p: any, idx: number) => {
          // Tutor Name
          const tutorNome = p.cliente?.nome || p.clientes?.nome || data.cliente?.nome || data.clientes?.nome;
          // Last appointment
          const lastAppt = p.historicoAtendimentos?.[0];

          return (
            <div
              key={p.id || idx}
              className="rounded-xl border border-border/80 bg-background/95 p-3.5 text-xs shadow-xs space-y-2.5 hover:border-emerald-600/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span>{p.nome}</span>
                </div>
                {p.raca && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {p.raca}
                  </span>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {p.porte && (
                  <span><span className="font-semibold">Porte:</span> {p.porte}</span>
                )}
                {p.peso && (
                  <span><span className="font-semibold">Peso:</span> {p.peso}kg</span>
                )}
              </div>

              {tutorNome && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3 text-emerald-700" />
                  <span>Tutor(a): {tutorNome}</span>
                </div>
              )}

              {/* Health Notes */}
              {(p.cuidados_saude || p.alergias) && (
                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950">
                  <div className="font-semibold flex items-center gap-1 mb-1">
                    <Heart className="h-3.5 w-3.5 text-amber-700" />
                    <span>Cuidados de Saúde</span>
                  </div>
                  {p.cuidados_saude && <div className="mb-0.5"><span className="font-medium">Notas:</span> {p.cuidados_saude}</div>}
                  {p.alergias && <div><span className="font-medium">Alergias:</span> {p.alergias}</div>}
                </div>
              )}

              {/* Programs */}
              {p.programasAtivos && p.programasAtivos.length > 0 && (
                <div className="p-2.5 rounded-lg bg-[#FDF9EC] border border-[#C8A951]/40 text-xs">
                  <div className="font-semibold text-[#8C6D1F] flex items-center gap-1 mb-1">
                    <Gift className="h-3.5 w-3.5 text-[#C8A951]" />
                    <span>Programas Ativos ({p.programasAtivos.length})</span>
                  </div>
                  <div className="text-foreground font-medium">
                    {p.programasAtivos.map((prog: any) => prog.nome).join(", ")}
                  </div>
                </div>
              )}

              {/* Last Appointment */}
              {lastAppt && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-emerald-700" />
                  <span>
                    Último atendimento: {lastAppt.data || lastAppt.dataAtendimento} - {lastAppt.servico || lastAppt.tipoServico}
                  </span>
                </div>
              )}

              {/* Ações interativas */}
              {onActionClick && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onActionClick(`Qual o histórico do ${p.nome}?`)}
                    className="h-6 px-2 text-[10px] text-emerald-900 border-emerald-300 hover:bg-emerald-50 rounded-md font-medium"
                  >
                    <Calendar className="h-2.5 w-2.5 mr-1" /> Histórico
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onActionClick(`Agende um banho para o ${p.nome} amanhã`)}
                    className="h-6 px-2 text-[10px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-md font-medium ml-auto"
                  >
                    <CalendarPlus className="h-2.5 w-2.5 mr-1" /> Agendar
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
