import React from "react";
import { User, Dog, Calendar, Gift, FileText, ChevronRight, X } from "lucide-react";
import { JessiContextState } from "@/lib/ia/jessi-session";
import { Button } from "@/components/ui/button";

interface JessiContextPanelProps {
  contexto: JessiContextState;
  isOpen: boolean;
  onClose: () => void;
}

export const JessiContextPanel: React.FC<JessiContextPanelProps> = ({
  contexto,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const temContexto =
    contexto.clienteSelecionadoNome ||
    contexto.petSelecionadoNome ||
    contexto.dataReferencia ||
    contexto.servicoSelecionadoNome;

  return (
    <aside className="w-72 border-l border-border/70 bg-card/60 backdrop-blur-xs flex flex-col h-full text-xs">
      <div className="p-3.5 border-b border-border/70 flex items-center justify-between font-semibold text-foreground">
        <span>Painel de Contexto Ativo</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3.5 space-y-4 flex-1 overflow-y-auto">
        {!temContexto ? (
          <div className="text-muted-foreground text-center py-6 leading-relaxed">
            Nenhum cliente ou registro fixado nesta conversa ainda. Conforme você conversa, as informações aparecerão aqui.
          </div>
        ) : (
          <>
            {contexto.clienteSelecionadoNome && (
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                  <User className="h-3 w-3 text-emerald-700" /> Tutor Selecionado
                </span>
                <span className="font-semibold text-foreground block">
                  {contexto.clienteSelecionadoNome}
                </span>
              </div>
            )}

            {contexto.petSelecionadoNome && (
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Dog className="h-3 w-3 text-emerald-700" /> Pet Ativo
                </span>
                <span className="font-semibold text-foreground block">
                  {contexto.petSelecionadoNome}
                </span>
              </div>
            )}

            {contexto.dataReferencia && (
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-emerald-700" /> Data de Referência
                </span>
                <span className="font-semibold text-foreground block">
                  {contexto.dataReferencia}
                </span>
              </div>
            )}

            {contexto.servicoSelecionadoNome && (
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Gift className="h-3 w-3 text-amber-600" /> Serviço / Programa
                </span>
                <span className="font-semibold text-foreground block">
                  {contexto.servicoSelecionadoNome}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
