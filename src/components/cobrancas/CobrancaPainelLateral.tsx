import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  obterDossieCobranca, 
  registrarPromessaAvancada 
} from "@/lib/cobrancas-advanced.functions";
import { registrarEnvio, sugerirMensagemCobranca } from "@/lib/cobrancas.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  HandCoins, 
  MessageCircle, 
  History, 
  CalendarClock, 
  Sparkles,
  Phone,
  User,
  Dog,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openWhatsAppComposerGlobal } from "@/components/whatsapp-composer";

interface Props {
  cobrancaId: string | null;
  onClose: () => void;
}

export function CobrancaPainelLateral({ cobrancaId, onClose }: Props) {
  const obterDossie = useServerFn(obterDossieCobranca);
  const registrarPromessa = useServerFn(registrarPromessaAvancada);
  const registrarEv = useServerFn(registrarEnvio);
  const sugerir = useServerFn(sugerirMensagemCobranca);

  const [aba, setAba] = useState("contexto");
  const [mensagem, setMensagem] = useState("");
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [promessaData, setPromessaData] = useState("");
  const [promessaValor, setPromessaValor] = useState("");

  const { data: dossie, isLoading, refetch } = useQuery({
    queryKey: ["cobranca-dossie", cobrancaId],
    queryFn: () => cobrancaId ? obterDossie({ data: { cobrancaId } }) : null,
    enabled: !!cobrancaId,
  });

  if (!cobrancaId) return null;

  const cob = dossie?.cobranca as any;
  const cliente = cob?.clientes;
  const pet = cob?.atendimentos?.pets;


  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  const handleSugerirIA = async (tom: any) => {
    setCarregandoIA(true);
    try {
      const r = await sugerir({ data: { cobrancaId, intencao: tom } });
      setMensagem(r.mensagem);
      setAba("compor");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar sugestão");
    } finally {
      setCarregandoIA(false);
    }
  };

  const handleRegistrarPromessa = async () => {
    if (!promessaData || !promessaValor) {
      toast.error("Preencha data e valor da promessa");
      return;
    }
    try {
      await registrarPromessa({
        data: {
          cobrancaId,
          valor: Number(promessaValor),
          dataPrometida: promessaData,
        }
      });
      toast.success("Promessa registrada com sucesso");
      refetch();
      setPromessaData("");
      setPromessaValor("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar promessa");
    }
  };

  const handleWhatsApp = () => {
    if (!cliente?.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    openWhatsAppComposerGlobal({
      tipo: "cobranca_vencida",
      destinatario: cliente.nome,
      telefone: cliente.whatsapp,
      mensagem,
      cobranca_id: cobrancaId,
      cliente_id: cliente.id,
    });
    registrarEv({ data: { cobrancaId, mensagem, canal: "whatsapp" } });
    refetch();
  };

  return (
    <Sheet open={!!cobrancaId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl w-[95vw] p-0 flex flex-col h-full">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !cob ? (
          <div className="p-6">Cobrança não encontrada</div>
        ) : (
          <>
            <SheetHeader className="p-6 pb-2">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={cob.prioridade === 'critica' ? 'destructive' : 'outline'} className="uppercase text-[10px]">
                  Prioridade {cob.prioridade}
                </Badge>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {cob.status}
                </Badge>
              </div>
              <SheetTitle className="text-xl font-display flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-gold" />
                Dossiê de Cobrança
              </SheetTitle>
              <SheetDescription>
                {cliente?.nome} • {pet?.nome ?? "Sem pet"}
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 grid grid-cols-3 gap-2 mb-4">
              <div className="bg-muted/50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Saldo</div>
                <div className="font-semibold text-rose-600">{brl(Number(cob.saldo))}</div>
              </div>
              <div className="bg-muted/50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Vencimento</div>
                <div className="font-semibold">{fmtDate(cob.vencimento)}</div>
              </div>
              <div className="bg-muted/50 p-2 rounded-lg text-center">
                <div className="text-[10px] text-muted-foreground uppercase">Atraso</div>
                <div className="font-semibold">{cob.dias_atraso}d</div>
              </div>
            </div>

            <Separator />

            <Tabs value={aba} onValueChange={setAba} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-2">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="contexto">Dossiê</TabsTrigger>
                  <TabsTrigger value="compor">IA / Whats</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full p-6">
                  <TabsContent value="contexto" className="m-0 space-y-6">
                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" /> Dados do Tutor
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Nome</Label>
                          <div className="font-medium">{cliente?.nome}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                          <div className="flex items-center gap-1 font-medium">
                            {cliente?.whatsapp || "Não informado"}
                            {cliente?.whatsapp && <Phone className="h-3 w-3 text-emerald-500" />}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Dog className="h-4 w-4 text-primary" /> Dados do Pet / Serviço
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Pet</Label>
                          <div className="font-medium">{pet?.nome ?? "—"}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Último Banho</Label>
                          <div className="font-medium">{fmtDate(cob.atendimentos?.data_inicio)}</div>
                        </div>
                      </div>
                    </section>

                    <Separator />

                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-amber-600" /> Promessa de Pagamento
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Data</Label>
                          <Input 
                            type="date" 
                            value={promessaData} 
                            onChange={e => setPromessaData(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor</Label>
                          <Input 
                            type="number" 
                            value={promessaValor} 
                            placeholder={cob.saldo.toString()}
                            onChange={e => setPromessaValor(e.target.value)} 
                          />
                        </div>
                      </div>
                      <Button className="w-full" variant="outline" onClick={handleRegistrarPromessa}>
                        Registrar Promessa
                      </Button>
                    </section>
                  </TabsContent>

                  <TabsContent value="compor" className="m-0 space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Tom da Cobrança (IA)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={carregandoIA}
                          onClick={() => handleSugerirIA("lembrete")}
                        >
                          <Clock className="h-3 w-3 mr-2 text-sky-500" /> Cordial
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={carregandoIA}
                          onClick={() => handleSugerirIA("cobranca")}
                        >
                          <Sparkles className="h-3 w-3 mr-2 text-gold" /> Objetivo
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={carregandoIA}
                          onClick={() => handleSugerirIA("negociacao")}
                        >
                          <AlertTriangle className="h-3 w-3 mr-2 text-amber-500" /> Firme
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={carregandoIA}
                          onClick={() => handleSugerirIA("incisiva")}
                        >
                          <ShieldAlert className="h-3 w-3 mr-2 text-rose-500" /> Incisivo
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Mensagem para WhatsApp</Label>
                      <Textarea 
                        rows={10} 
                        value={mensagem} 
                        onChange={e => setMensagem(e.target.value)}
                        placeholder="Clique em um dos tons acima para gerar com IA ou digite aqui..."
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="historico" className="m-0 space-y-4">
                    {dossie?.historico && dossie.historico.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        Nenhum contato registrado ainda.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {dossie?.historico.map((h: any) => (
                          <div key={h.id} className="border rounded-lg p-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="uppercase font-semibold text-primary">{h.tipo}</span>
                              <span>{new Date(h.created_at).toLocaleString()}</span>
                            </div>
                            <div className="whitespace-pre-wrap">{h.payload?.mensagem || h.tipo}</div>
                            {h.usuario_email && (
                              <div className="text-[10px] text-right italic text-muted-foreground">
                                Por: {h.usuario_email}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </div>
            </Tabs>

            <SheetFooter className="p-6 pt-2 border-t mt-auto">
              <div className="flex w-full gap-2">
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  Fechar
                </Button>
                {aba === 'compor' && (
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleWhatsApp}>
                    <MessageCircle className="h-4 w-4 mr-2" /> Abrir WhatsApp
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
