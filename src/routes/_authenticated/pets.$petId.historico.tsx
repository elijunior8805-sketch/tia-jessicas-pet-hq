import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Calendar, ChevronDown, ChevronRight, Image as ImageIcon,
  AlertTriangle, DollarSign, Truck, MessageSquare, FileText, Loader2,
  ChevronsDownUp, ChevronsUpDown, Search, X, Download,
} from "lucide-react";
import { useSignedUrl } from "@/lib/use-signed-url";
import { generateDossiePDF } from "@/lib/pet-dossie-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pets/$petId/historico")({
  component: HistoricoPet,
});

const brl = (v: number) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDT = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const fmtD = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function HistoricoPet() {
  const { petId } = Route.useParams();
  const [busca, setBusca] = useState<string>("");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [servico, setServico] = useState<string>("");
  const [profissional, setProfissional] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [pagamento, setPagamento] = useState<string>("todos");
  const [levaTraz, setLevaTraz] = useState<string>("todos");
  const [comFotos, setComFotos] = useState(false);
  const [comOcorrencia, setComOcorrencia] = useState(false);
  const [comRecomendacao, setComRecomendacao] = useState(false);
  const [ordem, setOrdem] = useState<string>("data_desc");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandAll, setExpandAll] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoCsv, setGerandoCsv] = useState(false);
  const pageSize = 20;

  function aplicarPreset(dias: number | null) {
    if (dias === null) { setDe(""); setAte(""); return; }
    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - dias);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDe(iso(inicio));
    setAte(iso(hoje));
    setPage(0);
  }

  function limparFiltros() {
    setBusca(""); setDe(""); setAte(""); setServico("");
    setProfissional("todos"); setStatus("todos"); setPagamento("todos");
    setLevaTraz("todos"); setComFotos(false); setComOcorrencia(false);
    setComRecomendacao(false); setPage(0);
  }

  const filtrosAtivos =
    (busca ? 1 : 0) + (de ? 1 : 0) + (ate ? 1 : 0) + (servico ? 1 : 0) +
    (profissional !== "todos" ? 1 : 0) + (status !== "todos" ? 1 : 0) +
    (pagamento !== "todos" ? 1 : 0) + (levaTraz !== "todos" ? 1 : 0) +
    (comFotos ? 1 : 0) + (comOcorrencia ? 1 : 0) + (comRecomendacao ? 1 : 0);

  // Registra o acesso uma vez ao entrar
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("pet_acessos_log").insert({
        pet_id: petId,
        user_id: u.user?.id ?? null,
        user_email: u.user?.email ?? null,
        acao: "consulta_historico",
        escopo: {},
      });
    })().catch(() => {});
  }, [petId]);

  const { data: pet } = useQuery({
    queryKey: ["pet-header", petId],
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("id, nome, foto_url, cliente_id, clientes(nome)").eq("id", petId).maybeSingle();
      return data;
    },
  });

  const { data: profissionais } = useQuery({
    queryKey: ["pet-profissionais-do-pet", petId],
    queryFn: async () => {
      const { data } = await supabase.from("atendimentos").select("profissional_id").eq("pet_id", petId).not("profissional_id", "is", null);
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.profissional_id)));
      if (ids.length === 0) return [] as { id: string; nome: string }[];
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
      return profs ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["pet-historico", petId, { busca, de, ate, servico, profissional, status, pagamento, levaTraz, comFotos, comOcorrencia, comRecomendacao, ordem, page }],
    queryFn: async () => {
      const orderMap: Record<string, { col: string; asc: boolean }> = {
        data_desc: { col: "data_inicio", asc: false },
        data_asc: { col: "data_inicio", asc: true },
        valor_desc: { col: "valor_executado", asc: false },
        valor_asc: { col: "valor_executado", asc: true },
      };
      const ord = orderMap[ordem] ?? orderMap.data_desc;
      let q = supabase
        .from("atendimentos")
        .select(
          "id, data_inicio, data_fim, encerrado_em, servicos_planejados, servicos_executados, servicos_extras, valor_executado, taxa_leva_traz, comportamentos, observacoes, recomendacoes, proxima_visita, pagamento_status, pagamento_forma, valor_pago, fotos_antes, fotos_depois, foto_principal_depois, profissional_id, alergia_observada, usou_focinheira, agendamento_id, agendamentos(status, data, hora, leva_traz_modalidade)",
          { count: "exact" }
        )
        .eq("pet_id", petId)
        .order(ord.col, { ascending: ord.asc, nullsFirst: false })
        .order("data_inicio", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (de) q = q.gte("data_inicio", de);
      if (ate) q = q.lte("data_inicio", ate + "T23:59:59");
      if (status === "concluido") q = q.not("encerrado_em", "is", null);
      if (status === "cancelado") q = q.is("encerrado_em", null);
      if (profissional !== "todos") q = q.eq("profissional_id", profissional);
      if (pagamento !== "todos") q = q.eq("pagamento_status", pagamento);
      const { data, count } = await q;
      let rows = data ?? [];
      if (servico.trim()) {
        const s = servico.trim().toLowerCase();
        rows = rows.filter((a: any) =>
          [...(a.servicos_executados ?? []), ...(a.servicos_planejados ?? []), ...(a.servicos_extras ?? [])]
            .some((x: any) => String(x?.nome ?? "").toLowerCase().includes(s))
        );
      }
      if (busca.trim()) {
        const b = busca.trim().toLowerCase();
        rows = rows.filter((a: any) => {
          const servs = [...(a.servicos_executados ?? []), ...(a.servicos_planejados ?? []), ...(a.servicos_extras ?? [])]
            .map((x: any) => String(x?.nome ?? "")).join(" ");
          const hay = [
            servs, a.observacoes, a.recomendacoes, a.alergia_observada,
            (a.comportamentos ?? []).join(" "), a.pagamento_forma, a.pagamento_status,
          ].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(b);
        });
      }
      if (levaTraz === "com") {
        rows = rows.filter((a: any) => a.agendamentos?.leva_traz_modalidade && a.agendamentos.leva_traz_modalidade !== "nao_utilizar");
      } else if (levaTraz === "sem") {
        rows = rows.filter((a: any) => !a.agendamentos?.leva_traz_modalidade || a.agendamentos.leva_traz_modalidade === "nao_utilizar");
      }
      if (comFotos) rows = rows.filter((a: any) => ((a.fotos_antes ?? []).length + (a.fotos_depois ?? []).length) > 0);
      if (comRecomendacao) rows = rows.filter((a: any) => !!a.recomendacoes);
      return { rows, total: count ?? 0 };
    },
  });

  const { data: ocorrencias } = useQuery({
    queryKey: ["pet-ocorrencias-hist", petId],
    queryFn: async () => (await supabase.from("ocorrencias").select("id, atendimento_id, tipo, descricao, gravidade, data_ocorrencia").eq("pet_id", petId)).data ?? [],
  });

  const ocorrenciasPorAtend = useMemo(() => {
    const m = new Map<string, any[]>();
    (ocorrencias ?? []).forEach((o: any) => {
      if (!o.atendimento_id) return;
      const arr = m.get(o.atendimento_id) ?? [];
      arr.push(o); m.set(o.atendimento_id, arr);
    });
    return m;
  }, [ocorrencias]);

  let rows = data?.rows ?? [];
  if (comOcorrencia) rows = rows.filter((a: any) => (ocorrenciasPorAtend.get(a.id) ?? []).length > 0);

  const totalPag = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  async function gerarHistoricoPdf() {
    if (!pet) return;
    setGerandoPdf(true);
    try {
      let q = supabase
        .from("atendimentos")
        .select("*")
        .eq("pet_id", petId)
        .order("data_inicio", { ascending: false });
      if (de) q = q.gte("data_inicio", de);
      if (ate) q = q.lte("data_inicio", ate + "T23:59:59");
      const { data: atendimentos } = await q;

      const { data: ocs } = await supabase
        .from("ocorrencias").select("*").eq("pet_id", petId)
        .order("data_ocorrencia", { ascending: false });

      const { data: empresa } = await supabase.from("empresa_config").select("*").maybeSingle();
      const { data: u } = await supabase.auth.getUser();
      const { data: prof } = u.user
        ? await supabase.from("profiles").select("nome").eq("id", u.user.id).maybeSingle()
        : { data: null };

      await generateDossiePDF({
        pet,
        cliente: (pet as any).clientes ?? null,
        atendimentos: atendimentos ?? [],
        ocorrencias: ocs ?? [],
        empresa,
        operador: prof?.nome ?? u.user?.email ?? null,
        secoes: {
          identificacao: true, saude: true, tutor: true, resumo: true,
          atendimentos: true, fotos: true, valores: true,
          recomendacoes: true, ocorrencias: true, peso: true,
        },
        periodo: { de: de || null, ate: ate || null },
      });

      await supabase.from("pet_acessos_log").insert({
        pet_id: petId,
        user_id: u.user?.id ?? null,
        user_email: u.user?.email ?? null,
        acao: "gerou_pdf",
        escopo: { origem: "historico", periodo: { de, ate } },
      });
      toast.success("Histórico gerado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar histórico");
    } finally {
      setGerandoPdf(false);
    }
  }



  async function exportarCsv() {
    if (!pet) return;
    setGerandoCsv(true);
    try {
      const orderMap: Record<string, { col: string; asc: boolean }> = {
        data_desc: { col: "data_inicio", asc: false },
        data_asc: { col: "data_inicio", asc: true },
        valor_desc: { col: "valor_executado", asc: false },
        valor_asc: { col: "valor_executado", asc: true },
      };
      const ord = orderMap[ordem] ?? orderMap.data_desc;
      let q = supabase
        .from("atendimentos")
        .select("id, data_inicio, data_fim, encerrado_em, servicos_planejados, servicos_executados, servicos_extras, valor_executado, taxa_leva_traz, comportamentos, observacoes, recomendacoes, pagamento_status, pagamento_forma, valor_pago, fotos_antes, fotos_depois, profissional_id, alergia_observada, agendamentos(status, leva_traz_modalidade)")
        .eq("pet_id", petId)
        .order(ord.col, { ascending: ord.asc, nullsFirst: false })
        .order("data_inicio", { ascending: false });
      if (de) q = q.gte("data_inicio", de);
      if (ate) q = q.lte("data_inicio", ate + "T23:59:59");
      if (status === "concluido") q = q.not("encerrado_em", "is", null);
      if (status === "cancelado") q = q.is("encerrado_em", null);
      if (profissional !== "todos") q = q.eq("profissional_id", profissional);
      if (pagamento !== "todos") q = q.eq("pagamento_status", pagamento);
      const { data: allRows } = await q;
      let list: any[] = allRows ?? [];

      if (servico.trim()) {
        const s = servico.trim().toLowerCase();
        list = list.filter((a) =>
          [...(a.servicos_executados ?? []), ...(a.servicos_planejados ?? []), ...(a.servicos_extras ?? [])]
            .some((x: any) => String(x?.nome ?? "").toLowerCase().includes(s))
        );
      }
      if (busca.trim()) {
        const b = busca.trim().toLowerCase();
        list = list.filter((a) => {
          const servs = [...(a.servicos_executados ?? []), ...(a.servicos_planejados ?? []), ...(a.servicos_extras ?? [])]
            .map((x: any) => String(x?.nome ?? "")).join(" ");
          const hay = [servs, a.observacoes, a.recomendacoes, a.alergia_observada,
            (a.comportamentos ?? []).join(" "), a.pagamento_forma, a.pagamento_status]
            .filter(Boolean).join(" ").toLowerCase();
          return hay.includes(b);
        });
      }
      if (levaTraz === "com") list = list.filter((a) => a.agendamentos?.leva_traz_modalidade && a.agendamentos.leva_traz_modalidade !== "nao_utilizar");
      else if (levaTraz === "sem") list = list.filter((a) => !a.agendamentos?.leva_traz_modalidade || a.agendamentos.leva_traz_modalidade === "nao_utilizar");
      if (comFotos) list = list.filter((a) => ((a.fotos_antes ?? []).length + (a.fotos_depois ?? []).length) > 0);
      if (comRecomendacao) list = list.filter((a) => !!a.recomendacoes);
      if (comOcorrencia) list = list.filter((a) => (ocorrenciasPorAtend.get(a.id) ?? []).length > 0);

      const profIds = Array.from(new Set(list.map((a) => a.profissional_id).filter(Boolean)));
      const nomePorId = new Map<string, string>();
      if (profIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", profIds);
        (profs ?? []).forEach((p: any) => nomePorId.set(p.id, p.nome));
      }

      const esc = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["Data", "Hora", "Serviços", "Status", "Pagamento", "Forma pagto.", "Valor executado", "Valor pago", "Taxa leva e traz", "Responsável", "Observações", "Recomendações"];
      const linhas = list.map((a) => {
        const dt = a.encerrado_em || a.data_fim || a.data_inicio;
        const d = dt ? new Date(dt) : null;
        const data = d ? d.toLocaleDateString("pt-BR") : "";
        const hora = d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
        const servs = [...(a.servicos_executados ?? []), ...(a.servicos_planejados ?? []), ...(a.servicos_extras ?? [])]
          .map((x: any) => x?.nome).filter(Boolean).join(" | ");
        const st = a.encerrado_em ? "Concluído" : (a.agendamentos?.status ?? "Em aberto");
        return [
          data, hora, servs, st,
          a.pagamento_status ?? "", a.pagamento_forma ?? "",
          Number(a.valor_executado ?? 0).toFixed(2).replace(".", ","),
          Number(a.valor_pago ?? 0).toFixed(2).replace(".", ","),
          Number(a.taxa_leva_traz ?? 0).toFixed(2).replace(".", ","),
          nomePorId.get(a.profissional_id) ?? "",
          a.observacoes ?? "", a.recomendacoes ?? "",
        ].map(esc).join(";");
      });
      const csv = "\uFEFF" + [header.join(";"), ...linhas].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nome = (pet.nome ?? "pet").replace(/[^\w\-]+/g, "_");
      a.href = url;
      a.download = `historico_${nome}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("pet_acessos_log").insert({
        pet_id: petId, user_id: u.user?.id ?? null, user_email: u.user?.email ?? null,
        acao: "exportou_csv", escopo: { origem: "historico", total: list.length, filtros: { de, ate, servico, profissional, status, pagamento, levaTraz, busca } },
      });
      toast.success(`CSV gerado (${list.length} registros).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar CSV");
    } finally {
      setGerandoCsv(false);
    }
  }



  return (
    <PageShell>
      <PageHeader
        title={`Histórico · ${pet?.nome ?? ""}`}
        description={pet?.clientes?.nome ?? ""}
        actions={
          <>
            <Button className="gap-2" onClick={gerarHistoricoPdf} disabled={gerandoPdf || !pet}>
              {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4"/>}
              Gerar histórico (PDF)
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportarCsv} disabled={gerandoCsv || !pet}>
              {gerandoCsv ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
              Exportar CSV
            </Button>
            <Link to="/pets/$petId/dossie" params={{ petId }}>
              <Button variant="outline" className="gap-2"><FileText className="h-4 w-4"/> Dossiê personalizado</Button>
            </Link>
            <Link to="/pets/$petId/ficha" params={{ petId }}>
              <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4"/> Voltar à ficha</Button>
            </Link>
          </>
        }
      />


      <Card className="p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input
              className="pl-8"
              placeholder="Busca rápida — serviço, observação, recomendação, comportamento…"
              value={busca}
              onChange={e => { setBusca(e.target.value); setPage(0); }}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" onClick={() => aplicarPreset(7)}>7d</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarPreset(30)}>30d</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarPreset(90)}>90d</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarPreset(365)}>1 ano</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarPreset(null)}>Tudo</Button>
          </div>
          {filtrosAtivos > 0 && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={limparFiltros}>
              <X className="h-3.5 w-3.5"/> Limpar ({filtrosAtivos})
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={e => { setDe(e.target.value); setPage(0); }} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={e => { setAte(e.target.value); setPage(0); }} />
          </div>
          <div>
            <Label className="text-xs">Serviço</Label>
            <Input placeholder="Ex.: banho, tosa" value={servico} onChange={e => { setServico(e.target.value); setPage(0); }} />
          </div>
          <div>
            <Label className="text-xs">Profissional</Label>
            <Select value={profissional} onValueChange={(v) => { setProfissional(v); setPage(0); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(profissionais ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="concluido">Concluídos</SelectItem>
                <SelectItem value="cancelado">Em aberto/cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Pagamento</Label>
            <Select value={pagamento} onValueChange={(v) => { setPagamento(v); setPage(0); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Leva e Traz</Label>
            <Select value={levaTraz} onValueChange={(v) => { setLevaTraz(v); setPage(0); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com transporte</SelectItem>
                <SelectItem value="sem">Sem transporte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ordenar por</Label>
            <Select value={ordem} onValueChange={(v) => { setOrdem(v); setPage(0); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="data_desc">Data (mais recentes)</SelectItem>
                <SelectItem value="data_asc">Data (mais antigas)</SelectItem>
                <SelectItem value="valor_desc">Valor (maior → menor)</SelectItem>
                <SelectItem value="valor_asc">Valor (menor → maior)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-4 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={comFotos} onCheckedChange={(v) => { setComFotos(!!v); setPage(0); }} /> Com fotos
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={comOcorrencia} onCheckedChange={(v) => { setComOcorrencia(!!v); setPage(0); }} /> Com ocorrência
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={comRecomendacao} onCheckedChange={(v) => { setComRecomendacao(!!v); setPage(0); }} /> Com recomendação
            </label>
          </div>
        </div>
      </Card>


      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado com esses filtros.</Card>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setExpandAll(v => !v); setExpanded({}); }}
            >
              {expandAll ? <><ChevronsDownUp className="h-4 w-4"/> Recolher tudo</> : <><ChevronsUpDown className="h-4 w-4"/> Expandir tudo</>}
            </Button>
          </div>
          {rows.map((a: any) => {
            const override = expanded[a.id];
            const isOpen = override === undefined ? expandAll : override;
            const execs = ((a.servicos_executados ?? []) as any[]).map((s: any) => s?.nome).filter(Boolean);
            const totalVal = Number(a.valor_executado ?? 0) + Number(a.taxa_leva_traz ?? 0);
            const ocs = ocorrenciasPorAtend.get(a.id) ?? [];
            const totalFotos = (a.fotos_antes ?? []).length + (a.fotos_depois ?? []).length;
            return (
              <Card key={a.id} className="overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/40 transition"
                  onClick={() => setExpanded(x => ({ ...x, [a.id]: !x[a.id] }))}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 mt-1 shrink-0"/> : <ChevronRight className="h-4 w-4 mt-1 shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground"/>
                      <span className="font-medium text-sm">{fmtDT(a.data_inicio)}</span>
                      {a.encerrado_em ? (
                        <Badge variant="secondary" className="text-[10px]">Concluído</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Em aberto</Badge>
                      )}
                      {totalFotos > 0 && <Badge variant="outline" className="text-[10px] gap-1"><ImageIcon className="h-3 w-3"/>{totalFotos}</Badge>}
                      {ocs.length > 0 && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3"/>{ocs.length}</Badge>}
                      {a.agendamentos?.leva_traz_modalidade && a.agendamentos.leva_traz_modalidade !== "nao_utilizar" && (
                        <Badge variant="outline" className="text-[10px] gap-1"><Truck className="h-3 w-3"/>Leva e Traz</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {execs.length ? execs.join(", ") : "Sem serviços executados"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-primary">{brl(totalVal)}</div>
                    {a.pagamento_status && (
                      <div className="text-[10px] text-muted-foreground uppercase">{a.pagamento_status}</div>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t p-4 space-y-3 text-sm">
                    <DetailRow label="Serviços planejados" value={((a.servicos_planejados ?? []) as any[]).map((s: any) => s?.nome).filter(Boolean).join(", ") || "—"}/>
                    <DetailRow label="Adicionais" value={((a.servicos_extras ?? []) as any[]).map((s: any) => s?.nome).filter(Boolean).join(", ") || "—"}/>
                    <DetailRow label="Comportamento" value={(a.comportamentos ?? []).join(", ") || "—"}/>
                    {a.alergia_observada && <DetailRow label="Alergia observada" value={a.alergia_observada}/>}
                    {a.recomendacoes && <DetailRow label="Recomendações" value={a.recomendacoes}/>}
                    {a.observacoes && <DetailRow label="Observações" value={a.observacoes}/>}
                    {a.proxima_visita && <DetailRow label="Próxima visita" value={fmtD(a.proxima_visita)}/>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                      <MetaCell icon={DollarSign} label="Pagamento" value={`${a.pagamento_forma ?? "—"} · ${brl(Number(a.valor_pago ?? 0))}`}/>
                      <MetaCell icon={Truck} label="Leva e Traz" value={brl(Number(a.taxa_leva_traz ?? 0))}/>
                      <MetaCell icon={MessageSquare} label="Focinheira" value={a.usou_focinheira ? "Sim" : "Não"}/>
                      <MetaCell icon={Calendar} label="Encerrado" value={fmtDT(a.encerrado_em)}/>
                    </div>
                    {ocs.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-medium text-warning mb-1">Ocorrências</div>
                        <ul className="text-xs space-y-1">
                          {ocs.map((o: any) => (
                            <li key={o.id}>• <strong>{o.tipo}</strong>{o.gravidade ? ` (${o.gravidade})` : ""}: {o.descricao}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {totalFotos > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Fotos</div>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {[...(a.fotos_antes ?? []), ...(a.fotos_depois ?? [])].slice(0, 12).map((f: any, i: number) => (
                            <FotoThumb key={i} path={typeof f === "string" ? f : f?.path} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">Página {page + 1} de {totalPag} · {data?.total ?? 0} registros</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPag} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}
function MetaCell({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground"/>
      <div className="min-w-0">
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div className="text-xs truncate">{value}</div>
      </div>
    </div>
  );
}
function FotoThumb({ path }: { path?: string | null }) {
  const { data: url } = useSignedUrl(path ?? null);
  if (!url) return <div className="aspect-square bg-muted rounded"/>;
  return <img src={url} className="aspect-square object-cover rounded border" alt="" />;
}
