import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Send,
  HeartHandshake,
  ArrowRight,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { openWhatsAppComposerGlobal } from "@/components/whatsapp-composer";
import { useNavigate } from "@tanstack/react-router";

export type ReativacaoDados = {
  ok: boolean;
  quitado: boolean;
  clienteNome: string;
  clienteWhatsapp: string | null;
  petNome: string;
  diasDesdeAtendimento: number;
  mensagemReativacao: string;
};

interface ReativacaoPosQuitacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: ReativacaoDados | null;
}

export function ReativacaoPosQuitacaoDialog({
  open,
  onOpenChange,
  dados,
}: ReativacaoPosQuitacaoDialogProps) {
  const navigate = useNavigate();

  if (!dados) return null;

  const handleCopiarMensagem = () => {
    navigator.clipboard.writeText(dados.mensagemReativacao);
    toast.success("Mensagem de reativação copiada!");
  };

  const handleEnviarWhatsApp = () => {
    if (!dados.clienteWhatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }

    openWhatsAppComposerGlobal({
      tipo: "reativacao_cliente",
      destinatario: dados.clienteNome,
      telefone: dados.clienteWhatsapp,
      mensagem: dados.mensagemReativacao,
      motivo: "Reativação Pós-Quitação",
    });

    onOpenChange(false);
  };

  const handleIrParaAgendamento = () => {
    onOpenChange(false);
    navigate({ to: "/agendamentos" as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-[#C8A951]/50 shadow-2xl">
        {/* Header Comemorativo */}
        <div className="bg-gradient-to-br from-[#123328] via-[#1a4a3b] to-[#0c241c] p-6 text-white text-center relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#C8A951]/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#C8A951] to-[#F1E5C4] text-[#123328] shadow-lg mb-3">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <Badge className="bg-[#C8A951]/20 text-[#F1E5C4] border border-[#C8A951]/40 font-bold mb-2">
              🎉 Débito Quitado com Sucesso!
            </Badge>

            <DialogTitle className="text-xl font-bold text-white font-display">
              Transforme a Quitação em Novo Agendamento
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-100/90 mt-1 max-w-sm mx-auto">
              O tutor <strong>{dados.clienteNome}</strong> está com a conta zerada. O pet <strong>{dados.petNome}</strong> não visita o Spa há <strong>{dados.diasDesdeAtendimento} dias</strong>.
            </DialogDescription>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4 bg-background">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border text-xs">
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-emerald-600" />
              <span>
                Última visita de <strong>{dados.petNome}</strong>:{" "}
                <strong className="text-primary">{dados.diasDesdeAtendimento} dias atrás</strong>
              </span>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold">
              Momento Ideal para Reativação
            </Badge>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#C8A951]" />
                Convite de Reativação Gerado pela IA
              </label>
              <button
                onClick={handleCopiarMensagem}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar convite
              </button>
            </div>

            <Textarea
              defaultValue={dados.mensagemReativacao}
              rows={5}
              className="text-xs leading-relaxed font-sans bg-muted/20 border-primary/20 resize-none"
            />
          </div>
        </div>

        {/* Footer com Ações */}
        <DialogFooter className="p-4 bg-muted/30 border-t flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Apenas Concluir
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleIrParaAgendamento}
              className="text-xs gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Ver Agenda
            </Button>

            <Button
              size="sm"
              onClick={handleEnviarWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-md"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar Convite no WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
