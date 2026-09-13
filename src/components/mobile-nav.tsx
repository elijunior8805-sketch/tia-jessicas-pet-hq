import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Menu,
  Scissors,
  Truck,
  Wallet,
  Receipt,
  Package,
  ShoppingCart,
  Building2,
  BarChart3,
  MessageSquare,
  Inbox,
  HandCoins,
  HeartHandshake,
  BellRing,
  Megaphone,
  Settings,
  PawPrint,
  Cake,
  PackageCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import logoAsset from "@/assets/spa-de-pet-logo.png.asset.json";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Item = { title: string; url: string; icon: LucideIcon };

const primary: Item[] = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Jessi IA", url: "/jessi", icon: Sparkles },
  { title: "Clientes", url: "/clientes", icon: Users },
];

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Operação",
    items: [
      { title: "Jessi IA", url: "/jessi", icon: Sparkles },
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", url: "/agenda", icon: Calendar },
      { title: "Atendimentos", url: "/atendimentos", icon: ClipboardList },
      { title: "Clientes e Pets", url: "/clientes", icon: Users },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Serviços", url: "/servicos", icon: Scissors },
      { title: "Clubinho", url: "/gestao/programas-cuidado", icon: PackageCheck },
      { title: "Leva e Traz", url: "/leva-traz", icon: Truck },
      { title: "Financeiro", url: "/financeiro", icon: Wallet },
      { title: "Pagamentos em aberto", url: "/pagamentos-abertos", icon: Receipt },
      { title: "Estoque", url: "/estoque", icon: Package },
      { title: "Compras", url: "/compras", icon: ShoppingCart },
      { title: "Fornecedores", url: "/fornecedores", icon: Building2 },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Central de Mensagens", url: "/inbox", icon: Inbox },
      { title: "Cobranças", url: "/cobrancas", icon: HandCoins },
      { title: "Lembretes", url: "/lembretes", icon: BellRing },
      { title: "Aniversários", url: "/aniversarios", icon: Cake },
      { title: "Reativação", url: "/reativacao", icon: HeartHandshake },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone },
      { title: "Comunicação / IA", url: "/comunicacao", icon: MessageSquare },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => pathname === u || pathname.startsWith(u + "/");

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-sidebar-border/80 bg-sidebar/95 backdrop-blur-md text-sidebar-foreground shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 h-16 items-center">
          {primary.map((item) => {
            const active = isActive(item.url);
            return (
              <li key={item.url} className="min-w-0 h-full">
                <Link
                  to={item.url}
                  className={`flex flex-col items-center justify-center gap-1 h-full w-full py-1 text-[11px] font-medium tracking-tight transition-all active:scale-90 touch-manipulation select-none ${
                    active
                      ? "text-sidebar-primary font-bold"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  }`}
                >
                  <div className={`p-1 rounded-full transition-all ${active ? "bg-sidebar-accent/80 text-sidebar-primary ring-1 ring-sidebar-border" : ""}`}>
                    <item.icon className="h-5 w-5 shrink-0" />
                  </div>
                  <span className="truncate max-w-full px-0.5 leading-none">{item.title}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 h-full">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="w-full h-full flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium tracking-tight text-sidebar-foreground/70 hover:text-sidebar-foreground transition-all active:scale-90 touch-manipulation select-none"
                >
                  <div className="p-1 rounded-full">
                    <Menu className="h-5 w-5 shrink-0" />
                  </div>
                  <span className="leading-none">Menu</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[88%] max-w-sm bg-sidebar text-sidebar-foreground border-sidebar-border p-0"
              >
                <SheetHeader className="px-5 pt-5 pb-4 border-b border-sidebar-border">
                  <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-white shadow-sm ring-1 ring-sidebar-border overflow-hidden">
                      <img src={logoAsset.url} alt="Spa de Pet Tia Jéssica" className="h-8 w-8 object-contain" />
                    </span>
                    <span className="flex flex-col text-left">
                      <span className="font-display text-base font-semibold">Tia Jéssica</span>
                      <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
                        Spa de Pet
                      </span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto max-h-[calc(100vh-5rem)] px-3 py-3">
                  {groups.map((g) => (
                    <div key={g.label} className="mb-4">
                      <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">
                        {g.label}
                      </div>
                      <ul className="space-y-1">
                        {g.items.map((item) => {
                          const active = isActive(item.url);
                          return (
                            <li key={item.url}>
                              <Link
                                to={item.url}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 min-h-[48px] text-sm font-medium transition-all active:scale-[0.98] touch-manipulation ${
                                  active
                                    ? "bg-sidebar-accent text-sidebar-primary font-semibold shadow-2xs"
                                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60"
                                }`}
                              >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
      {/* Espaço para o conteúdo não ficar atrás da barra */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(4.25rem + env(safe-area-inset-bottom))" }}
      />
    </>
  );
}
