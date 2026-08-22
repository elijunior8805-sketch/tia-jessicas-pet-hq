import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarPagamentosArquivados, restaurarPagamento, type PagamentoArquivadoDTO } from "@/lib/pagamentos.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PagamentosLixeiraTab() {
  const listar = useServerFn(listarPagamentosArquivados);
  const restaurar = useServerFn(restaurarPagamento);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pagamentos-arquivados"],
    queryFn: () => listar(),
  });

  const restaurarMut = useMutation({
    mutationFn: (id: string) => restaurar({ data: { pagamentoId: id } }),
    onSuccess: () => {
      toast.success("Lançamento restaurado!");
      qc.invalidateQueries({ queryKey: ["pagamentos-arquivados"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao restaurar"),
  });

  const itens = query.data ?? [];

  if (query.isLoading) return <div className="py-10 text-center text-muted-foreground">Carregando lixeira...</div>;

  if (itens.length === 0) {
    return (
      <div className="py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
        <Trash2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">Lixeira vazia</h3>
        <p className="text-sm text-muted-foreground">Itens excluídos aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente / Pet</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Arquivado em</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((p) => (
            <TableRow key={p.id} className="opacity-80">
              <TableCell>
                <div className="font-medium">{p.cliente_nome}</div>
                {p.pet_nome && <div className="text-xs text-muted-foreground">🐾 {p.pet_nome}</div>}
              </TableCell>
              <TableCell className="tabular-nums font-medium">{brl(p.saldo)}</TableCell>
              <TableCell className="text-sm">
                <div>{format(new Date(p.arquivado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</div>
                {p.arquivado_por_nome && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {p.arquivado_por_nome}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground italic max-w-[200px] truncate">
                {p.arquivado_motivo || "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restaurarMut.mutate(p.id)}
                  disabled={restaurarMut.isPending}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restaurar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
