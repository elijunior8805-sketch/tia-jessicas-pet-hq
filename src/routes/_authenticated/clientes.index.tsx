import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, EmptyState, StatusBadge } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useSignedUrl } from "@/lib/use-signed-url";
import {
  Users, Plus, Search, Star, MessageCircle, MapPin, Phone, Mail,
  PawPrint, X, ArrowLeft, ChevronRight, CalendarPlus, Pencil,
  ExternalLink, AlertTriangle, DollarSign, ClipboardList, FileText,
  Cake, History, MessageSquare, UserPlus,
} from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().optional(),
  sel: z.string().optional(),
  vip: z.enum(["1"]).optional(),
});

export const Route = createFileRoute("/_authenticated/clientes/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ClientesPage,
});

const PAGE_SIZE = 10;

function ClientesPage() {
  const navigate = useNavigate();
  const { q: qParam, sel, vip: vipParam } = Route.useSearch();
  const onlyVip = vipParam === "1";
  const [rawQ, setRawQ] = useState(qParam ?? "");
  const [q, setQ] = useState(qParam ?? "");
  const [page, setPage] = useState(0);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ), 280);
    return () => clearTimeout(t);
  }, [rawQ]);

  // Reset page on search change and sync URL
  useEffect(() => {
    setPage(0);
    navigate({
      to: "/clientes",
      search: (prev: any) => ({ ...prev, q: q || undefined }),
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const termo = q.trim();
  const searching = termo.length >= 2;

  // Total de clientes
  const { data: totalClientes } = useQuery({
    queryKey: ["clientes-total"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // Total de VIPs
  const { data: totalVip } = useQuery({
    queryKey: ["clientes-total-vip"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("vip", true);
      return count ?? 0;
    },
  });

  // Cadastrados recentemente (estado inicial) — respeita filtro VIP
  const { data: recentes } = useQuery({
    queryKey: ["clientes-recentes", onlyVip],
    enabled: !searching,
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, whatsapp, bairro, vip, ativo, foto_url, created_at, pets(id, nome, foto_url)")
        .order(onlyVip ? "nome" : "created_at", { ascending: onlyVip ? true : false })
        .limit(onlyVip ? 100 : 5);
      if (onlyVip) query = query.eq("vip", true);
      const { data } = await query;
      return data ?? [];
    },
  });

  // Resultados da busca
  const { data: resultados, isFetching: buscando } = useQuery({
    queryKey: ["clientes-busca", termo, page, onlyVip],
    enabled: searching,
    staleTime: 15_000,
    queryFn: async () => {
      const like = `%${termo}%`;
      // Busca em clientes (nome, cpf, telefone, whatsapp, bairro, email)
      let baseQ = supabase
        .from("clientes")
        .select("id, nome, cpf, telefone, whatsapp, bairro, email, vip, ativo, foto_url, created_at, pets(id, nome, raca, foto_url)")
        .or(
          `nome.ilike.${like},cpf.ilike.${like},telefone.ilike.${like},whatsapp.ilike.${like},bairro.ilike.${like},email.ilike.${like}`,
        )
        .order("nome")
        .range(0, (page + 1) * PAGE_SIZE - 1);
      if (onlyVip) baseQ = baseQ.eq("vip", true);

      const { data: byCliente } = await baseQ;

      // Busca por pet (nome ou raça) — traz cliente_id de pets que casam
      const { data: petsMatch } = await supabase
        .from("pets")
        .select("cliente_id")
        .or(`nome.ilike.${like},raca.ilike.${like}`)
        .limit(50);

      const clienteIds = Array.from(
        new Set((petsMatch ?? []).map((p: any) => p.cliente_id).filter(Boolean)),
      );

      let byPet: any[] = [];
      if (clienteIds.length > 0) {
        const alreadyIds = new Set((byCliente ?? []).map((c: any) => c.id));
        const missing = clienteIds.filter((id) => !alreadyIds.has(id));
        if (missing.length > 0) {
          let q2 = supabase
            .from("clientes")
            .select("id, nome, cpf, telefone, whatsapp, bairro, email, vip, ativo, foto_url, created_at, pets(id, nome, raca, foto_url)")
            .in("id", missing)
            .limit(20);
          if (onlyVip) q2 = q2.eq("vip", true);
          const { data } = await q2;
          byPet = data ?? [];
        }
      }

      const merged = [...(byCliente ?? []), ...byPet];
      // Dedup
      const map = new Map<string, any>();
      merged.forEach((c) => map.set(c.id, c));
      const arr = Array.from(map.values());

      // Ordenar por relevância: começa com termo > contém no nome > outros
      const t = termo.toLowerCase();
      arr.sort((a, b) => {
        const an = String(a.nome ?? "").toLowerCase();
        const bn = String(b.nome ?? "").toLowerCase();
        const as = an.startsWith(t) ? 0 : an.includes(t) ? 1 : 2;
        const bs = bn.startsWith(t) ? 0 : bn.includes(t) ? 1 : 2;
        if (as !== bs) return as - bs;
        return an.localeCompare(bn);
      });
      return arr.slice(0, (page + 1) * PAGE_SIZE);
    },
  });

  // Alertas financeiros para os clientes listados (batelada)
  const clienteIdsListados = useMemo(
    () => (searching ? resultados ?? [] : recentes ?? []).map((c: any) => c.id),
    [resultados, recentes, searching],
  );

  const { data: cobrancasByCliente } = useQuery({
    queryKey: ["clientes-cobrancas", clienteIdsListados],
    enabled: clienteIdsListados.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("cobrancas")
        .select("cliente_id, saldo, status")
        .in("cliente_id", clienteIdsListados)
        .in("status", ["vencido", "a_vencer", "pago_parcial", "enviada", "respondeu", "promessa", "negociado", "sem_retorno", "pausada"]);
      const map: Record<string, { vencido: number; total: number }> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.cliente_id]) map[r.cliente_id] = { vencido: 0, total: 0 };
        const s = Number(r.saldo ?? 0);
        map[r.cliente_id].total += s;
        if (r.status === "vencido") map[r.cliente_id].vencido += s;
      });
      return map;
    },
  });

  const selecionar = (id: string | null) => {
    navigate({
      to: "/clientes",
      search: (prev: any) => ({ ...prev, sel: id ?? undefined }),
      replace: false,
    });
  };

  const podeMais = searching && (resultados?.length ?? 0) >= (page + 1) * PAGE_SIZE;

  const lista = searching ? resultados ?? [] : [];

  return (
    <PageShell>
      <PageHeader
        title="Clientes e Pets"
        description="Central de consulta: busque um cliente e abra a ficha completa."
        icon={Users}
        actions={
          <Link to="/clientes/novo">
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo cliente</Button>
          </Link>
        }
        stats={
          totalClientes != null
            ? [{ label: "Total cadastrado", value: totalClientes.toLocaleString("pt-BR") }]
            : undefined
        }
      />

      <div className={cn(
        "grid gap-4 lg:gap-6",
        "lg:grid-cols-[380px_minmax(0,1fr)]",
      )}>
        {/* -------- Coluna esquerda: busca + lista -------- */}
        <aside className={cn(
          "card-premium overflow-hidden flex flex-col",
          "min-h-[520px]",
          sel && "hidden lg:flex", // mobile: some quando ficha aberta
        )}>
          <div className="p-4 border-b border-border space-y-3 bg-muted/30">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={rawQ}
                onChange={(e) => setRawQ(e.target.value)}
                placeholder="Nome, CPF, telefone, bairro, pet, raça..."
                className="pl-9 pr-9 h-11 text-[15px]"
              />
              {rawQ && (
                <button
                  onClick={() => { setRawQ(""); setQ(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => navigate({ to: "/clientes", search: (prev: any) => ({ ...prev, vip: undefined }), replace: true })}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  !onlyVip ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border text-foreground",
                )}
              >
                Todos {totalClientes != null && <span className="opacity-70">({totalClientes})</span>}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/clientes", search: (prev: any) => ({ ...prev, vip: "1" }), replace: true })}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors inline-flex items-center justify-center gap-1",
                  onlyVip
                    ? "bg-[var(--color-gold)] text-primary border-[var(--color-gold)]"
                    : "bg-background hover:bg-[var(--color-gold)]/10 border-[var(--color-gold)]/40 text-foreground",
                )}
                title="Mostrar somente clientes marcados como VIP"
              >
                <Star className={cn("h-3.5 w-3.5", onlyVip && "fill-current")} />
                VIP {totalVip != null && <span className="opacity-80">({totalVip})</span>}
              </button>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>
                {searching
                  ? `${lista.length} resultado${lista.length === 1 ? "" : "s"}${onlyVip ? " VIP" : ""}`
                  : onlyVip
                    ? "Clientes VIP"
                    : "Cadastrados recentemente"}
              </span>
              {buscando && searching && <span className="text-primary">Buscando…</span>}
            </div>
            {onlyVip && (
              <Link
                to="/atendimentos"
                search={{ vip: "1" } as any}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
              >
                <Star className="h-3 w-3 fill-[var(--color-gold)] text-[var(--color-gold)]" />
                Ver atendimentos de clientes VIP →
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!searching && (
              <div className="divide-y">
                {(recentes ?? []).map((c: any) => (
                  <ClienteRow
                    key={c.id}
                    cliente={c}
                    selecionado={c.id === sel}
                    onClick={() => selecionar(c.id)}
                    cobranca={cobrancasByCliente?.[c.id]}
                  />
                ))}
                {(recentes ?? []).length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    {onlyVip ? "Nenhum cliente marcado como VIP." : "Nenhum cliente cadastrado ainda."}
                  </div>
                )}
              </div>
            )}

            {searching && lista.length === 0 && !buscando && (
              <div className="p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted grid place-items-center mb-3">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium text-foreground mb-1">
                  Nenhum cliente encontrado
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  Verifique o telefone, CPF ou nome digitado.
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setRawQ(""); setQ(""); }}>
                    Limpar pesquisa
                  </Button>
                  <Link
                    to="/clientes/novo"
                    search={{ nome: /[a-zA-Z]/.test(termo) ? termo : undefined, telefone: /^\d/.test(termo) ? termo : undefined } as any}
                  >
                    <Button size="sm" className="gap-1 w-full">
                      <UserPlus className="h-3.5 w-3.5" /> Cadastrar "{termo}"
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {searching && lista.length > 0 && (
              <div className="divide-y">
                {lista.map((c: any) => (
                  <ClienteRow
                    key={c.id}
                    cliente={c}
                    selecionado={c.id === sel}
                    onClick={() => selecionar(c.id)}
                    cobranca={cobrancasByCliente?.[c.id]}
                  />
                ))}
                {podeMais && (
                  <div className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Carregar mais
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* -------- Coluna direita: ficha do cliente -------- */}
        <section className={cn(
          "min-w-0",
          !sel && "hidden lg:block",
        )}>
          {sel ? (
            <FichaCliente id={sel} onVoltar={() => selecionar(null)} />
          ) : (
            <EmptyState
              icon={Users}
              title="Selecione um cliente"
              description="Busque um cliente para consultar seus dados, pets e histórico de atendimentos."
            />
          )}
        </section>
      </div>
    </PageShell>
  );
}

/* =====================================================================
   Linha compacta de resultado
   ===================================================================== */
function ClienteRow({
  cliente: c,
  selecionado,
  onClick,
  cobranca,
}: {
  cliente: any;
  selecionado: boolean;
  onClick: () => void;
  cobranca?: { vencido: number; total: number };
}) {
  const pets = c.pets ?? [];
  const firstPet = pets[0];
  const { data: petUrl } = useSignedUrl(firstPet?.foto_url ?? null);
  const contato = c.whatsapp || c.telefone;
  const vencido = cobranca?.vencido ?? 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 flex gap-3 items-start transition-colors relative",
        selecionado ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent",
      )}
    >
      <div className="shrink-0">
        {petUrl ? (
          <img src={petUrl} alt={firstPet?.nome} className="h-11 w-11 rounded-full object-cover border" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-primary/10 grid place-items-center">
            <PawPrint className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="font-display font-semibold text-sm text-primary truncate">{c.nome}</div>
          {c.vip === true && (
            <span
              title="Cliente marcado como VIP no cadastro"
              aria-label="Cliente VIP"
              className="inline-flex"
            >
              <Star className="h-3.5 w-3.5 shrink-0 text-[var(--color-gold)] fill-[var(--color-gold)]" />
            </span>
          )}
          {c.ativo === false && <Badge variant="secondary" className="text-[10px] px-1 py-0">Arquivado</Badge>}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">
          {contato && <span>{contato}</span>}
          {contato && c.bairro && <span className="mx-1.5">·</span>}
          {c.bairro && <span>{c.bairro}</span>}
        </div>
        {pets.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pets.slice(0, 3).map((p: any) => (
              <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80 truncate max-w-[110px]">
                {p.nome}
              </span>
            ))}
            {pets.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                +{pets.length - 3}
              </span>
            )}
          </div>
        )}
        {vencido > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-terracotta)]">
            <AlertTriangle className="h-3 w-3" />
            {vencido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} vencido
          </div>
        )}
      </div>
      <ChevronRight className={cn(
        "h-4 w-4 shrink-0 mt-1 transition-colors",
        selecionado ? "text-primary" : "text-muted-foreground/40",
      )} />
    </button>
  );
}

