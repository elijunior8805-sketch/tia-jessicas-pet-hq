import React from "react";
import { User, Phone, MapPin, PawPrint, CalendarPlus, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClienteCardProps {
  data: any;
  onActionClick?: (cmd: string) => void;
}

export const ClienteCard: React.FC<ClienteCardProps> = ({ data, onActionClick }) => {
  const clientes = Array.isArray(data) ? data : data?.clientes || (data ? [data] : []);

  if (!clientes.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
        Nenhum cliente localizado.
      </div>
    );
  }

  return (
    <div className="space-y-2.5 my-2">
      <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-emerald-700" />
        <span>Ficha de Clientes & Pets ({clientes.length})</span>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
        {clientes.map((c: any, idx: number) => {
          const pets = c.pets || [];
          const petsNomes = pets.map((p: any) => `${p.nome}${p.raca ? ` (${p.raca})` : ""}`).join(", ");
          const primeiroPet = pets.length > 0 ? pets[0].nome : null;

          return (
            <div
              key={c.id || idx}
              className="rounded-xl border border-border/80 bg-background/95 p-3.5 text-xs shadow-xs space-y-2.5 hover:border-emerald-600/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span>{c.nome}</span>
                </div>
                {c.telefone && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 text-emerald-700" />
                    {c.telefone}
                  </span>
                )}
              </div>

              {c.bairro && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{c.bairro}{c.cidade ? ` • ${c.cidade}` : ""}</span>
                </div>
              )}

              {/* Pets do cliente */}
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-xs">
                <div className="font-semibold text-emerald-950 flex items-center gap-1 mb-1">
                  <PawPrint className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Pets Vinculados ({pets.length}):</span>
                </div>
                <div className="text-foreground font-medium">
                  {petsNomes || "Nenhum pet cadastrado."}
                </div>
              </div>

              {/* Ações interativas */}
              {onActionClick && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onActionClick(`Quais são os pets do ${c.nome}?`)}
                    className="h-6 px-2 text-[10px] text-emerald-900 border-emerald-300 hover:bg-emerald-50 rounded-md font-medium"
                  >
                    <PawPrint className="h-2.5 w-2.5 mr-1" /> Ver Pets
                  </Button>
                  {primeiroPet && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onActionClick(`E os créditos do ${primeiroPet}?`)}
                      className="h-6 px-2 text-[10px] text-[#8C6D1F] border-[#C8A951]/50 hover:bg-amber-50 rounded-md font-medium"
                    >
                      <Gift className="h-2.5 w-2.5 mr-1" /> Créditos do {primeiroPet}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => onActionClick(`Agende um banho para o ${primeiroPet || c.nome} amanhã`)}
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
