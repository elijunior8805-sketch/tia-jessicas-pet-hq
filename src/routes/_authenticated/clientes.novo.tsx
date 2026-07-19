import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Save, Camera, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  component: NovoClientePage,
});

const clienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  nascimento: z.string().optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(150).optional().or(z.literal("")),
  cep: z.string().trim().max(15).optional().or(z.literal("")),
  rua: z.string().trim().max(150).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(80).optional().or(z.literal("")),
  bairro: z.string().trim().max(80).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  estado: z.string().trim().max(4).optional().or(z.literal("")),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
  indicacao: z.string().trim().max(120).optional().or(z.literal("")),
  vip: z.boolean(),
  // primeiro pet (opcional)
  pet_nome: z.string().trim().max(60).optional().or(z.literal("")),
  pet_raca: z.string().trim().max(60).optional().or(z.literal("")),
  pet_porte: z.string().trim().max(30).optional().or(z.literal("")),
  pet_sexo: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof clienteSchema>;

function NovoClientePage() {
  const navigate = useNavigate();
  const [v, setV] = useState<FormValues>({
    nome: "", cpf: "", nascimento: "", telefone: "", whatsapp: "", email: "",
    cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    observacoes: "", indicacao: "", vip: false,
    pet_nome: "", pet_raca: "", pet_porte: "", pet_sexo: "",
  });
  const [petFoto, setPetFoto] = useState<File | null>(null);
  const [petFotoPreview, setPetFotoPreview] = useState<string | null>(null);

  function onPickFoto(file: File | null) {
    setPetFoto(file);
    if (petFotoPreview) URL.revokeObjectURL(petFotoPreview);
    setPetFotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const { data: racas } = useQuery({
    queryKey: ["racas-ativas"],
    queryFn: async () => (await supabase.from("racas").select("nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: portes } = useQuery({
    queryKey: ["portes-ativos"],
    queryFn: async () => (await supabase.from("portes").select("nome").eq("ativo", true).order("ordem")).data ?? [],
  });

  const mutation = useMutation({
    mutationFn: async (input: FormValues) => {
      const parsed = clienteSchema.parse(input);
      const clean = (s?: string) => (s && s.trim()) ? s.trim() : null;
      const { data: cliente, error } = await supabase.from("clientes").insert({
        nome: parsed.nome.trim(),
        cpf: clean(parsed.cpf),
        nascimento: clean(parsed.nascimento),
        telefone: clean(parsed.telefone),
        whatsapp: clean(parsed.whatsapp),
        email: clean(parsed.email),
        cep: clean(parsed.cep),
        rua: clean(parsed.rua),
        numero: clean(parsed.numero),
        complemento: clean(parsed.complemento),
        bairro: clean(parsed.bairro),
        cidade: clean(parsed.cidade),
        estado: clean(parsed.estado),
        observacoes: clean(parsed.observacoes),
        indicacao: clean(parsed.indicacao),
        vip: parsed.vip,
      }).select("id").single();
      if (error) throw error;

      if (parsed.pet_nome && parsed.pet_nome.trim()) {
        const { data: pet, error: petErr } = await supabase.from("pets").insert({
          cliente_id: cliente.id,
          nome: parsed.pet_nome.trim(),
          raca: clean(parsed.pet_raca),
          porte: clean(parsed.pet_porte),
          sexo: clean(parsed.pet_sexo),
        }).select("id").single();
        if (petErr) throw petErr;

        if (petFoto && pet?.id) {
          const ext = (petFoto.name.split(".").pop() || "jpg").toLowerCase();
          const path = `pets/${pet.id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("spa-fotos")
            .upload(path, petFoto, { upsert: true, contentType: petFoto.type || "image/jpeg" });
          if (upErr) {
            toast.error("Cliente e pet salvos, mas a foto falhou: " + upErr.message);
          } else {
            await supabase.from("pets").update({ foto_url: path }).eq("id", pet.id);
          }
        }
      }

      return cliente.id as string;
    },
    onSuccess: (id) => {
      toast.success("Cliente cadastrado!");
      navigate({ to: "/clientes/$id", params: { id } });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao salvar");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = clienteSchema.safeParse(v);
    if (!result.success) return toast.error(result.error.issues[0]?.message ?? "Verifique os campos");
    mutation.mutate(v);
  }

  const field = <K extends keyof FormValues>(k: K) => ({
    value: v[k] as any,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });

  return (
    <PageShell>
      <PageHeader
        title="Novo cliente"
        description="Cadastre uma única vez — reutilizado no agendamento, atendimento e financeiro."
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/clientes" })} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        }
      />

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Dados do tutor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome completo *</Label>
              <Input {...field("nome")} required />
            </div>
            <div>
              <Label>CPF</Label>
              <Input {...field("cpf")} />
            </div>
            <div>
              <Label>Nascimento</Label>
              <Input type="date" {...field("nascimento")} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input {...field("telefone")} inputMode="tel" />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input {...field("whatsapp")} inputMode="tel" />
            </div>
            <div className="sm:col-span-2">
              <Label>E-mail</Label>
              <Input type="email" {...field("email")} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3 bg-gold/5">
              <div>
                <div className="font-medium text-sm">Cliente VIP</div>
                <div className="text-xs text-muted-foreground">Destacado no sistema</div>
              </div>
              <Switch checked={v.vip} onCheckedChange={(b) => setV((s) => ({ ...s, vip: b }))} />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Endereço</h2>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <div className="col-span-2 sm:col-span-2">
              <Label>CEP</Label>
              <Input {...field("cep")} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <Label>Rua</Label>
              <Input {...field("rua")} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>Número</Label>
              <Input {...field("numero")} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <Label>Complemento</Label>
              <Input {...field("complemento")} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <Label>Bairro</Label>
              <Input {...field("bairro")} />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <Label>Cidade</Label>
              <Input {...field("cidade")} />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <Label>Estado</Label>
              <Input maxLength={2} {...field("estado")} />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Extras</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Indicação</Label>
              <Input {...field("indicacao")} placeholder="Quem indicou?" />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea {...field("observacoes")} rows={3} />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 border-primary/20 bg-primary/5">
          <h2 className="font-display text-lg font-semibold mb-1">Primeiro pet (opcional)</h2>
          <p className="text-xs text-muted-foreground mb-4">Preencha o nome do pet para já cadastrá-lo junto. Você pode adicionar mais pets depois.</p>

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Foto do pet */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <label
                htmlFor="pet-foto"
                className="relative h-28 w-28 rounded-full border-2 border-dashed border-primary/40 bg-card overflow-hidden cursor-pointer flex items-center justify-center hover:border-primary/70 transition"
              >
                {petFotoPreview ? (
                  <img src={petFotoPreview} alt="Foto do pet" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Camera className="h-6 w-6" />
                    <span className="text-[10px] uppercase tracking-wider">Foto</span>
                  </div>
                )}
                <input
                  id="pet-foto"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFoto(e.target.files?.[0] ?? null)}
                />
              </label>
              {petFotoPreview && (
                <button
                  type="button"
                  onClick={() => onPickFoto(null)}
                  className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> remover
                </button>
              )}
            </div>

            <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome do pet</Label>
                <Input {...field("pet_nome")} />
              </div>
              <div className="sm:col-span-2">
                <Label>Raça</Label>
                <Select value={v.pet_raca || undefined} onValueChange={(val) => setV((s) => ({ ...s, pet_raca: val }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {racas?.map((r) => <SelectItem key={r.nome} value={r.nome}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Porte</Label>
                <Select value={v.pet_porte || undefined} onValueChange={(val) => setV((s) => ({ ...s, pet_porte: val }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {portes?.map((p) => <SelectItem key={p.nome} value={p.nome}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Sexo</Label>
                <Select value={v.pet_sexo || undefined} onValueChange={(val) => setV((s) => ({ ...s, pet_sexo: val }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macho">Macho</SelectItem>
                    <SelectItem value="femea">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/clientes" })}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Salvando…" : "Salvar cliente"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
