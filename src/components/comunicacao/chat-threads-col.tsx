import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarThreads } from "@/lib/comunicacao-central.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

interface ChatThreadsColProps {
  onSelectThread: (clienteId: string) => void;
  selectedId?: string;
}

export function ChatThreadsCol({ onSelectThread, selectedId }: ChatThreadsColProps) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"abertas" | "nao_lidas" | "resolvidas" | "atencao">("abertas");
  const listar = useServerFn(listarThreads);

  const { data: threads, isLoading } = useQuery({
    queryKey: ["chat-threads", busca, status],
    queryFn: () => listar({ data: { busca, status } }),
    refetchInterval: 30000,
  });

  return (
    <div className="flex flex-col h-full border-r border-border/60 bg-muted/10">
      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou pet..."
            className="pl-9 bg-background"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "abertas", label: "Abertas", icon: MessageSquare },
            { id: "nao_lidas", label: "Não lidas", icon: Clock },
            { id: "atencao", label: "Atenção", icon: AlertCircle },
            { id: "resolvidas", label: "Resolvidas", icon: CheckCircle2 },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                status === s.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background border border-border/60 hover:border-primary/40"
              )}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Carregando conversas...</div>
        ) : threads?.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma conversa encontrada.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {threads?.map((t: any) => {
              const ultimaEm = t.ultima_em ? new Date(t.ultima_em) : null;
              return (
                <button
                  key={t.cliente_id}
                  onClick={() => onSelectThread(t.cliente_id)}
                  className={cn(
                    "w-full p-4 text-left transition-colors hover:bg-muted/50 flex flex-col gap-1",
                    selectedId === t.cliente_id && "bg-primary/5 border-l-4 border-primary"
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-sm truncate">{t.cliente_nome}</span>
                    {ultimaEm && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(ultimaEm, { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                  
                  {t.pet_primeiro_nome && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Pet: {t.pet_primeiro_nome}
                    </span>
                  )}
                  
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 italic">
                    {t.ultima_mensagem || "Sem mensagens"}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5">
                    {Number(t.nao_lidas || 0) > 0 && (
                      <Badge className="h-4 px-1.5 text-[9px] bg-primary">{t.nao_lidas} não lidas</Badge>
                    )}
                    {t.status_conversa === 'atencao_humana' && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">Atenção</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
