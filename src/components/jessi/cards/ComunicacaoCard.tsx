import React, { useState } from "react";
import { MessageSquare, Send, Copy, Check, ExternalLink, User, Phone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { abrirWhatsApp, formatarTelefoneBR } from "@/lib/whatsapp";

interface ComunicacaoCardProps {
  data: {
    mensagemFormatada?: string;
    urlWhatsApp?: string;
    telefoneFormatado?: string;
    cliente?: string;
    pet?: string;
    tipoMensagem?: string;
  };
  onActionClick?: (comando: string) => void;
}

const TIPO_LABEL_MAP: Record<string, { label: string; color: string }> = {
  lembrete_agenda: { label: "Lembrete de Horário", color: "bg-blue-100 text-blue-800 border-blue-200" },
  pet_pronto: { label: "Pet Pronto", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  confirmacao_pix: { label: "Confirmação Pix", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  reativacao_carinho: { label: "Reativação / Saudade", color: "bg-purple-100 text-purple-800 border-purple-200" },
  cobranca: { label: "Cobrança / Pendência", color: "bg-amber-100 text-amber-800 border-amber-200" },
};

export const ComunicacaoCard: React.FC<ComunicacaoCardProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const mensagem = data?.mensagemFormatada || "";
  const cliente = data?.cliente || "Cliente";
  const pet = data?.pet;
  const telefone = data?.telefoneFormatado;
  const urlWhatsApp = data?.urlWhatsApp;
  const tipoInfo = (data?.tipoMensagem && TIPO_LABEL_MAP[data.tipoMensagem]) || {
    label: "WhatsApp",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  const handleCopiar = async () => {
    if (!mensagem) return;
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopied(true);
      toast.success("Mensagem copiada para a área de transferência!");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleEnviarWhatsApp = () => {
    if (urlWhatsApp) {
      abrirWhatsApp(urlWhatsApp);
    } else {
      toast.error("Telefone não disponível para abrir no WhatsApp.");
    }
  };

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-linear-to-br from-emerald-50/50 via-background to-background p-4 space-y-3.5 text-xs shadow-xs">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[#25D366]">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              Mensagem WhatsApp
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {cliente} {pet ? `(Pet: ${pet})` : ""}
            </span>
          </div>
        </div>
        <Badge className={`${tipoInfo.color} text-[10px] font-medium`}>
          {tipoInfo.label}
        </Badge>
      </div>

      {/* Conteúdo da Mensagem */}
      <div className="relative rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100/90 dark:border-emerald-900/40 p-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">
        <div className="absolute top-2 right-2 text-emerald-600/40">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        {mensagem}
      </div>

      {/* Info do Destinatário */}
      {telefone && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Phone className="h-3 w-3 text-emerald-600" />
          <span>Destinatário: <strong className="text-foreground">{formatarTelefoneBR(telefone)}</strong></span>
        </div>
      )}

      {/* Ações / Botões */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {urlWhatsApp ? (
          <Button
            type="button"
            size="sm"
            onClick={handleEnviarWhatsApp}
            className="flex-1 min-w-[140px] bg-[#25D366] hover:bg-[#1EBE5D] text-white font-medium text-xs shadow-xs gap-1.5 transition-all cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar no WhatsApp
            <ExternalLink className="h-3 w-3 opacity-80" />
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopiar}
          className={`text-xs font-medium gap-1.5 border-border hover:bg-muted/80 cursor-pointer ${!urlWhatsApp ? "w-full" : ""}`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Copiar Mensagem
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
