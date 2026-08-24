import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Plus, Sparkles, History, Settings as SettingsIcon, CreditCard, Clock, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { 
  getProgramasCatalogo, 
  upsertPrograma, 
  toggleProgramaStatus,
  duplicarPrograma
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
  DialogTrigger 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

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

  const toggleStatusMutation = useMutation({
    mutationFn: (vars: { id: string, status: "ativo" | "inativo" | "rascunho" }) => 
      toggleProgramaStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      toast.success("Status atualizado com sucesso");
    }
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
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gold hover:bg-gold/90 text-white font-medium shadow-sm transition-all active:scale-95">
              <Plus className="mr-2 h-4 w-4" />
              Novo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Programa de Cuidado</DialogTitle>
              <DialogDescription>
                Configure os serviços, validade e benefícios deste programa.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-gold" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                O formulário de criação completa será implementado na Parte 2 deste módulo.
              </p>
              <Button variant="outline" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex-wrap h-auto overflow-x-auto justify-start">
          <TabsTrigger value="catalogo" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="ativos" disabled className="opacity-50">
            <Plus className="mr-2 h-4 w-4" />
            Programas Ativos
          </TabsTrigger>
          <TabsTrigger value="creditos" disabled className="opacity-50">
            <CreditCard className="mr-2 h-4 w-4" />
            Créditos
          </TabsTrigger>
          <TabsTrigger value="vencimento" disabled className="opacity-50">
            <Clock className="mr-2 h-4 w-4" />
            Vencimentos
          </TabsTrigger>
          <TabsTrigger value="historico" disabled className="opacity-50">
            <History className="mr-2 h-4 w-4" />
            Histórico
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
                          <Plus className="h-4 w-4 rotate-45" title="Duplicar" />
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
                      <Button variant="outline" className="flex-1 text-xs h-9 hover:border-gold/50 hover:bg-gold/5" onClick={() => toast.info("Edição disponível na Parte 2")}>
                        Editar
                      </Button>
                      <Button 
                        variant="secondary" 
                        className={`flex-1 text-xs h-9 ${programa.status === 'ativo' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        onClick={() => toggleStatusMutation.mutate({ 
                          id: programa.id, 
                          status: programa.status === 'ativo' ? 'inativo' : 'ativo' 
                        })}
                      >
                        {programa.status === 'ativo' ? 'Inativar' : 'Ativar'}
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
                  <p className="text-sm font-semibold text-amber-900">Configurações em breve</p>
                  <p className="text-xs text-amber-800/80 leading-relaxed">
                    A gestão de prazos de carência, regras de cancelamento automático e integração financeira será habilitada na Parte 2 da implementação.
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
    </div>
  );
}
