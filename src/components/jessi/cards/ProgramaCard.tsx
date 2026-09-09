import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Gift, CalendarPlus, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProgramaCardProps {
  data: any;
  onActionClick?: (cmd: string) => void;
}

export const ProgramaCard: React.FC<ProgramaCardProps> = ({ data, onActionClick }) => {
  const pet = data?.pet;
  const contratos = data?.contratos || (Array.isArray(data) ? data : []);

  return (
    <div className="rounded-2xl border border-[#C8A951]/40 bg-card p-4 space-y-3 text-xs shadow-xs my-2">
      <div className="font-semibold text-emerald-950 flex items-center justify-between border-b border-border/60 pb-2.5">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#C8A951]" />
          <span>Clubinho & Saldos de Créditos</span>
        </span>
        {pet?.nome && <Badge variant="outline" className="text-[10px] text-emerald-800 bg-emerald-50">Pet: {pet.nome}</Badge>}
      </div>

      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900">
        <span className="font-semibold block mb-0.5">⭐ Regra de Equivalência de Banho:</span>
        1 crédito de banho do Clubinho pode ser utilizado tanto para <strong>Banho Simples</strong> quanto para <strong>Banho Premium</strong> sem cobrança extra.
      </div>

      {!contratos.length ? (
        <div className="text-muted-foreground py-3 text-center text-xs">
          Nenhum plano do Clubinho ou pacote de créditos ativo para este pet.
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {contratos.map((c: any, idx: number) => {
            const nomeProg = c.programa?.nome || c.programas_de_cuidado?.nome || c.nome_snapshot || "Clubinho";
            const validadeStr = c.validadeData || c.data_de_validade;
            const validade = validadeStr ? new Date(`${validadeStr}T12:00:00`).toLocaleDateString("pt-BR") : "Sem validade";
            const contratacaoStr = c.contratacaoData || c.data_da_venda || c.data_de_inicio;
            const contratacao = contratacaoStr ? new Date(`${contratacaoStr}T12:00:00`).toLocaleDateString("pt-BR") : null;
            const status = c.status_do_programa || "ativo";
            const petNome = c.pet?.nome || c.pets?.nome || pet?.nome || "Pet";
            const tutorNome = c.tutor?.nome || c.clientes?.nome || "Tutor";
            const disponiveis = c.creditosDisponiveis ?? c.saldos?.[0]?.disponivel ?? 0;
            const contratados = c.creditosContratados ?? c.saldos?.[0]?.criado ?? disponiveis;
            const utilizados = c.creditosUtilizados ?? c.saldos?.[0]?.consumido ?? (contratados - disponiveis);

            return (
              <div
                key={c.id || idx}
                className="rounded-xl border border-border/80 bg-background/95 p-3 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5 text-[#C8A951]" />
                    {nomeProg}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize bg-emerald-50 text-emerald-800 border-emerald-300">
                    {status}
                  </Badge>
                </div>

                <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-1.5 pt-1 border-t border-border/40">
                  <span>Pet: <strong className="text-foreground">{petNome}</strong></span>
                  <span>Tutor: <strong className="text-foreground">{tutorNome}</strong></span>
                  {contratacao && <span>Início: <strong>{contratacao}</strong></span>}
                  <span>Validade: <strong>{validade}</strong></span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60 text-xs">
                  <span className="text-[11px] text-muted-foreground">Saldo de Créditos:</span>
                  <span className="font-bold text-emerald-800">
                    {disponiveis} disp. / {contratados} total ({utilizados} usados)
                  </span>
                </div>

                {onActionClick && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                    <Button
                      size="sm"
                      onClick={() => onActionClick(`Agende um banho para o ${petNome} usando créditos do programa`)}
                      className="h-6 px-2 text-[10px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-md font-medium ml-auto"
                    >
                      <CalendarPlus className="h-2.5 w-2.5 mr-1" /> Agendar com Crédito
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
