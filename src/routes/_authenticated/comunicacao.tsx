import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  MessageCircle,
  Cake,
  AlarmClock,
  History,
  Loader2,
  Copy,
  Wand2,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sugerirMensagemWhatsApp } from "@/lib/comunicacao.functions";

export const Route = createFileRoute("/_authenticated/comunicacao")({
  component: ComunicacaoPage,
});

// -------- helpers --------
function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D+/g, "");
}
function waPhone(v: string | null | undefined) {
  const d = onlyDigits(v);
  if (!d) return "";
  if (d.length <= 11) return `55${d}`;
  return d;
}
function openWa(phone: string, text: string) {
  const p = waPhone(phone);
  if (!p) {
    toast.error("Cliente sem WhatsApp cadastrado");
    return;
  }
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`, "_blank");
}
function primeiroNome(v: string | null | undefined) {
  return (v ?? "").trim().split(/\s+/)[0] ?? "";
}

type Cliente = { id: string; nome: string; whatsapp: string | null };
type Pet = {
  id: string;
  nome: string;
  cliente_id: string;
  data_nascimento: string | null;
  proxima_visita: string | null;
  ultimo_banho: string | null;
  clientes: { id: string; nome: string; whatsapp: string | null } | null;
};

function ComunicacaoPage() {
  // ---- data ----
  const clientesQ = useQuery({
    queryKey: ["comunicacao", "clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, whatsapp")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const petsQ = useQuery({
    queryKey: ["comunicacao", "pets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select(
          "id, nome, cliente_id, data_nascimento, proxima_visita, ultimo_banho, clientes(id, nome, whatsapp)",
        )
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Pet[];
    },
  });

  const recibosQ = useQuery({
    queryKey: ["comunicacao", "recibos-enviados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recibos_enviados")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- IA compose state ----
  const [clienteId, setClienteId] = useState<string>("");
  const [petId, setPetId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("lembrete_agendamento");
  const [tom, setTom] = useState<string>("carinhoso");
  const [contexto, setContexto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [gerando, setGerando] = useState(false);

  const sugerir = useServerFn(sugerirMensagemWhatsApp);

  const petsDoCliente = useMemo(
    () => (petsQ.data ?? []).filter((p) => !clienteId || p.cliente_id === clienteId),
    [petsQ.data, clienteId],
  );

  const clienteSel = clientesQ.data?.find((c) => c.id === clienteId);
  const petSel = petsQ.data?.find((p) => p.id === petId);

  async function gerar() {
    if (!clienteSel) {
      toast.error("Selecione um cliente");
      return;
    }
    setGerando(true);
    try {
      const r = await sugerir({
        data: {
          tipo: tipo as any,
          tom: tom as any,
          clienteNome: primeiroNome(clienteSel.nome) || clienteSel.nome,
          petNome: petSel?.nome ?? null,
          contexto: contexto || null,
        },
      });
      setMensagem(r.mensagem);
    } catch (e: any) {
      toast.error("Não foi possível gerar", { description: e?.message });
    } finally {
      setGerando(false);
    }
  }

  function enviar() {
    if (!clienteSel?.whatsapp) {
      toast.error("Este cliente não possui WhatsApp");
      return;
    }
    if (!mensagem.trim()) {
      toast.error("Escreva ou gere uma mensagem");
      return;
    }
    openWa(clienteSel.whatsapp, mensagem);
  }

  // ---- sugestões inteligentes ----
  const hoje = new Date();
  const sugestoes = useMemo(() => {
    const pets = petsQ.data ?? [];
    const aniversarios = pets
      .filter((p) => p.data_nascimento)
      .map((p) => {
        const dn = parseISO(p.data_nascimento!);
        const aniv = new Date(hoje.getFullYear(), dn.getMonth(), dn.getDate());
        const diff = differenceInDays(aniv, hoje);
        return { pet: p, diasAte: diff };
      })
      .filter((x) => x.diasAte >= 0 && x.diasAte <= 7)
      .sort((a, b) => a.diasAte - b.diasAte);

    const atrasados = pets
      .filter((p) => p.proxima_visita)
      .map((p) => ({
        pet: p,
        diasAtraso: differenceInDays(hoje, parseISO(p.proxima_visita!)),
      }))
      .filter((x) => x.diasAtraso > 0)
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 20);

    return { aniversarios, atrasados };
  }, [petsQ.data]);

  function usarSugestao(pet: Pet, tipoSugerido: string) {
    setClienteId(pet.cliente_id);
    setPetId(pet.id);
    setTipo(tipoSugerido);
    setMensagem("");
    toast.success("Cliente e pet carregados no compositor");
    document.getElementById("compositor")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <PageShell>
      <PageHeader
        title="Comunicação e IA"
        description="Mensagens WhatsApp com sugestões inteligentes."
      />

      <Tabs defaultValue="compor" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compor">
            <Wand2 className="h-4 w-4 mr-2" /> Compor
          </TabsTrigger>
          <TabsTrigger value="sugestoes">
            <Sparkles className="h-4 w-4 mr-2" /> Sugestões
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* -------- Compor -------- */}
        <TabsContent value="compor">
          <div id="compositor" className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Card className="p-6 rounded-2xl border-border/60 space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-primary">
                    Assistente de mensagem
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    A IA sugere; você revisa e envia.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setPetId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(clientesQ.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pet (opcional)</Label>
                  <Select value={petId} onValueChange={setPetId} disabled={!clienteId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {petsDoCliente.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lembrete_agendamento">Lembrete de agendamento</SelectItem>
                      <SelectItem value="confirmacao">Confirmação</SelectItem>
                      <SelectItem value="retorno_atrasado">Retorno atrasado</SelectItem>
                      <SelectItem value="aniversario">Aniversário do pet</SelectItem>
                      <SelectItem value="aviso_encerramento">Aviso de encerramento</SelectItem>
                      <SelectItem value="agradecimento">Agradecimento</SelectItem>
                      <SelectItem value="reengajamento">Reengajamento</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tom</Label>
                  <Select value={tom} onValueChange={setTom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carinhoso">Carinhoso</SelectItem>
                      <SelectItem value="cordial">Cordial</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="descontraido">Descontraído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Contexto adicional (opcional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Ex.: horário 14h de sábado; oferecer combo banho + tosa higiênica."
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                />
              </div>

              <Button onClick={gerar} disabled={gerando || !clienteId} className="w-full">
                {gerando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar sugestão</>}
              </Button>
            </Card>

            <Card className="p-6 rounded-2xl border-border/60 space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-xl font-semibold text-primary">
                    Prévia da mensagem
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {clienteSel ? clienteSel.nome : "Selecione um cliente"}
                    {petSel ? ` · ${petSel.nome}` : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4 min-h-[180px]">
                <div className="rounded-2xl bg-white shadow-sm p-3 text-sm whitespace-pre-wrap">
                  {mensagem || <span className="text-muted-foreground">A mensagem aparecerá aqui…</span>}
                </div>
              </div>

              <Textarea
                rows={5}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Edite o texto antes de enviar…"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(mensagem); toast.success("Copiado"); }}
                  disabled={!mensagem}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copiar
                </Button>
                <Button onClick={enviar} disabled={!mensagem || !clienteSel?.whatsapp} className="flex-1 min-w-[160px]">
                  <Send className="h-4 w-4 mr-2" /> Enviar por WhatsApp
                </Button>
              </div>
              {clienteSel && !clienteSel.whatsapp && (
                <p className="text-xs text-destructive">Este cliente não tem WhatsApp cadastrado.</p>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* -------- Sugestões -------- */}
        <TabsContent value="sugestoes">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6 rounded-2xl border-border/60">
              <div className="flex items-center gap-3 mb-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Cake className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-primary">Aniversários próximos</h2>
                  <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
                </div>
              </div>
              {sugestoes.aniversarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aniversário próximo.</p>
              ) : (
                <ul className="space-y-2">
                  {sugestoes.aniversarios.map(({ pet, diasAte }) => (
                    <li key={pet.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{pet.nome} <span className="text-muted-foreground text-xs">· {pet.clientes?.nome}</span></div>
                        <div className="text-xs text-muted-foreground">
                          {diasAte === 0 ? "Hoje!" : `Em ${diasAte} dia(s)`}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => usarSugestao(pet, "aniversario")}>
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6 rounded-2xl border-border/60">
              <div className="flex items-center gap-3 mb-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-700">
                  <AlarmClock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-primary">Retornos atrasados</h2>
                  <p className="text-xs text-muted-foreground">Pets com visita agendada vencida</p>
                </div>
              </div>
              {sugestoes.atrasados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum retorno atrasado. 🎉</p>
              ) : (
                <ul className="space-y-2">
                  {sugestoes.atrasados.map(({ pet, diasAtraso }) => (
                    <li key={pet.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{pet.nome} <span className="text-muted-foreground text-xs">· {pet.clientes?.nome}</span></div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{diasAtraso}d</Badge>
                          desde {format(parseISO(pet.proxima_visita!), "dd/MM", { locale: ptBR })}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => usarSugestao(pet, "retorno_atrasado")}>
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* -------- Histórico -------- */}
        <TabsContent value="historico">
          <Card className="p-6 rounded-2xl border-border/60">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-primary">Últimos envios</h2>
                <p className="text-xs text-muted-foreground">Recibos e comprovantes enviados</p>
              </div>
            </div>
            {(recibosQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {(recibosQ.data ?? []).map((r: any) => (
                  <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.contraparte ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.tipo ? <Badge variant="secondary" className="mr-2">{r.tipo}</Badge> : null}
                        {r.created_at && format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    {r.signed_url && (
                      <a href={r.signed_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline shrink-0">
                        Ver PDF
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
