import React from "react";
import {
  Calendar,
  Users,
  DollarSign,
  Gift,
  FileText,
  Bell,
  History,
  Settings,
  PlusCircle,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface JessiSidebarProps {
  onNovaConversa: () => void;
  onSelecionarModulo: (modulo: string) => void;
  moduloAtivo: string;
}

export const JessiSidebar: React.FC<JessiSidebarProps> = ({
  onNovaConversa,
  onSelecionarModulo,
  moduloAtivo,
}) => {
  const itensNav = [
    { id: "rotina", label: "Minha Rotina", icon: LayoutDashboard },
    { id: "agenda", label: "Agenda & Horários", icon: Calendar },
    { id: "clientes", label: "Clientes & Pets", icon: Users },
    { id: "financeiro", label: "Financeiro & KPIs", icon: DollarSign },
    { id: "programas", label: "Clubinho", icon: Gift },
    { id: "comprovantes", label: "Comprovantes Pix", icon: FileText },
    { id: "alertas", label: "Alertas & Cobrança", icon: Bell },
    { id: "historico", label: "Auditoria & Qualidade", icon: History },
  ];

  return (
    <aside className="w-60 border-r border-border/70 bg-card/70 backdrop-blur-xs flex flex-col h-full text-xs">
      <div className="p-3 border-b border-border/70">
        <Button
          onClick={onNovaConversa}
          className="w-full bg-emerald-800 hover:bg-emerald-900 text-white text-xs h-9 gap-1.5 font-semibold rounded-xl shadow-xs"
        >
          <PlusCircle className="h-4 w-4" />
          Nova Conversa
        </Button>
      </div>

      <div className="flex-1 p-2 space-y-1 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          Módulos Rápidos
        </div>
        {itensNav.map((item) => {
          const Icon = item.icon;
          const isAtivo = moduloAtivo === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelecionarModulo(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-medium transition-all ${
                isAtivo
                  ? "bg-emerald-100/70 text-emerald-900 font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isAtivo ? "text-emerald-800" : "text-muted-foreground"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border/70 flex items-center justify-between text-muted-foreground text-[11px]">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-emerald-700" />
          Jessi v2.0
        </span>
      </div>
    </aside>
  );
};
