import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Share2,
  CheckCircle2,
  Eye,
  RefreshCw,
  Sparkles,
  Phone,
  AlertCircle,
} from "lucide-react";
import {
  TermoProgramaData,
  visualizarTermoProgramaPDF,
  baixarTermoProgramaPDF,
  compartilharTermoWhatsApp,
} from "@/lib/programa-termo-pdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TermoPosVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termoData: TermoProgramaData | null;
  onSuccess?: () => void;
}

export function TermoPosVendaDialog({
  open,
  onOpenChange,
  termoData,
  onSuccess,
}: TermoPosVendaDialogProps) {
  const [gerando, setGerando] = useState(false);
  const [encaminhado, setEncaminhado] = useState(false);
  const [salvandoEncaminhamento, setSalvandoEncaminhamento] = useState(false);

  if (!termoData) return null;

  const numContrato =
    termoData.numero_contrato || `PC-${termoData.contrato_id.slice(0, 8).toUpperCase()}`;

  const handleVisualizar = async () => {
    try {
      setGerando(true);
      await visualizarTermoProgramaPDF(termoData);
    } catch (err: any) {
      toast.error("Erro ao visualizar PDF: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleBaixar = async () => {
    try {
      setGerando(true);
      await baixarTermoProgramaPDF(termoData);
    } catch (err: any) {
      toast.error("Erro ao baixar PDF: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleCompartilhar = async () => {
    try {
      setGerando(true);
      await compartilharTermoWhatsApp(termoData);
    } catch (err: any) {
      toast.error("Erro ao compartilhar: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  const handleMarcarEncaminhado = async () => {
    try {
      setSalvandoEncaminhamento(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("auditoria_programas" as any).insert({
        acao: "termo_encaminhado_manual",
        cliente_id: termoData.contrato_id,
        programa_contratado_id: termoData.contrato_id,
        motivo: `Termo ${numContrato} marcado como encaminhado para o WhatsApp (${termoData.tutor_telefone || "não informado"})`,
        usuario_id: user?.id,
        created_at: new Date().toISOString(),
      });

      setEncaminhado(true);
      toast.success("Marcado como encaminhado com sucesso!");
      onSuccess?.();
    } catch (err: any) {
      toast.error("Erro ao registrar marcação: " + err.message);
    } finally {
      setSalvandoEncaminhamento(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 bg-gradient-to-br from-[#123F2A] to-[#1B5E20] text-white">
          <div className="flex items-center justify-between mb-1">
            <Badge className="bg-[#C8A951] text-emerald-950 font-bold text-[10px] border-none">
              Venda Concluída com Sucesso
            </Badge>
            <span className="text-xs text-white/80 font-mono font-bold">{numContrato}</span>
          </div>
          <DialogTitle className="text-lg font-bold font-display text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#C8A951]" />
            Termo de Adesão — Clubinho
          </DialogTitle>
          <DialogDescription className="text-xs text-white/80">
            A adesão ao Clubinho foi registrada no banco de dados. O PDF oficial já está pronto para visualização, download e compartilhamento.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 text-xs">
          {/* Card Resumo */}
          <div className="p-4 rounded-2xl bg-[#F5F2EA] border border-[#C8A951]/30 space-y-2.5 text-foreground">
            <div className="flex justify-between items-center border-b border-border/60 pb-2">
              <span className="text-muted-foreground font-medium">Tutor / Contratante:</span>
              <span className="font-bold text-foreground">{termoData.tutor_nome}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/60 pb-2">
              <span className="text-muted-foreground font-medium">Pet Vinculado (Exclusivo):</span>
              <span className="font-bold text-emerald-900">🐾 {termoData.pet_nome}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/60 pb-2">
              <span className="text-muted-foreground font-medium">Plano do Clubinho:</span>
              <span className="font-bold text-foreground">{termoData.programa_nome}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/60 pb-2">
              <span className="text-muted-foreground font-medium">Validade:</span>
              <span className="font-bold text-emerald-900">
                {termoData.data_inicio.slice(0, 10).split("-").reverse().join("/")} até{" "}
                {termoData.data_validade.slice(0, 10).split("-").reverse().join("/")} (30 dias)
              </span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-muted-foreground font-medium">Valor Final:</span>
              <span className="text-base font-bold text-emerald-950">
                R$ {termoData.valor_final.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Telefone para envio */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-800" />
              <span>
                WhatsApp:{" "}
                <strong className="text-foreground">
                  {termoData.tutor_telefone || "Não cadastrado"}
                </strong>
              </span>
            </div>
            {encaminhado ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                ✓ Encaminhado
              </Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarcarEncaminhado}
                disabled={salvandoEncaminhamento}
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Marcar como encaminhado
              </Button>
            )}
          </div>

          {/* Ações Principais do PDF */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <Button
              variant="outline"
              onClick={handleVisualizar}
              disabled={gerando}
              className="h-10 text-xs rounded-xl border-border/80 font-medium gap-1.5 hover:bg-muted/50"
            >
              <Eye className="h-4 w-4 text-emerald-800" /> Visualizar Termo
            </Button>

            <Button
              variant="outline"
              onClick={handleBaixar}
              disabled={gerando}
              className="h-10 text-xs rounded-xl border-border/80 font-medium gap-1.5 hover:bg-muted/50"
            >
              <Download className="h-4 w-4 text-emerald-800" /> Baixar PDF
            </Button>

            <Button
              onClick={handleCompartilhar}
              disabled={gerando}
              className="h-10 text-xs bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-xs gap-1.5"
            >
              <Share2 className="h-4 w-4" /> Compartilhar WhatsApp
            </Button>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl text-muted-foreground hover:text-foreground"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
