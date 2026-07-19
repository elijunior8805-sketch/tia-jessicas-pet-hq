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
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
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
  { title: "Clientes", url: "/clientes", icon: Users },
];

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Operação",
    items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", url: "/agenda", icon: Calendar },
      { title: "Clientes e Pets", url: "/clientes", icon: Users },
      { title: "Serviços", url: "/servicos", icon: Scissors },
      { title: "Leva e Traz", url: "/leva-traz", icon: Truck },
    ],
  },
  {
    label: "Gestão",
    items: [
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
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-sidebar-border bg-sidebar text-sidebar-foreground"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(item.url);
            return (
              <li key={item.url} className="min-w-0">
                <Link
                  to={item.url}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition-colors ${
                    active
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate max-w-full px-1">{item.title}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-wide text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  <Menu className="h-5 w-5 shrink-0" />
                  <span>Menu</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[86%] max-w-sm bg-sidebar text-sidebar-foreground border-sidebar-border p-0"
              >
                <SheetHeader className="px-5 pt-5 pb-4 border-b border-sidebar-border">
                  <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <PawPrint className="h-5 w-5" />
                    </span>
                    <span className="flex flex-col text-left">
                      <span className="font-display text-base font-semibold">Tia Jéssica</span>
                      <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
                        Spa de Pet
                      </span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto max-h-[calc(100vh-5rem)] px-2 py-3">
                  {groups.map((g) => (
                    <div key={g.label} className="mb-4">
                      <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                        {g.label}
                      </div>
                      <ul className="space-y-0.5">
                        {g.items.map((item) => {
                          const active = isActive(item.url);
                          return (
                            <li key={item.url}>
                              <Link
                                to={item.url}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                                  active
                                    ? "bg-sidebar-accent text-sidebar-primary"
                                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60"
                                }`}
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
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
