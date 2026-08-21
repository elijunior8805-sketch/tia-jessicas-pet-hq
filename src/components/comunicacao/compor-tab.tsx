import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Sparkles, Loader2, Send, Copy, Wand2, MessageSquare, 
  ArrowRight, ShieldAlert, AlertTriangle, Clock
} from "lucide-react";
import { gerar3AbordagensIA, registrarComunicacao } from "@/lib/comunicacao-central.functions";
import { abrirWhatsAppBusiness } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Cliente = { id: string; nome: string; whatsapp: string | null; tom_preferido: string | null; opt_out_comunicacao: boolean };
type Pet = { id: string; nome: string; cliente_id: string };

export function ComporTab({ clientes, pets }: { clientes: Cliente[]; pets: Pet[] }) {
  const gerar3Fn = useServerFn(gerar3AbordagensIA);
  const registrarFn = useServerFn(registrarComunicacao);

  const [clienteId, setClienteId] = useState("");
  const [petId, setPetId] = useState("");
  const [objetivo, setObjetivo] = useState<any>("cobranca");
  const [contexto, setContexto] = useState("");
  const [versoes, setVersoes] = useState<any[]>([]);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [editada, setEditada] = useState("");

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const petsDoCliente = useMemo(() => pets.filter((p) => !clienteId || p.cliente_id === clienteId), [pets, clienteId]);
  
  const gerarMut = useMutation({
    mutationFn: () => {
      if (!clienteId) throw new Error("Selecione um cliente");
      return gerar3Fn({
        data: {
          clienteId,
          petId: petId || null,
          objetivo,
          contextoManual: contexto,
        }
      });
    },
    onSuccess: (data: any) => {
      setVersoes(data.versoes || []);
      setSelecionada(null);
      setEditada("");
      toast.success("IA gerou 3 abordagens distintas.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar abordagens"),
  });

  const enviarMut = useMutation({
    mutationFn: async () => {
      if (!cliente || !editada) return;
      
      await registrarFn({
        data: {
          clienteId: cliente.id,
          corpo: editada,
          tomEscolhido: selecionada !== null ? versoes[selecionada]?.tom : "personalizado",
          canal: "whatsapp",
          tipo: objetivo,
          textoEditado: editada,
        }
      });
      
      abrirWhatsAppBusiness(cliente.whatsapp || "", editada);
    },
    onSuccess: () => {
      toast.success("Registrado e WhatsApp aberto.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar envio"),
  });

  const handleSelect = (idx: number) => {
    setSelecionada(idx);
    setEditada(versoes[idx].texto);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna 1: Configuração */}
        <Card className="p-5 space-y-4 lg:col-span-1 border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-primary">Compositor IA</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setPetId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.opt_out_comunicacao ? "🚫" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Pet (opcional)</Label>
              <Select value={petId} onValueChange={setPetId} disabled={!clienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione o pet" /></SelectTrigger>
                <SelectContent>
                  {petsDoCliente.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Objetivo</Label>
              <Select value={objetivo} onValueChange={setObjetivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                  <SelectItem value="lembrete">Lembrete de Banho</SelectItem>
                  <SelectItem value="reativacao">Reativação (Sumido)</SelectItem>
                  <SelectItem value="aniversario">Aniversário</SelectItem>
                  <SelectItem value="outro">Outro Contexto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Contexto Livre (Opcional)</Label>
              <Textarea 
                placeholder="Ex: A Mel estava muito feliz hoje no banho! Avise que ela já está pronta."
                rows={4}
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={() => gerarMut.mutate()} 
              disabled={gerarMut.isPending || !clienteId || cliente?.opt_out_comunicacao}
            >
              {gerarMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Gerar 3 Abordagens
            </Button>

            {cliente?.opt_out_comunicacao && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-700">
                  Este cliente ativou o opt-out. O envio de mensagens automáticas ou IA está bloqueado por LGPD.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Coluna 2 & 3: Resultado */}
        <div className="lg:col-span-2 space-y-6">
          {versoes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {versoes.map((v, i) => (
                <Card 
                  key={i} 
                  className={`p-4 cursor-pointer transition-all border-2 ${
                    selecionada === i ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-transparent hover:border-primary/20"
                  } ${v.bloqueada ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => !v.bloqueada && handleSelect(i)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {v.tom}
                    </Badge>
                    {selecionada === i && <Sparkles className="h-3 w-3 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-6 italic leading-relaxed">
                    "{v.texto}"
                  </p>
                  {v.bloqueada && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-rose-600">
                      <AlertTriangle className="h-3 w-3" /> Termos bloqueados
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-2xl">
              <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">Configure o cliente e objetivo para gerar abordagens</p>
            </div>
          )}

          {selecionada !== null && (
            <Card className="p-6 border-primary/20 bg-emerald-50/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary/10 p-2 rounded-full text-primary">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">Revisão Final</h3>
                  <p className="text-xs text-muted-foreground">Edite o texto se necessário antes de enviar.</p>
                </div>
              </div>

              <Textarea 
                value={editada}
                onChange={(e) => setEditada(e.target.value)}
                rows={6}
                className="bg-white text-base shadow-sm mb-4"
              />

              <div className="flex items-center justify-between gap-4">
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(editada);
                  toast.success("Copiado!");
                }}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar
                </Button>
                
                <Button 
                  className="flex-1"
                  onClick={() => enviarMut.mutate()}
                  disabled={enviarMut.isPending || !editada || !cliente?.whatsapp}
                >
                  {enviarMut.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar para {primeiroNome(cliente?.nome)}
                </Button>
              </div>
            </Card>
          )}

          {/* Histórico Recente Rápido */}
          {clienteId && (
            <div className="pt-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Últimos contatos
              </p>
              <UltimosContatos clienteId={clienteId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UltimosContatos({ clienteId }: { clienteId: string }) {
  const { data: msgs, isLoading } = useQuery({
    queryKey: ["cliente-historico-rapido", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("corpo, created_at, direcao")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(2);
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  if (isLoading) return <div className="h-10 animate-pulse bg-muted rounded-lg" />;
  if (!msgs?.length) return <p className="text-xs text-muted-foreground italic">Sem histórico recente.</p>;

  return (
    <div className="space-y-2">
      {(msgs || []).map((m: any, i: number) => (
        <div key={i} className={`p-2 rounded-lg text-[11px] ${m.direcao === 'out' ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'}`}>
          <div className="flex justify-between text-[10px] mb-1 opacity-70">
            <span>{m.direcao === 'out' ? 'Nós' : 'Cliente'}</span>
            <span>{new Date(m.created_at).toLocaleDateString()}</span>
          </div>
          <p className="line-clamp-2">{m.corpo}</p>
        </div>
      ))}
    </div>
  );
}

function primeiroNome(v: string | null | undefined) {
  return (v ?? "").trim().split(/\s+/)[0] ?? "";
}
