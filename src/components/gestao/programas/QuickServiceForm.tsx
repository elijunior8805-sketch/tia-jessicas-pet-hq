import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertServico } from "@/lib/servicos.functions";
import { Scissors, Clock, Info } from "lucide-react";

interface QuickServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (servico: any) => void;
}

export function QuickServiceForm({ open, onOpenChange, onSuccess }: QuickServiceFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("0");
  const [duracao, setDuracao] = useState("60");
  const [descricao, setDescricao] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => upsertServico({ data }),
    onSuccess: (data) => {
      toast.success("Serviço criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      onSuccess?.(data);
      onOpenChange(false);
      reset();
    },
    onError: (err: any) => {
      toast.error("Erro ao criar serviço: " + err.message);
    }
  });

  const reset = () => {
    setNome("");
    setValor("0");
    setDuracao("60");
    setDescricao("");
  };

  const handleSave = () => {
    if (!nome) {
      toast.error("O nome do serviço é obrigatório");
      return;
    }
    mutation.mutate({
      nome,
      valor: Number(valor),
      duracao_min: Number(duracao),
      descricao,
      ativo: true,
      is_combo: false
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-gold" />
            Novo Serviço
          </DialogTitle>
          <DialogDescription>
            Cadastre rapidamente um serviço para incluí-lo no programa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="q-nome">Nome do Serviço</Label>
            <Input 
              id="q-nome" 
              placeholder="Ex: Banho Premium" 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="q-valor">Valor Padrão (R$)</Label>
              <Input 
                id="q-valor" 
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="q-duracao">Duração (min)</Label>
              <div className="relative">
                <Input 
                  id="q-duracao" 
                  type="number"
                  className="pr-10"
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                />
                <Clock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="q-desc">Descrição Curta</Label>
            <Textarea 
              id="q-desc" 
              placeholder="O que está incluso neste serviço?" 
              className="resize-none h-20"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            className="bg-gold hover:bg-gold/90 text-white" 
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : "Criar Serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
