import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lookupCep, formatCep } from "@/lib/cep";
import { toast } from "sonner";

export type ClienteFormState = {
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string;
  whatsapp: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacoes: string;
  indicacao: string;
  vip: boolean;
  tom_preferido: string;
  opt_out_comunicacao: boolean;
  opt_out_motivo: string;
};

export const emptyClienteForm: ClienteFormState = {
  nome: "", cpf: "", nascimento: "", telefone: "", whatsapp: "", email: "",
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  observacoes: "", indicacao: "", vip: false,
  tom_preferido: "", opt_out_comunicacao: false, opt_out_motivo: "",
};

export function ClienteFormFields({
  value,
  onChange,
}: {
  value: ClienteFormState;
  onChange: (patch: Partial<ClienteFormState>) => void;
}) {
  const [cepLoading, setCepLoading] = useState(false);

  async function buscarCep() {
    const info = await (async () => {
      setCepLoading(true);
      try { return await lookupCep(value.cep); } finally { setCepLoading(false); }
    })();
    if (!info) {
      toast.warning("CEP não encontrado. Você pode preencher manualmente.");
      return;
    }
    onChange({
      cep: formatCep(info.cep),
      rua: info.rua || value.rua,
      bairro: info.bairro || value.bairro,
      cidade: info.cidade || value.cidade,
      estado: info.estado || value.estado,
    });
    toast.success("Endereço preenchido pelo CEP.");
  }

  function onCepChange(v: string) {
    const masked = formatCep(v);
    onChange({ cep: masked });
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 8) {
      void (async () => {
        setCepLoading(true);
        const info = await lookupCep(digits);
        setCepLoading(false);
        if (info) {
          onChange({
            rua: info.rua || value.rua,
            bairro: info.bairro || value.bairro,
            cidade: info.cidade || value.cidade,
            estado: info.estado || value.estado,
          });
        }
      })();
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Dados do tutor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={value.nome} onChange={(e) => onChange({ nome: e.target.value })} required maxLength={120} />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={value.cpf} onChange={(e) => onChange({ cpf: e.target.value })} maxLength={20} placeholder="000.000.000-00" />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input type="date" value={value.nascimento} onChange={(e) => onChange({ nascimento: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={value.telefone} onChange={(e) => onChange({ telefone: e.target.value })} inputMode="tel" maxLength={30} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={value.whatsapp} onChange={(e) => onChange({ whatsapp: e.target.value })} inputMode="tel" maxLength={30} />
          </div>
          <div className="sm:col-span-2">
            <Label>E-mail</Label>
            <Input type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} maxLength={150} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 bg-gold/5">
            <div>
              <div className="font-medium text-sm">Cliente VIP</div>
              <div className="text-xs text-muted-foreground">Destacado no sistema</div>
            </div>
            <Switch checked={value.vip} onCheckedChange={(b) => onChange({ vip: b })} />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Endereço</h2>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <div className="col-span-2 sm:col-span-2">
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input
                value={value.cep}
                onChange={(e) => onCepChange(e.target.value)}
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
              />
              <Button type="button" variant="outline" onClick={buscarCep} disabled={cepLoading} size="icon" title="Buscar CEP">
                {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Auto-preenche rua, bairro, cidade e estado.</p>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label>Avenida / Rua</Label>
            <Input value={value.rua} onChange={(e) => onChange({ rua: e.target.value })} maxLength={150} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Número</Label>
            <Input value={value.numero} onChange={(e) => onChange({ numero: e.target.value })} maxLength={20} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label>Complemento</Label>
            <Input value={value.complemento} onChange={(e) => onChange({ complemento: e.target.value })} maxLength={80} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label>Bairro</Label>
            <Input value={value.bairro} onChange={(e) => onChange({ bairro: e.target.value })} maxLength={80} />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Label>Cidade</Label>
            <Input value={value.cidade} onChange={(e) => onChange({ cidade: e.target.value })} maxLength={80} />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <Label>Estado</Label>
            <Input maxLength={2} value={value.estado} onChange={(e) => onChange({ estado: e.target.value.toUpperCase() })} placeholder="UF" />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Extras</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Indicação / Como conheceu</Label>
            <Input value={value.indicacao} onChange={(e) => onChange({ indicacao: e.target.value })} maxLength={120} placeholder="Quem indicou ou como chegou até nós?" />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={value.observacoes} onChange={(e) => onChange({ observacoes: e.target.value })} rows={3} maxLength={1000} />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function clienteFormFromRow(row: any): ClienteFormState {
  return {
    nome: row?.nome ?? "",
    cpf: row?.cpf ?? "",
    nascimento: row?.nascimento ?? "",
    telefone: row?.telefone ?? "",
    whatsapp: row?.whatsapp ?? "",
    email: row?.email ?? "",
    cep: row?.cep ?? "",
    rua: row?.rua ?? "",
    numero: row?.numero ?? "",
    complemento: row?.complemento ?? "",
    bairro: row?.bairro ?? "",
    cidade: row?.cidade ?? "",
    estado: row?.estado ?? "",
    observacoes: row?.observacoes ?? "",
    indicacao: row?.indicacao ?? "",
    vip: !!row?.vip,
  };
}

export function clienteFormToInsert(f: ClienteFormState) {
  const clean = (s?: string) => (s && s.trim() ? s.trim() : null);
  return {
    nome: f.nome.trim(),
    cpf: clean(f.cpf),
    nascimento: clean(f.nascimento),
    telefone: clean(f.telefone),
    whatsapp: clean(f.whatsapp),
    email: clean(f.email),
    cep: clean(f.cep),
    rua: clean(f.rua),
    numero: clean(f.numero),
    complemento: clean(f.complemento),
    bairro: clean(f.bairro),
    cidade: clean(f.cidade),
    estado: clean(f.estado),
    observacoes: clean(f.observacoes),
    indicacao: clean(f.indicacao),
    vip: f.vip,
  };
}
