import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import {
  PetFormFields, PetFormState, emptyPetForm, petFormFromRow, petFormToInsert,
} from "@/components/pet-form-fields";
import { uploadPetFoto, removePetFoto } from "@/lib/pet-foto-upload";

export const Route = createFileRoute("/_authenticated/pets/$petId/editar")({
  component: EditarPetPage,
});

function EditarPetPage() {
  const { petId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<PetFormState>(emptyPetForm);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  const dirtyRef = useRef(false);

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet-editar", petId],
    queryFn: async () =>
      (await supabase.from("pets").select("*, clientes(id, nome)").eq("id", petId).maybeSingle()).data,
  });

  // Reset form when navigating between different pets (component may not remount)
  useEffect(() => {
    setForm(emptyPetForm);
    setFoto(null);
    setRemoveFoto(false);
    setLoadedFor(null);
    dirtyRef.current = false;
  }, [petId]);

  useEffect(() => {
    if (pet && pet.id === petId && loadedFor !== petId) {
      setForm(petFormFromRow(pet));
      setLoadedFor(petId);
      setTimeout(() => { dirtyRef.current = false; }, 0);
    }
  }, [pet, petId, loadedFor]);
  useEffect(() => { if (loadedFor === petId) dirtyRef.current = true; }, [form, foto, removeFoto, loadedFor, petId]);

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
      if (!form.nome.trim()) throw new Error("Nome do pet é obrigatório.");
      const patch: any = petFormToInsert(form);
      if (foto) {
        const path = await uploadPetFoto(petId, foto);
        patch.foto_url = path;
        if (pet?.foto_url && pet.foto_url !== path) await removePetFoto(pet.foto_url);
      } else if (removeFoto && pet?.foto_url) {
        await removePetFoto(pet.foto_url);
        patch.foto_url = null;
      }
      const { error } = await supabase.from("pets").update(patch).eq("id", petId);
      if (error) throw error;
    },
    onSuccess: () => {
      dirtyRef.current = false;
      toast.success("Pet atualizado.");
      qc.invalidateQueries({ queryKey: ["pet-ficha", petId] });
      qc.invalidateQueries({ queryKey: ["cliente", pet?.cliente_id] });
      navigate({ to: "/pets/$petId/ficha", params: { petId } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function tryBack() {
    if (dirtyRef.current) {
      if (!confirm("Existem alterações não salvas. Sair?")) return;
    }
    navigate({ to: "/pets/$petId/ficha", params: { petId } });
  }

  if (isLoading) return <PageShell><div className="text-sm text-muted-foreground">Carregando…</div></PageShell>;
  if (!pet) return <PageShell><div className="text-sm text-muted-foreground">Pet não encontrado.</div></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title={`Editar ${pet.nome}`}
        description={pet.clientes?.nome ? `Tutor: ${pet.clientes.nome}` : undefined}
        actions={
          <Button variant="outline" onClick={tryBack} className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        }
      />
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-6">
        <PetFormFields
          value={form}
          onChange={(patch) => setForm((s) => ({ ...s, ...patch }))}
          currentFotoPath={pet.foto_url}
          onFotoFile={setFoto}
          onRemoveFoto={() => setRemoveFoto(true)}
        />
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
