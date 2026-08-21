import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterDossieConversa, registrarRespostaCliente, registrarComunicacao } from "@/lib/comunicacao-central.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Phone, Wand2, Sparkles, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { brl } from "@/lib/comunicacao-central.server";
import { toast } from "sonner";
import { abrirWhatsAppBusiness } from "@/lib/whatsapp";



interface ChatTimelineColProps {
  clienteId: string;
}

export function ChatTimelineCol({ clienteId }: ChatTimelineColProps) {
  const qc = useQueryClient();
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const [mensagem, setMensagem] = useState("");
  
  const dossieFn = useServerFn(obterDossieConversa);
  const respFn = useServerFn(registrarRespostaCliente);
  const enviarFn = useServerFn(registrarComunicacao);

  const { data: dossie, isLoading } = useQuery({
    queryKey: ["chat-dossie", clienteId],
    queryFn: () => dossieFn({ data: { clienteId } }),
  });

  const respMut = useMutation({
    mutationFn: (corpo: string) => respFn({ data: { clienteId, corpo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-dossie", clienteId] });
      setMensagem("");
    }
  });

  const enviarMut = useMutation({
    mutationFn: (corpo: string) => enviarFn({ data: { clienteId, corpo, canal: "whatsapp" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-dossie", clienteId] });
      setMensagem("");
      toast.success("Mensagem registrada e enviada.");
    }
  });

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dossie?.historico]);

    enviarMut.mutate(mensagem);
    if (dossie?.cliente?.whatsapp) {
      abrirWhatsAppBusiness(dossie.cliente.whatsapp, mensagem);
    }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;


  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="p-4 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {dossie?.cliente?.nome?.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{dossie?.cliente?.nome}</h3>
            <p className="text-xs text-muted-foreground">{dossie?.cliente?.whatsapp}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="gap-2" onClick={() => abrirWhatsAppBusiness(dossie?.cliente?.whatsapp || "")}>
            <Phone className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </div>

      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {dossie?.historico?.map((m: any) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col max-w-[80%] gap-1",
              m.direcao === "out" ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                m.direcao === "out" 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-muted text-foreground rounded-tl-none border border-border/40"
              )}
            >
              {m.corpo}
            </div>
            <span className="text-[10px] text-muted-foreground px-1">
              {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
              {m.direcao === 'out' && ` · ${m.autor_email || 'Sistema'}`}
            </span>
          </div>
        ))}
        <div ref={timelineEndRef} />
      </div>

      <div className="p-4 border-t bg-card/50">
        <div className="relative">
          <Textarea
            placeholder="Digite uma mensagem ou registre a resposta do cliente..."
            className="min-h-[100px] pr-24 resize-none shadow-sm"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Melhorar com IA">
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-8 w-8" onClick={() => enviarMut.mutate(mensagem)} disabled={!mensagem.trim() || enviarMut.isPending}>
              {enviarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" size="sm" className="h-7 text-[10px]" onClick={() => respMut.mutate(mensagem)} disabled={!mensagem.trim() || respMut.isPending}>
            Registrar Resposta do Cliente
          </Button>
        </div>
      </div>
    </div>
  );
}
