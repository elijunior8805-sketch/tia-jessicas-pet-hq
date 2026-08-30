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
  Pencil,
  Archive,
  RotateCcw,
  Bot,
  Info,
  CalendarPlus,
  HelpCircle,
  Percent,
  DollarSign,
  MoreVertical,
  Ban,
  CheckSquare,
  Square,
  Eye,
  FileSpreadsheet,
  Copy,
  Link as LinkIcon,
  PlayCircle
} from "lucide-react";

import { useState, useMemo, useEffect } from "react";
import { 
  getProgramasCatalogo, 
  toggleProgramaStatus,
  duplicarPrograma,
  excluirRascunhosProgramas,
  consultarVinculosPrograma,
  excluirProgramaCatalogo,
  normalizarNomeCopia,
  contratarPrograma,
  reconciliarCreditosPet
} from "@/lib/programas-cuidado.functions";
import { 
  cancelarContrato, 
  excluirLancamentosLote,
  excluirContratosCanceladosDefinitivo
} from "@/lib/programas-contratos.functions";
import { ProgramaFormDialog } from "@/components/gestao/programas/ProgramaFormDialog";
import { ContratoDetalheDialog } from "@/components/gestao/programas/ContratoDetalheDialog";
import { QuickServiceForm } from "@/components/gestao/programas/QuickServiceForm";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ProgramasConfigTab } from "@/components/gestao/programas/ProgramasConfigTab";
import { getProgramasConfig } from "@/lib/programas-config.functions";
import { REGRAS_CATEGORIAS_PADRAO, identificarCategoriaCredito } from "@/lib/programas-creditos-core";

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
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const brl = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const { data: programasRaw = [] } = useSuspenseQuery({
    queryKey: ["programas-catalogo"],
    queryFn: () => getProgramasCatalogo(),
  });

  // Deduplicação defensiva no frontend para garantir unicidade por ID
  const programas = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of (programasRaw as any[]) ?? []) {
      if (p?.id && !map.has(p.id)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [programasRaw]);

  const [activeTab, setActiveTab] = useState("catalogo");
  const [activeSubTabCatalogo, setActiveSubTabCatalogo] = useState<"todos" | "ativo" | "rascunho" | "inativo">("todos");
  
  // Por padrão mostra contratos operacionais (Ativos + Aguardando Pagamento) para manter a tela limpa
  const [activeSubTabAtivos, setActiveSubTabAtivos] = useState<"operacionais" | "ativo" | "aguardando_pagamento" | "cancelado">("operacionais");
  
  const [openVenda, setOpenVenda] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState<any>(null);
  const [vendaStep, setVendaStep] = useState(1);
  const [isProgramaModalOpen, setIsProgramaModalOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<any>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [programaParaArquivar, setProgramaParaArquivar] = useState<any | null>(null);

  // Duplicação e Exclusão Inteligente de Programas do Catálogo
  const [selectedRascunhosIds, setSelectedRascunhosIds] = useState<string[]>([]);
  const [programaParaDuplicar, setProgramaParaDuplicar] = useState<any | null>(null);
  const [openExcluirRascunhosDialog, setOpenExcluirRascunhosDialog] = useState(false);
  const [motivoExcluirRascunhos, setMotivoExcluirRascunhos] = useState("");

  // Diálogo de Exclusão Inteligente e Vínculos
  const [programaParaExcluir, setProgramaParaExcluir] = useState<any | null>(null);
  const [vinculosInfo, setVinculosInfo] = useState<any | null>(null);
  const [carregandoVinculos, setCarregandoVinculos] = useState(false);
  const [motivoExcluirPrograma, setMotivoExcluirPrograma] = useState("");
  const [forcarCancelamentoTestes, setForcarCancelamentoTestes] = useState(false);

  // Diálogo de Consulta de Vínculos
  const [programaParaVerVinculos, setProgramaParaVerVinculos] = useState<any | null>(null);

  // Seleção e Cancelamento de Contratos Vendidos em Lote / Individual
  const [selectedContratosIds, setSelectedContratosIds] = useState<string[]>([]);
  const [contratoParaCancelar, setContratoParaCancelar] = useState<any | null>(null);
  const [motivoCancelamentoIndividual, setMotivoCancelamentoIndividual] = useState("");
  const [openExcluirLoteDialog, setOpenExcluirLoteDialog] = useState(false);
  const [motivoExcluirLote, setMotivoExcluirLote] = useState("");

  // Exclusão Definitiva de Contratos Cancelados (Individual / Lote)
  const [contratoCanceladoParaExcluir, setContratoCanceladoParaExcluir] = useState<any | null>(null);
  const [openExcluirCanceladosDialog, setOpenExcluirCanceladosDialog] = useState(false);
  const [motivoExcluirCancelados, setMotivoExcluirCancelados] = useState("Limpeza de lançamentos cancelados e testes");

  // Estados da Venda Personalizada
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [petPorteSelecionado, setPetPorteSelecionado] = useState<string>("");
  const [vendaDataInicio, setVendaDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formaPagamento, setFormaPagamento] = useState<string>("pix");
  const [itensCustomizados, setItensCustomizados] = useState<Array<{ servico_id: string; nome: string; quantidade: number; valor_unitario: number }>>([]);
  const [servicoExtraAdicionar, setServicoExtraAdicionar] = useState<string>("");
  
  // Campo Livre de Desconto
  const [tipoDescontoVenda, setTipoDescontoVenda] = useState<"percentual" | "fixo">("percentual");
  const [descontoValorVenda, setDescontoValorVenda] = useState<string>("0");
  const [motivoDescontoVenda, setMotivoDescontoVenda] = useState<string>("");

  const { data: programasConfig } = useQuery({
    queryKey: ["programas-config"],
    queryFn: () => getProgramasConfig(),
  });

  // Busca todos os serviços
  const { data: todosServicos = [] } = useQuery({
    queryKey: ["servicos-catalogo-venda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, nome, categoria, valor, duracao_min")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Busca Portes e Preços por Porte
  const { data: portes = [] } = useQuery({
    queryKey: ["portes-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("portes").select("id, nome").eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: servicosPrecos = [] } = useQuery({
    queryKey: ["servicos-precos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos_precos").select("servico_id, porte_id, valor");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  // Função para resolver o preço unitário do serviço considerando o porte do pet
  const obterPrecoServico = (servicoId: string, porteNome?: string) => {
    const serv = todosServicos.find((s: any) => s.id === servicoId);
    if (!serv) return 0;
    if (porteNome && portes.length > 0) {
      const porteObj = portes.find((p: any) => p.nome.toLowerCase() === porteNome.toLowerCase());
      if (porteObj) {
        const precoPorte = servicosPrecos.find((sp: any) => sp.servico_id === servicoId && sp.porte_id === porteObj.id);
        if (precoPorte && Number(precoPorte.valor) > 0) {
          return Number(precoPorte.valor);
        }
      }
    }
    return Number(serv.valor || 0);
  };

  // Atualiza preços dos itens ao selecionar pet/porte
  useEffect(() => {
    if (!selectedPet) return;
    const porte = petPorteSelecionado || selectedPet.porte;
    setItensCustomizados((prev) =>
      prev.map((item) => ({
        ...item,
        valor_unitario: obterPrecoServico(item.servico_id, porte)
      }))
    );
  }, [selectedPet, petPorteSelecionado, todosServicos, servicosPrecos, portes]);

  const invalidarTodosCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
    queryClient.invalidateQueries({ queryKey: ["programas-ativos"] });
    queryClient.invalidateQueries({ queryKey: ["creditos-movimentacoes"] });
    queryClient.invalidateQueries({ queryKey: ["cliente-ficha-programas"] });
    queryClient.invalidateQueries({ queryKey: ["cliente-ficha-pagamentos-v2"] });
    queryClient.invalidateQueries({ queryKey: ["cliente-ficha-detalhe"] });
    queryClient.invalidateQueries({ queryKey: ["pet-programa-ativo"] });
    queryClient.invalidateQueries({ queryKey: ["creditos-disponiveis-pet"] });
    queryClient.invalidateQueries({ queryKey: ["financial-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["pagamentos-lista"] });
    queryClient.invalidateQueries({ queryKey: ["pagamentos-abertos"] });
    queryClient.invalidateQueries({ queryKey: ["auditoria-programas"] });
  };

  const duplicarMutation = useMutation({
    mutationFn: (vars: { id: string }) => duplicarPrograma({ data: { id: vars.id } }),
    onSuccess: (res: any) => {
      invalidarTodosCaches();
      toast.success(`Programa duplicado com sucesso como "${res.nome}"!`);
      setProgramaParaDuplicar(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao duplicar programa: " + err.message);
    }
  });

  const excluirRascunhosMutation = useMutation({
    mutationFn: (vars: { programa_ids: string[]; motivo: string }) =>
      excluirRascunhosProgramas({ data: vars }),
    onSuccess: (res: any) => {
      invalidarTodosCaches();
      toast.success(`${res.total_processados} rascunho(s) excluído(s) com sucesso!`);
      setSelectedRascunhosIds([]);
      setOpenExcluirRascunhosDialog(false);
      setMotivoExcluirRascunhos("");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir rascunhos: " + err.message);
    }
  });

  const excluirProgramaCatalogoMut = useMutation({
    mutationFn: (vars: { programa_id: string; motivo: string; forcar_cancelamento_testes: boolean }) =>
      excluirProgramaCatalogo({ data: vars }),
    onSuccess: (res: any) => {
      invalidarTodosCaches();
      toast.success(`Programa "${res.nome}" excluído do catálogo com sucesso!`);
      setProgramaParaExcluir(null);
      setVinculosInfo(null);
      setMotivoExcluirPrograma("");
      setForcarCancelamentoTestes(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir programa: " + err.message);
    }
  });

  // Exclusão definitiva de contratos cancelados (Individual e Lote)
  const excluirCanceladosDefinitivoMut = useMutation({
    mutationFn: (vars: { contrato_ids: string[]; motivo: string }) =>
      excluirContratosCanceladosDefinitivo({ data: vars }),
    onSuccess: (res: any) => {
      invalidarTodosCaches();
      toast.success(`${res.total_excluidos} programa(s) cancelado(s) excluído(s) definitivamente da área operacional!`);
      setSelectedContratosIds([]);
      setContratoCanceladoParaExcluir(null);
      setOpenExcluirCanceladosDialog(false);
      setMotivoExcluirCancelados("Limpeza de lançamentos cancelados e testes");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir contratos cancelados: " + err.message);
    }
  });

  // Abre diálogo de exclusão de programa do catálogo e consulta vínculos automaticamente
  const handleAbrirExclusaoPrograma = async (prog: any) => {
    setProgramaParaExcluir(prog);
    setCarregandoVinculos(true);
    setVinculosInfo(null);
    setMotivoExcluirPrograma("");
    setForcarCancelamentoTestes(false);

    try {
      const info = await consultarVinculosPrograma({ data: { programa_id: prog.id } });
      setVinculosInfo(info);
    } catch (e: any) {
      toast.error("Erro ao consultar vínculos: " + e.message);
    } finally {
      setCarregandoVinculos(false);
    }
  };

  // Abre diálogo de consulta de vínculos
  const handleAbrirVinculosPrograma = async (prog: any) => {
    setProgramaParaVerVinculos(prog);
    setCarregandoVinculos(true);
    setVinculosInfo(null);

    try {
      const info = await consultarVinculosPrograma({ data: { programa_id: prog.id } });
      setVinculosInfo(info);
    } catch (e: any) {
      toast.error("Erro ao consultar vínculos: " + e.message);
    } finally {
      setCarregandoVinculos(false);
    }
  };

  const contratarMutation = useMutation({
    mutationFn: (vars: any) => contratarPrograma({ data: vars }),
    onSuccess: () => {
      invalidarTodosCaches();
      toast.success("Programa contratado e créditos liberados com sucesso!");
      setOpenVenda(false);
      resetVenda();
    },
    onError: (err: any) => {
      toast.error("Erro ao contratar: " + err.message);
    }
  });

  const cancelarIndividualMut = useMutation({
    mutationFn: (vars: { contrato_id: string; motivo: string }) =>
      cancelarContrato({ data: { contrato_id: vars.contrato_id, motivo: vars.motivo, estornar_financeiro: true } }),
    onSuccess: () => {
      invalidarTodosCaches();
      toast.success("Programa cancelado e efeitos estornados com sucesso!");
      setContratoParaCancelar(null);
      setMotivoCancelamentoIndividual("");
    },
    onError: (err: any) => {
      toast.error("Erro ao cancelar programa: " + err.message);
    }
  });

  const excluirLoteMut = useMutation({
    mutationFn: (vars: { contrato_ids: string[]; motivo: string }) =>
      excluirLancamentosLote({ data: { contrato_ids: vars.contrato_ids, motivo: vars.motivo, is_teste: true } }),
    onSuccess: (res: any) => {
      invalidarTodosCaches();
      toast.success(`${res.total_processados} lançamento(s) cancelado(s) com estorno integral!`);
      setSelectedContratosIds([]);
      setOpenExcluirLoteDialog(false);
      setMotivoExcluirLote("");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir lançamentos em lote: " + err.message);
    }
  });

  const resetVenda = () => {
    setVendaStep(1);
    setSelectedCliente(null);
    setSelectedPet(null);
    setPetPorteSelecionado("");
    setSearchCliente("");
    setSelectedPrograma(null);
    setItensCustomizados([]);
    setTipoDescontoVenda("percentual");
    setDescontoValorVenda("0");
    setMotivoDescontoVenda("");
    setFormaPagamento("pix");
    setServicoExtraAdicionar("");
  };

  const handleOpenVenda = (programa: any) => {
    setSelectedPrograma(programa);
    
    const itensBase = (programa.itens ?? []).map((i: any) => ({
      servico_id: i.servico_id,
      nome: i.servico?.nome || "Serviço",
      quantidade: Number(i.quantidade || 1),
      valor_unitario: Number(i.valor_unitario_de_referencia || i.servico?.valor || 0)
    }));
    setItensCustomizados(itensBase);

    const sub = Number(programa.valor_normal_dos_servicos || 0);
    const preco = Number(programa.preco_do_programa || 0);
    const desc = Math.max(0, sub - preco);
    if (sub > 0 && desc > 0) {
      const perc = Math.round((desc / sub) * 1000) / 10;
      setTipoDescontoVenda("percentual");
      setDescontoValorVenda(String(perc));
    } else {
      setTipoDescontoVenda("percentual");
      setDescontoValorVenda("0");
    }
    setMotivoDescontoVenda("");
    setOpenVenda(true);
  };

  const restaurarComposicaoOriginal = () => {
    if (!selectedPrograma) return;
    const porte = petPorteSelecionado || selectedPet?.porte;
    const itensBase = (selectedPrograma.itens ?? []).map((i: any) => ({
      servico_id: i.servico_id,
      nome: i.servico?.nome || "Serviço",
      quantidade: Number(i.quantidade || 1),
      valor_unitario: obterPrecoServico(i.servico_id, porte)
    }));
    setItensCustomizados(itensBase);

    const sub = Number(selectedPrograma.valor_normal_dos_servicos || 0);
    const preco = Number(selectedPrograma.preco_do_programa || 0);
    const desc = Math.max(0, sub - preco);
    if (sub > 0 && desc > 0) {
      const perc = Math.round((desc / sub) * 1000) / 10;
      setTipoDescontoVenda("percentual");
      setDescontoValorVenda(String(perc));
    } else {
      setTipoDescontoVenda("percentual");
      setDescontoValorVenda("0");
    }
  };

  const handleAdicionarExtraNaVenda = (servicoId: string) => {
    if (!servicoId) return;
    const serv = todosServicos.find((s: any) => s.id === servicoId);
    if (!serv) return;

    const porte = petPorteSelecionado || selectedPet?.porte;
    const precoUnit = obterPrecoServico(serv.id, porte);

    setItensCustomizados((prev) => {
      const jaExiste = prev.find((i) => i.servico_id === servicoId);
      if (jaExiste) {
        return prev.map((i) => i.servico_id === servicoId ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, {
        servico_id: serv.id,
        nome: serv.nome,
        quantidade: 1,
        valor_unitario: precoUnit
      }];
    });
    setServicoExtraAdicionar("");
  };

  const toggleStatusMutation = useMutation({
    mutationFn: (vars: { id: string, status: "ativo" | "inativo" | "rascunho" }) => 
      toggleProgramaStatus({ data: vars }),
    onSuccess: () => {
      invalidarTodosCaches();
      toast.success("Status atualizado com sucesso");
      setProgramaParaArquivar(null);
    }
  });

  const { data: todosContratos = [] } = useQuery({
    queryKey: ["programas-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programas_contratados" as any)
        .select("*, clientes(nome), pets(nome, raca)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["creditos-movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programas_creditos_movimentacoes" as any)
        .select("*, pets(nome)")
        .order("data_hora", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativo": return <Badge className="bg-green-500/10 text-green-600 border-green-200">Ativo</Badge>;
      case "inativo": return <Badge variant="secondary" className="opacity-70">Arquivado</Badge>;
      case "rascunho": return <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50/50">Rascunho</Badge>;
      default: return null;
    }
  };

  // Programas do Catálogo filtrados por subaba
  const programasCatalogoFiltrados = useMemo(() => {
    if (activeSubTabCatalogo === "todos") return programas;
    return programas.filter((p: any) => p.status === activeSubTabCatalogo);
  }, [programas, activeSubTabCatalogo]);

  const rascunhosProgramas = useMemo(() => {
    return programas.filter((p: any) => p.status === "rascunho");
  }, [programas]);

  const handleToggleSelectAllRascunhos = () => {
    if (selectedRascunhosIds.length === rascunhosProgramas.length && rascunhosProgramas.length > 0) {
      setSelectedRascunhosIds([]);
    } else {
      setSelectedRascunhosIds(rascunhosProgramas.map((p) => p.id));
    }
  };

  const handleToggleSelectRascunho = (id: string) => {
    setSelectedRascunhosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Nome previsto para a duplicação em confirmação
  const nomePreviaDuplicacao = useMemo(() => {
    if (!programaParaDuplicar) return "";
    const nomes = programas.map((p: any) => p.nome as string);
    return normalizarNomeCopia(programaParaDuplicar.nome, nomes);
  }, [programaParaDuplicar, programas]);

  // Contratos Ativos, Pendentes e Cancelados
  const contratosOperacionais = useMemo(() => {
    return todosContratos.filter((c) => c.status_do_programa === "ativo" || c.status_do_programa === "aguardando_pagamento");
  }, [todosContratos]);

  const contratosAtivos = useMemo(() => {
    return todosContratos.filter((c) => c.status_do_programa === "ativo");
  }, [todosContratos]);

  const contratosAguardando = useMemo(() => {
    return todosContratos.filter((c) => c.status_do_programa === "aguardando_pagamento");
  }, [todosContratos]);

  const contratosCancelados = useMemo(() => {
    return todosContratos.filter((c) => c.status_do_programa === "cancelado");
  }, [todosContratos]);

  // Contratos filtrados conforme subaba
  const contratosFiltrados = useMemo(() => {
    if (activeSubTabAtivos === "operacionais") return contratosOperacionais;
    if (activeSubTabAtivos === "ativo") return contratosAtivos;
    if (activeSubTabAtivos === "aguardando_pagamento") return contratosAguardando;
    if (activeSubTabAtivos === "cancelado") return contratosCancelados;
    return contratosOperacionais;
  }, [activeSubTabAtivos, contratosOperacionais, contratosAtivos, contratosAguardando, contratosCancelados]);

  const valorTotalSelecionados = useMemo(() => {
    return todosContratos
      .filter((c) => selectedContratosIds.includes(c.id))
      .reduce((acc, c) => acc + Number(c.preco_vendido || 0), 0);
  }, [todosContratos, selectedContratosIds]);

  const handleToggleSelectAll = () => {
    if (selectedContratosIds.length === contratosFiltrados.length && contratosFiltrados.length > 0) {
      setSelectedContratosIds([]);
    } else {
      setSelectedContratosIds(contratosFiltrados.map((c) => c.id));
    }
  };

  const handleToggleSelectContrato = (id: string) => {
    setSelectedContratosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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
            Gerencie planos pré-pagos e fidelidade com inteligência, controle de créditos e auditoria.
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
            Catálogo ({programas.length})
          </TabsTrigger>
          <TabsTrigger value="ativos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <PackageCheck className="mr-2 h-4 w-4" />
            Programas Ativos ({contratosOperacionais.length})
          </TabsTrigger>
          <TabsTrigger value="creditos" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <CreditCard className="mr-2 h-4 w-4" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="ia" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:text-gold font-bold transition-all px-5 py-2.5">
            <Bot className="mr-2 h-4 w-4" />
            Inteligência dos Programas
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

        {/* CATÁLOGO DE PROGRAMAS */}
        <TabsContent value="catalogo" className="space-y-6 outline-none">
          {/* Barra de Filtros e Exclusão de Rascunhos */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-3 rounded-xl border border-sidebar-border/60">
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1 rounded-xl">
              <Button 
                variant={activeSubTabCatalogo === "todos" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-xs px-3 rounded-lg"
                onClick={() => setActiveSubTabCatalogo("todos")}
              >
                Todos ({programas.length})
              </Button>
              <Button 
                variant={activeSubTabCatalogo === "ativo" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-xs px-3 rounded-lg"
                onClick={() => setActiveSubTabCatalogo("ativo")}
              >
                Ativos ({programas.filter(p => p.status === "ativo").length})
              </Button>
              <Button 
                variant={activeSubTabCatalogo === "rascunho" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-xs px-3 rounded-lg"
                onClick={() => setActiveSubTabCatalogo("rascunho")}
              >
                Rascunhos ({rascunhosProgramas.length})
              </Button>
              <Button 
                variant={activeSubTabCatalogo === "inativo" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-xs px-3 rounded-lg"
                onClick={() => setActiveSubTabCatalogo("inativo")}
              >
                Arquivados ({programas.filter(p => p.status === "inativo").length})
              </Button>
            </div>

            {/* Ação em lote para rascunhos */}
            {rascunhosProgramas.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleToggleSelectAllRascunhos}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {selectedRascunhosIds.length === rascunhosProgramas.length && rascunhosProgramas.length > 0
                    ? "Desmarcar rascunhos"
                    : `Selecionar todos (${rascunhosProgramas.length})`}
                </Button>
                {selectedRascunhosIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs gap-1.5 shadow-sm"
                    onClick={() => setOpenExcluirRascunhosDialog(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir {selectedRascunhosIds.length} rascunho(s)
                  </Button>
                )}
              </div>
            )}
          </div>

          {programasCatalogoFiltrados && programasCatalogoFiltrados.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {programasCatalogoFiltrados.map((programa: any) => {
                const isRascunho = programa.status === "rascunho";
                const isSelectedRascunho = selectedRascunhosIds.includes(programa.id);

                return (
                  <Card key={programa.id} className={`group overflow-hidden border-sidebar-border/60 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300 bg-white dark:bg-zinc-950 flex flex-col justify-between ${isSelectedRascunho ? 'ring-2 ring-gold border-gold' : ''}`}>
                    <div>
                      <CardHeader className="pb-3 border-b border-sidebar-border/40 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {isRascunho && (
                              <Checkbox 
                                checked={isSelectedRascunho}
                                onCheckedChange={() => handleToggleSelectRascunho(programa.id)}
                                aria-label={`Selecionar rascunho ${programa.nome}`}
                              />
                            )}
                            {getStatusBadge(programa.status)}
                          </div>

                          {/* BOTÃO DE AÇÕES EM TODOS OS CARDS DO CATÁLOGO */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs">Ações do Catálogo</DropdownMenuLabel>
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2"
                                onClick={() => handleAbrirVinculosPrograma(programa)}
                              >
                                <Eye className="h-3.5 w-3.5 text-primary" /> Ver detalhes e vínculos
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2"
                                onClick={() => {
                                  setEditingPrograma(programa);
                                  setIsProgramaModalOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gold" /> Editar programa
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2"
                                onClick={() => setProgramaParaDuplicar(programa)}
                              >
                                <Copy className="h-3.5 w-3.5 text-primary" /> Duplicar programa
                              </DropdownMenuItem>
                              
                              {programa.status === "rascunho" && (
                                <DropdownMenuItem 
                                  className="text-xs cursor-pointer gap-2 text-emerald-600 focus:text-emerald-700 font-semibold"
                                  onClick={() => toggleStatusMutation.mutate({ id: programa.id, status: "ativo" })}
                                >
                                  <PlayCircle className="h-3.5 w-3.5" /> Publicar no Catálogo
                                </DropdownMenuItem>
                              )}

                              {programa.status === "ativo" && (
                                <DropdownMenuItem 
                                  className="text-xs cursor-pointer gap-2 text-amber-700 focus:text-amber-800"
                                  onClick={() => setProgramaParaArquivar(programa)}
                                >
                                  <Archive className="h-3.5 w-3.5" /> Arquivar programa
                                </DropdownMenuItem>
                              )}

                              {programa.status === "inativo" && (
                                <DropdownMenuItem 
                                  className="text-xs cursor-pointer gap-2 text-emerald-600 focus:text-emerald-700"
                                  onClick={() => toggleStatusMutation.mutate({ id: programa.id, status: "ativo" })}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Reativar programa
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2 text-rose-600 focus:text-rose-700 font-semibold"
                                onClick={() => handleAbrirExclusaoPrograma(programa)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir programa / cópia
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2 text-muted-foreground"
                                onClick={() => setActiveTab("auditoria")}
                              >
                                <History className="h-3.5 w-3.5" /> Ver auditoria
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                            {programa.itens?.map((item: any) => {
                              const cat = identificarCategoriaCredito({ nome: item.servico?.nome, categoria: item.servico?.categoria });
                              const regra = REGRAS_CATEGORIAS_PADRAO[cat];
                              return (
                                <li key={item.id} className="text-sm bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-gold">
                                        {item.quantidade}x
                                      </Badge>
                                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                        {item.servico?.nome || "Serviço"}
                                      </span>
                                    </span>
                                  </div>
                                  {regra && (
                                    <p className="text-[10px] text-primary/75 pl-7">
                                      {regra.descricao_cobertura}
                                    </p>
                                  )}
                                </li>
                              );
                            })}
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
                    </div>

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
                          disabled={programa.status === "inativo"}
                        >
                          Vender Agora
                        </Button>
                        
                        {/* Botão de Arquivar com Confirmação */}
                        <Button 
                          variant="secondary" 
                          size="icon"
                          className={`h-11 w-11 rounded-xl shadow-sm ${programa.status === 'ativo' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={programa.status === 'ativo' ? 'Arquivar programa do catálogo' : 'Reativar programa'}
                          onClick={() => setProgramaParaArquivar(programa)}
                        >
                          {programa.status === 'ativo' ? <Archive className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
              <div className="w-16 h-16 rounded-full bg-gold/5 flex items-center justify-center mb-6">
                <PackageCheck className="h-8 w-8 text-gold/40" />
              </div>
              <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-zinc-100">Nenhum programa encontrado nesta visualização</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs text-center">Altere o filtro acima ou crie um novo programa no catálogo.</p>
              <Button 
                className="mt-8 bg-gold hover:bg-gold/90 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-gold/20"
                onClick={() => {
                  setEditingPrograma(null);
                  setIsProgramaModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-5 w-5" />
                Criar Novo Programa
              </Button>
            </div>
          )}
        </TabsContent>

        {/* PROGRAMAS E CONTRATOS DE CLIENTES */}
        <TabsContent value="ativos" className="space-y-6 outline-none">
          <Card className="border-sidebar-border/60">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-gold" />
                  Programas e Contratos de Clientes
                </CardTitle>
                <CardDescription>
                  Listagem limpa de contratos operacionais (ativos e aguardando pagamento). Programas cancelados podem ser consultados e excluídos definitivamente.
                </CardDescription>
              </div>
              
              <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1 rounded-xl">
                <Button 
                  variant={activeSubTabAtivos === "operacionais" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3 rounded-lg"
                  onClick={() => setActiveSubTabAtivos("operacionais")}
                >
                  Operacionais ({contratosOperacionais.length})
                </Button>
                <Button 
                  variant={activeSubTabAtivos === "ativo" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3 rounded-lg"
                  onClick={() => setActiveSubTabAtivos("ativo")}
                >
                  Ativos ({contratosAtivos.length})
                </Button>
                <Button 
                  variant={activeSubTabAtivos === "aguardando_pagamento" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3 rounded-lg"
                  onClick={() => setActiveSubTabAtivos("aguardando_pagamento")}
                >
                  Aguardando Pagamento ({contratosAguardando.length})
                </Button>
                <Button 
                  variant={activeSubTabAtivos === "cancelado" ? "secondary" : "ghost"} 
                  size="sm" 
                  className="h-8 text-xs px-3 rounded-lg text-rose-700 font-semibold"
                  onClick={() => setActiveSubTabAtivos("cancelado")}
                >
                  Cancelados ({contratosCancelados.length})
                </Button>
              </div>
            </CardHeader>

            {/* Barra de Ações em Lote para Cancelados */}
            {activeSubTabAtivos === "cancelado" && contratosCancelados.length > 0 && (
              <div className="p-3.5 bg-rose-50 border-b border-rose-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3 text-xs text-rose-900">
                  <Badge className="bg-rose-600 text-white font-bold">{contratosCancelados.length} cancelado(s)</Badge>
                  <span>Lançamentos inativos prontos para limpeza operacional definitiva.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs bg-white border-rose-300 text-rose-900 hover:bg-rose-100"
                    onClick={handleToggleSelectAll}
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    {selectedContratosIds.length === contratosCancelados.length
                      ? "Desmarcar todos"
                      : `Selecionar todos (${contratosCancelados.length})`}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 text-xs gap-1.5 shadow-sm bg-rose-600 hover:bg-rose-700"
                    onClick={() => {
                      if (selectedContratosIds.length === 0) {
                        setSelectedContratosIds(contratosCancelados.map((c) => c.id));
                      }
                      setOpenExcluirCanceladosDialog(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {selectedContratosIds.length > 0 
                      ? `Excluir ${selectedContratosIds.length} cancelado(s)` 
                      : `Excluir todos os ${contratosCancelados.length} cancelados`}
                  </Button>
                </div>
              </div>
            )}

            {/* Barra de Ações em Lote quando há seleção em abas operacionais */}
            {activeSubTabAtivos !== "cancelado" && selectedContratosIds.length > 0 && (
              <div className="p-3.5 bg-gold/10 border-b border-gold/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3 text-xs">
                  <Badge className="bg-gold text-white font-bold">{selectedContratosIds.length} selecionado(s)</Badge>
                  <span className="text-muted-foreground">Valor total envolvido: <strong>{brl(valorTotalSelecionados)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs bg-white"
                    onClick={() => setSelectedContratosIds([])}
                  >
                    Desmarcar todos
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 text-xs gap-1.5 shadow-sm"
                    onClick={() => setOpenExcluirLoteDialog(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Cancelar Selecionados
                  </Button>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {contratosFiltrados && contratosFiltrados.length > 0 ? (
                <div className="divide-y overflow-hidden">
                  {/* Cabeçalho da Lista com Selecionar Todos */}
                  <div className="p-3 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground font-semibold px-4">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={selectedContratosIds.length === contratosFiltrados.length && contratosFiltrados.length > 0}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Selecionar todos os contratos filtrados"
                      />
                      <span>Selecionar Todos</span>
                    </div>
                    <span>Lançamentos ({contratosFiltrados.length})</span>
                  </div>

                  {contratosFiltrados.map((contrato: any) => {
                    const isSelected = selectedContratosIds.includes(contrato.id);
                    const isCancelado = contrato.status_do_programa === "cancelado";
                    return (
                      <div 
                        key={contrato.id} 
                        className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isSelected ? 'bg-gold/5' : isCancelado ? 'bg-rose-50/30' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-1">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectContrato(contrato.id)}
                              aria-label={`Selecionar contrato ${contrato.nome_snapshot}`}
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-primary text-base">{contrato.nome_snapshot}</h4>
                              <Badge className={
                                contrato.status_do_programa === "ativo" 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : contrato.status_do_programa === "aguardando_pagamento"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800 border-rose-200"
                              }>
                                {contrato.status_do_programa === "ativo" 
                                  ? "Ativo" 
                                  : contrato.status_do_programa === "aguardando_pagamento" 
                                  ? "Aguardando pagamento" 
                                  : "Cancelado"}
                              </Badge>
                              {contrato.forma_de_pagamento && (
                                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                  {contrato.forma_de_pagamento}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span>Tutor: <strong>{contrato.clientes?.nome || "Cliente"}</strong></span>
                              <span>Pet: <strong>{contrato.pets?.nome || "Pet"}</strong></span>
                              <span>Início: <strong>{contrato.data_de_inicio ? new Date(contrato.data_de_inicio).toLocaleDateString("pt-BR") : "—"}</strong></span>
                              <span>Validade: <strong>{contrato.data_de_validade ? new Date(contrato.data_de_validade).toLocaleDateString("pt-BR") : "—"}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-2 md:pt-0">
                          <div className="text-right mr-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Valor</span>
                            <p className="text-sm font-bold text-gold">{brl(Number(contrato.preco_vendido || 0))}</p>
                          </div>

                          {/* BOTÃO CLARAMENTE IDENTIFICADO COMO AÇÕES */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-9 px-3 gap-1.5 text-xs font-semibold">
                                Ações <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs">Opções do Lançamento</DropdownMenuLabel>
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2"
                                onClick={() => setSelectedContratoId(contrato.id)}
                              >
                                <Eye className="h-3.5 w-3.5 text-primary" /> Ver detalhes
                              </DropdownMenuItem>
                              
                              {!isCancelado ? (
                                <>
                                  <DropdownMenuItem 
                                    className="text-xs cursor-pointer gap-2"
                                    onClick={() => setSelectedContratoId(contrato.id)}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-gold" /> Editar lançamento
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-xs cursor-pointer gap-2 text-rose-600 focus:text-rose-700"
                                    onClick={() => {
                                      setContratoParaCancelar(contrato);
                                      setMotivoCancelamentoIndividual("");
                                    }}
                                  >
                                    <Ban className="h-3.5 w-3.5" /> Cancelar programa
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-xs cursor-pointer gap-2 text-rose-700 focus:text-rose-800 font-semibold"
                                    onClick={() => {
                                      setContratoCanceladoParaExcluir(contrato);
                                      setSelectedContratosIds([contrato.id]);
                                      setOpenExcluirCanceladosDialog(true);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-600" /> Excluir definitivamente
                                  </DropdownMenuItem>
                                </>
                              )}
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer gap-2 text-muted-foreground"
                                onClick={() => setActiveTab("auditoria")}
                              >
                                <History className="h-3.5 w-3.5" /> Consultar auditoria
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-14 text-center text-muted-foreground">
                  <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="font-semibold text-sm">
                    {activeSubTabAtivos === "cancelado" 
                      ? "Nenhum programa cancelado encontrado. Área operacional 100% limpa."
                      : "Nenhum contrato ativo ou aguardando pagamento no momento."}
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {activeSubTabAtivos === "cancelado"
                      ? "Todos os lançamentos cancelados foram excluídos da base operacional."
                      : "Utilize o catálogo para realizar novas vendas de programas."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MOVIMENTAÇÕES DE CRÉDITOS */}
        <TabsContent value="creditos" className="space-y-6 outline-none">
          <Card className="border-sidebar-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Livro Razão de Créditos</CardTitle>
              <CardDescription>Histórico detalhado de todas as movimentações de saldo (Criação, Reserva, Consumo, Liberação, Cancelamento, Estorno).</CardDescription>
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
                            {m.data_hora ? format(new Date(m.data_hora), 'dd/MM/yy HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium">{m.pets?.nome || "Pet"}</td>
                          <td className="px-4 py-3">
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] px-1.5 h-5 font-bold ${
                                m.tipo === 'credito_criado' ? 'border-green-200 text-green-600 bg-green-50/50' :
                                m.tipo === 'credito_reservado' ? 'border-amber-200 text-amber-600 bg-amber-50/50' :
                                m.tipo === 'credito_consumido' ? 'border-blue-200 text-blue-600 bg-blue-50/50' :
                                m.tipo === 'reserva_liberada' ? 'border-purple-200 text-purple-600 bg-purple-50/50' :
                                m.tipo === 'cancelamento' ? 'border-rose-200 text-rose-600 bg-rose-50/50' :
                                'border-gray-200 text-gray-600'
                              }`}
                            >
                              {m.tipo.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${['credito_criado', 'reserva_liberada', 'estorno_consumo'].includes(m.tipo) ? 'text-green-600' : 'text-red-600'}`}>
                            {['credito_criado', 'reserva_liberada', 'estorno_consumo'].includes(m.tipo) ? `+${m.quantidade}` : `-${m.quantidade}`}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[240px] truncate">
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

        {/* INTELIGÊNCIA DOS PROGRAMAS (IA) */}
        <TabsContent value="ia" className="space-y-6 outline-none">
          <Card className="border-sidebar-border/60">
            <CardHeader className="bg-primary/5 border-b pb-4">
              <div className="flex items-center gap-2 text-primary font-display font-semibold text-lg">
                <Bot className="h-5 w-5 text-gold" />
                Inteligência dos Programas de Cuidado
              </div>
              <CardDescription>
                Assistência estratégica com base nos dados reais de contratos, saldos de créditos e histórico de atendimentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-l-gold bg-gold/5 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Equivalência de Banhos
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Créditos da categoria <strong>Banho</strong> cobrem tanto <em>Banho Simples</em> quanto <em>Banho Premium</em> sem diferença financeira.
                  </p>
                </Card>

                <Card className="p-4 border-l-4 border-l-blue-500 bg-blue-500/5 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Vencimentos Próximos
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A IA alerta tutores automaticamente sobre créditos com validade inferior a 5 dias para incentivar o uso.
                  </p>
                </Card>

                <Card className="p-4 border-l-4 border-l-emerald-500 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                    <RotateCcw className="h-4 w-4 text-emerald-500" />
                    Sugestão de Renovação
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Quando o pet consome o último crédito, o sistema sugere a renovação facilitada mantendo o histórico de preferências.
                  </p>
                </Card>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl border border-sidebar-border/50 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" /> Exemplos de Comandos para a Central Inteligente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-background rounded-lg border font-mono">“Mostre os programas cancelados”</div>
                  <div className="p-2.5 bg-background rounded-lg border font-mono">“Quantos cancelados posso excluir?”</div>
                  <div className="p-2.5 bg-background rounded-lg border font-mono">“Confirme se os cancelados ainda afetam o Financeiro”</div>
                  <div className="p-2.5 bg-background rounded-lg border font-mono">“Limpe os programas cancelados de teste”</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="auditoria" className="space-y-6 outline-none">
          <AuditoriaProgramasTab />
        </TabsContent>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="configuracoes" className="outline-none">
          <ProgramasConfigTab />
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE EXCLUSÃO DEFINITIVA DE PROGRAMAS CANCELADOS (INDIVIDUAL OU EM LOTE) */}
      <Dialog open={openExcluirCanceladosDialog} onOpenChange={setOpenExcluirCanceladosDialog}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800 font-display text-lg">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Excluir {selectedContratosIds.length} Programa(s) Cancelado(s) Definitivamente?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              Estes lançamentos cancelados serão removidos permanentemente da área operacional (Ficha do Cliente, Pet, Agenda e Financeiro). Apenas um registro técnico mínimo será mantido na Auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y bg-muted/20">
              {todosContratos
                .filter((c: any) => selectedContratosIds.includes(c.id))
                .map((c: any) => (
                  <div key={c.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{c.nome_snapshot}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Tutor: {c.clientes?.nome || "Cliente"} · Pet: {c.pets?.nome || "Pet"} · {brl(Number(c.preco_vendido || 0))} ({c.forma_de_pagamento || "—"})
                      </p>
                      <p className="text-[9px] font-mono text-muted-foreground/75">ID: {c.id}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-800 bg-rose-50">
                      Cancelado
                    </Badge>
                  </div>
                ))}
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed space-y-1">
              <p className="font-bold">✓ Verificação de Segurança Realizada:</p>
              <p>• Nenhum crédito ativo ou reservado será deixado na carteira do pet.</p>
              <p>• Nenhum pagamento ou dívida permanecerá no Financeiro ou Dashboard.</p>
              <p>• A área de trabalho ficará 100% limpa e profissional.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da Exclusão Definitiva (Auditoria)</Label>
              <Input
                value={motivoExcluirCancelados}
                onChange={(e) => setMotivoExcluirCancelados(e.target.value)}
                placeholder="Ex: Limpeza de lançamentos cancelados e testes"
                className="text-xs h-8"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpenExcluirCanceladosDialog(false)} disabled={excluirCanceladosDefinitivoMut.isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
              disabled={excluirCanceladosDefinitivoMut.isPending || motivoExcluirCancelados.trim().length < 3}
              onClick={() => {
                if (motivoExcluirCancelados.trim().length < 3) {
                  toast.error("Informe o motivo da exclusão.");
                  return;
                }
                excluirCanceladosDefinitivoMut.mutate({
                  contrato_ids: selectedContratosIds,
                  motivo: motivoExcluirCancelados,
                });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {excluirCanceladosDefinitivoMut.isPending 
                ? "Excluindo..." 
                : `Confirmar exclusão de ${selectedContratosIds.length} cancelado(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE EXCLUSÃO INTELIGENTE DE PROGRAMA DO CATÁLOGO COM VÍNCULOS */}
      <Dialog open={Boolean(programaParaExcluir)} onOpenChange={(v) => !v && setProgramaParaExcluir(null)}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800 font-display text-lg">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Excluir Programa do Catálogo?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              Verifique os vínculos antes de confirmar a exclusão deste programa modelo.
            </DialogDescription>
          </DialogHeader>

          {carregandoVinculos ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              Consultando vínculos e contratos associados...
            </div>
          ) : programaParaExcluir && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span>Programa:</span>
                  <span>{programaParaExcluir.nome}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>ID:</span>
                  <span className="font-mono">{programaParaExcluir.id}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Status no Catálogo:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">{programaParaExcluir.status}</Badge>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Preço Configurado:</span>
                  <span className="font-bold text-foreground">{brl(Number(programaParaExcluir.preco_do_programa || 0))}</span>
                </div>
              </div>

              {/* Status dos Vínculos */}
              {vinculosInfo && vinculosInfo.total_contratos === 0 ? (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
                  ✓ <strong>Sem vínculos comerciais:</strong> Este programa é um rascunho/cópia sem contratos, créditos ou pagamentos. Pode ser excluído permanentemente com segurança.
                </div>
              ) : vinculosInfo && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Existem {vinculosInfo.total_contratos} contrato(s) vinculados a este programa:
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-200">
                    <span>Ativos: <strong>{vinculosInfo.contratos_ativos_count}</strong></span>
                    <span>Aguardando: <strong>{vinculosInfo.contratos_pendentes_count}</strong></span>
                    <span>Cancelados: <strong>{vinculosInfo.contratos_cancelados_count}</strong></span>
                  </div>
                  <div className="pt-2 flex items-center gap-2 border-t border-amber-200">
                    <Checkbox
                      checked={forcarCancelamentoTestes}
                      onCheckedChange={(v) => setForcarCancelamentoTestes(Boolean(v))}
                      id="forcar_cancelamento"
                    />
                    <Label htmlFor="forcar_cancelamento" className="text-[11px] font-semibold text-rose-800 cursor-pointer">
                      Excluir como dados de teste e cancelar todos os vínculos automaticamente
                    </Label>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Motivo Obrigatório da Exclusão (Auditoria)</Label>
                <Textarea
                  value={motivoExcluirPrograma}
                  onChange={(e) => setMotivoExcluirPrograma(e.target.value)}
                  placeholder="Informe o motivo da exclusão deste programa (mínimo 3 letras)..."
                  className="text-xs"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 sm:justify-between">
            {vinculosInfo && vinculosInfo.total_contratos > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                onClick={() => {
                  toggleStatusMutation.mutate({ id: programaParaExcluir.id, status: "inativo" });
                  setProgramaParaExcluir(null);
                }}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" /> Arquivar (Recomendado)
              </Button>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setProgramaParaExcluir(null)}>
                Voltar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={
                  excluirProgramaCatalogoMut.isPending || 
                  motivoExcluirPrograma.trim().length < 3 ||
                  (vinculosInfo && vinculosInfo.total_contratos > 0 && !forcarCancelamentoTestes)
                }
                onClick={() => {
                  if (motivoExcluirPrograma.trim().length < 3) {
                    toast.error("Informe o motivo da exclusão.");
                    return;
                  }
                  excluirProgramaCatalogoMut.mutate({
                    programa_id: programaParaExcluir.id,
                    motivo: motivoExcluirPrograma,
                    forcar_cancelamento_testes: forcarCancelamentoTestes
                  });
                }}
              >
                {excluirProgramaCatalogoMut.isPending ? "Excluindo..." : "Excluir permanentemente"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONSULTA DE VÍNCULOS E DETALHES */}
      <Dialog open={Boolean(programaParaVerVinculos)} onOpenChange={(v) => !v && setProgramaParaVerVinculos(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-display text-lg">
              <LinkIcon className="h-5 w-5 text-gold" />
              Vínculos e Detalhes do Programa
            </DialogTitle>
            <DialogDescription className="text-xs">
              {programaParaVerVinculos?.nome} (ID: {programaParaVerVinculos?.id})
            </DialogDescription>
          </DialogHeader>

          {carregandoVinculos ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              Carregando vínculos...
            </div>
          ) : vinculosInfo && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/30 rounded-lg border space-y-1">
                <div className="flex justify-between">
                  <span>Preço do Programa:</span>
                  <strong className="text-gold">{brl(Number(vinculosInfo.programa?.preco_do_programa || 0))}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Validade:</span>
                  <strong>{vinculosInfo.programa?.validade_em_dias} dias</strong>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">{vinculosInfo.programa?.status}</Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contratos Vendidos ({vinculosInfo.total_contratos})</Label>
                {vinculosInfo.contratos.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-lg border divide-y bg-card">
                    {vinculosInfo.contratos.map((c: any) => (
                      <div key={c.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold">{c.clientes?.nome || "Cliente"} · Pet: {c.pets?.nome || "Pet"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Vendido por {brl(Number(c.preco_vendido || 0))} em {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge className={
                          c.status_do_programa === "ativo" ? "bg-emerald-100 text-emerald-800" :
                          c.status_do_programa === "aguardando_pagamento" ? "bg-amber-100 text-amber-800" :
                          "bg-zinc-200 text-zinc-700"
                        }>
                          {c.status_do_programa}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-center text-muted-foreground italic bg-muted/20 rounded-lg border">
                    Nenhum contrato vendido para este programa.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setProgramaParaVerVinculos(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONFIRMAÇÃO DE DUPLICAÇÃO DE PROGRAMA */}
      <Dialog open={Boolean(programaParaDuplicar)} onOpenChange={(v) => !v && setProgramaParaDuplicar(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-display text-lg">
              <Copy className="h-5 w-5 text-gold" />
              Duplicar Programa do Catálogo?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              Uma nova cópia independente será criada como rascunho com o nome padronizado. Clientes, créditos e contratos existentes não serão alterados ou copiados.
            </DialogDescription>
          </DialogHeader>

          {programaParaDuplicar && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Programa Original:</span>
                  <span className="font-semibold">{programaParaDuplicar.nome}</span>
                </div>
                <div className="flex justify-between text-gold">
                  <span className="text-muted-foreground">Novo Nome Gerado:</span>
                  <span className="font-bold">{nomePreviaDuplicacao}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Preço Configurado:</span>
                  <span className="font-semibold text-foreground">{brl(Number(programaParaDuplicar.preco_do_programa || 0))}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-gold/5 border border-gold/20 text-[11px] leading-relaxed text-muted-foreground">
                ✓ A cópia conterá a mesma composição de serviços e regras comerciais.<br />
                ✓ O status inicial será <strong>Rascunho</strong> para que você possa revisar antes de ativar.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setProgramaParaDuplicar(null)} disabled={duplicarMutation.isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-gold hover:bg-gold/90 text-white gap-1.5"
              disabled={duplicarMutation.isPending}
              onClick={() => {
                if (programaParaDuplicar) {
                  duplicarMutation.mutate({ id: programaParaDuplicar.id });
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {duplicarMutation.isPending ? "Duplicando..." : "Sim, Duplicar como Rascunho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE EXCLUSÃO DE RASCUNHOS SELECIONADOS NO CATÁLOGO */}
      <Dialog open={openExcluirRascunhosDialog} onOpenChange={setOpenExcluirRascunhosDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800 font-display text-lg">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Excluir {selectedRascunhosIds.length} Rascunho(s) Selecionado(s)?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              Os rascunhos selecionados serão excluídos permanentemente do catálogo. Esta operação não afeta nenhum contrato vendido ou histórico de clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="max-h-40 overflow-y-auto rounded-lg border divide-y bg-muted/20">
              {programas
                .filter((p: any) => selectedRascunhosIds.includes(p.id))
                .map((p: any) => (
                  <div key={p.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{p.nome}</span>
                      <p className="text-[10px] text-muted-foreground">ID: {p.id.slice(0, 8)}... · {p.validade_em_dias} dias</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800 bg-amber-50">
                      Rascunho
                    </Badge>
                  </div>
                ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da Exclusão (Obrigatório para Auditoria)</Label>
              <Textarea
                value={motivoExcluirRascunhos}
                onChange={(e) => setMotivoExcluirRascunhos(e.target.value)}
                placeholder="Informe o motivo da exclusão dos rascunhos (mínimo 3 letras)..."
                className="text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpenExcluirRascunhosDialog(false)} disabled={excluirRascunhosMutation.isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={excluirRascunhosMutation.isPending || motivoExcluirRascunhos.trim().length < 3}
              onClick={() => {
                if (motivoExcluirRascunhos.trim().length < 3) {
                  toast.error("Informe o motivo da exclusão dos rascunhos.");
                  return;
                }
                excluirRascunhosMutation.mutate({
                  programa_ids: selectedRascunhosIds,
                  motivo: motivoExcluirRascunhos,
                });
              }}
            >
              {excluirRascunhosMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONFIRMAÇÃO DE ARQUIVAMENTO DO CATÁLOGO */}
      <Dialog open={Boolean(programaParaArquivar)} onOpenChange={(v) => !v && setProgramaParaArquivar(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800">
              <Archive className="h-5 w-5 text-rose-600" />
              {programaParaArquivar?.status === 'ativo' ? 'Arquivar Programa do Catálogo?' : 'Reativar Programa no Catálogo?'}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              {programaParaArquivar?.status === 'ativo'
                ? `O programa "${programaParaArquivar?.nome}" deixará de aparecer para novas vendas. Todos os contratos já vendidos continuarão ativos, válidos e preservados com seus créditos até a expiração.`
                : `O programa "${programaParaArquivar?.nome}" voltará a ficar disponível no catálogo para novas vendas.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setProgramaParaArquivar(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className={programaParaArquivar?.status === 'ativo' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
              onClick={() => toggleStatusMutation.mutate({
                id: programaParaArquivar.id,
                status: programaParaArquivar.status === 'ativo' ? 'inativo' : 'ativo'
              })}
              disabled={toggleStatusMutation.isPending}
            >
              {toggleStatusMutation.isPending ? "Processando..." : (programaParaArquivar?.status === 'ativo' ? "Sim, arquivar" : "Sim, reativar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CANCELAMENTO / EXCLUSÃO INDIVIDUAL DE CONTRATO VENDIDO */}
      <Dialog open={Boolean(contratoParaCancelar)} onOpenChange={(v) => !v && setContratoParaCancelar(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800 font-display text-lg">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Cancelar e Estornar Venda do Programa?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              O contrato deixará de existir nas áreas operacionais. Os créditos não utilizados serão cancelados e os efeitos financeiros serão integralmente estornados.
            </DialogDescription>
          </DialogHeader>

          {contratoParaCancelar && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Programa:</span>
                  <span>{contratoParaCancelar.nome_snapshot}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tutor / Pet:</span>
                  <span>{contratoParaCancelar.clientes?.nome} · {contratoParaCancelar.pets?.nome}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor Contratado:</span>
                  <span className="font-bold text-foreground">{brl(Number(contratoParaCancelar.preco_vendido || 0))}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Motivo Obrigatório (Auditoria)</Label>
                <Textarea
                  value={motivoCancelamentoIndividual}
                  onChange={(e) => setMotivoCancelamentoIndividual(e.target.value)}
                  placeholder="Informe o motivo do cancelamento / exclusão (mínimo 3 letras)..."
                  className="text-xs"
                  rows={2}
                />
              </div>

              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                ✓ Contrato removido de Programas Ativos, Ficha do Cliente e Pet.<br />
                ✓ Créditos cancelados e desabilitados na Agenda.<br />
                ✓ Estorno financeiro efetuado e Dashboard recalculado.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setContratoParaCancelar(null)}>
              Voltar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={cancelarIndividualMut.isPending || motivoCancelamentoIndividual.trim().length < 3}
              onClick={() => {
                if (motivoCancelamentoIndividual.trim().length < 3) {
                  toast.error("Informe o motivo do cancelamento.");
                  return;
                }
                cancelarIndividualMut.mutate({
                  contrato_id: contratoParaCancelar.id,
                  motivo: motivoCancelamentoIndividual,
                });
              }}
            >
              {cancelarIndividualMut.isPending ? "Processando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE EXCLUSÃO EM LOTE DE CONTRATOS */}
      <Dialog open={openExcluirLoteDialog} onOpenChange={setOpenExcluirLoteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800 font-display text-lg">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Excluir {selectedContratosIds.length} Lançamento(s) Selecionado(s)?
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              Esta ação cancelará atomicamente todos os contratos selecionados, estornará os lançamentos financeiros no caixa e zerará seus créditos disponíveis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-lg border space-y-1.5">
              <div className="flex justify-between">
                <span>Total de contratos:</span>
                <strong>{selectedContratosIds.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Valor total envolvido:</span>
                <strong className="text-gold">{brl(valorTotalSelecionados)}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da Exclusão em Lote (Obrigatório)</Label>
              <Textarea
                value={motivoExcluirLote}
                onChange={(e) => setMotivoExcluirLote(e.target.value)}
                placeholder="Informe o motivo da exclusão em lote (mínimo 3 letras)..."
                className="text-xs"
                rows={2}
              />
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              ⚠️ Atenção: Todos os contratos selecionados serão retirados das fichas dos clientes e pets, os créditos serão cancelados e o Financeiro e Dashboard serão recalculados.
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpenExcluirLoteDialog(false)}>
              Voltar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={excluirLoteMut.isPending || motivoExcluirLote.trim().length < 3}
              onClick={() => {
                if (motivoExcluirLote.trim().length < 3) {
                  toast.error("Informe o motivo da exclusão em lote.");
                  return;
                }
                excluirLoteMut.mutate({
                  contrato_ids: selectedContratosIds,
                  motivo: motivoExcluirLote,
                });
              }}
            >
              {excluirLoteMut.isPending ? "Excluindo..." : "Confirmar Exclusão em Lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VENDA PERSONALIZADA */}
      <Dialog open={openVenda} onOpenChange={(val) => {
        if (!val) resetVenda();
        setOpenVenda(val);
      }}>
        <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-display">
              <PackageCheck className="h-5 w-5 text-gold" />
              Venda de Programa: {selectedPrograma?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o tutor, o pet e personalize os serviços com cálculo automático em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2">
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-6 px-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    vendaStep === s ? 'bg-gold text-white shadow-lg shadow-gold/20' : 
                    vendaStep > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {vendaStep > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && <div className={`w-24 h-0.5 mx-2 ${vendaStep > s ? 'bg-green-500' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>

            {/* ETAPA 1: CLIENTE E PET */}
            {vendaStep === 1 && (
              <div className="space-y-4 animate-in fade-in">
                <div className="space-y-2">
                  <Label className="text-xs">Buscar Tutor (Cliente)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Nome do cliente (mín. 3 letras)" 
                      className="pl-9 text-xs"
                      value={searchCliente}
                      onChange={(e) => setSearchCliente(e.target.value)}
                    />
                  </div>
                </div>

                {selectedCliente ? (
                  <div className="flex items-center justify-between p-3 bg-gold/5 border border-gold/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold text-xs">
                        {selectedCliente.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{selectedCliente.nome}</p>
                        <p className="text-xs text-muted-foreground">{selectedCliente.whatsapp || "Sem WhatsApp"}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setSelectedCliente(null); setSelectedPet(null); }}>
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {clientesBusca?.map((cli) => (
                      <div 
                        key={cli.id} 
                        className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-xs"
                        onClick={() => setSelectedCliente(cli)}
                      >
                        <div>
                          <p className="font-semibold">{cli.nome}</p>
                          <p className="text-muted-foreground">{cli.whatsapp || "Sem telefone"}</p>
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
                  <div className="space-y-2 pt-2 animate-in fade-in">
                    <Label className="text-xs">Selecionar Pet</Label>
                    {petsCliente && petsCliente.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {petsCliente.map((pet) => (
                          <div 
                            key={pet.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedPet?.id === pet.id ? 'border-gold bg-gold/5 shadow-sm' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => {
                              setSelectedPet(pet);
                              setPetPorteSelecionado(pet.porte || "");
                            }}
                          >
                            <p className="text-sm font-semibold truncate">{pet.nome}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {pet.raca || "Raça não inf."} · {pet.porte ? `Porte ${pet.porte}` : "Sem porte"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2 italic">Este cliente não possui pets cadastrados.</p>
                    )}
                  </div>
                )}

                {/* Seletor de Porte se o pet não possuir porte cadastrado */}
                {selectedPet && !selectedPet.porte && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 animate-in fade-in text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Selecione o porte do pet para cálculo exato de preços:
                    </div>
                    <Select value={petPorteSelecionado} onValueChange={setPetPorteSelecionado}>
                      <SelectTrigger className="text-xs h-8 bg-white">
                        <SelectValue placeholder="Selecione o porte..." />
                      </SelectTrigger>
                      <SelectContent>
                        {portes.map((p: any) => (
                          <SelectItem key={p.id} value={p.nome} className="text-xs">
                            Porte {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* ETAPA 2: PERSONALIZAR PARA ESTE CLIENTE & DESCONTO */}
            {vendaStep === 2 && (
              <div className="space-y-4 animate-in fade-in text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Personalizar para {selectedPet?.nome || "este pet"}</h4>
                    <p className="text-muted-foreground">
                      {petPorteSelecionado || selectedPet?.porte ? `Porte: ${petPorteSelecionado || selectedPet.porte} · ` : ""}
                      Ajuste quantidades ou adicione serviços extras.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={restaurarComposicaoOriginal}>
                    Restaurar original
                  </Button>
                </div>

                {/* Lista de Serviços do Contrato com Preço por Porte Atualizado */}
                <div className="rounded-lg border divide-y bg-card max-h-48 overflow-y-auto">
                  {itensCustomizados.map((it) => (
                    <div key={it.servico_id} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold">{it.nome}</span>
                        <span className="text-muted-foreground ml-1.5">({brl(it.valor_unitario)}/un)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setItensCustomizados((prev) =>
                              prev
                                .map((item) => item.servico_id === it.servico_id ? { ...item, quantidade: item.quantidade - 1 } : item)
                                .filter((item) => item.quantidade > 0)
                            );
                          }}
                        >
                          -
                        </Button>
                        <span className="w-6 text-center font-bold text-primary">{it.quantidade}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setItensCustomizados((prev) =>
                              prev.map((item) => item.servico_id === it.servico_id ? { ...item, quantidade: item.quantidade + 1 } : item)
                            );
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                  {itensCustomizados.length === 0 && (
                    <p className="p-4 text-center text-xs text-destructive">Selecione ao menos um serviço para o contrato.</p>
                  )}
                </div>

                {/* Adicionar Extra */}
                <div className="flex items-center gap-2">
                  <Select value={servicoExtraAdicionar} onValueChange={handleAdicionarExtraNaVenda}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="+ Adicionar serviço extra ao contrato..." />
                    </SelectTrigger>
                    <SelectContent>
                      {todosServicos.map((s: any) => {
                        const precoU = obterPrecoServico(s.id, petPorteSelecionado || selectedPet?.porte);
                        return (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.nome} ({brl(precoU)})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* SEÇÃO PREÇO E DESCONTO LIVRE DIGITÁVEL */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-gold" /> Preço e Desconto
                    </h4>
                    <span className="text-muted-foreground text-[11px]">Subtotal: <strong>{brl(subtotalVenda)}</strong></span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Tipo de Desconto</Label>
                      <Select value={tipoDescontoVenda} onValueChange={(v: "percentual" | "fixo") => setTipoDescontoVenda(v)}>
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
                        {tipoDescontoVenda === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
                      </Label>
                      <div className="relative">
                        {tipoDescontoVenda === "percentual" ? (
                          <Percent className="absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground font-bold">R$</span>
                        )}
                        <Input
                          type="number"
                          min={0}
                          max={tipoDescontoVenda === "percentual" ? 100 : subtotalVenda}
                          step="0.1"
                          value={descontoValorVenda}
                          onChange={(e) => setDescontoValorVenda(e.target.value)}
                          placeholder={tipoDescontoVenda === "percentual" ? "Ex: 10 ou 12.5" : "Ex: 25.00"}
                          className={`text-xs h-8 ${tipoDescontoVenda === "fixo" ? "pl-8" : "pr-8"}`}
                        />
                      </div>
                    </div>
                  </div>

                  {valorDescontoVenda > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px]">Motivo do Desconto (Obrigatório para Auditoria)</Label>
                      <Input
                        value={motivoDescontoVenda}
                        onChange={(e) => setMotivoDescontoVenda(e.target.value)}
                        placeholder="Ex: Cortesia autorizada pelo proprietário, fidelidade, etc."
                        className="text-xs h-8"
                      />
                    </div>
                  )}

                  {/* Resumo Visual em Tempo Real */}
                  <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-muted-foreground">Subtotal dos Serviços: </span>
                      <strong>{brl(subtotalVenda)}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Desconto ({percentualEfetivoVenda}%): </span>
                      <strong className="text-emerald-700">-{brl(valorDescontoVenda)}</strong>
                    </div>
                    <div className="text-sm font-bold text-gold">
                      Total do Contrato: {brl(precoFinalVenda)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Data de Início</Label>
                    <Input 
                      type="date" 
                      value={vendaDataInicio}
                      onChange={(e) => setVendaDataInicio(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Validade (Dias)</Label>
                    <div className="h-8 flex items-center px-3 border rounded-md bg-muted/30 text-xs font-medium">
                      {selectedPrograma?.validade_em_dias || 30} dias
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 3: REVISÃO COMPLETA E FORMA DE PAGAMENTO */}
            {vendaStep === 3 && (
              <div className="space-y-4 animate-in fade-in text-xs">
                <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Tutor</span>
                    <span className="font-semibold">{selectedCliente?.nome}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Pet</span>
                    <span className="font-semibold">
                      {selectedPet?.nome} ({petPorteSelecionado || selectedPet?.porte || "Porte Padrão"})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Programa</span>
                    <span className="font-semibold">{selectedPrograma?.nome}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Validade até</span>
                    <span className="font-semibold">
                      {format(addDays(new Date(vendaDataInicio), selectedPrograma?.validade_em_dias || 30), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  {/* Lista detalhada dos serviços */}
                  <div className="py-1 space-y-1 border-b">
                    <span className="text-muted-foreground font-semibold">Composição dos Créditos:</span>
                    {itensCustomizados.map((it) => (
                      <div key={it.servico_id} className="flex justify-between text-[11px]">
                        <span>{it.quantidade}x {it.nome}</span>
                        <span className="text-muted-foreground">{brl(it.quantidade * it.valor_unitario)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-muted-foreground py-0.5">
                    <span>Subtotal</span>
                    <span>{brl(subtotalVenda)}</span>
                  </div>
                  {valorDescontoVenda > 0 && (
                    <div className="flex justify-between text-emerald-700 py-0.5 font-medium">
                      <span>Desconto ({percentualEfetivoVenda}%)</span>
                      <span>-{brl(valorDescontoVenda)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 text-sm font-bold border-t">
                    <span>Total a Pagar</span>
                    <span className="text-gold text-base">{brl(precoFinalVenda)}</span>
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Condição / Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix (Imediato · Créditos Ativos)</SelectItem>
                      <SelectItem value="credito">Cartão de Crédito (Créditos Ativos)</SelectItem>
                      <SelectItem value="debito">Cartão de Débito (Créditos Ativos)</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro (Créditos Ativos)</SelectItem>
                      <SelectItem value="pendente">Aguardando Pagamento (Créditos bloqueados até quitação)</SelectItem>
                      <SelectItem value="outras">Outras Formas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold/5 border border-gold/20 text-[11px] leading-relaxed text-gold-foreground/90">
                  <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                  <span>
                    {formaPagamento === 'pendente' 
                      ? 'O contrato será criado com status "Aguardando Pagamento". Os créditos ficarão visíveis mas bloqueados até a baixa do pagamento.'
                      : 'O contrato será ativado imediatamente e os créditos liberados na carteira do pet.'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t gap-2">
            {vendaStep > 1 && (
              <Button variant="outline" size="sm" onClick={() => setVendaStep(vendaStep - 1)} disabled={contratarMutation.isPending}>
                Voltar
              </Button>
            )}
            {vendaStep < 3 ? (
              <Button 
                size="sm"
                className="bg-gold hover:bg-gold/90 text-white" 
                onClick={() => {
                  if (vendaStep === 2 && valorDescontoVenda > 0 && !motivoDescontoVenda.trim()) {
                    toast.error("Informe o motivo do desconto concedido.");
                    return;
                  }
                  setVendaStep(vendaStep + 1);
                }}
                disabled={!selectedPet || (vendaStep === 2 && itensCustomizados.length === 0)}
              >
                Continuar
              </Button>
            ) : (
              <Button 
                size="sm"
                className="bg-gold hover:bg-gold/90 text-white" 
                onClick={() => contratarMutation.mutate({
                  programa_id: selectedPrograma.id,
                  cliente_id: selectedCliente.id,
                  pet_id: selectedPet.id,
                  data_de_inicio: vendaDataInicio,
                  data_de_validade: format(addDays(new Date(vendaDataInicio), selectedPrograma?.validade_em_dias || 30), 'yyyy-MM-dd'),
                  preco_vendido: precoFinalVenda,
                  desconto: valorDescontoVenda,
                  tipo_desconto: tipoDescontoVenda,
                  valor_desconto: Number(descontoValorVenda) || 0,
                  motivo_desconto: motivoDescontoVenda,
                  forma_de_pagamento: formaPagamento,
                  modo_venda: "normal",
                  fracionado: false,
                  itens_selecionados: itensCustomizados.map((i) => ({
                    servico_id: i.servico_id,
                    quantidade: i.quantidade,
                    valor_unitario: i.valor_unitario,
                    nome: i.nome
                  })),
                  idempotency_key: `venda_${selectedPet.id}_${Date.now()}`
                })}
                disabled={contratarMutation.isPending}
              >
                {contratarMutation.isPending ? "Processando..." : "Confirmar e Ativar Venda"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDIÇÃO DO CATÁLOGO */}
      <ProgramaFormDialog 
        open={isProgramaModalOpen} 
        onOpenChange={setIsProgramaModalOpen}
        initial={editingPrograma}
      />

      {/* DIÁLOGO DE DETALHES E EDIÇÃO DO CONTRATO VENDIDO */}
      <ContratoDetalheDialog 
        contratoId={selectedContratoId}
        onOpenChange={(open) => {
          if (!open) setSelectedContratoId(null);
        }}
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
          Log de Auditoria Técnica e Comercial
        </CardTitle>
        <CardDescription>Histórico detalhado e perene de vendas, cancelamentos, exclusões e estornos no módulo de programas.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-sidebar-border/40">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Ação</th>
                <th className="p-4">Detalhes</th>
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
                    <div className="font-semibold text-xs">{log.clientes?.nome || log.valor_posterior?.nome || log.valor_anterior?.nome || (log.valor_anterior?.contratos_excluidos?.length ? `${log.valor_anterior.contratos_excluidos.length} contrato(s)` : '-')}</div>
                    <div className="text-[10px] text-muted-foreground">{log.pets?.nome || log.valor_anterior?.cliente || '-'}</div>
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
