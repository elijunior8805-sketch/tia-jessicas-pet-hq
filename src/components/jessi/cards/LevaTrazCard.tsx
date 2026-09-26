import React, { useState } from "react";
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageSquare, 
  Clock,
  Send,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotaLevaTrazResult, ParadaRota } from "@/lib/ia/tools/leva-traz-tools";

interface LevaTrazCardProps {
  data: RotaLevaTrazResult | any;
  onActionClick?: (command: string) => void;
}

export const LevaTrazCard: React.FC<LevaTrazCardProps> = ({ data, onActionClick }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedItinerario, setCopiedItinerario] = useState(false);

  const rota = data as RotaLevaTrazResult;
  const paradas: ParadaRota[] = rota?.paradas || [];

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyItinerario = () => {
    if (rota?.resumoMotoristaWhatsapp) {
      navigator.clipboard.writeText(rota.resumoMotoristaWhatsapp);
      setCopiedItinerario(true);
      toast.success("Itinerário completo copiado para envio ao motorista!");
      setTimeout(() => setCopiedItinerario(false), 2500);
    }
  };

  const handleOpenWhatsApp = (url?: string, textFallback?: string) => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (textFallback) {
      navigator.clipboard.writeText(textFallback);
      toast.info("Texto copiado! Adicione o telefone para abrir o WhatsApp.");
    }
  };

  if (!rota || paradas.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground text-center">
        Nenhuma corrida de Leva e Traz encontrada para esta data.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Header do Card com Resumo Logístico */}
      <div className="rounded-2xl border border-emerald-800/30 bg-emerald-950/10 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold">
              <Truck className="h-4 w-4 text-[#F5E6BE]" />
            </div>
            <div>
              <span className="font-bold text-foreground block text-sm">
                Itinerário Otimizado · {rota.data}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {rota.totalParadas} paradas ({rota.totalBuscas} buscas · {rota.totalEntregas} entregas)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {rota.googleMapsUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(rota.googleMapsUrl, "_blank", "noopener,noreferrer")}
                className="h-7 px-2.5 text-[11px] border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 rounded-lg gap-1 font-semibold"
              >
                <Navigation className="h-3 w-3" /> Abrir Maps
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleCopyItinerario}
              className="h-7 px-2.5 text-[11px] bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg gap-1 font-medium"
            >
              {copiedItinerario ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedItinerario ? "Copiado!" : "Copiar p/ Motorista"}
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Paradas da Rota */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {paradas.map((p) => {
          const isBusca = p.tipo === "busca";
          const corBadge = isBusca 
            ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200" 
            : "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200";

          return (
            <div
              key={p.id}
              className="p-3 rounded-xl border border-border bg-card shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-foreground">
                      {p.ordem}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${corBadge}`}>
                      {isBusca ? "🟢 Busca" : "🏠 Entrega"} · {p.horarioEstimado}
                    </span>
                    <span className="font-bold text-foreground">{p.petNome}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block pl-7">
                    Tutor: {p.clienteNome} {p.telefone ? `• ${p.telefone}` : ""}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground pl-7">
                    <MapPin className="h-3 w-3 shrink-0 text-emerald-700" />
                    <span className="truncate">{p.enderecoCompleto}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyText(p.id, p.mensagemWhatsapp)}
                    className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground"
                    title="Copiar aviso"
                  >
                    {copiedId === p.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleOpenWhatsApp(p.whatsappUrl, p.mensagemWhatsapp)}
                    className="h-6 px-2 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-md gap-1"
                  >
                    <MessageSquare className="h-2.5 w-2.5" /> Aviso
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
