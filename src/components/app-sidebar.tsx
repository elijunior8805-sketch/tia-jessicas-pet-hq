import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Scissors,
  Truck,
  Wallet,
  Receipt,
  Package,
  ShoppingCart,
  Building2,
  BarChart3,
  MessageSquare,
  HandCoins,
  Settings,
  PawPrint,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
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
      { title: "Comunicação / IA", url: "/comunicacao", icon: MessageSquare },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => pathname === u || pathname.startsWith(u + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <PawPrint className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-sidebar-foreground truncate">Tia Jéssica</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Spa de Pet</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-4 py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="px-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50 px-2">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url as string} className="relative flex items-center gap-2">
                          {active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gold" />
                          )}
                          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
