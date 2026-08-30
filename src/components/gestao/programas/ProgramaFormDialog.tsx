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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { upsertPrograma, copiarServicoParaPrograma } from "@/lib/programas-cuidado.functions";
import { getProgramasConfig } from "@/lib/programas-config.functions";
import { supabase } from "@/integrations/supabase/client";
import { PackageCheck, Save, Minus, Plus, Percent, DollarSign, Sparkles, Trash2, Copy, Layers } from "lucide-react";

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

  // Catálogo completo de serviços ativos (fonte oficial)
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

  // Outros programas para destino de cópia de serviços
  const { data: outrosProgramas = [] } = useQuery({
    queryKey: ["outros-programas-copia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programas_de_cuidado" as any)
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [validade, setValidade] = useState("30");
  const [regras, setRegras] = useState("");
  const [busca, setBusca] = useState("");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  
  // Seção Preço e Desconto
  const [tipoDesconto, setTipoDesconto] = useState<"percentual" | "fixo">("percentual");
  const [descontoValor, setDescontoValor] = useState<string>("0");
  const [precoManual, setPrecoManual] = useState<string>("");

  // Estado para copiar serviço para outro programa
  const [servicoParaCopiar, setServicoParaCopiar] = useState<any | null>(null);
  const [programaDestinoId, setProgramaDestinoId] = useState<string>("");

  // Carrega os dados ao abrir (novo ou edição)
  useEffect(() => {
    if (!open) return;
    setNome(initial?.nome ?? "");
    setDescricao(initial?.descricao ?? "");
    setRegras(initial?.regras ?? "");
    setBusca("");
    
    const mapa: Record<string, number> = {};
    for (const item of (initial?.itens ?? []) as any[]) {
      if (item?.servico_id) mapa[item.servico_id] = Number(item.quantidade || 0);
    }
    setQtd(mapa);
    
    const padrao = (config as any)?.validade_padrao_dias;
    setValidade(String(initial?.validade_em_dias ?? padrao ?? 30));

    if (initial?.preco_do_programa && initial?.valor_normal_dos_servicos) {
      const sub = Number(initial.valor_normal_dos_servicos);
      const preco = Number(initial.preco_do_programa);
      const desc = Math.max(0, sub - preco);
      if (sub > 0 && desc > 0) {
        const perc = Math.round((desc / sub) * 1000) / 10;
        setTipoDesconto("percentual");
        setDescontoValor(String(perc));
      } else {
        setTipoDesconto("fixo");
        setDescontoValor(String(desc));
      }
    } else {
      setTipoDesconto("percentual");
      setDescontoValor("0");
    }
    setPrecoManual("");
    setServicoParaCopiar(null);
    setProgramaDestinoId("");
  }, [open, initial, config]);

  const setQuantidade = (id: string, delta: number) =>
    setQtd((prev) => {
      const proximo = Math.max(0, (prev[id] ?? 0) + delta);
      const copia = { ...prev };
      if (proximo === 0) delete copia[id];
      else copia[id] = proximo;
      return copia;
    });

  const removerServicoDoPrograma = (id: string, nomeServico: string) => {
    setQtd((prev) => {
      const copia = { ...prev };
      delete copia[id];
      return copia;
    });
    toast.info(`"${nomeServico}" removido do programa.`);
  };

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
            categoria: s?.categoria ?? "Geral",
            quantidade,
            valor_unitario_de_referencia: valorUnit,
            valor_alocado: valorUnit * quantidade,
          };
        })
        .filter((i) => i.quantidade > 0),
    [qtd, servicos]
  );

  const subtotalServicos = useMemo(() => {
    return itensSelecionados.reduce((acc, i) => acc + i.valor_alocado, 0);
  }, [itensSelecionados]);

  // Cálculo automático do desconto e preço final em tempo real
  const { valorDescontoCalculado, precoFinal, percentualEfetivo } = useMemo(() => {
    const sub = subtotalServicos;
    if (sub <= 0) return { valorDescontoCalculado: 0, precoFinal: 0, percentualEfetivo: 0 };

    if (precoManual.trim() !== "") {
      const manual = Math.max(0, Number(precoManual) || 0);
      const desc = Math.max(0, sub - manual);
      const perc = sub > 0 ? Math.round((desc / sub) * 1000) / 10 : 0;
      return { valorDescontoCalculado: desc, precoFinal: manual, percentualEfetivo: perc };
    }

    const valorInput = Number(descontoValor.replace(",", ".")) || 0;
    if (tipoDesconto === "percentual") {
      const perc = Math.min(100, Math.max(0, valorInput));
      const desc = Math.round((sub * (perc / 100)) * 100) / 100;
      const final = Math.max(0, sub - desc);
      return { valorDescontoCalculado: desc, precoFinal: final, percentualEfetivo: perc };
    } else {
      const desc = Math.min(sub, Math.max(0, valorInput));
      const final = Math.max(0, sub - desc);
      const perc = sub > 0 ? Math.round((desc / sub) * 1000) / 10 : 0;
      return { valorDescontoCalculado: desc, precoFinal: final, percentualEfetivo: perc };
    }
  }, [subtotalServicos, tipoDesconto, descontoValor, precoManual]);

  const mutation = useMutation({
    mutationFn: (data: any) => upsertPrograma({ data }),
    onSuccess: () => {
      toast.success("Programa salvo no catálogo com sucesso");
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar o programa"),
  });

  const copiarServicoMut = useMutation({
    mutationFn: (vars: { servico_id: string; programa_destino_id: string; quantidade: number }) =>
      copiarServicoParaPrograma({ data: { ...vars, somar_se_existir: true } }),
    onSuccess: () => {
      toast.success("Serviço copiado para o programa de destino com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      setServicoParaCopiar(null);
      setProgramaDestinoId("");
    },
    onError: (err: any) => toast.error("Erro ao copiar serviço: " + err.message)
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
      preco_do_programa: precoFinal,
      valor_normal_dos_servicos: subtotalServicos,
      economia: valorDescontoCalculado,
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
      <DialogContent className="sm:max-w-[740px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PackageCheck className="h-6 w-6 text-gold" />
            {initial ? "Editar Programa do Catálogo" : "Novo Programa de Cuidado"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure os serviços reais, cálculo automático e política de desconto para novas vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 text-xs">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Nome do Programa</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Rotina em Dia" className="text-xs h-9" />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que o programa inclui?" className="text-xs" rows={2} />
          </div>

          {/* SERVIÇOS ATUALMENTE SELECIONADOS NO PROGRAMA */}
          {itensSelecionados.length > 0 && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-gold" /> Serviços na Composição ({itensSelecionados.length})
                </Label>
                <span className="text-muted-foreground text-[11px]">Subtotal: <strong>{brl(subtotalServicos)}</strong></span>
              </div>
              <div className="rounded-lg border divide-y bg-card overflow-hidden">
                {itensSelecionados.map((it) => (
                  <div key={it.servico_id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{it.nome}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {brl(it.valor_unitario_de_referencia)}/un · Total: {brl(it.valor_alocado)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setQuantidade(it.servico_id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-bold text-primary">{it.quantidade}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setQuantidade(it.servico_id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-gold"
                        title="Copiar serviço para outro programa"
                        onClick={() => setServicoParaCopiar(it)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                        title="Remover este serviço do programa"
                        onClick={() => removerServicoDoPrograma(it.servico_id, it.nome)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SELEÇÃO / ADIÇÃO DE SERVIÇOS DO CATÁLOGO GERAL */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">+ Adicionar Serviços do Catálogo Geral</Label>
              <span className="text-muted-foreground text-[11px]">{servicos?.length ?? 0} serviços disponíveis</span>
            </div>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar serviço do catálogo (ex: banho simples, hidratação, tosa)..."
              className="text-xs h-8"
            />
            <ScrollArea className="h-40 rounded-lg border border-sidebar-border/50 bg-card">
              <div className="divide-y">
                {listaFiltrada.length === 0 && (
                  <p className="p-4 text-center text-muted-foreground italic">Nenhum serviço ativo encontrado.</p>
                )}
                {listaFiltrada.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2.5 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-foreground">{s.nome}</p>
                      <p className="text-muted-foreground">
                        {s.categoria ? `${s.categoria} · ` : ""}
                        {brl(Number(s.valor ?? 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setQuantidade(s.id, -1)}
                        disabled={!qtd[s.id]}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center font-bold text-primary">{qtd[s.id] ?? 0}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
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

          {/* SEÇÃO PREÇO E DESCONTO DIGITÁVEL */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-gold" /> Preço e Desconto (Cálculo Automático)
              </h4>
              <span className="text-[11px] text-muted-foreground">Digite o desconto livremente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Tipo de Desconto</Label>
                <Select value={tipoDesconto} onValueChange={(v: "percentual" | "fixo") => setTipoDesconto(v)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="fixo">Valor em Reais (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">
                  {tipoDesconto === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
                </Label>
                <div className="relative">
                  {tipoDesconto === "percentual" ? (
                    <Percent className="absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground font-bold">R$</span>
                  )}
                  <Input
                    type="number"
                    min={0}
                    max={tipoDesconto === "percentual" ? 100 : subtotalServicos}
                    step="0.1"
                    value={descontoValor}
                    onChange={(e) => {
                      setDescontoValor(e.target.value);
                      setPrecoManual("");
                    }}
                    placeholder={tipoDesconto === "percentual" ? "Ex: 12.5" : "Ex: 30.00"}
                    className={`text-xs h-8 ${tipoDesconto === "fixo" ? "pl-8" : "pr-8"}`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Validade do Pacote</Label>
                <Input
                  type="number"
                  min={1}
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  className="text-xs h-8"
                  placeholder="30 dias"
                />
              </div>
            </div>

            {/* Resumo Financeiro Completo */}
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-muted-foreground">Subtotal dos Serviços: </span>
                <strong>{brl(subtotalServicos)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Desconto ({percentualEfetivo}%): </span>
                <strong className="text-emerald-700">-{brl(valorDescontoCalculado)}</strong>
              </div>
              <div className="text-sm font-bold text-gold">
                Total do Catálogo: {brl(precoFinal)}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Regras e Observações (Opcional)</Label>
            <Textarea value={regras} onChange={(e) => setRegras(e.target.value)} placeholder="Ex: uso exclusivo do pet contratado." className="text-xs" rows={2} />
          </div>
        </div>

        {/* DIÁLOGO EMBUTIDO PARA COPIAR SERVIÇO PARA OUTRO PROGRAMA */}
        {servicoParaCopiar && (
          <div className="p-3.5 bg-gold/10 border border-gold/30 rounded-xl space-y-2.5 text-xs animate-in fade-in">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-gold">
                <Copy className="h-4 w-4" /> Copiar "{servicoParaCopiar.nome}" ({servicoParaCopiar.quantidade}x) para outro programa
              </span>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setServicoParaCopiar(null)}>Fechar</Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={programaDestinoId} onValueChange={setProgramaDestinoId}>
                <SelectTrigger className="text-xs h-8 bg-background flex-1">
                  <SelectValue placeholder="Selecione o programa de destino..." />
                </SelectTrigger>
                <SelectContent>
                  {outrosProgramas
                    .filter((p: any) => p.id !== initial?.id)
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="bg-gold hover:bg-gold/90 text-white text-xs h-8"
                disabled={!programaDestinoId || copiarServicoMut.isPending}
                onClick={() => {
                  copiarServicoMut.mutate({
                    servico_id: servicoParaCopiar.servico_id,
                    programa_destino_id: programaDestinoId,
                    quantidade: servicoParaCopiar.quantidade
                  });
                }}
              >
                {copiarServicoMut.isPending ? "Copiando..." : "Confirmar Cópia"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            className="bg-gold hover:bg-gold/90 text-white text-xs gap-1.5"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {mutation.isPending ? "Salvando..." : "Salvar Programa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
