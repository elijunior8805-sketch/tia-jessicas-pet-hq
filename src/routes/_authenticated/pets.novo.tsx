import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { z } from "zod";
import {
  PetFormFields, PetFormState, emptyPetForm, petFormToInsert,
} from "@/components/pet-form-fields";
import { uploadPetFoto } from "@/lib/pet-foto-upload";

const searchSchema = z.object({ cliente: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/pets/novo")({
  validateSearch: (s) => searchSchema.parse(s),
  component: NovoPetPage,
});

function NovoPetPage() {
  const { cliente: clienteId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<PetFormState>(emptyPetForm);
  const [foto, setFoto] = useState<File | null>(null);
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = true; }, [form, foto]);

  const { data: cliente } = useQuery({
    queryKey: ["cliente-mini", clienteId],
    enabled: !!clienteId,
    queryFn: async () => (await supabase.from("clientes").select("id, nome").eq("id", clienteId!).maybeSingle()).data,
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Cliente não informado.");
      if (!form.nome.trim()) throw new Error("Nome do pet é obrigatório.");
      const { data: pet, error } = await supabase
        .from("pets")
        .insert({ cliente_id: clienteId, ...petFormToInsert(form) })
        .select("id")
        .single();
      if (error) throw error;
      if (foto) {
        try {
          const path = await uploadPetFoto(pet.id, foto);
          await supabase.from("pets").update({ foto_url: path }).eq("id", pet.id);
        } catch (e: any) {
          toast.error("Pet salvo, mas a foto falhou: " + (e?.message ?? ""));
        }
      }
      return pet.id as string;
    },
    onSuccess: () => {
      dirtyRef.current = false;
      toast.success("Pet cadastrado!");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      navigate({ to: "/clientes/$id", params: { id: clienteId! } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function tryBack() {
    if (dirtyRef.current && form.nome.trim()) {
      if (!confirm("Existem alterações não salvas. Sair?")) return;
    }
    if (clienteId) navigate({ to: "/clientes/$id", params: { id: clienteId } });
    else navigate({ to: "/clientes" });
  }

  if (!clienteId) {
    return (
      <PageShell>
        <div className="text-sm text-muted-foreground">
          Selecione o cliente para adicionar um pet.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Novo pet"
        description={cliente?.nome ? `Vinculado a ${cliente.nome}` : "Cadastro do pet"}
        actions={
          <Button variant="outline" onClick={tryBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        }
      />
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-6">
        <PetFormFields
          value={form}
          onChange={(patch) => setForm((s) => ({ ...s, ...patch }))}
          onFotoFile={setFoto}
        />
        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button type="button" variant="outline" onClick={tryBack}>Cancelar</Button>
          <Button type="submit" disabled={mut.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {mut.isPending ? "Salvando…" : "Salvar pet"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
