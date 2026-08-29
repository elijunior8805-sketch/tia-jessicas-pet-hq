import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { 
  PackageCheck, 
  Plus, 
  Sparkles, 
  History, 
  Settings as SettingsIcon, 
  CreditCard, 
  Clock, 
  AlertTriangle,
  Search,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Calendar,
  Wallet,
  Pencil
} from "lucide-react";

import { useState, useMemo } from "react";
import { 
  getProgramasCatalogo, 
  toggleProgramaStatus,
  duplicarPrograma,
  contratarPrograma,
  reconciliarCreditosPet
} from "@/lib/programas-cuidado.functions";
import { ProgramaFormDialog } from "@/components/gestao/programas/ProgramaFormDialog";
import { QuickServiceForm } from "@/components/gestao/programas/QuickServiceForm";
import { Switch } from "@/components/ui/switch";
import { ProgramasConfigTab } from "@/components/gestao/programas/ProgramasConfigTab";
import { getProgramasConfig } from "@/lib/programas-config.functions";


import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/gestao/programas-cuidado")({
  component: ProgramasCuidadoPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["programas-catalogo"],
      queryFn: () => getProgramasCatalogo(),
    });
  },
});

function ProgramasCuidadoPage() {
  const queryClient = useQueryClient();
  const { data: programas } = useSuspenseQuery({
    queryKey: ["programas-catalogo"],
    queryFn: () => getProgramasCatalogo(),
  });

  const [activeTab, setActiveTab] = useState("catalogo");
  const [activeSubTabAtivos, setActiveSubTabAtivos] = useState("todos");
  const [openVenda, setOpenVenda] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<any>(null);
  const [vendaStep, setVendaStep] = useState(1);
  const [isProgramaModalOpen, setIsProgramaModalOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<any>(null);

  
  // Estados da Venda
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [vendaDataInicio, setVendaDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [vendaPreco, setVendaPreco] = useState(0);
  const [vendaFracionada, setVendaFracionada] = useState(false);
  const [itensQtd, setItensQtd] = useState<Record<string, number>>({});

  const { data: programasConfig } = useQuery({
    queryKey: ["programas-config"],
    queryFn: () => getProgramasConfig(),
  });
  const permiteFracionar = !!(programasConfig as any)?.permitir_venda_fracionada;

  const itensPrograma: any[] = selectedPrograma?.itens ?? [];
  const qtdDe = (item: any) =>
    vendaFracionada ? Number(itensQtd[item.servico_id] ?? item.quantidade) : Number(item.quantidade);

  // Mesmo cálculo aplicado no servidor (o servidor é a fonte da verdade)
  const precoFracionado = (() => {
    const precoCheio = Number(selectedPrograma?.preco_do_programa ?? 0);
    if (!vendaFracionada || itensPrograma.length === 0) return precoCheio;
    const somaAlocada = itensPrograma.reduce((s, i) => s + Number(i.valor_alocado || 0), 0);
    let total = 0;
    if (somaAlocada > 0) {
      total = itensPrograma.reduce((s, i) => {
        const unit = Number(i.valor_alocado || 0) / Math.max(Number(i.quantidade || 1), 1);
        return s + unit * qtdDe(i);
      }, 0);
    } else {
      const totalUnidades = itensPrograma.reduce((s, i) => s + Number(i.quantidade || 0), 0) || 1;
      const unidades = itensPrograma.reduce((s, i) => s + qtdDe(i), 0);
      total = (precoCheio / totalUnidades) * unidades;
    }
    return Math.round(total * 100) / 100;
  })();

  const precoFinalVenda = vendaFracionada ? precoFracionado : vendaPreco;
  const unidadesSelecionadas = itensPrograma.reduce((s, i) => s + qtdDe(i), 0);


  // Busca Clientes
  const { data: clientesBusca } = useQuery({
    queryKey: ["clientes-busca", searchCliente],
    queryFn: async () => {
      if (searchCliente.length < 3) return [];
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, whatsapp")
        .ilike("nome", `%${searchCliente}%`)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: searchCliente.length >= 3
  });

  // Busca Pets do Cliente
  const { data: petsCliente } = useQuery({
    queryKey: ["pets-cliente", selectedCliente?.id],
    queryFn: async () => {
      if (!selectedCliente) return [];
      const { data, error } = await supabase
        .from("pets")
        .select("id, nome, raca, porte")
        .eq("cliente_id", selectedCliente.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCliente
  });

  const contratarMutation = useMutation({
    mutationFn: (vars: any) => contratarPrograma({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["creditos-movimentacoes"] });
      toast.success("Programa contratado com sucesso!");
      setOpenVenda(false);
      resetVenda();
    },
    onError: (err: any) => {
      toast.error("Erro ao contratar: " + err.message);
    }
  });

  const resetVenda = () => {
    setVendaStep(1);
    setSelectedCliente(null);
    setSelectedPet(null);
    setSearchCliente("");
    setSelectedPrograma(null);
    setVendaFracionada(false);
    setItensQtd({});
  };

  const handleOpenVenda = (programa: any) => {
    setSelectedPrograma(programa);
    setVendaPreco(Number(programa.preco_do_programa));
    setVendaFracionada(false);
    setItensQtd({});
    setOpenVenda(true);
  };


  const toggleStatusMutation = useMutation({
    mutationFn: (vars: { id: string, status: "ativo" | "inativo" | "rascunho" }) => 
      toggleProgramaStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      toast.success("Status atualizado com sucesso");
    }
  });

  const { data: programasAtivos } = useQuery({
    queryKey: ["programas-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programas_contratados" as any)
        .select("*, clientes(nome), pets(nome, raca)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: movimentacoes } = useQuery({
    queryKey: ["creditos-movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programas_creditos_movimentacoes" as any)
        .select("*, pets(nome)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const duplicarMutation = useMutation({
    mutationFn: (id: string) => duplicarPrograma({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      toast.success("Programa duplicado com sucesso");
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativo": return <Badge className="bg-green-500/10 text-green-600 border-green-200">Ativo</Badge>;
      case "inativo": return <Badge variant="secondary" className="opacity-70">Inativo</Badge>;
      case "rascunho": return <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50/50">Rascunho</Badge>;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <PackageCheck className="h-8 w-8 text-gold" />
            Programas de Cuidado
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            Gerencie planos pré-pagos e fidelidade com inteligência e elegância.
          </p>

        </div>
        
        <Button 
          className="bg-gold hover:bg-gold/90 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-gold/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
          onClick={() => {
            setEditingPrograma(null);
            setIsProgramaModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-5 w-5" />
          Novo Programa
        </Button>


      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-100/80 dark:bg-zinc-900/80 p-1.5 mb-8 flex-wrap h-auto overflow-x-auto justify-start rounded-2xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm gap-1">
          <TabsTrigger value="catalogo" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <Sparkles className="mr-2 h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="ativos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <Plus className="mr-2 h-4 w-4" />
            Programas Ativos
          </TabsTrigger>
          <TabsTrigger value="creditos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <CreditCard className="mr-2 h-4 w-4" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <History className="mr-2 h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>


        <TabsContent value="catalogo" className="space-y-6 outline-none">
          {programas && programas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {programas.map((programa: any) => (
                <Card key={programa.id} className="group overflow-hidden border-sidebar-border/60 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300 bg-white dark:bg-zinc-950">
                  <CardHeader className="pb-3 border-b border-sidebar-border/40 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex justify-between items-start mb-2">
                      {getStatusBadge(programa.status)}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-gold" onClick={() => {
                          setEditingPrograma(programa);
                          setIsProgramaModalOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-gold" onClick={() => duplicarMutation.mutate(programa.id)}>
                          <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-xl font-display text-zinc-900 dark:text-zinc-100 group-hover:text-gold transition-colors">
                      {programa.nome}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem] mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {programa.descricao || "Sem descrição definida."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-5 pb-5">
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        Serviços Incluídos
                      </p>
                      <ul className="space-y-2">
                        {programa.itens?.map((item: any) => (
                          <li key={item.id} className="flex items-center justify-between text-sm bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-gold">
                                {item.quantidade}x
                              </Badge>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {item.servico?.nome || "Serviço"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gold/5 border border-gold/10 p-3 rounded-xl">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gold/70">Validade</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{programa.validade_em_dias} dias</p>
                      </div>
                      <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Transporte</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {programa.inclui_transporte ? "Incluso" : "Não incluso"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4 pt-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                    <div className="w-full flex justify-between items-end">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-600 line-through decoration-zinc-300 dark:decoration-zinc-700">
                          R$ {Number(programa.valor_normal_dos_servicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-3xl font-display font-bold text-gold">
                          <span className="text-sm font-normal mr-1">R$</span>
                          {Number(programa.preco_do_programa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {programa.economia > 0 && (
                        <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm mb-1 animate-pulse">
                          ECONOMIZE R$ {Number(programa.economia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                    
                    <div className="w-full flex gap-2">
                      <Button 
                        className="flex-1 bg-gold hover:bg-gold/90 text-white font-bold h-11 rounded-xl shadow-lg shadow-gold/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => handleOpenVenda(programa)}
                      >
                        Vender Agora
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="icon"
                        className={`h-11 w-11 rounded-xl shadow-sm ${programa.status === 'ativo' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        onClick={() => toggleStatusMutation.mutate({ 
                          id: programa.id, 
                          status: programa.status === 'ativo' ? 'inativo' : 'ativo' 
                        })}
                      >
                        <Plus className={`h-5 w-5 ${programa.status === 'ativo' ? 'rotate-45' : ''}`} />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>

              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
              <div className="w-16 h-16 rounded-full bg-gold/5 flex items-center justify-center mb-6">
                <PackageCheck className="h-8 w-8 text-gold/40" />
              </div>
              <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-zinc-100">Nenhum programa no catálogo</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs text-center">Comece criando o seu primeiro programa de fidelidade para atrair mais clientes.</p>
              <Button 
                className="mt-8 bg-gold hover:bg-gold/90 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-gold/20"
                onClick={() => setIsProgramaModalOpen(true)}
              >
                <Plus className="mr-2 h-5 w-5" />
                Criar Primeiro Programa
              </Button>
            </div>
          )}
        </TabsContent>


        <TabsContent value="auditoria" className="space-y-6 outline-none">
          <AuditoriaProgramasTab />
        </TabsContent>



        <TabsContent value="ativos" className="space-y-6 outline-none">
          <Card className="border-sidebar-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Programas em Vigor</CardTitle>
                <CardDescription>Lista de todos os programas contratados.</CardDescription>
              </div>
              <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                <Button 
                  variant={activeSubTabAtivos === "todos" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3"
                  onClick={() => setActiveSubTabAtivos("todos")}
                >
                  Todos
                </Button>
                <Button 
                  variant={activeSubTabAtivos === "aguardando_pagamento" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3"
                  onClick={() => setActiveSubTabAtivos("aguardando_pagamento")}
                >
                  Aguardando
                </Button>
                <Button 
                  variant={activeSubTabAtivos === "ativo" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3"
                  onClick={() => setActiveSubTabAtivos("ativo")}
                >
                  Ativos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {programasAtivos && programasAtivos.length > 0 ? (
                <div className="space-y-4">
                  {programasAtivos
                    .filter((p: any) => activeSubTabAtivos === "todos" || p.status_do_programa === activeSubTabAtivos)
                    .map((contrato: any) => (
                    <div key={contrato.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-sidebar-border/40 hover:bg-muted/10 transition-colors gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <PackageCheck className="h-5 w-5 text-gold" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{contrato.nome_snapshot}</span>
                            {contrato.status_do_programa === 'ativo' ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-200 h-5 px-1.5 text-[10px]">Ativo</Badge>
                            ) : contrato.status_do_programa === 'aguardando_pagamento' ? (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 h-5 px-1.5 text-[10px]">Aguardando</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{contrato.status_do_programa}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-[10px] text-gold hover:text-gold/80 hover:bg-gold/5"
                              onClick={async () => {
                                const res = await reconciliarCreditosPet({ data: { pet_id: contrato.pet_id } });
                                if ((res as any)[0]?.divergencia) {
                                  toast.error("Divergência detectada nos créditos!");
                                } else {
                                  toast.success("Créditos reconciliados e consistentes.");
                                }
                              }}
                            >
                              Reconciliar
                            </Button>

                            <span className="flex items-center gap-1"><Search className="h-3 w-3" /> {contrato.clientes?.nome}</span>
                            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> {contrato.pets?.nome}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Expira em {format(new Date(contrato.data_de_validade), 'dd/MM/yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor Contratado</p>
                          <p className="text-sm font-bold text-gold">R$ {Number(contrato.preco_vendido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-gold">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {programasAtivos.filter((p: any) => activeSubTabAtivos === "todos" || p.status_do_programa === activeSubTabAtivos).length === 0 && (
                    <div className="py-10 text-center text-muted-foreground italic text-sm">
                      Nenhum programa encontrado com este status.
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhuma contratação ativa encontrada no momento.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creditos" className="space-y-6 outline-none">
          <Card className="border-sidebar-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Livro Razão de Créditos</CardTitle>
              <CardDescription>Histórico detalhado de todas as movimentações de saldo.</CardDescription>
            </CardHeader>
            <CardContent>
              {movimentacoes && movimentacoes.length > 0 ? (
                <div className="relative overflow-x-auto rounded-lg border border-sidebar-border/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold tracking-wider border-b border-sidebar-border/40">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Pet</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3 text-right">Qtd</th>
                        <th className="px-4 py-3">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sidebar-border/40">
                      {movimentacoes.map((m: any) => (
                        <tr key={m.id} className="hover:bg-muted/5 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {format(new Date(m.created_at), 'dd/MM/yy HH:mm')}
                          </td>
                          <td className="px-4 py-3 font-medium">{m.pets?.nome}</td>
                          <td className="px-4 py-3">
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] px-1 h-4 ${
                                m.tipo === 'credito_criado' ? 'border-green-200 text-green-600 bg-green-50/50' :
                                m.tipo === 'credito_reservado' ? 'border-amber-200 text-amber-600 bg-amber-50/50' :
                                m.tipo === 'credito_consumido' ? 'border-red-200 text-red-600 bg-red-50/50' :
                                'border-gray-200 text-gray-600'
                              }`}
                            >
                              {m.tipo.replace('credito_', '').toUpperCase()}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${m.quantidade > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                            {m.motivo || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhuma movimentação de crédito registrada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes" className="outline-none">
          <ProgramasConfigTab />


        </TabsContent>
      </Tabs>

      {/* MODAL DE VENDA (CONTRATAÇÃO) */}
      <Dialog open={openVenda} onOpenChange={(val) => {
        if (!val) resetVenda();
        setOpenVenda(val);
      }}>
        <DialogContent className="sm:max-w-[500px] overflow-hidden p-0 gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-gold" />
              Contratar: {selectedPrograma?.nome}
            </DialogTitle>
            <DialogDescription>
              Siga os passos para ativar o programa para o pet.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2">
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-8 px-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    vendaStep === s ? 'bg-gold text-white shadow-lg shadow-gold/20' : 
                    vendaStep > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {vendaStep > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && <div className={`w-16 h-0.5 mx-2 ${vendaStep > s ? 'bg-green-500' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>

            {vendaStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Buscar Cliente</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Nome do cliente (mín. 3 letras)" 
                        className="pl-9"
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                      />
                    </div>
                  </div>

                  {selectedCliente ? (
                    <div className="flex items-center justify-between p-3 bg-gold/5 border border-gold/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold">
                          {selectedCliente.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{selectedCliente.nome}</p>
                          <p className="text-xs text-muted-foreground">{selectedCliente.whatsapp || "Sem WhatsApp"}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedCliente(null); setSelectedPet(null); }}>
                        Alterar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientesBusca?.map((cli) => (
                        <div 
                          key={cli.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedCliente(cli)}
                        >
                          <div>
                            <p className="text-sm font-medium">{cli.nome}</p>
                            <p className="text-xs text-muted-foreground">{cli.whatsapp}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                      {searchCliente.length >= 3 && clientesBusca?.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-2 italic">Nenhum cliente encontrado.</p>
                      )}
                    </div>
                  )}

                  {selectedCliente && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label>Selecionar Pet</Label>
                      {petsCliente && petsCliente.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {petsCliente.map((pet) => (
                            <div 
                              key={pet.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                selectedPet?.id === pet.id ? 'border-gold bg-gold/5 shadow-sm' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => setSelectedPet(pet)}
                            >
                              <p className="text-sm font-semibold truncate">{pet.nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{pet.raca || "Raça não inf."}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-2 italic">Este cliente não possui pets cadastrados.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {vendaStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Início</Label>
                      <Input 
                        type="date" 
                        value={vendaDataInicio}
                        onChange={(e) => setVendaDataInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Validade (Dias)</Label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30 text-sm font-medium">
                        {selectedPrograma?.validade_em_dias} dias
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Preço de Venda (R$)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-bold">R$</span>
                      <Input 
                        type="number"
                        className="pl-10 font-bold text-gold"
                        value={vendaFracionada ? precoFracionado : vendaPreco}
                        readOnly={vendaFracionada}
                        onChange={(e) => setVendaPreco(Number(e.target.value))}
                      />
                    </div>
                    {vendaFracionada ? (
                      <p className="text-[10px] text-muted-foreground font-medium">
                        * Valor calculado automaticamente pelo servidor conforme os serviços selecionados.
                      </p>
                    ) : vendaPreco !== Number(selectedPrograma?.preco_do_programa) ? (
                      <p className="text-[10px] text-amber-600 font-medium">
                        * Valor original: R$ {Number(selectedPrograma?.preco_do_programa).toLocaleString('pt-BR')}
                      </p>
                    ) : null}
                  </div>

                  <div className="p-4 rounded-xl bg-muted/20 border border-sidebar-border/40 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Resumo dos Créditos</p>
                      {permiteFracionar && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Fracionar</span>
                          <Switch
                            checked={vendaFracionada}
                            onCheckedChange={(v: boolean) => {
                              setVendaFracionada(v);
                              if (v) {
                                const base: Record<string, number> = {};
                                itensPrograma.forEach((i: any) => { base[i.servico_id] = Number(i.quantidade); });
                                setItensQtd(base);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div className="space-y-2">
                      {itensPrograma.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm gap-3">
                          <span className="text-muted-foreground truncate">{item.servico?.nome}</span>
                          {vendaFracionada ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button" variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                                onClick={() => setItensQtd((p) => ({ ...p, [item.servico_id]: Math.max(0, (p[item.servico_id] ?? Number(item.quantidade)) - 1) }))}
                              >-</Button>
                              <span className="w-8 text-center font-bold text-gold">{qtdDe(item)}</span>
                              <Button
                                type="button" variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                                onClick={() => setItensQtd((p) => ({ ...p, [item.servico_id]: Math.min(Number(item.quantidade), (p[item.servico_id] ?? Number(item.quantidade)) + 1) }))}
                              >+</Button>
                            </div>
                          ) : (
                            <Badge variant="outline" className="font-bold border-gold/30 text-gold">
                              {item.quantidade}x
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    {vendaFracionada && unidadesSelecionadas === 0 && (
                      <p className="text-[10px] text-destructive font-medium">Selecione ao menos um serviço.</p>
                    )}
                  </div>

                </div>
              </div>
            )}

            {vendaStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-gold" />
                  </div>
                  <h4 className="text-lg font-display font-bold">Tudo pronto!</h4>
                  <p className="text-sm text-muted-foreground">Confirme os detalhes finais antes de ativar.</p>
                </div>

                <div className="bg-muted/30 border border-sidebar-border/50 rounded-2xl p-4 space-y-4">
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-sidebar-border">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-semibold">{selectedCliente?.nome}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-sidebar-border">
                    <span className="text-muted-foreground">Pet</span>
                    <span className="font-semibold">{selectedPet?.nome}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-sidebar-border">
                    <span className="text-muted-foreground">Validade até</span>
                    <span className="font-semibold">
                      {format(addDays(new Date(vendaDataInicio), selectedPrograma?.validade_em_dias), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg py-2">
                    <span className="font-bold">Total a Pagar</span>
                    <span className="font-bold text-gold">R$ {precoFinalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gold/5 border border-gold/20">
                  <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-gold-foreground/80">
                    Ao confirmar, os créditos serão liberados imediatamente no livro razão. 
                    Esta ação gerará registros de auditoria e não poderá ser desfeita automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-sidebar-border/40 gap-3">
            {vendaStep > 1 && (
              <Button variant="outline" className="flex-1" onClick={() => setVendaStep(vendaStep - 1)} disabled={contratarMutation.isPending}>
                Voltar
              </Button>
            )}
            {vendaStep < 3 ? (
              <Button 
                className="flex-1 bg-gold hover:bg-gold/90 text-white" 
                onClick={() => setVendaStep(vendaStep + 1)}
                disabled={!selectedPet || precoFinalVenda <= 0 || (vendaFracionada && unidadesSelecionadas === 0)}
              >
                Continuar
              </Button>
            ) : (
              <Button 
                className="flex-1 bg-gold hover:bg-gold/90 text-white" 
                onClick={() => contratarMutation.mutate({
                  programa_id: selectedPrograma.id,
                  cliente_id: selectedCliente.id,
                  pet_id: selectedPet.id,
                  data_de_inicio: vendaDataInicio,
                  data_de_validade: format(addDays(new Date(vendaDataInicio), selectedPrograma.validade_em_dias), 'yyyy-MM-dd'),
                  preco_vendido: precoFinalVenda,
                  fracionado: vendaFracionada,
                  itens_selecionados: vendaFracionada
                    ? itensPrograma.map((i: any) => ({ servico_id: i.servico_id, quantidade: qtdDe(i) }))
                    : undefined,
                  idempotency_key: `venda_${selectedPet.id}_${Date.now()}`
                })}
                disabled={contratarMutation.isPending}
              >
                {contratarMutation.isPending ? "Processando..." : "Confirmar e Ativar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProgramaFormDialog 
        open={isProgramaModalOpen} 
        onOpenChange={setIsProgramaModalOpen}
        initial={editingPrograma}
      />
    </div>

  );
}

function AuditoriaProgramasTab() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["auditoria-programas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_programas" as any)
        .select("*, clientes(nome), pets(nome)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    }
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando auditoria...</div>;

  return (
    <Card className="border-sidebar-border/60 overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-gold" />
          Log de Auditoria
        </CardTitle>
        <CardDescription>Histórico detalhado de ações no módulo de programas.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-sidebar-border/40">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Ação</th>
                <th className="p-4">Cliente/Pet</th>
                <th className="p-4">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sidebar-border/30">
              {logs && logs.length > 0 ? logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-gold/30 text-gold-foreground bg-gold/5">
                      {log.acao.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-xs">{log.clientes?.nome || '-'}</div>
                    <div className="text-[10px] text-muted-foreground">{log.pets?.nome || '-'}</div>
                  </td>
                  <td className="p-4 text-xs italic text-muted-foreground/80">{log.motivo || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-muted-foreground italic">Nenhum registro de auditoria encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