/* =====================================================================
   Ficha completa (painel direito)
   ===================================================================== */
function FichaCliente({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-ficha", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("*, pets(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: atends } = useQuery({
    queryKey: ["cliente-ficha-atends", id],
    enabled: !!data,
    queryFn: async () => {
      const petIds = (data?.pets ?? []).map((p: any) => p.id);
      if (petIds.length === 0) return [];
      const { data: rows } = await supabase
        .from("atendimentos")
        .select("id, pet_id, data_inicio, data_fim, encerrado_em, finalizado, valor_executado, pets(nome), servicos_executados, servicos_planejados")
        .in("pet_id", petIds)
        .order("encerrado_em", { ascending: false, nullsFirst: false })
        .limit(30);
      return rows ?? [];

    },
  });

  const { data: agendamentos } = useQuery({
    queryKey: ["cliente-ficha-agendamentos", id],
    enabled: !!data,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, pet_id, pets(nome)")
        .eq("cliente_id", id)
        .order("data", { ascending: false })
        .limit(20);
      return rows ?? [];
    },
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["cliente-ficha-pagamentos-v2", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("pagamentos")
        .select("id, atendimento_id, valor_total, valor_pago, forma, status, data_pagamento, vencimento, atendimentos(pet_id)")
        .eq("cliente_id", id)
        .order("data_pagamento", { ascending: false, nullsFirst: false })
        .limit(200);
      return (rows ?? []).map((r: any) => ({ ...r, valor: r.valor_total }));
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ["cliente-ficha-mensagens", id],
    enabled: !!data,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("mensagens")
        .select("id, direcao, tipo, texto, status, created_at")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      return rows ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="card-premium p-8 text-sm text-muted-foreground">Carregando ficha…</div>
    );
  }
  if (!data) {
    return (
      <div className="card-premium p-8 text-sm text-muted-foreground">Cliente não encontrado.</div>
    );
  }

  const atendsFinalizados = (atends ?? []).filter((a: any) => a.finalizado === true && a.encerrado_em);
  const totalAtend = atendsFinalizados.length;
  const datasExec = atendsFinalizados
    .map((a: any) => (a.encerrado_em ?? a.data_fim ?? "").toString().slice(0, 10))
    .filter(Boolean)
    .sort();
  const ultimaVisita = datasExec[datasExec.length - 1] as string | undefined;

  const proximas = (data.pets ?? []).map((p: any) => p.proxima_visita).filter(Boolean).sort();
  const proximaVisita = proximas[0] as string | undefined;

  const pendencias = (pagamentos ?? []).filter((p: any) => p.status === "pendente" || p.status === "parcial");
  const totalPendente = pendencias.reduce((s: number, p: any) => s + (Number(p.valor) - Number(p.valor_pago || 0)), 0);
  const totalRecebido = (pagamentos ?? [])
    .filter((p: any) => p.status === "pago" || p.status === "parcial")
    .reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);
  const vencidos = pendencias.filter((p: any) => p.vencimento && new Date(p.vencimento) < new Date());
  const totalVencido = vencidos.reduce((s: number, p: any) => s + (Number(p.valor) - Number(p.valor_pago || 0)), 0);

  const endereco = [
    [data.rua, data.numero].filter(Boolean).join(", "),
    data.bairro,
    [data.cidade, data.estado].filter(Boolean).join(" / "),
  ].filter(Boolean).join(" · ");

  const mapsUrl = data.rua
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([data.rua, data.numero, data.bairro, data.cidade, data.estado].filter(Boolean).join(", "))}`
    : null;
  const whatsappUrl = data.whatsapp ? `https://wa.me/${String(data.whatsapp).replace(/\D/g, "")}` : null;

  const initials = String(data.nome || "?").split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="card-premium overflow-hidden flex flex-col">
      {/* Voltar (mobile) */}
      <div className="lg:hidden p-3 border-b border-border bg-muted/30">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Resultados
        </Button>
      </div>

      {/* Header da ficha */}
      <header className="p-5 sm:p-7 border-b border-border">
        <div className="flex flex-wrap items-start gap-5">
          <FichaAvatar path={data.foto_url} nome={data.nome} initials={initials} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-primary truncate">
                {data.nome}
              </h2>
              {data.vip === true && (
                <span title="Cliente marcado como VIP no cadastro" className="inline-flex">
                  <StatusBadge tone="gold"><Star className="h-3 w-3" /> VIP</StatusBadge>
                </span>
              )}
              {data.ativo === false ? (
                <StatusBadge tone="muted">Arquivado</StatusBadge>
              ) : (
                <StatusBadge tone="success">Ativo</StatusBadge>
              )}
              {totalVencido > 0 && (
                <StatusBadge tone="danger">
                  <AlertTriangle className="h-3 w-3" /> {totalVencido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} vencido
                </StatusBadge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {data.telefone && <InfoLine icon={Phone} text={data.telefone} />}
              {data.whatsapp && <InfoLine icon={MessageCircle} text={data.whatsapp} />}
              {data.email && <InfoLine icon={Mail} text={data.email} />}
              {endereco && <InfoLine icon={MapPin} text={endereco} />}
              {data.created_at && (
                <InfoLine icon={Cake} text={`Cliente desde ${new Date(data.created_at).toLocaleDateString("pt-BR")}`} />
              )}
            </div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="mt-5 flex flex-wrap gap-2">
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5">
                <MapPin className="h-4 w-4" /> Maps
              </Button>
            </a>
          )}
          <Link to="/clientes/$id/editar" params={{ id }}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </Link>
          <Link to="/pets/novo" search={{ cliente: id } as any}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <PawPrint className="h-4 w-4" /> Novo pet
            </Button>
          </Link>
          <Link to="/agenda" search={{ cliente: id } as any}>
            <Button size="sm" className="gap-1.5">
              <CalendarPlus className="h-4 w-4" /> Novo agendamento
            </Button>
          </Link>
          <Link to="/pagamentos-abertos" search={{ cliente: id } as any}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <DollarSign className="h-4 w-4" /> Pagamentos
            </Button>
          </Link>
        </div>
      </header>

      {/* Abas */}
      <Tabs defaultValue="visao" className="flex-1 flex flex-col">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="h-auto bg-transparent p-0 rounded-none w-full justify-start px-4">
            {[
              ["visao", "Visão geral"],
              ["pets", `Pets${data.pets?.length ? ` (${data.pets.length})` : ""}`],
              ["agenda", "Agendamentos"],
              ["financeiro", "Financeiro"],
              ["comunicacao", "Comunicação"],
              ["historico", "Histórico"],
            ].map(([v, label]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent px-4 py-3 text-sm font-medium whitespace-nowrap"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* VISÃO GERAL */}
          <TabsContent value="visao" className="mt-0 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MiniKpi label="Pets" value={String(data.pets?.length ?? 0)} />
              <MiniKpi label="Atendimentos" value={String(totalAtend)} />
              <MiniKpi label="Última visita" value={ultimaVisita ? new Date(ultimaVisita).toLocaleDateString("pt-BR") : "—"} />
              <MiniKpi label="Próxima visita" value={proximaVisita ? new Date(proximaVisita).toLocaleDateString("pt-BR") : "—"} />
              <MiniKpi label="Total recebido" value={fmtBRL(totalRecebido)} />
              <MiniKpi
                label="Saldo pendente"
                value={fmtBRL(totalPendente)}
                tone={totalPendente > 0 ? "warn" : "default"}
              />
              {totalVencido > 0 && (
                <MiniKpi label="Vencido" value={fmtBRL(totalVencido)} tone="danger" />
              )}
            </div>
            {data.observacoes && (
              <Card className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Observações
                </div>
                <p className="text-sm whitespace-pre-wrap">{data.observacoes}</p>
              </Card>
            )}
          </TabsContent>

          {/* PETS */}
          <TabsContent value="pets" className="mt-0">
            {(data.pets ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhum pet cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.pets.map((p: any) => <PetCard key={p.id} pet={p} />)}
              </div>
            )}
          </TabsContent>

          {/* AGENDAMENTOS */}
          <TabsContent value="agenda" className="mt-0">
            {(agendamentos ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhum agendamento registrado.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {agendamentos!.map((a: any) => (
                  <div key={a.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {a.pets?.nome ?? "—"}{" "}
                        <span className="text-muted-foreground font-normal">
                          · {a.data ? new Date(a.data + "T00:00").toLocaleDateString("pt-BR") : "—"} {a.hora?.slice(0, 5) ?? ""}
                        </span>
                      </div>
                    </div>
                    <StatusBadge tone={a.status === "concluido" ? "success" : a.status === "cancelado" ? "muted" : "info"}>
                      {a.status ?? "—"}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* FINANCEIRO */}
          <TabsContent value="financeiro" className="mt-0 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniKpi label="Recebido" value={fmtBRL(totalRecebido)} />
              <MiniKpi label="Pendente" value={fmtBRL(totalPendente)} tone={totalPendente > 0 ? "warn" : "default"} />
              <MiniKpi label="Vencido" value={fmtBRL(totalVencido)} tone={totalVencido > 0 ? "danger" : "default"} />
              <MiniKpi label="Lançamentos" value={String((pagamentos ?? []).length)} />
            </div>
            {(pagamentos ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Sem lançamentos financeiros.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {pagamentos!.slice(0, 15).map((p: any) => {
                  const saldo = Number(p.valor) - Number(p.valor_pago || 0);
                  const venc = p.vencimento ? new Date(p.vencimento) : null;
                  const overdue = venc && venc < new Date() && saldo > 0;
                  return (
                    <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {fmtBRL(Number(p.valor))}
                          <span className="text-xs text-muted-foreground font-normal ml-2">· {p.forma}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.data_pagamento
                            ? `Pago em ${new Date(p.data_pagamento).toLocaleDateString("pt-BR")}`
                            : venc
                              ? `Vence em ${venc.toLocaleDateString("pt-BR")}`
                              : "—"}
                        </div>
                      </div>
                      <StatusBadge tone={p.status === "pago" ? "success" : overdue ? "danger" : "warning"}>
                        {p.status}{overdue ? " · vencido" : ""}
                      </StatusBadge>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* COMUNICAÇÃO */}
          <TabsContent value="comunicacao" className="mt-0">
            {(mensagens ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhuma mensagem registrada.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {mensagens!.map((m: any) => (
                  <div key={m.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 text-xs">
                        <StatusBadge tone={m.direcao === "saida" ? "petrol" : "info"} dot={false}>
                          {m.direcao === "saida" ? "Enviada" : "Recebida"}
                        </StatusBadge>
                        <span className="text-muted-foreground">{m.tipo}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground/90 line-clamp-3">{m.texto}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="mt-0">
            <TimelineHistorico
              atends={atends ?? []}
              agendamentos={agendamentos ?? []}
              pagamentos={pagamentos ?? []}
              mensagens={mensagens ?? []}
              cadastroEm={data.created_at}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ===================== Helpers e mini-componentes ===================== */

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InfoLine({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function MiniKpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "danger" }) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2.5",
      tone === "warn" && "bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] border-[color-mix(in_oklab,var(--color-warning)_35%,transparent)]",
      tone === "danger" && "bg-[color-mix(in_oklab,var(--color-terracotta)_10%,transparent)] border-[color-mix(in_oklab,var(--color-terracotta)_35%,transparent)]",
      tone === "default" && "bg-muted/30 border-border",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-semibold text-primary mt-0.5 truncate">{value}</div>
    </div>
  );
}

function FichaAvatar({ path, nome, initials }: { path?: string | null; nome: string; initials: string }) {
  const { data: url } = useSignedUrl(path ?? null);
  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover border-2 border-[color-mix(in_oklab,var(--color-gold)_35%,transparent)] shadow-sm shrink-0"
      />
    );
  }
  return (
    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-primary/10 grid place-items-center text-primary font-display text-2xl shrink-0 border-2 border-[color-mix(in_oklab,var(--color-gold)_35%,transparent)]">
      {initials || "?"}
    </div>
  );
}

function PetCard({ pet }: { pet: any }) {
  const { data: fotoUrl } = useSignedUrl(pet.foto_url);
  return (
    <div className="rounded-lg border border-border p-4 hover:shadow-elegant hover:-translate-y-0.5 transition h-full bg-background flex flex-col">
      <Link to="/pets/$petId/ficha" params={{ petId: pet.id }} className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          {fotoUrl ? (
            <img src={fotoUrl} alt={pet.nome} className="h-12 w-12 rounded-full object-cover border" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
              <PawPrint className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold text-primary truncate">{pet.nome}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[pet.raca, pet.porte].filter(Boolean).join(" · ")}
            </div>
          </div>
          {pet.necessita_focinheira && <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0" />}
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
          {pet.sexo && <span>{pet.sexo}</span>}
          {pet.peso && <span>{pet.peso} kg</span>}
          {pet.ultimo_banho && <span>Banho: {new Date(pet.ultimo_banho).toLocaleDateString("pt-BR")}</span>}
          {pet.proxima_visita && <span>Próx: {new Date(pet.proxima_visita).toLocaleDateString("pt-BR")}</span>}
        </div>
        {(pet.alergias || pet.cuidados_saude) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {pet.alergias && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color-mix(in_oklab,var(--color-warning)_15%,transparent)] text-[color-mix(in_oklab,var(--color-warning)_50%,var(--color-foreground))]">
                Alergia
              </span>
            )}
            {pet.cuidados_saude && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color-mix(in_oklab,var(--color-terracotta)_12%,transparent)] text-[var(--color-terracotta)]">
                Cuidados
              </span>
            )}
          </div>
        )}
      </Link>
      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
        <Link to="/pets/$petId/ficha" params={{ petId: pet.id }} className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline">
          <FileText className="h-3 w-3" /> Abrir ficha
        </Link>
        <Link to="/pets/$petId/historico" params={{ petId: pet.id }}>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] px-2">
            <History className="h-3 w-3" /> Histórico
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ===================== Timeline de histórico ===================== */

type EventoTimeline = {
  when: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  icon: any;
  tone: "info" | "success" | "warning" | "danger" | "muted";
};

function TimelineHistorico({
  atends, agendamentos, pagamentos, mensagens, cadastroEm,
}: {
  atends: any[]; agendamentos: any[]; pagamentos: any[]; mensagens: any[]; cadastroEm?: string;
}) {
  const eventos: EventoTimeline[] = [];

  if (cadastroEm) {
    eventos.push({
      when: cadastroEm, tipo: "cadastro",
      titulo: "Cliente cadastrado",
      icon: UserPlus, tone: "info",
    });
  }

  atends.forEach((a) => {
    const when = a.encerrado_em ?? a.data_fim ?? a.data_inicio;
    if (!when || a.finalizado !== true) return;
    eventos.push({
      when,
      tipo: "atendimento",
      titulo: `Atendimento · ${a.pets?.nome ?? ""}`,
      descricao: a.valor_executado ? fmtBRL(Number(a.valor_executado)) : undefined,
      icon: ClipboardList, tone: "success",
    });
  });


  agendamentos.forEach((a) => {
    if (!a.data) return;
    eventos.push({
      when: a.data,
      tipo: "agendamento",
      titulo: `Agendamento · ${a.pets?.nome ?? ""}`,
      descricao: `${a.hora?.slice(0, 5) ?? ""} · ${a.status ?? ""}`,
      icon: CalendarPlus,
      tone: a.status === "cancelado" ? "muted" : "info",
    });
  });

  pagamentos.forEach((p) => {
    if (!p.data_pagamento && !p.vencimento) return;
    eventos.push({
      when: p.data_pagamento || p.vencimento,
      tipo: "pagamento",
      titulo: `Pagamento · ${fmtBRL(Number(p.valor))}`,
      descricao: `${p.forma} · ${p.status}`,
      icon: DollarSign,
      tone: p.status === "pago" ? "success" : "warning",
    });
  });

  mensagens.forEach((m) => {
    eventos.push({
      when: m.created_at,
      tipo: "mensagem",
      titulo: `Mensagem ${m.direcao === "saida" ? "enviada" : "recebida"}`,
      descricao: m.texto?.slice(0, 80),
      icon: MessageSquare, tone: "info",
    });
  });

  eventos.sort((a, b) => (a.when < b.when ? 1 : -1));

  if (eventos.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8">Sem histórico ainda.</div>;
  }

  return (
    <ol className="relative border-l-2 border-border/60 pl-5 space-y-4">
      {eventos.slice(0, 40).map((e, i) => {
        const Icon = e.icon;
        return (
          <li key={i} className="relative">
            <span className={cn(
              "absolute -left-[27px] top-0.5 h-4 w-4 rounded-full border-2 border-background grid place-items-center",
              e.tone === "success" && "bg-[var(--color-emerald)]",
              e.tone === "warning" && "bg-[var(--color-warning)]",
              e.tone === "danger" && "bg-[var(--color-terracotta)]",
              e.tone === "muted" && "bg-muted-foreground",
              e.tone === "info" && "bg-primary",
            )} />
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{e.titulo}</span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(e.when).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {e.descricao && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.descricao}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
