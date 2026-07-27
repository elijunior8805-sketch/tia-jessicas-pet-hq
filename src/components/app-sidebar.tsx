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
  Inbox,
  HandCoins,
  HeartHandshake,
  BellRing,
  Megaphone,
  Settings,
  Shield,
  ShieldAlert,
  PawPrint,
  Cake,
} from "lucide-react";
import logoAsset from "@/assets/spa-de-pet-logo.png.asset.json";
import { useMyAccess } from "@/hooks/use-my-permissions";
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
      { title: "Atendimentos", url: "/atendimentos", icon: ClipboardList },
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
      { title: "Cobranças", url: "/cobrancas", icon: HandCoins },
      { title: "Estoque", url: "/estoque", icon: Package },
      { title: "Compras", url: "/compras", icon: ShoppingCart },
      { title: "Fornecedores", url: "/fornecedores", icon: Building2 },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Verificação de totais", url: "/verificacao", icon: ShieldCheck },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Central de Mensagens", url: "/inbox", icon: Inbox },
      { title: "Lembretes", url: "/lembretes", icon: BellRing },
      { title: "Aniversários", url: "/aniversarios", icon: Cake },
      { title: "Reativação", url: "/reativacao", icon: HeartHandshake },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone },
      { title: "Comunicação / IA", url: "/comunicacao", icon: MessageSquare },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

const adminGroup = {
  label: "Segurança",
  items: [
    { title: "Usuários e Acessos", url: "/usuarios", icon: Shield },
    { title: "Auditoria de Acessos", url: "/auditoria-acessos", icon: ShieldAlert },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => pathname === u || pathname.startsWith(u + "/");
  const { data: access } = useMyAccess();
  const visibleGroups = access?.canManageUsers ? [...groups, adminGroup] : groups;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm ring-1 ring-sidebar-border overflow-hidden">
            <img src={logoAsset.url} alt="Spa de Pet Tia Jéssica" className="h-8 w-8 object-contain" />
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
        {visibleGroups.map((g) => (
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
