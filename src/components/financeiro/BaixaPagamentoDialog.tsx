import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { confirmarRecebimento } from "@/lib/pagamentos.functions";

interface BaixaPagamentoDialogProps {
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

export function BaixaPagamentoDialog({
  open,
  onOpenChange,
  pagamento,
  onSuccess,
}: BaixaPagamentoDialogProps) {
  const queryClient = useQueryClient();
  const confirmarRecebimentoFn = useServerFn(confirmarRecebimento);

  const saldoRestante = pagamento ? pagamento.valor_total - pagamento.valor_pago : 0;

  const [valor, setValor] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Initialize fields when dialog opens
  useEffect(() => {
    if (open && pagamento) {
      setValor(saldoRestante.toString());
      setDataPagamento(new Date().toISOString().split("T")[0]);
      setFormaPagamento("");
      setObservacao("");
      setError(null);
    }
  }, [open, pagamento, saldoRestante]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return confirmarRecebimentoFn({ data });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["fin-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["programas-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-programas"] });
      
      const novoStatus = result?.novo_status === "pago" ? "Pago Integralmente" : result?.novo_status === "parcial" ? "Pagamento Parcial" : "Atualizado";
      toast.success(
        `Pagamento registrado com sucesso! (${novoStatus})`
      );
      
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao registrar pagamento");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagamento) return;

    const numValor = parseFloat(valor);
    if (isNaN(numValor) || numValor <= 0) {
      setError("O valor deve ser maior que zero.");
      return;
    }

    if (numValor > saldoRestante) {
      setError("O valor não pode ser maior que o saldo restante.");
      return;
    }

    if (!dataPagamento) {
      setError("A data de pagamento é obrigatória.");
      return;
    }

    if (!formaPagamento) {
      setError("A forma de pagamento é obrigatória.");
      return;
    }

    setError(null);

    mutation.mutate({
      pagamentoId: pagamento.id,
      id: pagamento.id,
      valor: numValor,
      dataPagamento: dataPagamento,
      data_pagamento: dataPagamento,
      forma: formaPagamento,
      forma_pagamento: formaPagamento,
      observacao: observacao || undefined,
    });
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!pagamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Baixa de Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            {pagamento.cliente_nome && (
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{pagamento.cliente_nome}</span>
              </div>
            )}
            {pagamento.descricao && (
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Descrição:</span>
                <span className="font-medium">{pagamento.descricao}</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Valor Total:</span>
              <span className="font-medium">{formatCurrency(pagamento.valor_total)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Valor Pago:</span>
              <span className="font-medium text-emerald-600">
                {formatCurrency(pagamento.valor_pago)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t mt-2">
              <span className="font-medium">Saldo Restante:</span>
              <span className="font-bold text-primary">
                {formatCurrency(saldoRestante)}
              </span>
            </div>
          </div>

          <form id="baixa-pagamento-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor a Pagar (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data do Pagamento</Label>
              <Input
                id="data"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger id="forma">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Outras">Outras</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observação (Opcional)</Label>
              <Textarea
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Detalhes adicionais..."
              />
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
          </form>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="baixa-pagamento-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : "Confirmar Recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
