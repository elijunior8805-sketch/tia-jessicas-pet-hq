import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, MapPin, Phone, Mail, Star, PawPrint, Plus, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetalhe,
});

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

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

  if (isLoading) return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  if (!data) return <PageShell><div className="text-sm text-muted-foreground">Cliente não encontrado.</div></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title={data.nome}
        description="Ficha do cliente e pets vinculados."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/clientes" })} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button className="gap-2"><Plus className="h-4 w-4"/> Novo pet</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display font-semibold text-primary">Contato</h2>
            {data.vip && <Badge className="badge-gold text-xs"><Star className="h-3 w-3 mr-0.5"/>VIP</Badge>}
          </div>
          <div className="space-y-2 text-sm">
            {data.telefone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground"/>{data.telefone}</div>}
            {data.whatsapp && <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground"/>{data.whatsapp}</div>}
            {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground"/>{data.email}</div>}
            {(data.rua || data.bairro) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5"/>
                <span>
                  {[data.rua, data.numero].filter(Boolean).join(", ")}
                  {data.complemento && ` — ${data.complemento}`}
                  {data.bairro && <><br/>{data.bairro}</>}
                  {(data.cidade || data.estado) && <><br/>{[data.cidade, data.estado].filter(Boolean).join(" / ")}</>}
                </span>
              </div>
            )}
          </div>
          {data.observacoes && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Observações</div>
              <p className="text-sm whitespace-pre-wrap">{data.observacoes}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-primary mb-3">Pets</h2>
          {!data.pets || data.pets.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum pet cadastrado ainda.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.pets.map((p: any) => (
                <Link key={p.id} to="/pets/$petId/ficha" params={{ petId: p.id }}>
                  <div className="rounded-lg border p-4 hover:shadow-elegant hover:-translate-y-0.5 transition h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center">
                        <PawPrint className="h-4 w-4 text-primary"/>
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-primary truncate">{p.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[p.raca, p.porte].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <FileText className="h-3 w-3"/> Abrir ficha operacional →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
