import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Clock, Send, Copy, CheckCircle2, AlertTriangle, ShieldAlert,
  MessageSquare, Wand2, CalendarClock,
} from "lucide-react";
import {
  listarFilaProativa, adiarSugestao, resolverSugestao,
  gerarCobrancaIA, refinarMensagem, registrarComunicacao, salvarPromessa,
} from "@/lib/comunicacao-central.functions";
import { abrirWhatsAppBusiness } from "@/lib/whatsapp";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const PRIO_STYLE: Record<string, string> = {
  critica: "bg-rose-100 text-rose-800 border-rose-200",
  alta: "bg-amber-100 text-amber-900 border-amber-200",
  media: "bg-sky-100 text-sky-900 border-sky-200",
  baixa: "bg-muted text-muted-foreground border-border",
};

const TONS = [
  { v: "carinhoso", l: "Carinhoso" },
  { v: "amigavel", l: "Amigável" },
  { v: "neutro", l: "Neutro" },
  { v: "profissional", l: "Profissional" },
  { v: "firme_respeitoso", l: "Firme e respeitoso" },
  { v: "formal", l: "Formal" },
];

export function FilaProativaTab() {
  const qc = useQueryClient();
  const filaFn = useServerFn(listarFilaProativa);
  const adiarFn = useServerFn(adiarSugestao);
  const resolverFn = useServerFn(resolverSugestao);

  const [filtro, setFiltro] = useState<string>("todas");
  const [aberta, setAberta] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["comunicacao", "fila-proativa"],
    queryFn: () => filaFn(),
    refetchInterval: 60_000,
  });

  const adiarM = useMutation({
    mutationFn: (p: { id: string; horas: number }) => adiarFn({ data: p }),
    onSuccess: () => {
      toast.success("Contato adiado.");
      qc.invalidateQueries({ queryKey: ["comunicacao"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível adiar."),
  });

  const resolverM = useMutation({
    mutationFn: (p: { id: string; resultado?: string }) => resolverFn({ data: p }),
    onSuccess: () => {
      toast.success("Marcado como resolvido.");
      qc.invalidateQueries({ queryKey: ["comunicacao"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível resolver."),
  });

  const linhas = ((q.data as any[]) ?? []).filter((s) => {
    if (filtro === "todas") return true;
    if (filtro === "hoje") return !s._adiada;
    if (filtro === "adiadas") return s._adiada;
    return s._prioridade_label === filtro;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["todas", "Todas"], ["hoje", "Para hoje"], ["critica", "Crítica"],
          ["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"], ["adiadas", "Adiadas"],
        ].map(([v, l]) => (
          <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"}
            onClick={() => setFiltro(v as string)}>
            {l}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          {linhas.length} item(ns) — ordenados por prioridade real
        </span>
      </div>

      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : linhas.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum contato pendente com esse filtro. 🐾
        </Card>
      ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente / Pet</th>
                  <th className="px-4 py-3 text-left font-medium">Motivo</th>
                  <th className="px-4 py-3 text-left font-medium">Prioridade</th>
                  <th className="px-4 py-3 text-left font-medium">Valores</th>
                  <th className="px-4 py-3 text-left font-medium">Último Contato</th>
                  <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((s) => (
                  <tr key={s.id} className={`${s._adiada ? "opacity-60 bg-muted/20" : "hover:bg-muted/5 transition-colors"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[150px]">{s.clientes?.nome ?? "Cliente"}</div>
                      {s.pets?.nome && <div className="text-[10px] text-muted-foreground italic">{s.pets.nome}</div>}
                      {s.clientes?.opt_out_comunicacao && (
                        <Badge variant="outline" className="mt-1 border-rose-200 text-rose-700 text-[9px] h-4">
                          LGPD 🚫
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs line-clamp-2 max-w-[200px]" title={s.motivo}>{s.motivo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`${PRIO_STYLE[s._prioridade_label] ?? ""} text-[10px] h-5`}>
                        {String(s._prioridade_label).toUpperCase()}
                      </Badge>
                      {s._promessa_vencida && <div className="text-[9px] text-rose-600 font-bold mt-1">QUEBRA DE PROMESSA</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-xs">{brl(s._valor_pendente)}</div>
                      {s._dias_atraso > 0 && <div className="text-[10px] text-muted-foreground">{s._dias_atraso}d atraso</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s._ultima_comunicacao ? new Date(s._ultima_comunicacao).toLocaleDateString() : "Nunca"}
                      {s._sem_resposta && <div className="text-amber-600 text-[9px] font-medium mt-0.5">SILÊNCIO +48H</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-primary"
                          onClick={() => setAberta(s)}
                          disabled={s.clientes?.opt_out_comunicacao}
                          title="Gerar Mensagem IA"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => adiarM.mutate({ id: s.id, horas: 24 })}
                          title="Adiar 24h"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-emerald-600"
                          onClick={() => resolverM.mutate({ id: s.id, resultado: "Resolvido manualmente" })}
                          title="Marcar como resolvido"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}

      {aberta ? (
        <GeradorCobrancaDialog
          sugestao={aberta}
          onClose={() => setAberta(null)}
        />
      ) : null}
    </div>
  );
}

export function GeradorCobrancaDialog({
  sugestao, onClose,
}: { sugestao: any; onClose: () => void }) {
  const qc = useQueryClient();
  const gerarFn = useServerFn(gerarCobrancaIA);
  const refinarFn = useServerFn(refinarMensagem);
  const registrarFn = useServerFn(registrarComunicacao);
  const promessaFn = useServerFn(salvarPromessa);

  const [texto, setTexto] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [tom, setTom] = useState<string>(sugestao._tom_sugerido ?? "amigavel");
  const [firmeza, setFirmeza] = useState<number>(2);
  const [tamanho, setTamanho] = useState<"curta" | "media" | "detalhada">("curta");
  const [emojis, setEmojis] = useState(true);
  const [citarPet, setCitarPet] = useState(true);
  const [incluirValor, setIncluirValor] = useState(true);
  const [incluirPix, setIncluirPix] = useState(true);
  const [permitirNegociacao, setPermitirNegociacao] = useState(true);
  const [instrucao, setInstrucao] = useState("");
  const [promessaData, setPromessaData] = useState("");
  const [promessaValor, setPromessaValor] = useState<string>("");
  const [geracaoMs, setGeracaoMs] = useState<number | null>(null);
  const [aprovado, setAprovado] = useState(false);

  const podeIA = !!sugestao.cobranca_id;

  const gerarM = useMutation({
    mutationFn: async () => {
      const t0 = Date.now();
      const r = await gerarFn({
        data: {
          cobrancaId: sugestao.cobranca_id,
          opcoes: {
            tom, firmeza, tamanho, emojis, citarPet, incluirValor,
            incluirPix, permitirNegociacao, canal: "whatsapp",
          },
          instrucaoExtra: instrucao || null,
        },
      });
      setGeracaoMs(Date.now() - t0);
      return r;
    },
    onSuccess: (r: any) => {
      setTexto(r.mensagem ?? "");
      setMeta(r);
      setAprovado(false);
      if (r.alerta) toast.warning(r.alerta);
    },
    onError: (e: any) => toast.error(e?.message ?? "A IA não conseguiu gerar agora."),
  });

  const refinarM = useMutation({
    mutationFn: (acao: string) => refinarFn({ data: { texto, acao: acao as any } }),
    onSuccess: (r: any) => setTexto(r.texto ?? texto),
    onError: () => toast.error("Não foi possível refinar o texto."),
  });

  const enviarM = useMutation({
    mutationFn: async () => {
      await registrarFn({
        data: {
          clienteId: sugestao.cliente_id,
          corpo: texto,
          mensagemIaOriginal: meta?.mensagem ?? null,
          tomSugerido: sugestao._tom_sugerido ?? null,
          tomEscolhido: tom,
          nivelFirmeza: firmeza,
          modeloIa: meta?.modelo ?? null,
          canal: "whatsapp",
          tipo: sugestao.tipo ?? "cobranca",
          cobrancaId: sugestao.cobranca_id ?? null,
          sugestaoId: sugestao.id ?? null,
          textoEditado: meta?.mensagem && meta.mensagem !== texto ? texto : null,
          tempoGeracaoMs: geracaoMs,
          tokensEstimados: Math.round((texto?.length ?? 0) / 4),
          contextoIa: {
            tom, firmeza, tamanho, emojis, citarPet, incluirValor,
            incluirPix, permitirNegociacao,
            instrucao: instrucao || null,
            revisadoManualmente: !!meta?.mensagem && meta.mensagem !== texto,
          },
        },
      });
      if (promessaData) {
        await promessaFn({
          data: {
            clienteId: sugestao.cliente_id,
            cobrancaId: sugestao.cobranca_id ?? null,
            valorPrometido: Number(promessaValor || sugestao._valor_pendente || 0),
            dataPrometida: promessaData,
            status: "aguardando",
            valorRecebido: 0,
          },
        });
      }
    },
    onSuccess: () => {
      const fone = sugestao.clientes?.whatsapp ?? "";
      if (fone) abrirWhatsAppBusiness(fone, texto);
      toast.success("Registrado no histórico do cliente.");
      qc.invalidateQueries({ queryKey: ["comunicacao"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Gerar mensagem — {sugestao.clientes?.nome}
          </DialogTitle>
          <DialogDescription>
            A IA sugere; você revisa e aprova. Nada é enviado sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tom</Label>
              <Select value={tom} onValueChange={setTom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
              {sugestao._motivo_do_tom ? (
                <p className="text-[11px] text-muted-foreground">Sugerido: {sugestao._motivo_do_tom}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nível de firmeza: {firmeza}</Label>
              <Slider min={1} max={5} step={1} value={[firmeza]}
                onValueChange={(v) => setFirmeza(v[0] ?? 2)} />
              <p className="text-[11px] text-muted-foreground">1 = bem gentil · 5 = firme (sempre respeitoso)</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tamanho</Label>
              <Select value={tamanho} onValueChange={(v) => setTamanho(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="curta">Curta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="detalhada">Detalhada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-5">
              <Toggle label="Emojis" v={emojis} set={setEmojis} />
              <Toggle label="Citar pet" v={citarPet} set={setCitarPet} />
              <Toggle label="Valor" v={incluirValor} set={setIncluirValor} />
              <Toggle label="Pix" v={incluirPix} set={setIncluirPix} />
              <Toggle label="Negociar" v={permitirNegociacao} set={setPermitirNegociacao} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Instrução extra (opcional)</Label>
            <Input value={instrucao} onChange={(e) => setInstrucao(e.target.value)}
              placeholder="Ex.: lembrar que ela pediu para avisar depois do dia 10" />
          </div>

          <Button onClick={() => gerarM.mutate()} disabled={!podeIA || gerarM.isPending} className="w-full">
            {gerarM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {texto ? "Gerar outra versão" : "Gerar com IA"}
          </Button>
          {!podeIA ? (
            <p className="text-[11px] text-muted-foreground">
              Esta sugestão não está ligada a uma cobrança — escreva a mensagem manualmente abaixo.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem (edite à vontade)</Label>
            <Textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="A mensagem gerada aparece aqui para sua revisão." />
            <div className="flex flex-wrap gap-1.5">
              {[
                ["mais_gentil", "Mais gentil"],
                ["mais_cordial", "Mais cordial"],
                ["mais_direta", "Mais direta"],
                ["mais_firme", "Mais firme"],
                ["mais_humano", "Mais humano"],
                ["citar_pet", "Mencionar o pet"],
                ["sem_valor", "Sem citar valor"],
                ["incluir_vencimento", "Incluir vencimento"],
                ["acolhedor", "Acolhedor"],
                ["resumir", "Resumir"],
                ["corrigir", "Corrigir"],
              ].map(([a, l]) => (
                <Button key={a} size="sm" variant="outline" className="h-7 text-xs px-2.5 rounded-lg" disabled={!texto || refinarM.isPending}
                  onClick={() => refinarM.mutate(a as string)}>
                  {refinarM.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : l}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg" disabled={!texto}
                onClick={() => { navigator.clipboard.writeText(texto); toast.success("Copiado para a área de transferência."); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            {meta?.alerta ? (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {meta.alerta}
              </p>
            ) : null}
            {meta?.modelo ? (
              <p className="text-[11px] text-muted-foreground">Gerado por {meta.modelo}</p>
            ) : null}
          </div>

          <Card className="p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Registrar promessa de pagamento (opcional)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={promessaData} onChange={(e) => setPromessaData(e.target.value)} />
              <Input type="number" step="0.01" placeholder={brl(sugestao._valor_pendente ?? 0)}
                value={promessaValor} onChange={(e) => setPromessaValor(e.target.value)} />
            </div>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted-foreground mr-auto cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={aprovado}
              onChange={(e) => setAprovado(e.target.checked)}
            />
            Li e aprovo o texto acima
          </label>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => enviarM.mutate()} disabled={!texto.trim() || !aprovado || enviarM.isPending}>
            {enviarM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Aprovar e abrir WhatsApp
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, v, set }: { label: string; v: boolean; set: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Switch checked={v} onCheckedChange={set} />
      {label}
    </label>
  );
}
