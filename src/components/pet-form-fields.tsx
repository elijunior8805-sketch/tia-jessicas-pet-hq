import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PetFotoPicker } from "@/components/pet-foto-picker";

export type PetFormState = {
  nome: string;
  raca: string;
  sexo: string;
  peso: string;
  porte: string;
  cor: string;
  nascimento: string;
  castrado: "sim" | "nao" | "";
  alergias: string;
  cuidados_saude: string;
  temperamento: string;
  observacoes: string;
  necessita_focinheira: boolean;
  preferencias_tutor: string;
  ultimo_banho: string;
  ultima_tosa: string;
  proxima_visita: string;
};

export const emptyPetForm: PetFormState = {
  nome: "", raca: "", sexo: "", peso: "", porte: "", cor: "", nascimento: "",
  castrado: "", alergias: "", cuidados_saude: "", temperamento: "", observacoes: "",
  necessita_focinheira: false, preferencias_tutor: "",
  ultimo_banho: "", ultima_tosa: "", proxima_visita: "",
};

export function petFormFromRow(row: any): PetFormState {
  return {
    nome: row?.nome ?? "",
    raca: row?.raca ?? "",
    sexo: row?.sexo ?? "",
    peso: row?.peso != null ? String(row.peso) : "",
    porte: row?.porte ?? "",
    cor: row?.cor ?? "",
    nascimento: row?.nascimento ?? "",
    castrado: row?.castrado === true ? "sim" : row?.castrado === false ? "nao" : "",
    alergias: row?.alergias ?? "",
    cuidados_saude: row?.cuidados_saude ?? "",
    temperamento: row?.temperamento ?? "",
    observacoes: row?.observacoes ?? "",
    necessita_focinheira: !!row?.necessita_focinheira,
    preferencias_tutor: row?.preferencias_tutor ?? "",
    ultimo_banho: row?.ultimo_banho ?? "",
    ultima_tosa: row?.ultima_tosa ?? "",
    proxima_visita: row?.proxima_visita ?? "",
  };
}

export function petFormToInsert(f: PetFormState) {
  const clean = (s?: string) => (s && s.trim() ? s.trim() : null);
  const peso = f.peso ? Number(String(f.peso).replace(",", ".")) : null;
  return {
    nome: f.nome.trim(),
    raca: clean(f.raca),
    sexo: clean(f.sexo),
    peso: peso != null && !Number.isNaN(peso) ? peso : null,
    porte: clean(f.porte),
    cor: clean(f.cor),
    nascimento: clean(f.nascimento),
    castrado: f.castrado === "sim" ? true : f.castrado === "nao" ? false : null,
    alergias: clean(f.alergias),
    cuidados_saude: clean(f.cuidados_saude),
    temperamento: clean(f.temperamento),
    observacoes: clean(f.observacoes),
    necessita_focinheira: !!f.necessita_focinheira,
    preferencias_tutor: clean(f.preferencias_tutor),
    ultimo_banho: clean(f.ultimo_banho),
    ultima_tosa: clean(f.ultima_tosa),
    proxima_visita: clean(f.proxima_visita),
  };
}

export function PetFormFields({
  value,
  onChange,
  currentFotoPath,
  onFotoFile,
  onRemoveFoto,
}: {
  value: PetFormState;
  onChange: (patch: Partial<PetFormState>) => void;
  currentFotoPath?: string | null;
  onFotoFile: (f: File | null) => void;
  onRemoveFoto?: () => void;
}) {
  const { data: racas } = useQuery({
    queryKey: ["racas-ativas"],
    queryFn: async () => (await supabase.from("racas").select("nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: portes } = useQuery({
    queryKey: ["portes-ativos"],
    queryFn: async () => (await supabase.from("portes").select("nome").eq("ativo", true).order("ordem")).data ?? [],
  });
  const { data: temperamentos } = useQuery({
    queryKey: ["temperamentos-ativos"],
    queryFn: async () => (await supabase.from("temperamentos").select("nome").eq("ativo", true).order("nome")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-52 shrink-0">
            <h2 className="font-display text-lg font-semibold mb-3">Foto do pet</h2>
            <PetFotoPicker
              currentPath={currentFotoPath}
              onFileChange={onFotoFile}
              onRemoveExisting={onRemoveFoto}
              size="lg"
            />
          </div>

          <div className="grid flex-1 grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={value.nome} onChange={(e) => onChange({ nome: e.target.value })} required maxLength={60} />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <Label>Raça</Label>
              <Select value={value.raca || undefined} onValueChange={(val) => onChange({ raca: val })}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {racas?.map((r) => <SelectItem key={r.nome} value={r.nome}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sexo</Label>
              <Select value={value.sexo || undefined} onValueChange={(val) => onChange({ sexo: val })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="macho">Macho</SelectItem>
                  <SelectItem value="femea">Fêmea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Porte</Label>
              <Select value={value.porte || undefined} onValueChange={(val) => onChange({ porte: val })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {portes?.map((p) => <SelectItem key={p.nome} value={p.nome}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input inputMode="decimal" value={value.peso} onChange={(e) => onChange({ peso: e.target.value })} placeholder="0,0" />
            </div>
            <div>
              <Label>Cor / pelagem</Label>
              <Input value={value.cor} onChange={(e) => onChange({ cor: e.target.value })} maxLength={40} />
            </div>
            <div className="col-span-2">
              <Label>Data de nascimento</Label>
              <Input type="date" value={value.nascimento} onChange={(e) => onChange({ nascimento: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Castrado</Label>
              <Select value={value.castrado || undefined} onValueChange={(val) => onChange({ castrado: val as any })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <Label>Temperamento</Label>
              <Select value={value.temperamento || undefined} onValueChange={(val) => onChange({ temperamento: val })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {temperamentos?.map((t) => <SelectItem key={t.nome} value={t.nome}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-2 flex items-center justify-between gap-3 rounded-md border p-3 bg-warning/5">
              <div>
                <div className="font-medium text-sm">Necessita focinheira</div>
                <div className="text-xs text-muted-foreground">Alerta na ficha operacional</div>
              </div>
              <Switch checked={value.necessita_focinheira} onCheckedChange={(b) => onChange({ necessita_focinheira: b })} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Saúde e cuidados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Alergias</Label>
            <Textarea value={value.alergias} onChange={(e) => onChange({ alergias: e.target.value })} rows={2} maxLength={500} />
          </div>
          <div>
            <Label>Cuidados / problemas de saúde</Label>
            <Textarea value={value.cuidados_saude} onChange={(e) => onChange({ cuidados_saude: e.target.value })} rows={2} maxLength={500} />
          </div>
          <div className="sm:col-span-2">
            <Label>Preferências e solicitações recorrentes</Label>
            <Textarea value={value.preferencias_tutor} onChange={(e) => onChange({ preferencias_tutor: e.target.value })} rows={2} maxLength={500} />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={value.observacoes} onChange={(e) => onChange({ observacoes: e.target.value })} rows={2} maxLength={500} />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Histórico</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Último banho</Label>
            <Input type="date" value={value.ultimo_banho} onChange={(e) => onChange({ ultimo_banho: e.target.value })} />
          </div>
          <div>
            <Label>Última tosa</Label>
            <Input type="date" value={value.ultima_tosa} onChange={(e) => onChange({ ultima_tosa: e.target.value })} />
          </div>
          <div>
            <Label>Próxima visita</Label>
            <Input type="date" value={value.proxima_visita} onChange={(e) => onChange({ proxima_visita: e.target.value })} />
          </div>
        </div>
      </Card>
    </div>
  );
}
