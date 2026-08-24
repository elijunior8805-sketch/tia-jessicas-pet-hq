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
  Wallet
} from "lucide-react";
import { useState, useMemo } from "react";
import { 
  getProgramasCatalogo, 
  toggleProgramaStatus,
  duplicarPrograma,
  contratarPrograma,
  reconciliarCreditosPet
} from "@/lib/programas-cuidado.functions";

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
  
  // Estados da Venda
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [vendaDataInicio, setVendaDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [vendaPreco, setVendaPreco] = useState(0);

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
  };

  const handleOpenVenda = (programa: any) => {
    setSelectedPrograma(programa);
    setVendaPreco(Number(programa.preco_do_programa));
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
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-gold" />
            Programas de Cuidado
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie planos pré-pagos e fidelidade para seus clientes.
          </p>
        </div>
        
        <Button className="bg-gold hover:bg-gold/90 text-white font-medium shadow-sm transition-all active:scale-95" onClick={() => toast.info("Funcionalidade de criação será expandida em breve")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Programa
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex-wrap h-auto overflow-x-auto justify-start">
          <TabsTrigger value="catalogo" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="ativos" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Programas Ativos
          </TabsTrigger>
          <TabsTrigger value="creditos" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CreditCard className="mr-2 h-4 w-4" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <History className="mr-2 h-4 w-4" />
            Auditoria
          </TabsTrigger>

          <TabsTrigger value="configuracoes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-6 outline-none">
          {programas && programas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {programas.map((programa: any) => (
                <Card key={programa.id} className="group overflow-hidden border-sidebar-border/60 hover:shadow-lg hover:shadow-gold/5 transition-all duration-300">
                  <CardHeader className="pb-3 border-b border-sidebar-border/40 bg-muted/20">
                    <div className="flex justify-between items-start mb-2">
                      {getStatusBadge(programa.status)}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-gold" onClick={() => duplicarMutation.mutate(programa.id)}>
                          <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg font-display text-sidebar-foreground group-hover:text-gold transition-colors">
                      {programa.nome}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem] mt-1 italic text-xs">
                      {programa.descricao || "Sem descrição definida."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 pb-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        Serviços Incluídos
                      </p>
                      <ul className="space-y-1.5">
                        {programa.itens?.map((item: any) => (
                          <li key={item.id} className="flex items-center justify-between text-sm bg-muted/30 px-2 py-1.5 rounded-md border border-sidebar-border/30">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-white border-sidebar-border/50">
                                {item.quantidade}x
                              </Badge>
                              <span className="font-medium text-sidebar-foreground/90">
                                {item.servico?.nome || "Serviço"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gold/5 border border-gold/10 p-2.5 rounded-lg">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gold/80">Validade</p>
                        <p className="text-sm font-semibold text-sidebar-foreground">{programa.validade_em_dias} dias</p>
                      </div>
                      <div className="bg-muted/50 p-2.5 rounded-lg border border-sidebar-border/40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transporte</p>
                        <p className="text-sm font-semibold text-sidebar-foreground">
                          {programa.inclui_transporte ? "Incluso" : "Não incluso"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3 pt-4 border-t border-sidebar-border/40 bg-muted/10">
                    <div className="w-full flex justify-between items-end">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 line-through">
                          R$ {Number(programa.valor_normal_dos_servicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-2xl font-display font-bold text-gold">
                          R$ {Number(programa.preco_do_programa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {programa.economia > 0 && (
                        <Badge className="bg-green-600 text-white border-none shadow-sm">
                          Economia de R$ {Number(programa.economia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="w-full flex gap-2 pt-1">
                      <Button 
                        className="flex-1 bg-gold hover:bg-gold/90 text-white font-medium"
                        onClick={() => handleOpenVenda(programa)}
                      >
                        Vender Agora
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="icon"
                        className={`${programa.status === 'ativo' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                        onClick={() => toggleStatusMutation.mutate({ 
                          id: programa.id, 
                          status: programa.status === 'ativo' ? 'inativo' : 'ativo' 
                        })}
                      >
                        <Plus className={`h-4 w-4 ${programa.status === 'ativo' ? 'rotate-45' : ''}`} />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/20 border-2 border-dashed border-sidebar-border rounded-xl">
              <PackageCheck className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-sidebar-foreground">Nenhum programa cadastrado</h3>
              <p className="text-sm text-muted-foreground mt-1">Comece criando o seu primeiro programa de fidelidade.</p>
              <Button className="mt-6 bg-gold hover:bg-gold/90 text-white">
                <Plus className="mr-2 h-4 w-4" />
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
                    .filter((p: any) => activeSubTabAtivos === "todos" || p.status === activeSubTabAtivos)
                    .map((contrato: any) => (
                    <div key={contrato.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-sidebar-border/40 hover:bg-muted/10 transition-colors gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <PackageCheck className="h-5 w-5 text-gold" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{contrato.nome_snapshot}</span>
                            {contrato.status === 'ativo' ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-200 h-5 px-1.5 text-[10px]">Ativo</Badge>
                            ) : contrato.status === 'aguardando_pagamento' ? (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 h-5 px-1.5 text-[10px]">Aguardando</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{contrato.status}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
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
                  {programasAtivos.filter((p: any) => activeSubTabAtivos === "todos" || p.status === activeSubTabAtivos).length === 0 && (
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
          <Card className="border-sidebar-border/60 max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-gold" />
                Configurações do Módulo
              </CardTitle>
              <CardDescription>
                Defina regras gerais para todos os programas de cuidado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900">Configurações avançadas</p>
                  <p className="text-xs text-amber-800/80 leading-relaxed">
                    A gestão de prazos de carência, regras de cancelamento automático e integração financeira será habilitada na Parte 3.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-sidebar-border/40">
                  <div>
                    <p className="text-sm font-medium">Permitir venda fracionada</p>
                    <p className="text-xs text-muted-foreground">Clientes podem comprar apenas metade do programa.</p>
                  </div>
                  <Badge variant="outline" className="opacity-50">Desativado</Badge>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-sidebar-border/40">
                  <div>
                    <p className="text-sm font-medium">Notificar vencimento</p>
                    <p className="text-xs text-muted-foreground">Enviar WhatsApp quando faltarem 5 dias para expirar.</p>
                  </div>
                  <Badge variant="outline" className="opacity-50">Desativado</Badge>
                </div>
                <div className="flex justify-between items-center py-3">
                  <div>
                    <p className="text-sm font-medium">Validade padrão</p>
                    <p className="text-xs text-muted-foreground">Prazo sugerido na criação de novos programas.</p>
                  </div>
                  <span className="text-sm font-medium text-sidebar-foreground">30 dias</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" disabled className="w-full">
                Salvar Alterações
              </Button>
            </CardFooter>
          </Card>
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
                        value={vendaPreco}
                        onChange={(e) => setVendaPreco(Number(e.target.value))}
                      />
                    </div>
                    {vendaPreco !== Number(selectedPrograma?.preco_do_programa) && (
                      <p className="text-[10px] text-amber-600 font-medium">
                        * Valor original: R$ {Number(selectedPrograma?.preco_do_programa).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-muted/20 border border-sidebar-border/40 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Resumo dos Créditos</p>
                    <div className="space-y-2">
                      {selectedPrograma?.itens?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{item.servico?.nome}</span>
                          <Badge variant="outline" className="font-bold border-gold/30 text-gold">
                            {item.quantidade}x
                          </Badge>
                        </div>
                      ))}
                    </div>
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
                    <span className="font-bold text-gold">R$ {vendaPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                disabled={!selectedPet || vendaPreco <= 0}
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
                  preco_vendido: vendaPreco,
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
        .order("criado_em", { ascending: false })
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
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-sidebar-border/40 text-left">
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
                    {format(new Date(log.criado_em), 'dd/MM/yy HH:mm')}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-gold/30 text-gold-foreground bg-gold/5">
                      {log.acao.replace('_', ' ')}
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

