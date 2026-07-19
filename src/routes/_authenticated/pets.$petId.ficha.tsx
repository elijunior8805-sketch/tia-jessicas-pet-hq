import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, PawPrint, ArrowLeft, Ruler, Cake, Syringe, Heart, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pets/$petId/ficha")({
  component: FichaOperacional,
});

function FichaOperacional() {
  const { petId } = Route.useParams();

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet-ficha", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, clientes(id, nome, whatsapp, vip)")
        .eq("id", petId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: historico } = useQuery({
    queryKey: ["pet-historico", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("id, data_execucao, valor_final, observacoes_saida, agendamentos(data, hora, servicos(nome))")
        .eq("pet_id", petId)
        .order("data_execucao", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: ocorrencias } = useQuery({
    queryKey: ["pet-ocorrencias", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ocorrencias")
        .select("id, tipo, descricao, gravidade, data_ocorrencia")
        .eq("pet_id", petId)
        .order("data_ocorrencia", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (isLoading) return <PageShell><div className="text-sm text-muted-foreground">Carregando ficha…</div></PageShell>;
  if (!pet) return <PageShell><div className="text-sm text-muted-foreground">Pet não encontrado.</div></PageShell>;

  const alertas: string[] = [];
  if (pet.temperamento && ["agressivo", "medroso", "estressado"].includes(String(pet.temperamento).toLowerCase())) {
    alertas.push(`Temperamento: ${pet.temperamento}`);
  }
  if (pet.alergias) alertas.push(`Alergias: ${pet.alergias}`);
  if ((pet as any).cuidados_saude) alertas.push(`Saúde: ${(pet as any).cuidados_saude}`);
  if ((pet as any).observacoes) alertas.push(`Observações: ${(pet as any).observacoes}`);

  return (
    <PageShell>
      <PageHeader
        title={pet.nome}
        description={`Ficha operacional · ${pet.clientes?.nome ?? ""}`}
        actions={
          <Link to="/clientes/$id" params={{ id: pet.cliente_id }}>
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4"/> Voltar ao cliente</Button>
          </Link>
        }
      />

      {alertas.length > 0 && (
        <Card className="p-4 mb-4 border-warning bg-warning/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5"/>
            <div className="min-w-0">
              <div className="font-display font-semibold text-warning-foreground">Atenção antes de manusear</div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {alertas.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 grid place-items-center">
              <PawPrint className="h-7 w-7 text-primary"/>
            </div>
            <div>
              <div className="font-display text-xl font-semibold text-primary">{pet.nome}</div>
              <div className="text-xs text-muted-foreground">{[pet.raca, pet.porte].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            {pet.sexo && <Info icon={Heart} label="Sexo" value={pet.sexo}/>}
            {pet.nascimento && <Info icon={Cake} label="Nascimento" value={new Date(pet.nascimento).toLocaleDateString("pt-BR")}/>}
            {pet.peso && <Info icon={Ruler} label="Peso" value={`${pet.peso} kg`}/>}
            {pet.cor && <Info icon={PawPrint} label="Cor / pelagem" value={pet.cor}/>}
            {(pet as any).cuidados_saude && <Info icon={Syringe} label="Cuidados de saúde" value={(pet as any).cuidados_saude}/>}
          </dl>
          {pet.temperamento && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Temperamento</div>
              <Badge variant="secondary">{pet.temperamento}</Badge>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4"/> Últimos atendimentos
          </h2>
          {!historico || historico.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Sem histórico ainda.</div>
          ) : (
            <div className="divide-y">
              {historico.map((h: any) => (
                <div key={h.id} className="py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {h.agendamentos?.servicos?.nome ?? "Atendimento"}
                    </div>
                    {h.observacoes_saida && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{h.observacoes_saida}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{h.data_execucao ? new Date(h.data_execucao).toLocaleDateString("pt-BR") : "—"}</div>
                    {h.valor_final != null && (
                      <div className="text-sm font-semibold text-primary">
                        {Number(h.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h2 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4"/> Ocorrências registradas
          </h2>
          {!ocorrencias || ocorrencias.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma ocorrência registrada.</div>
          ) : (
            <div className="space-y-2">
              {ocorrencias.map((o: any) => (
                <div key={o.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{o.tipo}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {o.gravidade && <Badge variant={o.gravidade === "alta" ? "destructive" : "secondary"}>{o.gravidade}</Badge>}
                      <span>{new Date(o.data_ocorrencia).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  {o.descricao && <p className="text-sm mt-1 whitespace-pre-wrap">{o.descricao}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5"/>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}
