import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getContratoDetalhe,
  atualizarContrato,
  cancelarContrato,
} from "@/lib/programas-contratos.functions";
import { PackageCheck, Minus, Plus, Save, Ban } from "lucide-react";

const brl = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  contratoId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ContratoDetalheDialog({ contratoId, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const open = Boolean(contratoId);

  const { data, isLoading } = useQuery({
    queryKey: ["contrato-detalhe", contratoId],
    queryFn: () => getContratoDetalhe({ data: { contrato_id: contratoId as string } }),
    enabled: open,
  });

  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [preco, setPreco] = useState("0");
  const [validade, setValidade] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!data) return;
    const mapa: Record<string, number> = {};
    for (const item of (data as any).itens ?? []) mapa[item.servico_id] = Number(item.quantidade || 0);
    setQtd(mapa);
    setPreco(String((data as any).contrato?.preco_vendido ?? 0));
    setValidade(String((data as any).contrato?.data_de_validade ?? "").slice(0, 10));
    setMotivo("");
  }, [data]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["programas-ativos"] });
    queryClient.invalidateQueries({ queryKey: ["creditos-movimentacoes"] });
    queryClient.invalidateQueries({ queryKey: ["contrato-detalhe", contratoId] });
  };

  const salvar = useMutation({
    mutationFn: () =>
      atualizarContrato({
        data: {
          contrato_id: contratoId as string,
          preco_vendido: Number(preco || 0),
          data_de_validade: validade || undefined,
          motivo,
          itens: Object.entries(qtd).map(([servico_id, quantidade]) => ({ servico_id, quantidade })),
        },
      }),
    onSuccess: () => {
      toast.success("Pacote atualizado com sucesso");
      invalidar();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar o pacote"),
  });

  const cancelar = useMutation({
    mutationFn: () =>
      cancelarContrato({
        data: { contrato_id: contratoId as string, motivo, estornar_financeiro: true },
      }),
    onSuccess: () => {
      toast.success("Pacote cancelado. O histórico foi preservado.");
      invalidar();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível cancelar o pacote"),
  });

  const contrato: any = (data as any)?.contrato;
  const itens: any[] = (data as any)?.itens ?? [];
  const pagamento: any = (data as any)?.pagamento;

  const exigeMotivo = () => {
    if (motivo.trim().length < 3) {
      toast.error("Informe o motivo (mínimo 3 caracteres)");
      return false;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PackageCheck className="h-6 w-6 text-gold" />
            {contrato?.nome_snapshot ?? "Pacote comprado"}
          </DialogTitle>
          <DialogDescription>
            {contrato
              ? `${contrato.clientes?.nome ?? "Cliente"} · ${contrato.pets?.nome ?? "Pet"}`
              : "Carregando informações do pacote..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}

        {contrato && (
          <div className="grid gap-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{contrato.status_do_programa}</Badge>
              {pagamento && (
                <Badge variant="secondary">
                  Financeiro: {pagamento.status} · {brl(Number(pagamento.valor_total ?? 0))}
                </Badge>
              )}
            </div>

            <div className="rounded-lg border border-sidebar-border/50 divide-y">
              {itens.map((item) => (
                <div key={item.servico_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Consumido {item.saldo.consumido} · Reservado {item.saldo.reservado} · Disponível{" "}
                      {item.saldo.disponivel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setQtd((p) => ({
                          ...p,
                          [item.servico_id]: Math.max(0, (p[item.servico_id] ?? 0) - 1),
                        }))
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold">{qtd[item.servico_id] ?? 0}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setQtd((p) => ({ ...p, [item.servico_id]: (p[item.servico_id] ?? 0) + 1 }))
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground italic">Sem composição registrada.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor vendido (R$)</Label>
                <Input type="number" min={0} value={preco} onChange={(e) => setPreco(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Validade</Label>
                <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Motivo da alteração / cancelamento</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Registrado na auditoria do pacote."
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => exigeMotivo() && cancelar.mutate()}
            disabled={!contrato || cancelar.isPending || contrato?.status_do_programa === "cancelado"}
          >
            <Ban className="mr-2 h-4 w-4" />
            {cancelar.isPending ? "Cancelando..." : "Cancelar pacote"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button
              className="bg-gold hover:bg-gold/90 text-white"
              onClick={() => exigeMotivo() && salvar.mutate()}
              disabled={!contrato || salvar.isPending || contrato?.status_do_programa === "cancelado"}
            >
              <Save className="mr-2 h-4 w-4" />
              {salvar.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
