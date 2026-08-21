import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Dog, Wallet, Calendar, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { obterDossieConversa } from "@/lib/comunicacao-central.functions";
import { brl } from "@/lib/comunicacao-central.server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatContextColProps {
  clienteId: string;
}

export function ChatContextCol({ clienteId }: ChatContextColProps) {
  const dossieFn = useServerFn(obterDossieConversa);
  const { data: dossie } = useQuery({
    queryKey: ["chat-dossie", clienteId],
    queryFn: () => dossieFn({ data: { clienteId } }),
  });

  const totalDevedor = dossie?.cobrancas?.reduce((acc: number, c: any) => acc + (c.saldo || 0), 0) || 0;

  return (
    <div className="w-80 border-l border-border/60 bg-muted/5 flex flex-col h-full overflow-y-auto p-4 space-y-6">
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <User className="h-3 w-3" /> Perfil do Cliente
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{dossie?.cliente?.nome}</span>
          </div>
          {dossie?.cliente?.vip && (
            <Badge className="bg-amber-500 hover:bg-amber-600 border-none w-fit">Cliente VIP</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Dog className="h-3 w-3" /> Pets
        </h4>
        <div className="grid gap-2">
          {dossie?.pets?.map((pet: any) => (
            <div key={pet.id} className="flex items-center gap-2 p-2 rounded-lg border bg-background/50">
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                <Dog className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{pet.nome}</p>
                <p className="text-[10px] text-muted-foreground truncate">{pet.raca || 'Sem raça'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Wallet className="h-3 w-3" /> Financeiro
        </h4>
        <Card className={cn("p-4 border-l-4", (totalDevedor || 0) > 0 ? "border-l-rose-500" : "border-l-emerald-500")}>
          <p className="text-[10px] text-muted-foreground uppercase">Saldo Devedor Total</p>
          <p className="text-xl font-bold">{brl(totalDevedor)}</p>
          {dossie?.promessas && dossie.promessas.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              <span>{dossie.promessas.length} promessa(s) ativa(s)</span>
            </div>
          )}
        </Card>
      </div>


      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Calendar className="h-3 w-3" /> Próximo Agendamento
        </h4>
        {dossie?.proximoAgendamento ? (
          <Card className="p-3 border-l-4 border-l-primary">
            <p className="text-xs font-semibold">{dossie.proximoAgendamento.pets?.nome}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {format(new Date(dossie.proximoAgendamento.data), "dd/MM (EEEE)", { locale: ptBR })}
            </p>
            <p className="text-xs font-bold text-primary mt-1">{dossie.proximoAgendamento.hora}</p>
          </Card>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nenhum agendamento futuro.</p>
        )}
      </div>
    </div>
  );
}
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
