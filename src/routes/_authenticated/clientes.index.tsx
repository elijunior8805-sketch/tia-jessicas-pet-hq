import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Star, MessageCircle, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientesPage,
});

function ClientesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes", q],
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, whatsapp, bairro, cidade, vip, pets(id, nome, raca)")
        .order("nome");
      if (q.trim()) {
        const like = `%${q.trim()}%`;
        query = query.or(`nome.ilike.${like},telefone.ilike.${like},whatsapp.ilike.${like},bairro.ilike.${like}`);
      }
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Clientes e Pets"
        description="Cadastre uma vez, reutilize em todo o fluxo."
        actions={
          <Button onClick={() => navigate({ to: "/clientes/novo" })} className="gap-2">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, telefone, WhatsApp ou bairro…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !clientes || clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Cadastre o primeiro cliente e seu pet para começar a agendar atendimentos."
          action={<Button onClick={() => navigate({ to: "/clientes/novo" })}><Plus className="h-4 w-4 mr-2"/>Cadastrar agora</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clientes.map((c) => (
            <Link key={c.id} to="/clientes/$id" params={{ id: c.id }}>
              <Card className="p-4 hover:shadow-elegant hover:-translate-y-0.5 transition h-full">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-primary truncate">{c.nome}</h3>
                      {c.vip && <Badge className="badge-gold text-xs shrink-0"><Star className="h-3 w-3 mr-0.5"/>VIP</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3"/>{c.whatsapp}</span>}
                      {c.bairro && <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{c.bairro}</span>}
                    </div>
                    {c.pets && c.pets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.pets.slice(0, 4).map((p: any) => (
                          <Badge key={p.id} variant="secondary" className="text-xs">{p.nome}</Badge>
                        ))}
                        {c.pets.length > 4 && <Badge variant="secondary" className="text-xs">+{c.pets.length - 4}</Badge>}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
