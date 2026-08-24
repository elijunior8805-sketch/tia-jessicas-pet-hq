import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertPrograma } from "@/lib/programas-cuidado.functions";
import { PackageCheck, Save } from "lucide-react";

interface ProgramaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: any;
}

export function ProgramaFormDialog({ open, onOpenChange, initial }: ProgramaFormDialogProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(initial?.nome || "");
  const [descricao, setDescricao] = useState(initial?.descricao || "");
  const [preco, setPreco] = useState(initial?.preco_do_programa || "0");
  const [validade, setValidade] = useState(initial?.validade_em_dias || "30");

  const mutation = useMutation({
    mutationFn: (data: any) => upsertPrograma({ data }),
    onSuccess: () => {
      toast.success("Programa salvo com sucesso");
      queryClient.invalidateQueries({ queryKey: ["programas-catalogo"] });
      onOpenChange(false);
    }
  });

  const handleSave = () => {
    mutation.mutate({
      id: initial?.id,
      nome,
      descricao,
      status: "ativo",
      preco_do_programa: Number(preco),
      valor_normal_dos_servicos: Number(preco),
      economia: 0,
      validade_em_dias: Number(validade),
      permite_parcelamento: true,
      inclui_transporte: false,
      itens: [] // Simplified for now
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PackageCheck className="h-6 w-6 text-gold" />
            {initial ? "Editar Programa" : "Novo Programa"}
          </DialogTitle>
          <DialogDescription>Preencha os dados do programa de cuidado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nome do Programa</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Rotina em Dia" />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que o programa inclui?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor (R$)</Label>
              <Input type="number" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Validade (Dias)</Label>
              <Input type="number" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-gold hover:bg-gold/90 text-white" onClick={handleSave} disabled={mutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? "Salvando..." : "Salvar Programa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
