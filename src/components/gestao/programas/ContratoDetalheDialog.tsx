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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getContratoDetalhe,
  atualizarContrato,
  cancelarContrato,
} from "@/lib/programas-contratos.functions";
import { supabase } from "@/integrations/supabase/client";
import { PackageCheck, Minus, Plus, Save, Ban, AlertTriangle, Sparkles, CheckCircle2, DollarSign } from "lucide-react";
import { REGRAS_CATEGORIAS_PADRAO, identificarCategoriaCredito } from "@/lib/programas-creditos-core";

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

  // Carrega todos os serviços ativos do catálogo para permitir adicionar serviços ao pacote
  const { data: todosServicos = [] } = useQuery({
    queryKey: ["servicos-ativos-contrato-dialog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, nome, categoria, valor, duracao_min")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [preco, setPreco] = useState("0");
  const [validade, setValidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [servicoAdicionar, setServicoAdicionar] = useState<string>("");
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);

  useEffect(() => {
    if (!data) return;
    const mapa: Record<string, number> = {};
    for (const item of (data as any).itens ?? []) mapa[item.servico_id] = Number(item.quantidade || 0);
    setQtd(mapa);
    setPreco(String((data as any).contrato?.preco_vendido ?? 0));
    setValidade(String((data as any).contrato?.data_de_validade ?? "").slice(0, 10));
    setMotivo("");
    setServicoAdicionar("");
    setConfirmarCancelamento(false);
  }, [data]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["programas-ativos"] });
    queryClient.invalidateQueries({ queryKey: ["creditos-movimentacoes"] });
    queryClient.invalidateQueries({ queryKey: ["contrato-detalhe", contratoId] });
    queryClient.invalidateQueries({ queryKey: ["cliente-ficha-programas"] });
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
  const itensOriginais: any[] = (data as any)?.itens ?? [];
  const pagamento: any = (data as any)?.pagamento;

  const itensExibicao = useMemo(() => {
    const mapaItens = new Map();
    itensOriginais.forEach((it) => {
      mapaItens.set(it.servico_id, {
        servico_id: it.servico_id,
        nome: it.nome,
        categoria: it.categoria,
        saldo: it.saldo || { criado: it.quantidade, consumido: 0, reservado: 0, disponivel: it.quantidade },
      });
    });

    Object.keys(qtd).forEach((sId) => {
      if (!mapaItens.has(sId)) {
        const servico = todosServicos.find((s: any) => s.id === sId);
        if (servico) {
          mapaItens.set(sId, {
            servico_id: sId,
            nome: servico.nome,
            categoria: servico.categoria,
            saldo: { criado: 0, consumido: 0, reservado: 0, disponivel: 0 },
          });
        }
      }
    });

    return Array.from(mapaItens.values());
  }, [itensOriginais, qtd, todosServicos]);

  const servicosDisponiveisParaAdicionar = useMemo(() => {
    return todosServicos.filter((s: any) => !(s.id in qtd));
  }, [todosServicos, qtd]);

  const handleAdicionarServico = (servicoId: string) => {
    if (!servicoId) return;
    setQtd((prev) => ({
      ...prev,
      [servicoId]: 1,
    }));
    setServicoAdicionar("");
  };

  const exigeMotivo = () => {
    if (motivo.trim().length < 3) {
      toast.error("Informe o motivo (mínimo 3 caracteres)");
      return false;
    }
    return true;
  };

  const podeSalvar = () => {
    for (const it of itensOriginais) {
      const novaQtd = qtd[it.servico_id] ?? 0;
      const minimoPermitido = (it.saldo?.consumido || 0) + (it.saldo?.reservado || 0);
      if (novaQtd < minimoPermitido) {
        toast.error(`Não é possível reduzir ${it.nome} abaixo de ${minimoPermitido} (já utilizado ou reservado).`);
        return false;
      }
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PackageCheck className="h-6 w-6 text-gold" />
            {contrato?.nome_snapshot ?? "Pacote Comprado"}
          </DialogTitle>
          <DialogDescription>
            {contrato
              ? `${contrato.clientes?.nome ?? "Cliente"} · Pet: ${contrato.pets?.nome ?? "Pet"}`
              : "Carregando informações do pacote..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}

        {contrato && (
          <div className="grid gap-4 py-2">
            {/* Status e Financeiro */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border border-sidebar-border/40">
              <div className="flex items-center gap-2">
                <Badge className={contrato.status_do_programa === "ativo" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                  {contrato.status_do_programa === "ativo" ? "Ativo" : "Aguardando pagamento"}
                </Badge>
                {pagamento && (
                  <Badge variant="outline" className="text-xs">
                    Financeiro: {pagamento.status === "pago" ? "Quitado" : "Pendente"} ({brl(Number(pagamento.valor_total ?? contrato.preco_vendido))})
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Início: {contrato.data_de_inicio ? new Date(contrato.data_de_inicio).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>

            {/* Composição e Créditos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Composição do Pacote</Label>
                <span className="text-xs text-muted-foreground">Ajuste quantidades com preservação de histórico</span>
              </div>

              <div className="rounded-lg border border-sidebar-border/50 divide-y bg-card">
                {itensExibicao.map((item) => {
                  const categoria = identificarCategoriaCredito({ nome: item.nome, categoria: item.categoria });
                  const regra = REGRAS_CATEGORIAS_PADRAO[categoria];
                  const qtdAtual = qtd[item.servico_id] ?? 0;
                  const consumidos = item.saldo?.consumido || 0;
                  const reservados = item.saldo?.reservado || 0;
                  const minimo = consumidos + reservados;

                  return (
                    <div key={item.servico_id} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Consumidos: <strong>{consumidos}</strong> · Reservados: <strong>{reservados}</strong> · Disponíveis: <strong>{item.saldo?.disponivel || 0}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setQtd((p) => {
                                const proximo = Math.max(minimo, (p[item.servico_id] ?? 0) - 1);
                                const copia = { ...p };
                                if (proximo === 0) delete copia[item.servico_id];
                                else copia[item.servico_id] = proximo;
                                return copia;
                              })
                            }
                            disabled={qtdAtual <= minimo || contrato.status_do_programa === "cancelado"}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold text-primary">{qtdAtual}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setQtd((p) => ({ ...p, [item.servico_id]: (p[item.servico_id] ?? 0) + 1 }))
                            }
                            disabled={contrato.status_do_programa === "cancelado"}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {regra && (
                        <div className="text-[10px] text-primary/80 bg-primary/5 rounded px-2 py-0.5 font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          <span>{regra.descricao_cobertura}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Adicionar Serviço Extra ao Pacote */}
              {servicosDisponiveisParaAdicionar.length > 0 && contrato.status_do_programa !== "cancelado" && (
                <div className="flex items-center gap-2 pt-1">
                  <Select value={servicoAdicionar} onValueChange={handleAdicionarServico}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="+ Adicionar outro serviço ao pacote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {servicosDisponiveisParaAdicionar.map((s: any) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.nome} ({brl(Number(s.valor || 0))})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Valores e Validade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Valor do Pacote (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  disabled={contrato.status_do_programa === "cancelado"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Data de Validade</Label>
                <Input
                  type="date"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  disabled={contrato.status_do_programa === "cancelado"}
                />
              </div>
            </div>

            {/* Motivo Obrigatório */}
            <div className="grid gap-1.5 pt-1">
              <Label className="text-xs font-semibold">Motivo da Alteração / Cancelamento (Obrigatório)</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Informe o motivo da alteração (mínimo 3 caracteres) para registro de auditoria..."
                className="text-xs"
                rows={2}
              />
            </div>

            {/* Confirmação de Cancelamento se acionado */}
            {confirmarCancelamento && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-2 text-xs animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-800">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Confirmar cancelamento do pacote?
                </div>
                <p className="text-rose-700 leading-relaxed">
                  Os créditos ainda não utilizados serão cancelados. Os atendimentos já realizados serão integralmente preservados no histórico.
                </p>
                <div className="flex gap-2 justify-end pt-1">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirmarCancelamento(false)}>
                    Voltar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => exigeMotivo() && cancelar.mutate()}
                    disabled={cancelar.isPending}
                  >
                    {cancelar.isPending ? "Cancelando..." : "Sim, confirmar cancelamento"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between pt-2">
          {!confirmarCancelamento && (
            <Button
              variant="destructive"
              onClick={() => {
                if (exigeMotivo()) setConfirmarCancelamento(true);
              }}
              disabled={!contrato || cancelar.isPending || contrato?.status_do_programa === "cancelado"}
              className="text-xs"
            >
              <Ban className="mr-1.5 h-4 w-4" />
              Cancelar pacote
            </Button>
          )}

          <div className="flex gap-2 justify-end w-full sm:w-auto">
            <Button variant="outline" className="text-xs" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              className="bg-gold hover:bg-gold/90 text-white text-xs"
              onClick={() => exigeMotivo() && podeSalvar() && salvar.mutate()}
              disabled={!contrato || salvar.isPending || contrato?.status_do_programa === "cancelado"}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {salvar.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
