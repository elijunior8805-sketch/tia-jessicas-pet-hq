import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProgramaCardProps {
  data: any;
}

export const ProgramaCard: React.FC<ProgramaCardProps> = ({ data }) => {
  const pet = data?.pet;
  const contratos = data?.contratos || (Array.isArray(data) ? data : []);

  return (
    <div className="rounded-xl border border-amber-800/20 bg-amber-950/5 p-3.5 space-y-3 text-xs">
      <div className="font-semibold text-amber-950 flex items-center justify-between border-b border-amber-900/10 pb-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <span>Programas de Cuidado & Créditos</span>
        </span>
        {pet?.nome && <span className="text-muted-foreground font-normal">Pet: {pet.nome}</span>}
      </div>

      {!contratos.length ? (
        <div className="text-muted-foreground py-2 text-center">
          Nenhum programa ou pacote de créditos ativo para este pet.
        </div>
      ) : (
        <div className="space-y-2">
          {contratos.map((c: any, idx: number) => {
            const nomeProg = c.programas_de_cuidado?.nome || c.nome_snapshot || "Programa de Cuidado";
            const validade = c.data_de_validade ? new Date(c.data_de_validade).toLocaleDateString("pt-BR") : "Sem validade";
            const status = c.status_do_programa || "ativo";

            return (
              <div
                key={c.id || idx}
                className="rounded-lg border border-border/80 bg-background/90 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5 text-amber-600" />
                    {nomeProg}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {status}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>Validade: {validade}</span>
                  <span className="font-medium text-foreground">
                    R$ {Number(c.preco_vendido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
