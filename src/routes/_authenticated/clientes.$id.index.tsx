import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MessageCircle, MapPin, Phone, Mail, Star, PawPrint, Plus, FileText,
  Pencil, Archive, CalendarPlus, ExternalLink, ClipboardList, DollarSign, AlertTriangle, CheckCircle2, Sparkles
} from "lucide-react";
import { useSignedUrl } from "@/lib/use-signed-url";
import { useRealtimeFinanceiro } from "@/lib/use-realtime-financeiro";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { BaixaPagamentoDialog } from "@/components/financeiro/BaixaPagamentoDialog";

export const Route = createFileRoute("/_authenticated/clientes/$id/")({
  component: ClienteDetalhe,
});

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useRealtimeFinanceiro([
    ["cliente-pagamentos", id],
    ["cliente-atends", id],
    ["cliente", id],
  ]);

  const [pagamentoParaBaixa, setPagamentoParaBaixa] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*, pets(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: atends } = useQuery({
    queryKey: ["cliente-atends", id],
    enabled: !!data,
    queryFn: async () => {
      const petIds = (data?.pets ?? []).map((p: any) => p.id);
      if (petIds.length === 0) return [];
      const { data: rows } = await supabase
        .from("atendimentos")
        .select("id, pet_id, data_execucao, valor_final, status, relatorio_pdf_path, pets(nome)")
        .in("pet_id", petIds)
        .order("data_execucao", { ascending: false, nullsFirst: false })
        .limit(30);
      return rows ?? [];
    },
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["cliente-pagamentos", id],
    enabled: !!data,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("pagamentos")
        .select("id, atendimento_id, valor_total, valor_pago, forma, status, data_pagamento, vencimento, categoria_receita, descricao, idempotency_key, arquivado_em, atendimentos(pet_id, finalizado, valor_executado, taxa_leva_traz, desconto)")
        .eq("cliente_id", id)
        .is("arquivado_em", null)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(60);
      return (rows ?? []).map((r: any) => {
        const a = r.atendimentos;
        const valorDinamico = a?.finalizado
          ? Math.max(Number(a.valor_executado || 0) + Number(a.taxa_leva_traz || 0) - Number(a.desconto || 0), 0)
          : Number(r.valor_total || 0);
        return { ...r, valor: valorDinamico };
      });
    },
  });

  const { data: programasAtivos } = useQuery({
    queryKey: ["cliente-programas", id],
    enabled: !!data,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("programas_contratados")
        .select(`
          id, programa_id, pet_id, nome_snapshot, composicao_snapshot,
          preco_original, preco_vendido, desconto,
          data_de_inicio, data_de_validade, status_do_programa,
          forma_de_pagamento, criado_em,
          pets:pet_id(nome)
        `)
        .eq("cliente_id", id)
        .in("status_do_programa", ["ativo", "aguardando_pagamento"])
        .order("criado_em", { ascending: false });
      return rows ?? [];
    },
  });

  const arquivarMut = useMutation({
    mutationFn: async () => {
      const novoStatus = !data?.ativo;
      const { error } = await supabase.from("clientes").update({ ativo: novoStatus }).eq("id", id);
      if (error) throw error;
      return novoStatus;
    },
    onSuccess: (novoStatus) => {
      toast.success(novoStatus ? "Cliente reativado." : "Cliente arquivado.");
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (isLoading) return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  if (!data) return <PageShell><div className="text-sm text-muted-foreground">Cliente não encontrado.</div></PageShell>;

  const totalAtend = atends?.length ?? 0;
  const datasExec = (atends ?? [])
    .filter((a: any) => a.status === "concluido" || a.status === "finalizado")
    .map((a: any) => a.data_execucao)
    .filter(Boolean)
    .sort();
  const ultimaVisita = datasExec[datasExec.length - 1] as string | undefined;
  const proximas = (data.pets ?? [])
    .map((p: any) => p.proxima_visita)
    .filter(Boolean)
    .sort();
  const proximaVisita = proximas[0] as string | undefined;

  const pendencias = (pagamentos ?? []).filter((p: any) => 
    (p.status === "pendente" || p.status === "parcial" || p.status === "atrasado") && 
    !p.arquivado_em &&
    p.status !== "cancelado" &&
    (Number(p.valor) - Number(p.valor_pago || 0)) > 0
  );
  const totalPendente = pendencias.reduce((s: number, p: any) => s + Math.max(0, Number(p.valor) - Number(p.valor_pago || 0)), 0);
  const totalRecebido = (pagamentos ?? [])
    .filter((p: any) => (p.status === "pago" || p.status === "parcial") && !p.arquivado_em && p.status !== "cancelado")
    .reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);

  const enderecoLinhas = [
    [data.rua, data.numero].filter(Boolean).join(", "),
    data.complemento,
    data.bairro,
    [data.cidade, data.estado].filter(Boolean).join(" / "),
    data.cep,
  ].filter(Boolean).join(", ");
  const mapsUrl = enderecoLinhas
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoLinhas)}`
    : null;
  const whatsappUrl = data.whatsapp
    ? `https://wa.me/${String(data.whatsapp).replace(/\D/g, "")}`
    : null;

  return (
    <PageShell>
      <PageHeader
        title={data.nome}
        description={data.ativo === false ? "Cliente arquivado" : "Ficha do cliente e pets vinculados."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/clientes" })} className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/clientes/$id/editar", params: { id } })}
              className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white"
            >
              <Pencil className="h-4 w-4"/> Editar cliente
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/pets/novo", search: { cliente: id } })}
              className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white"
            >
              <Plus className="h-4 w-4"/> Novo pet
            </Button>

            <Button
              onClick={() => navigate({ to: "/agenda", search: { cliente: id, pet: undefined } })}
              className="gap-2 bg-white text-primary hover:bg-white/90"
            >
              <CalendarPlus className="h-4 w-4"/> Novo agendamento
            </Button>
            <Button
              onClick={() => navigate({ to: "/jessi" })}
              className="gap-2 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold border border-[#C8A951]/40"
            >
              <Sparkles className="h-4 w-4 text-[#C8A951]"/> Perguntar à Jessi
            </Button>
            <Button
              variant="outline"
              onClick={() => arquivarMut.mutate()}
              disabled={arquivarMut.isPending}
              className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white"
            >
              <Archive className="h-4 w-4"/> {data.ativo === false ? "Reativar" : "Arquivar"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contato */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <ClienteAvatar path={(data as any).foto_url} nome={data.nome} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold text-primary truncate">Contato</h2>
              <div className="flex items-center gap-1 flex-wrap">
                {data.vip === true && (
                  <span title="Cliente marcado como VIP no cadastro" className="inline-flex">
                    <Badge className="badge-gold text-xs"><Star className="h-3 w-3 mr-0.5"/>VIP</Badge>
                  </span>
                )}
                {data.ativo === false && <Badge variant="secondary" className="text-xs">Arquivado</Badge>}
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {data.cpf && <Row label="CPF" value={data.cpf}/>}
            {data.nascimento && <Row label="Nascimento" value={new Date(data.nascimento).toLocaleDateString("pt-BR")}/>}
            {data.telefone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground"/>{data.telefone}</div>}
            {data.whatsapp && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground"/>{data.whatsapp}</div>
                {whatsappUrl && (
                  <button
                    type="button"
                    onClick={() => abrirWhatsApp(whatsappUrl)}
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Abrir <ExternalLink className="h-3 w-3"/>
                  </button>
                )}
              </div>
            )}
            {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground"/>{data.email}</div>}
            {(data.rua || data.bairro) && (
              <div className="flex items-start justify-between gap-2 pt-1">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5"/>
                  <span className="min-w-0">
                    {[data.rua, data.numero].filter(Boolean).join(", ")}
                    {data.complemento && ` — ${data.complemento}`}
                    {data.bairro && <><br/>{data.bairro}</>}
                    {(data.cidade || data.estado) && <><br/>{[data.cidade, data.estado].filter(Boolean).join(" / ")}</>}
                    {data.cep && <><br/>CEP {data.cep}</>}
                  </span>
                </div>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 shrink-0">
                    Maps <ExternalLink className="h-3 w-3"/>
                  </a>
                )}
              </div>
            )}
            {data.indicacao && <Row label="Indicação" value={data.indicacao}/>}
            {data.created_at && <Row label="Cadastrado em" value={new Date(data.created_at).toLocaleDateString("pt-BR")}/>}
          </div>
          {data.observacoes && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Observações</div>
              <p className="text-sm whitespace-pre-wrap">{data.observacoes}</p>
            </div>
          )}
        </Card>

        {/* KPIs + pets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Atendimentos" value={totalAtend.toString()} />
            <Kpi label="Última visita" value={ultimaVisita ? new Date(ultimaVisita).toLocaleDateString("pt-BR") : "—"} />
            <Kpi label="Próxima visita" value={proximaVisita ? new Date(proximaVisita).toLocaleDateString("pt-BR") : "—"} />
            <Kpi
              label="Pendências"
              value={totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              variant={totalPendente > 0 ? "warn" : "default"}
            />
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-primary">Pets</h2>
              <Link to="/pets/novo" search={{ cliente: id }}>
                <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5"/> Novo pet</Button>
              </Link>
            </div>
            {!data.pets || data.pets.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhum pet cadastrado ainda.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.pets.map((p: any) => <PetCard key={p.id} pet={p} />)}
              </div>
            )}
          </Card>
        </div>

        {/* Clubinho */}
        <Card className="p-5 lg:col-span-3">
          <h2 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4"/> Clubinho
          </h2>
          {!programasAtivos || programasAtivos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum plano do Clubinho ativo.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(programasAtivos as any[]).map((prog: any) => {
                // Find related payment
                const pagProg = (pagamentos ?? []).find((p: any) => 
                  p.idempotency_key === `programa_${prog.id}`
                ) as any;
                const valorPago = Number(pagProg?.valor_pago ?? 0);
                const saldo = Math.max(0, Number(prog.preco_vendido) - valorPago);
                const statusBadge: { label: string; cls: string } = ({
                  'ativo': { label: 'Ativo', cls: 'bg-green-100 text-green-800' },
                  'aguardando_pagamento': { label: 'Aguardando pagamento', cls: 'bg-amber-100 text-amber-800' },
                  'suspenso': { label: 'Suspenso', cls: 'bg-orange-100 text-orange-800' },
                  'vencido': { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
                  'concluído': { label: 'Concluído', cls: 'bg-blue-100 text-blue-800' },
                } as Record<string, { label: string; cls: string }>)[prog.status_do_programa] ?? { label: String(prog.status_do_programa), cls: 'bg-gray-100 text-gray-800' };
                
                return (
                  <div key={prog.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-display font-semibold text-primary text-sm truncate">{prog.nome_snapshot}</div>
                      <Badge className={`text-xs ${statusBadge.cls}`}>{statusBadge.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {prog.pets?.nome ?? '—'} · Validade: {prog.data_de_validade ? new Date(prog.data_de_validade).toLocaleDateString('pt-BR') : '—'}
                    </div>
                    {Array.isArray(prog.composicao_snapshot) && (
                      <div className="space-y-0.5">
                        {prog.composicao_snapshot.map((item: any, i: number) => (
                          <div key={i} className="text-xs flex justify-between">
                            <span>{item.quantidade}x serviço</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 border-t space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor contratado</span>
                        <span className="font-medium">{Number(prog.preco_vendido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor pago</span>
                        <span className="font-medium text-green-700">{valorPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      {saldo > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Saldo pendente</span>
                          <span className="font-medium text-amber-700">{saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                      )}
                      {saldo > 0 && pagProg && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                            onClick={() => setPagamentoParaBaixa({
                              id: pagProg.id,
                              valor_total: Number(prog.preco_vendido),
                              valor_pago: valorPago,
                              status: pagProg.status,
                              descricao: `Programa: ${prog.nome_snapshot}`,
                              cliente_nome: data?.nome,
                            })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Baixar pagamento
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Histórico de atendimentos */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4"/> Histórico de atendimentos
          </h2>
          {!atends || atends.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Sem atendimentos ainda.</div>
          ) : (
            <div className="divide-y">
              {atends.slice(0, 15).map((a: any) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                  <Link to="/atendimentos/$atendId" params={{ atendId: a.id }} className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.pets?.nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.data_execucao ? new Date(a.data_execucao).toLocaleDateString("pt-BR") : "—"} · {a.status ?? "—"}
                    </div>
                  </Link>
                  <div className="text-right">
                    {a.valor_final != null && (
                      <div className="text-sm font-semibold text-primary">
                        {Number(a.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    )}
                    {a.relatorio_pdf_path && (
                      <div className="text-[11px] text-primary inline-flex items-center gap-1">
                        <FileText className="h-3 w-3"/> relatório
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Financeiro */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4"/> Financeiro
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="Recebido" value={totalRecebido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/>
            <Row label="Pendente" value={totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/>
          </div>
          {pendencias.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-1 text-xs text-warning-foreground mb-2">
                <AlertTriangle className="h-3 w-3"/> Pagamentos em aberto
              </div>
              <ul className="space-y-1 text-xs">
                {pendencias.slice(0, 6).map((p: any) => (
                  <li key={p.id} className="flex justify-between items-center gap-2 hover:bg-muted/40 p-1 rounded">
                    <span className="truncate">
                      {p.vencimento ? new Date(p.vencimento).toLocaleDateString("pt-BR") : "—"} · {p.status === 'pendente' ? 'Aguardando pagamento' : p.status === 'parcial' ? 'Pagamento parcial' : p.status === 'pago' ? `Pago via ${p.forma ?? '—'}` : p.status === 'cancelado' ? 'Cancelado' : p.status}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-medium">
                        {(Number(p.valor) - Number(p.valor_pago || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[11px] text-primary"
                        onClick={() => setPagamentoParaBaixa({
                          id: p.id,
                          valor_total: Number(p.valor),
                          valor_pago: Number(p.valor_pago || 0),
                          status: p.status,
                          descricao: p.descricao,
                          cliente_nome: data?.nome,
                        })}
                      >
                        Baixar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {pagamentoParaBaixa && (
        <BaixaPagamentoDialog
          open={!!pagamentoParaBaixa}
          onOpenChange={(v) => !v && setPagamentoParaBaixa(null)}
          pagamento={pagamentoParaBaixa}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["cliente-pagamentos", id] });
            qc.invalidateQueries({ queryKey: ["cliente-programas", id] });
            qc.invalidateQueries({ queryKey: ["cliente", id] });
          }}
        />
      )}
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function ClienteAvatar({ path, nome }: { path?: string | null; nome: string }) {
  const { data: url } = useSignedUrl(path ?? null);
  if (url) return <img src={url} alt={nome} className="h-14 w-14 rounded-full object-cover border" />;
  const initials = nome.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="h-14 w-14 rounded-full bg-primary/10 grid place-items-center text-primary font-semibold">
      {initials || "?"}
    </div>
  );
}

function Kpi({ label, value, variant = "default" }: { label: string; value: string; variant?: "default" | "warn" }) {
  return (
    <Card className={`p-3 ${variant === "warn" ? "bg-warning/10 border-warning/30" : ""}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-display font-semibold text-primary">{value}</div>
    </Card>
  );
}

function PetCard({ pet }: { pet: any }) {
  const { data: fotoUrl } = useSignedUrl(pet.foto_url);
  return (
    <div className="rounded-lg border p-4 hover:shadow-elegant transition h-full flex flex-col">
      <Link to="/pets/$petId/ficha" params={{ petId: pet.id }} className="flex items-center gap-3 mb-3">
        {fotoUrl ? (
          <img src={fotoUrl} alt={pet.nome} className="h-12 w-12 rounded-full object-cover border" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
            <PawPrint className="h-6 w-6 text-primary"/>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-primary truncate">{pet.nome}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[pet.raca, pet.porte].filter(Boolean).join(" · ")}
          </div>
        </div>
        {pet.necessita_focinheira && <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
      </Link>
      <div className="text-xs text-muted-foreground mb-3">
        {pet.proxima_visita ? `Próx: ${new Date(pet.proxima_visita).toLocaleDateString("pt-BR")}` : "Sem próxima visita"}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Link to="/pets/$petId/ficha" params={{ petId: pet.id }}>
          <Button size="sm" variant="outline" className="w-full gap-1">
            <FileText className="h-3.5 w-3.5"/> Ficha
          </Button>
        </Link>
        <Link to="/pets/$petId/historico" params={{ petId: pet.id }}>
          <Button size="sm" className="w-full gap-1">
            <ClipboardList className="h-3.5 w-3.5"/> Histórico
          </Button>
        </Link>
      </div>
    </div>
  );
}