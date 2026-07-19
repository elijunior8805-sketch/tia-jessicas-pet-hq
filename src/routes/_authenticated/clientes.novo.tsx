import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import {
  ClienteFormFields, ClienteFormState, emptyClienteForm, clienteFormToInsert,
} from "@/components/cliente-form-fields";
import {
  PetFormFields, PetFormState, emptyPetForm, petFormToInsert,
} from "@/components/pet-form-fields";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { uploadPetFoto } from "@/lib/pet-foto-upload";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  component: NovoClientePage,
});

function NovoClientePage() {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<ClienteFormState>(emptyClienteForm);
  const [incluirPet, setIncluirPet] = useState(true);
  const [pet, setPet] = useState<PetFormState>(emptyPetForm);
  const [petFoto, setPetFoto] = useState<File | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => { dirtyRef.current = true; }, [cliente, pet, incluirPet, petFoto]);

  // Unsaved changes guard on unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || !cliente.nome.trim()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cliente.nome]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!cliente.nome.trim()) throw new Error("Informe o nome do cliente.");
      const { data: novo, error } = await supabase
        .from("clientes")
        .insert(clienteFormToInsert(cliente))
        .select("id")
        .single();
      if (error) throw error;

      if (incluirPet && pet.nome.trim()) {
        const { data: novoPet, error: petErr } = await supabase
          .from("pets")
          .insert({ cliente_id: novo.id, ...petFormToInsert(pet) })
          .select("id")
          .single();
        if (petErr) throw petErr;
        if (petFoto && novoPet?.id) {
          try {
            const path = await uploadPetFoto(novoPet.id, petFoto);
            await supabase.from("pets").update({ foto_url: path }).eq("id", novoPet.id);
          } catch (e: any) {
            toast.error("Cliente e pet salvos, mas a foto falhou: " + (e?.message ?? ""));
          }
        }
      }

      return novo.id as string;
    },
    onSuccess: (id) => {
      dirtyRef.current = false;
      toast.success("Cliente cadastrado!");
      navigate({ to: "/clientes/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function tryBack() {
    if (dirtyRef.current && cliente.nome.trim()) {
      if (!confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) return;
    }
    navigate({ to: "/clientes" });
  }

  return (
    <PageShell>
      <PageHeader
        title="Novo cliente"
        description="Cadastre uma única vez — reutilizado no agendamento, atendimento e financeiro."
        actions={
          <Button variant="outline" onClick={tryBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        }
      />

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-6"
      >
        <ClienteFormFields
          value={cliente}
          onChange={(patch) => setCliente((s) => ({ ...s, ...patch }))}
        />

        <Card className="p-4 sm:p-6 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Primeiro pet</h2>
              <p className="text-xs text-muted-foreground">Cadastre um pet agora ou adicione depois.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cadastrar pet</span>
              <Switch checked={incluirPet} onCheckedChange={setIncluirPet} />
            </div>
          </div>

          {incluirPet && (
            <PetFormFields
              value={pet}
              onChange={(patch) => setPet((s) => ({ ...s, ...patch }))}
              onFotoFile={setPetFoto}
            />
          )}
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button type="button" variant="outline" onClick={tryBack}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Salvando…" : "Salvar cliente"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
