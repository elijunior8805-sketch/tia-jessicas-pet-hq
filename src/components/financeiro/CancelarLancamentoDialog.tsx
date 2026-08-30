import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelarLancamento, estornarPagamento } from "@/lib/pagamentos.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface CancelarLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamento: {
    id: string;
    valor_total: number;
    valor_pago: number;
    status: string;
    descricao?: string;
    cliente_nome?: string;
  } | null;
  onSuccess?: () => void;
}

export function CancelarLancamentoDialog({
  open,
  onOpenChange,
  pagamento,
  onSuccess,
}: CancelarLancamentoDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [confirmacaoValor, setConfirmacaoValor] = useState("");
  
  const queryClient = useQueryClient();
  const cancelarFn = useServerFn(cancelarLancamento);
  const estornarFn = useServerFn(estornarPagamento);

  const isPago = pagamento?.status === "pago";
  const exigeConfirmacaoExtra = !isPago && pagamento && pagamento.valor_total > 500;
  
  const cancelarMutation = useMutation({
    mutationFn: async () => {
      if (!pagamento) return;
      if (isPago) {
        return estornarFn({ data: { pagamentoId: pagamento.id, motivo } });
      } else {
        return cancelarFn({ data: { pagamentoId: pagamento.id, motivo } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(isPago ? "Pagamento estornado com sucesso" : "Lançamento cancelado com sucesso");
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      toast.error(`Erro ao ${isPago ? "estornar" : "cancelar"}: ${error.message}`);
    },
  });

  const handleClose = () => {
    setMotivo("");
    setConfirmacaoValor("");
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (motivo.trim().length < 3) {
      toast.error("O motivo deve ter pelo menos 3 caracteres.");
      return;
    }
    if (exigeConfirmacaoExtra && confirmacaoValor !== pagamento.valor_total.toString()) {
      toast.error("Confirmação de valor incorreta.");
      return;
    }
    cancelarMutation.mutate();
  };

  if (!pagamento) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isPago ? "Estornar Pagamento" : "Cancelar Lançamento"}
          </DialogTitle>
          <DialogDescription>
            {isPago
              ? "Reverta este pagamento e volte o valor para pendente."
              : "Cancele esta cobrança. Ela não será mais contabilizada."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2 rounded-md bg-muted p-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-muted-foreground">Valor:</span>
              <span className="font-semibold">
                {pagamento.valor_total.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>
            {pagamento.cliente_nome && (
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Cliente:</span>
                <span className="text-sm">{pagamento.cliente_nome}</span>
              </div>
            )}
          </div>

          <div className={`flex items-start gap-3 rounded-md p-3 text-sm ${isPago ? "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"}`}>
            {isPago ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div className="space-y-1">
              <p className="font-medium">
                {isPago
                  ? "O pagamento será revertido e o valor voltará como pendente."
                  : "Este lançamento será cancelado e não contará mais como dívida."}
              </p>
              <p className="text-xs opacity-90">
                {isPago
                  ? "Se vinculado a um programa, o contrato será suspenso temporariamente."
                  : "Se vinculado a um programa, o contrato será cancelado e os agendamentos removidos."}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="motivo" className="text-sm font-medium">
              Motivo do {isPago ? "estorno" : "cancelamento"} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo"
              placeholder={`Explique o motivo do ${isPago ? "estorno" : "cancelamento"}...`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground">Mínimo de 3 caracteres</p>
          </div>

          {exigeConfirmacaoExtra && (
            <div className="grid gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <Label htmlFor="confirmacao" className="text-sm font-medium text-destructive">
                Confirmação de Segurança
              </Label>
              <p className="text-xs text-muted-foreground mb-1">
                Este é um cancelamento de alto valor. Digite o valor total ({pagamento.valor_total}) para confirmar:
              </p>
              <Input
                id="confirmacao"
                placeholder="Ex: 600"
                value={confirmacaoValor}
                onChange={(e) => setConfirmacaoValor(e.target.value)}
                className="border-destructive/30 focus-visible:ring-destructive/30"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={cancelarMutation.isPending}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={
              cancelarMutation.isPending ||
              motivo.trim().length < 3 ||
              Boolean(exigeConfirmacaoExtra && confirmacaoValor !== pagamento.valor_total.toString())
            }
          >
            {cancelarMutation.isPending ? "Processando..." : isPago ? "Confirmar Estorno" : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
