import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { upsertPrograma } from "@/lib/programas-cuidado.functions";
import { getProgramasConfig } from "@/lib/programas-config.functions";
import { supabase } from "@/integrations/supabase/client";
import { PackageCheck, Save, Minus, Plus } from "lucide-react";

interface ProgramaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: any;
}

const brl = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ProgramaFormDialog({ open, onOpenChange, initial }: ProgramaFormDialogProps) {
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["programas-config"],
    queryFn: () => getProgramasConfig(),
  });

  // Catálogo completo de serviços ativos (sem lista fixa no código)
  const { data: servicos } = useQuery({
    queryKey: ["servicos-ativos-programa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, nome, categoria, valor, duracao_min, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("0");
  const [validade, setValidade] = useState("30");
  const [regras, setRegras] = useState("");
  const [busca, setBusca] = useState("");
  const [qtd, setQtd] = useState<Record<string, number>>({});

  // Carrega os dados ao abrir (novo ou edição)
  useEffect(() => {
    if (!open) return;
    setNome(initial?.nome ?? "");
    setDescricao(initial?.descricao ?? "");
    setPreco(String(initial?.preco_do_programa ?? "0"));
    setRegras(initial?.regras ?? "");
    setBusca("");
    const mapa: Record<string, number> = {};
    for (const item of (initial?.itens ?? []) as any[]) {
      if (item?.servico_id) mapa[item.servico_id] = Number(item.quantidade || 0);
    }
    setQtd(mapa);
    const padrao = (config as any)?.validade_padrao_dias;
    setValidade(String(initial?.validade_em_dias ?? padrao ?? 30));
  }, [open, initial, config]);

  const setQuantidade = (id: string, delta: number) =>
    setQtd((prev) => {
      const proximo = Math.max(0, (prev[id] ?? 0) + delta);
      const copia = { ...prev };
      if (proximo === 0) delete copia[id];
      else copia[id] = proximo;
      return copia;
    });

  const listaFiltrada = useMemo(() => {
    const termo = busca
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    const lista = (servicos ?? []) as any[];
    if (!termo) return lista;
    return lista.filter((s) =>
      `${s.nome} ${s.categoria ?? ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(termo)
    );
  }, [servicos, busca]);

  const itensSelecionados = useMemo(
    () =>
      Object.entries(qtd)
        .map(([servico_id, quantidade]) => {
          const s = (servicos ?? []).find((x: any) => x.id === servico_id) as any;
          const valorUnit = Number(s?.valor ?? 0);
          return {
            servico_id,
            nome: s?.nome ?? "Serviço",
            quantidade,
            valor_unitario_de_referencia: valorUnit,
            valor_alocado: valorUnit * quantidade,
          };
        })
        .filter((i) => i.quantidade > 0),
    [qtd, servicos]
  );

  const valorNormal = itensSelecionados.reduce((acc, i) => acc + i.valor_alocado, 0);
  const economia = Math.max(0, valorNormal - Number(preco || 0));

  const mutation = useMutation({
    mutationFn: (data: any) => upsertPrograma({ data }),
    onSuccess: () => {
      toast.success("Programa salvo com sucesso");
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar o programa"),
  });

  const handleSave = () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do programa");
      return;
    }
    if (itensSelecionados.length === 0) {
      toast.error("Selecione ao menos um serviço para compor o programa");
      return;
    }
    if (Number(validade) < 1) {
      toast.error("A validade deve ser de pelo menos 1 dia");
      return;
    }

    mutation.mutate({
      id: initial?.id,
      nome: nome.trim(),
      descricao,
      status: initial?.status ?? "ativo",
      preco_do_programa: Number(preco || 0),
      valor_normal_dos_servicos: valorNormal,
      economia,
      validade_em_dias: Number(validade),
      permite_parcelamento: initial?.permite_parcelamento ?? true,
      inclui_transporte: initial?.inclui_transporte ?? false,
      regras,
      itens: itensSelecionados.map((i, idx) => ({
        servico_id: i.servico_id,
        quantidade: i.quantidade,
        valor_unitario_de_referencia: i.valor_unitario_de_referencia,
        valor_alocado: i.valor_alocado,
        ordem_de_exibicao: idx,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PackageCheck className="h-6 w-6 text-gold" />
            {initial ? "Editar Programa" : "Novo Programa"}
          </DialogTitle>
          <DialogDescription>Monte o pacote com os serviços reais do seu catálogo.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome do Programa</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Rotina em Dia" />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que o programa inclui?" />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Serviços do programa</Label>
              <span className="text-xs text-muted-foreground">
                {itensSelecionados.length} selecionado(s)
              </span>
            </div>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar serviço (ex: banho, hidratação, tosa)"
            />
            <ScrollArea className="h-56 rounded-lg border border-sidebar-border/50">
              <div className="divide-y">
                {listaFiltrada.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground italic">Nenhum serviço ativo encontrado.</p>
                )}
                {listaFiltrada.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.categoria ? `${s.categoria} · ` : ""}
                        {brl(Number(s.valor ?? 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQuantidade(s.id, -1)}
                        disabled={!qtd[s.id]}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{qtd[s.id] ?? 0}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQuantidade(s.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {itensSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {itensSelecionados.map((i) => (
                <Badge key={i.servico_id} variant="secondary" className="text-xs">
                  {i.quantidade}× {i.nome}
                </Badge>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor do programa (R$)</Label>
              <Input type="number" min={0} value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Validade (dias)</Label>
              <Input type="number" min={1} value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Regras (opcional)</Label>
            <Textarea value={regras} onChange={(e) => setRegras(e.target.value)} placeholder="Ex: uso exclusivo do pet contratado." />
          </div>

          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span>Valor normal: <strong>{brl(valorNormal)}</strong></span>
            <span>Preço do pacote: <strong>{brl(Number(preco || 0))}</strong></span>
            <span className="text-green-600">Economia: <strong>{brl(economia)}</strong></span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-gold hover:bg-gold/90 text-white" onClick={handleSave} disabled={mutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? "Salvando..." : "Salvar Programa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
