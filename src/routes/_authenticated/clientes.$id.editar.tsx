import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import {
  ClienteFormFields, ClienteFormState, emptyClienteForm, clienteFormFromRow, clienteFormToInsert,
} from "@/components/cliente-form-fields";
import { FotoPicker } from "@/components/foto-picker";
import { uploadFoto, removeFoto } from "@/lib/foto-upload";
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/$id/editar")({
  component: EditarClientePage,
});

function EditarClientePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<ClienteFormState>(emptyClienteForm);
  const [loaded, setLoaded] = useState(false);
  const dirtyRef = useRef(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente-editar", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (cliente && !loaded) {
      setForm(clienteFormFromRow(cliente));
      setLoaded(true);
      // reset dirty after initial fill on next tick
      setTimeout(() => { dirtyRef.current = false; }, 0);
    }
  }, [cliente, loaded]);

  useEffect(() => { if (loaded) dirtyRef.current = true; }, [form, loaded]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório.");
      const { error } = await supabase.from("clientes").update(clienteFormToInsert(form)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      dirtyRef.current = false;
      toast.success("Alterações salvas.");
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      navigate({ to: "/clientes/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function tryBack() {
    if (dirtyRef.current) {
      if (!confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) return;
    }
    navigate({ to: "/clientes/$id", params: { id } });
  }

  if (isLoading) return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  if (!cliente) return <PageShell><div className="text-sm text-muted-foreground">Cliente não encontrado.</div></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title={`Editar ${cliente.nome}`}
        description="Atualiza o registro atual — pets, atendimentos e histórico permanecem vinculados."
        actions={
          <Button variant="outline" onClick={tryBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        }
      />
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-6">
        <ClienteFormFields value={form} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} />
        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button type="button" variant="outline" onClick={tryBack}>Cancelar</Button>
          <Button type="submit" disabled={mut.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {mut.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
