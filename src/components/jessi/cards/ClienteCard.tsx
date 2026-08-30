import React from "react";
import { User, Phone, Dog } from "lucide-react";

interface ClienteCardProps {
  data: any;
}

export const ClienteCard: React.FC<ClienteCardProps> = ({ data }) => {
  const clientes = Array.isArray(data) ? data : data?.clientes || (data?.id ? [data] : []);

  if (!clientes.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
        Nenhum tutor localizado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-emerald-700" />
        <span>Ficha de Cliente / Tutor ({clientes.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
        {clientes.map((c: any, idx: number) => {
          const pets = c.pets || [];
          return (
            <div
              key={c.id || idx}
              className="rounded-lg border border-border/80 bg-background/90 p-3 text-xs shadow-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-foreground">{c.nome}</span>
                {c.telefone && (
                  <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                    <Phone className="h-3 w-3" />
                    {c.telefone}
                  </span>
                )}
              </div>
              {pets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/40">
                  {pets.map((p: any, pIdx: number) => (
                    <span
                      key={p.id || pIdx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200"
                    >
                      <Dog className="h-3 w-3" />
                      {p.nome} {p.raca ? `· ${p.raca}` : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  Nenhum pet vinculado.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
